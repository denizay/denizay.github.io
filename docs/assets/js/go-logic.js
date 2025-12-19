export const BLACK = 1;
export const WHITE = -1;
export const EMPTY = 0;

const HISTORY_LENGTH = 3;

export class GoGame {
    constructor(size = 9) {
        this.size = size;
        this.board = Array(size).fill().map(() => Array(size).fill(EMPTY));
        this.turn = BLACK; // Black goes first
        this.capturedStones = { [BLACK]: 0, [WHITE]: 0 };
        this.lastMove = null;
        this.koPoint = null;
        this.passes = 0;
        this.gameOver = false;

        // Stores full game states for history/undo
        this.history = [];
    }

    reset() {
        this.board = Array(this.size).fill().map(() => Array(this.size).fill(EMPTY));
        this.turn = BLACK;
        this.capturedStones = { [BLACK]: 0, [WHITE]: 0 };
        this.lastMove = null;
        this.koPoint = null;
        this.passes = 0;
        this.gameOver = false;
        this.history = [];
    }

    play(row, col) {
        if (this.gameOver) return false;

        // Pass validation
        if (row === -1 && col === -1) {
            this.saveState(); // Save state before passing
            this.passes++;
            this.turn = -this.turn;
            this.lastMove = 'PASS';
            this.koPoint = null;
            if (this.passes >= 2) {
                this.gameOver = true;
            }
            return true;
        }

        if (!this.isValidMove(row, col)) return false;

        // Save state before move (This becomes T-1 for the next turn)
        this.saveState();

        // Place stone
        this.board[row][col] = this.turn;
        this.passes = 0;

        // Check captures
        const opponent = -this.turn;
        let captured = [];
        const neighbors = this.getNeighbors(row, col);

        for (const [nr, nc] of neighbors) {
            if (this.board[nr][nc] === opponent) {
                const group = this.getGroup(nr, nc);
                if (this.countLiberties(group) === 0) {
                    captured.push(...group);
                }
            }
        }

        // Remove captured stones
        for (const [cr, cc] of captured) {
            this.board[cr][cc] = EMPTY;
        }
        this.capturedStones[this.turn] += captured.length;

        // Update Ko point
        if (captured.length === 1 && this.getGroup(row, col).length === 1 && this.countLiberties(this.getGroup(row, col)) === 1) {
            this.koPoint = captured[0];
        } else {
            this.koPoint = null;
        }

        this.lastMove = { row, col };
        this.turn = -this.turn;
        return true;
    }

    isValidMove(row, col) {
        if (row < 0 || row >= this.size || col < 0 || col >= this.size) return false;
        if (this.board[row][col] !== EMPTY) return false;

        // Ko Check
        if (this.koPoint && this.koPoint[0] === row && this.koPoint[1] === col) {
            return false;
        }

        // Suicide check
        this.board[row][col] = this.turn;
        const group = this.getGroup(row, col);
        const liberties = this.countLiberties(group);

        let captures = 0;
        const opponent = -this.turn;
        const neighbors = this.getNeighbors(row, col);
        for (const [nr, nc] of neighbors) {
            if (this.board[nr][nc] === opponent) {
                const oppGroup = this.getGroup(nr, nc);
                if (this.countLiberties(oppGroup) === 0) {
                    captures += oppGroup.length;
                }
            }
        }

        this.board[row][col] = EMPTY; // Revert

        if (liberties === 0 && captures === 0) return false; // Suicide move

        return true;
    }

    getNeighbors(r, c) {
        const neighbors = [];
        if (r > 0) neighbors.push([r - 1, c]);
        if (r < this.size - 1) neighbors.push([r + 1, c]);
        if (c > 0) neighbors.push([r, c - 1]);
        if (c < this.size - 1) neighbors.push([r, c + 1]);
        return neighbors;
    }

    getGroup(r, c) {
        const color = this.board[r][c];
        const group = [];
        const visited = new Set();
        const queue = [[r, c]];
        visited.add(`${r},${c}`);

        while (queue.length > 0) {
            const [currR, currC] = queue.shift();
            group.push([currR, currC]);

            const neighbors = this.getNeighbors(currR, currC);
            for (const [nr, nc] of neighbors) {
                if (this.board[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push([nr, nc]);
                }
            }
        }
        return group;
    }

    countLiberties(group) {
        const liberties = new Set();
        for (const [r, c] of group) {
            const neighbors = this.getNeighbors(r, c);
            for (const [nr, nc] of neighbors) {
                if (this.board[nr][nc] === EMPTY) {
                    liberties.add(`${nr},${nc}`);
                }
            }
        }
        return liberties.size;
    }

    /**
     * Generates the input tensor for the neural network.
     * Shape: [(HISTORY_LENGTH + 1) * 2 + 1, 9, 9] -> 9 planes for History=3
     * * Structure per time step (Current, T-1, T-2, T-3):
     * - Plane 0: Stones matching Current Player's color
     * - Plane 1: Stones matching Opponent's color
     * * Final Plane:
     * - Color Plane (All 1s if Black to play, All 0s if White to play)
     */
    generateTensorInput() {
        const size = this.size;
        // Calculation: (3 history + 1 current) * 2 planes + 1 color plane = 9 planes
        const num_planes = (HISTORY_LENGTH + 1) * 2 + 1;
        const input = new Float32Array(num_planes * size * size);

        // We iterate 0 (Current), 1 (T-1), 2 (T-2), 3 (T-3)
        for (let h = 0; h <= HISTORY_LENGTH; h++) {
            let boardState;

            // Fetch the board state for this history step
            if (h === 0) {
                boardState = this.board; // Current board
            } else {
                // history array stores past states. history[length-1] is T-1
                const histIdx = this.history.length - h;
                if (histIdx >= 0) {
                    boardState = this.history[histIdx].board;
                } else {
                    // Padding: If history doesn't exist yet (start of game), use empty board
                    boardState = Array(size).fill().map(() => Array(size).fill(EMPTY));
                }
            }

            // Calculate the starting index in the flat array for this time step's planes
            // Each step adds 2 planes (size * size * 2)
            const baseIdx = h * 2 * size * size;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const idx = r * size + c;
                    const stone = boardState[r][c];

                    // Determine "My" vs "Opponent" relative to the CURRENT turn
                    // This matches the Python logic: 'if curr_turn_color == BLACK ...'
                    let isMyStone = false;
                    let isOppStone = false;

                    if (this.turn === BLACK) {
                        if (stone === BLACK) isMyStone = true;
                        if (stone === WHITE) isOppStone = true;
                    } else { // Current turn is WHITE
                        if (stone === WHITE) isMyStone = true;
                        if (stone === BLACK) isOppStone = true;
                    }

                    // Plane A: My Stones
                    input[baseIdx + idx] = isMyStone ? 1 : 0;

                    // Plane B: Opponent Stones (Offset by 1 board size)
                    input[baseIdx + (size * size) + idx] = isOppStone ? 1 : 0;
                }
            }
        }

        // --- Final Plane: Color to Play ---
        // All 1s for Black, All 0s for White
        const colorPlaneStart = (num_planes - 1) * size * size;
        const colorVal = (this.turn === BLACK) ? 1 : 0;

        for (let i = 0; i < size * size; i++) {
            input[colorPlaneStart + i] = colorVal;
        }

        return input;
    }

    saveState() {
        // Deep copy the current state
        this.history.push({
            board: this.board.map(row => [...row]),
            turn: this.turn,
            capturedStones: { ...this.capturedStones },
            lastMove: this.lastMove,
            koPoint: this.koPoint ? [...this.koPoint] : null,
            passes: this.passes,
            gameOver: this.gameOver
        });
    }

    undo() {
        if (this.history.length === 0) return false;
        const state = this.history.pop();
        this.board = state.board;
        this.turn = state.turn;
        this.capturedStones = state.capturedStones;
        this.lastMove = state.lastMove;
        this.koPoint = state.koPoint;
        this.passes = state.passes;
        this.gameOver = state.gameOver;
        return true;
    }
}