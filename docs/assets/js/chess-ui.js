import init, { get_all_legal_moves, is_in_check } from '../../pkg/rust_engine.js';

await init();

const E = 0;    // Empty

const WP = 1;   // White Pawn
const WN = 2;   // White Knight
const WB = 3;   // White Bishop
const WR = 4;   // White Rook
const WQ = 5;   // White Queen
const WK = 6;   // White King

const BP = -1;  // Black Pawn
const BN = -2;  // Black Knight
const BB = -3;  // Black Bishop
const BR = -4;  // Black Rook
const BQ = -5;  // Black Queen
const BK = -6;  // Black King

const WHITE = 0;
const BLACK = 1;


// Mapping internal codes to Unicode
const PIECES = {
    [BP]: '♟', [BN]: '♞', [BB]: '♝', [BQ]: '♛', [BK]: '♚', [BR]: '♜',
    [WP]: '♙', [WN]: '♘', [WB]: '♗', [WQ]: '♕', [WK]: '♔', [WR]: '♖',
    [E]: ''
};

export class ChessBoard {
    constructor(elementId, wasmEngine) {
        this.container = document.getElementById(elementId);
        this.wasm = wasmEngine;
        this.selectedSquare = null;
        this.isPlayerTurn = true;
        this.turn = WHITE;
        this.legalMoves = new Map(); // Map<fromIndex, Set<toIndex>>

        this.board = [
            BR, BN, BB, BQ, BK, BB, BN, BR,
            BP, BP, BP, BP, BP, BP, BP, BP,
            E, E, E, E, E, E, E, E,
            E, E, E, E, E, E, E, E,
            E, E, E, E, E, E, E, E,
            E, E, E, E, E, E, E, E,
            WP, WP, WP, WP, WP, WP, WP, WP,
            WR, WN, WB, WQ, WK, WB, WN, WR
        ];

        this.updateLegalMoves();
        this.render();

        this.worker = new Worker(new URL('./chess-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.handleWorkerMessage(e);
        this.timerInterval = null;
    }

    updateLegalMoves() {
        this.legalMoves.clear();
        // get_all_legal_moves returns a flat array: [from_rank, from_file, to_rank, to_file, ...]
        // We need to convert these to indices (0-63)
        // Rust side: rank 0 is top (Black), rank 7 is bottom (White)
        // JS side: index = rank * 8 + file

        const movesFlat = get_all_legal_moves(this.board, this.turn);

        for (let i = 0; i < movesFlat.length; i += 4) {
            const fromRank = movesFlat[i];
            const fromFile = movesFlat[i + 1];
            const toRank = movesFlat[i + 2];
            const toFile = movesFlat[i + 3];

            const fromIdx = fromRank * 8 + fromFile;
            const toIdx = toRank * 8 + toFile;

            if (!this.legalMoves.has(fromIdx)) {
                this.legalMoves.set(fromIdx, new Set());
            }
            this.legalMoves.get(fromIdx).add(toIdx);
        }
        if (this.legalMoves.size === 0) {
            if (is_in_check(this.board, this.turn)) {
                alert(`Checkmate! ${this.turn === WHITE ? "Black" : "White"} wins!`);
            } else {
                alert("Stalemate! Game Draw.");
            }
            this.isPlayerTurn = false; // Disable moves
        }

        console.log("Legal moves updated:", this.legalMoves);
    }

    render() {
        this.container.innerHTML = ''; // Clear board

        this.board.forEach((piece, index) => {
            const square = document.createElement('div');

            // Calculate row/col for coloring
            const row = Math.floor(index / 8);
            const col = index % 8;
            const isDark = (row + col) % 2 === 1;

            square.className = `square ${isDark ? 'dark' : 'light'}`;
            square.innerText = PIECES[piece] || '';

            // Highlight if selected
            if (this.selectedSquare === index) {
                square.classList.add('selected');
            }

            // Highlight legal moves if a piece is selected
            if (this.selectedSquare !== null && this.legalMoves.has(this.selectedSquare)) {
                if (this.legalMoves.get(this.selectedSquare).has(index)) {
                    square.classList.add('selected'); // Add CSS class for highlighting
                    // Optional: Add a marker dot or similar
                }
            }

            square.onclick = () => this.handleClick(index);

            this.container.appendChild(square);
        });
    }

    playAiTurn() {
        console.log("AI is thinking...");
        const depthInput = document.getElementById('ai-depth');
        const depth = depthInput ? parseInt(depthInput.value) : 3;

        this.startTimer();

        this.worker.postMessage({
            board: this.board,
            color: BLACK,
            depth: depth
        });
    }

    startTimer() {
        const timerDisplay = document.getElementById('ai-timer');
        if (!timerDisplay) return;

        const startTime = performance.now();
        this.timerInterval = setInterval(() => {
            const current = performance.now();
            const duration = ((current - startTime) / 1000).toFixed(1);
            timerDisplay.innerText = `Thinking: ${duration}s`;
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    handleWorkerMessage(e) {
        this.stopTimer();
        const { type, move, error } = e.data;

        if (type === 'error') {
            console.error("AI Worker Error:", error);
            alert("AI Error: " + error);
            return;
        }

        const timerDisplay = document.getElementById('ai-timer');
        if (timerDisplay) {
            if (timerDisplay.innerText.startsWith("Thinking: ")) {
                timerDisplay.innerText = timerDisplay.innerText.replace("Thinking:", "Last move:");
            }
        }

        if (!move || move.length !== 4) {
            console.error("AI returned invalid move:", move);
            alert("Game Over or AI gave up!");
            return;
        }

        const fromRank = move[0];
        const fromFile = move[1];
        const toRank = move[2];
        const toFile = move[3];

        const from = fromRank * 8 + fromFile;
        const to = toRank * 8 + toFile;

        console.log(`AI moved: ${from} (${fromRank},${fromFile}) -> ${to} (${toRank},${toFile})`);

        this.board[to] = this.board[from];
        this.board[from] = E;

        this.turn = WHITE;
        this.isPlayerTurn = true;
        this.updateLegalMoves();
        this.render();
    }

    handleClick(index) {
        if (!this.isPlayerTurn) return;

        if (this.selectedSquare === null) {
            // If nothing selected, select.
            const piece = this.board[index];
            if (piece !== E) {
                const isWhitePiece = piece > 0;
                const isBlackPiece = piece < 0;
                if ((this.turn === WHITE && isWhitePiece) || (this.turn === BLACK && isBlackPiece)) {
                    this.selectedSquare = index;
                    this.render();
                }
            }
        } else {
            // If a move already selected, move if new select is legal move
            // else deselect or select another piece
            console.log(`Move attempt: ${this.selectedSquare} -> ${index}`);

            // Check if move is legal
            const legalMovesFromSelected = this.legalMoves.get(this.selectedSquare);
            if (legalMovesFromSelected && legalMovesFromSelected.has(index)) {
                this.board[index] = this.board[this.selectedSquare];
                this.board[this.selectedSquare] = E;

                this.selectedSquare = null;
                this.turn = BLACK;
                this.isPlayerTurn = false;

                this.render();

                setTimeout(() => this.playAiTurn(), 100);
            } else {
                this.selectedSquare = null;
                const piece = this.board[index];
                if (piece !== E) {
                    const isWhitePiece = piece > 0;
                    if (this.turn === WHITE && isWhitePiece) {
                        this.selectedSquare = index;
                    }
                }

                this.render();
            }
        }
    }
}