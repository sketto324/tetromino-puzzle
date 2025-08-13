document.addEventListener('DOMContentLoaded', () => {
    const BOARD_ROWS = 8;
    const BOARD_COLS = 5;
    const gameBoard = document.getElementById('game-board');
    const piecesContainer = document.getElementById('pieces-container');
    const resetButton = document.getElementById('reset-button');
    const messageContainer = document.getElementById('message-container');
    const helpButton = document.getElementById('help-button');
    const helpModal = document.getElementById('help-modal');
    const closeButton = document.querySelector('.close-button');

    // テトロミノの定義 (形状, 色, ID)
    const TETROMINOS = [
        { name: 'I', shape: [[1, 1, 1, 1]], color: 'I' }, // I型
        { name: 'O', shape: [[1, 1], [1, 1]], color: 'O' }, // O型
        { name: 'L', shape: [[0, 0, 1], [1, 1, 1]], color: 'L' }, // L型
        { name: 'S', shape: [[0, 1, 1], [1, 1, 0]], color: 'S' }, // S型
        { name: 'T', shape: [[0, 1, 0], [1, 1, 1]], color: 'T' }  // T型
    ];

    let boardState = [];
    let pieces = [];
    let draggedPiece = null; // ドラッグ中のピースを保持する変数
    let lastPointerDown = { time: 0, id: null, timer: null }; // クリック/タップのタイミング管理用

    // ゲームの初期化
    function init() {
        gameBoard.innerHTML = '';
        piecesContainer.innerHTML = '';
        messageContainer.textContent = '';
        boardState = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(0));

        createBoard();
        createPieces();
    }

    // ゲームボードの生成
    function createBoard() {
        for (let i = 0; i < BOARD_ROWS * BOARD_COLS; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.row = Math.floor(i / BOARD_COLS);
            cell.dataset.col = i % BOARD_COLS;
            gameBoard.appendChild(cell);
        }
    }

    // ピースの生成
    function createPieces() {
        const tempPieces = [];
        let pieceIdCounter = 0;
        TETROMINOS.forEach(tetromino => {
            for (let i = 0; i < 2; i++) { // 各ピースを2つずつ生成
                const piece = {
                    ...tetromino,
                    id: pieceIdCounter, // ユニークなID (0-9)
                    isPlaced: false,
                    currentShape: tetromino.shape
                };
                const pieceElement = createPieceElement(piece);
                piece.element = pieceElement;
                tempPieces.push(piece);
                pieceIdCounter++;
            }
        });

        // Fisher-Yatesアルゴリズムでピースの配列をシャッフル
        for (let i = tempPieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tempPieces[i], tempPieces[j]] = [tempPieces[j], tempPieces[i]];
        }

        // シャッフルされたピースをグローバル変数に格納し、DOMに追加
        pieces = tempPieces;
        pieces.forEach(p => piecesContainer.appendChild(p.element));
    }

    // ピースのDOM要素を生成
    function createPieceElement(piece) {
        const el = document.createElement('div');
        el.classList.add('piece');
        el.dataset.id = piece.id;
        el.draggable = true;
        
        drawPieceOnElement(el, piece.currentShape, piece.color);

        // --- イベントリスナー ---
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);
        
        // PC: クリックで回転
        el.addEventListener('click', (e) => {
            // 意図しないイベント発火を防ぐ
            if (e.pointerType === 'touch') return;
            const pieceData = pieces.find(p => p.id == piece.id);
            if (pieceData?.isPlaced) return;
            rotatePiece(piece.id);
        });

        // PC: 右クリックで反転
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const pieceData = pieces.find(p => p.id == piece.id);
            if (pieceData?.isPlaced) return;
            flipPiece(piece.id);
        });

        // Mobile: タッチ操作（タップで回転、ダブルタップで反転）
        el.addEventListener('touchstart', handleTouchStart, { passive: false });

        return el;
    }

    // ピースの形状をDOM要素に描画
    function drawPieceOnElement(element, shape, color) {
        element.innerHTML = '';
        const rows = shape.length;
        const cols = shape[0].length;
        element.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        element.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        element.style.width = `calc(var(--cell-size) * ${cols} * 0.8)`;
        element.style.height = `calc(var(--cell-size) * ${rows} * 0.8)`;

        shape.forEach(row => {
            row.forEach(cell => {
                const mino = document.createElement('div');
                if (cell) {
                    mino.classList.add('mino', color);
                }
                element.appendChild(mino);
            });
        });
    }

    // ピースの回転
    function rotatePiece(pieceId) {
        const piece = pieces.find(p => p.id == pieceId);
        if (piece.isPlaced) return;
        
        const shape = piece.currentShape;
        const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        piece.currentShape = newShape;
        drawPieceOnElement(piece.element, piece.currentShape, piece.color);
    }

    // ピースの反転
    function flipPiece(pieceId) {
        const piece = pieces.find(p => p.id == pieceId);
        if (piece.isPlaced) return;

        const shape = piece.currentShape;
        const newShape = shape.map(row => row.slice().reverse());
        piece.currentShape = newShape;
        drawPieceOnElement(piece.element, piece.currentShape, piece.color);
    }

    // --- ドラッグ＆ドロップのハンドラ ---

    function handleDragStart(e) {
        const pieceElement = e.target.closest('.piece');
        if (!pieceElement) return;

        const pieceId = pieceElement.dataset.id;
        e.dataTransfer.setData('text/plain', pieceId);
        draggedPiece = pieces.find(p => p.id == pieceId);

        // --- ドラッグ画像を見切れずに、掴んだ位置で表示するための処理 ---
        // 1. ピースの見た目を複製して、ドラッグ画像として使用する
        const dragImage = pieceElement.cloneNode(true);
        dragImage.id = 'drag-image'; // 後で削除するためにIDを付与
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px'; // 画面外に配置
        document.body.appendChild(dragImage);

        // 2. 掴んだ位置を`.piece`要素の左上からの相対座標で正確に計算する
        const containerRect = pieceElement.getBoundingClientRect();
        const xOffset = e.clientX - containerRect.left;
        const yOffset = e.clientY - containerRect.top;
        e.dataTransfer.setDragImage(dragImage, xOffset, yOffset);
        // --- ここまで ---

        setTimeout(() => pieceElement.classList.add('dragging'), 0);
    }

    function handleDragEnd(e) {
        // 作成したドラッグ画像を削除する
        document.getElementById('drag-image')?.remove();

        e.target.classList.remove('dragging');
        draggedPiece = null; // 保持しているピースをクリア
        clearGhostPreview(); // ドラッグ終了時にプレビューを確実に消す
    }

    // --- タッチ操作用のハンドラ ---
    function handleTouchStart(e) {
        e.preventDefault(); // 画面のスクロールを防ぐ
        const pieceElement = e.target.closest('.piece');
        if (!pieceElement) return;
        const pieceId = pieceElement.dataset.id;

        const pieceData = pieces.find(p => p.id == pieceId);
        if (pieceData?.isPlaced) return;

        // --- ダブルタップ判定 ---
        const currentTime = e.timeStamp;
        if (currentTime - lastPointerDown.time < 300 && lastPointerDown.id === pieceId) {
            // ダブルタップを検出
            clearTimeout(lastPointerDown.timer); // 保留中の回転をキャンセル
            flipPiece(pieceId);
            lastPointerDown = { time: 0, id: null, timer: null }; // 判定後にリセット
            return; // ダブルタップ完了なので、ここで処理を終了
        }
        // --- ダブルタップ判定ここまで ---

        let isDragging = false;
        let dragImage = null;
        draggedPiece = pieces.find(p => p.id == pieceId);

        const touchStartPoint = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };

        const touchMoveHandler = (moveEvent) => {
            const moveTouch = moveEvent.changedTouches[0];
            const deltaX = Math.abs(moveTouch.clientX - touchStartPoint.x);
            const deltaY = Math.abs(moveTouch.clientY - touchStartPoint.y);

            // 5px以上動いたらドラッグ開始とみなす
            if (!isDragging && (deltaX > 5 || deltaY > 5)) {
                isDragging = true;
                clearTimeout(lastPointerDown.timer); // ドラッグなのでタップではない
                lastPointerDown = { time: 0, id: null, timer: null }; // タップ情報をリセット
                pieceElement.classList.add('dragging');
                
                dragImage = pieceElement.cloneNode(true);
                dragImage.id = 'drag-image';
                dragImage.style.position = 'absolute';
                dragImage.style.left = '0'; // transformの基点を左上に設定
                dragImage.style.top = '0';
                dragImage.style.zIndex = '1000';
                dragImage.style.pointerEvents = 'none';
                dragImage.style.filter = 'none'; // パフォーマンスのために影を消す
                document.body.appendChild(dragImage);
            }

            if (isDragging) {
                const containerRect = pieceElement.getBoundingClientRect();
                const xOffset = touchStartPoint.x - containerRect.left;
                const yOffset = touchStartPoint.y - containerRect.top;
                
                const x = moveTouch.clientX - xOffset;
                const y = moveTouch.clientY - yOffset;
                dragImage.style.transform = `translate(${x}px, ${y}px)`;

                gameBoard.dispatchEvent(new MouseEvent('dragover', { clientX: moveTouch.clientX, clientY: moveTouch.clientY, bubbles: true }));
            }
        };

        const touchEndHandler = (endEvent) => {
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);

            if (isDragging) {
                const endTouch = endEvent.changedTouches[0];
                const elementUnder = document.elementFromPoint(endTouch.clientX, endTouch.clientY);
                elementUnder?.dispatchEvent(new DragEvent('drop', { dataTransfer: new DataTransfer(), bubbles: true }));
            } else {
                // シングルタップの可能性。タイマーをセット
                const timer = setTimeout(() => { rotatePiece(pieceId); }, 250);
                lastPointerDown = { time: currentTime, id: pieceId, timer: timer };
            }
            // 共通の後片付け処理
            handleDragEnd(endEvent); 
        };

        document.addEventListener('touchmove', touchMoveHandler);
        document.addEventListener('touchend', touchEndHandler);
    }

    function clearGhostPreview() {
        const ghostCells = document.querySelectorAll('.ghost-preview');
        ghostCells.forEach(cell => {
            cell.classList.remove('ghost-preview');
            // ピースの色クラスをすべて削除
            TETROMINOS.forEach(t => cell.classList.remove(t.color));
        });
    }

    gameBoard.addEventListener('dragover', (e) => {
        e.preventDefault();
        // マウスイベントとタッチイベントの両方から呼び出される
        const clientX = e.clientX ?? e.changedTouches?.[0].clientX;
        const clientY = e.clientY ?? e.changedTouches?.[0].clientY;
        const elementUnder = document.elementFromPoint(clientX, clientY);
        const cell = elementUnder?.closest('.grid-cell');

        // ドラッグ中のピースがないか、カーソルがセル上にない場合は何もしない
        if (!cell || !draggedPiece) return;

        clearGhostPreview();

        const piece = draggedPiece;
        const startRow = parseInt(cell.dataset.row);
        const startCol = parseInt(cell.dataset.col);

        // プレビューを描画
        if (canPlacePiece(piece, startRow, startCol)) {
            const shape = piece.currentShape;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        const boardRow = startRow + r;
                        const boardCol = startCol + c;
                        const ghostCell = gameBoard.querySelector(`[data-row='${boardRow}'][data-col='${boardCol}']`);
                        if (ghostCell) {
                            ghostCell.classList.add('ghost-preview', piece.color);
                        }
                    }
                }
            }
        }
    });

    // マウスがボードから離れたときにプレビューを消す
    gameBoard.addEventListener('dragleave', (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            clearGhostPreview();
        }
    });

    gameBoard.addEventListener('drop', (e) => {
        e.preventDefault();
        clearGhostPreview(); // プレビューを消す

        const cell = e.target.closest('.grid-cell');
        if (!cell) return;

        // マウスイベントとタッチイベントの両方に対応
        const pieceId = e.dataTransfer?.getData('text/plain') || draggedPiece?.id;
        if (pieceId === undefined) return;

        const piece = pieces.find(p => p.id == pieceId);
        const startRow = parseInt(cell.dataset.row);
        const startCol = parseInt(cell.dataset.col);

        if (canPlacePiece(piece, startRow, startCol)) {
            placePiece(piece, startRow, startCol);
        }
    });

    // ピースが配置可能かチェック
    function canPlacePiece(piece, startRow, startCol) {
        const shape = piece.currentShape;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const boardRow = startRow + r;
                    const boardCol = startCol + c;

                    // ボードの範囲外かチェック
                    if (boardRow >= BOARD_ROWS || boardCol >= BOARD_COLS) {
                        return false;
                    }
                    // 他のピースと重なるかチェック
                    if (boardState[boardRow][boardCol] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // ピースをボードに配置
    function placePiece(piece, startRow, startCol) {
        const shape = piece.currentShape;
        const pieceId = piece.id + 1; // 0は空きマスなので1から始める

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const boardRow = startRow + r;
                    const boardCol = startCol + c;
                    boardState[boardRow][boardCol] = pieceId;
                    const cell = gameBoard.querySelector(`[data-row='${boardRow}'][data-col='${boardCol}']`);
                    
                    // 以前のピースをクリア
                    cell.innerHTML = ''; // ハイライトなどを消去
                    const placedMino = document.createElement('div');
                    placedMino.classList.add('placed-mino', piece.color);
                    cell.appendChild(placedMino);
                }
            }
        }

        piece.isPlaced = true;
        piece.element.classList.add('placed'); // ピースリストから非表示にする

        checkWinCondition();
    }

    // 盤面からピースを戻す
    function removePiece(pieceId) {
        const piece = pieces.find(p => p.id == pieceId);
        if (!piece || !piece.isPlaced) return;

        const pieceIdToRemove = piece.id + 1;

        // 1. boardStateを更新し、盤面のDOMからミノを削除
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (boardState[r][c] === pieceIdToRemove) {
                    boardState[r][c] = 0;
                    const cell = gameBoard.querySelector(`[data-row='${r}'][data-col='${c}']`);
                    if (cell) {
                        cell.innerHTML = '';
                    }
                }
            }
        }

        // 2. ピースの状態を更新し、ピース置き場に再表示
        piece.isPlaced = false;
        piece.element.classList.remove('placed');

        // 3. クリアメッセージを消す
        messageContainer.textContent = '';
    }

    // 盤面クリックのハンドラ（ピースを戻すため）
    function handleBoardClick(e) {
        // クリックされた要素がセルか、セル内のミノかを確認
        const targetCell = e.target.closest('.grid-cell');
        if (!targetCell) return;

        const row = parseInt(targetCell.dataset.row);
        const col = parseInt(targetCell.dataset.col);

        const pieceIdOnBoard = boardState[row][col];
        if (pieceIdOnBoard > 0) {
            // boardStateのIDは1-based, 配列のindexは0-based
            removePiece(pieceIdOnBoard - 1);
        }
    }

    // クリア条件のチェック
    function checkWinCondition() {
        const allPlaced = pieces.every(p => p.isPlaced);
        if (allPlaced) {
            messageContainer.textContent = '🎉 コンプリート！おめでとうございます！ 🎉';
        }
    }

    // リセットボタンの処理
    resetButton.addEventListener('click', init);
    gameBoard.addEventListener('click', handleBoardClick);

    // ヘルプモーダルの処理
    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });
    closeButton.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    // モーダルの外側をクリックしたときに閉じる
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    // ゲーム開始
    init();
});
