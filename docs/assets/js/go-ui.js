import { GoGame, BLACK, WHITE, EMPTY } from './go-logic.js';

// We assume onnx is loaded globally via script tag as 'ort'
// or we can try dynamic import if needed, but script tag is safer for browser static sites without bundlers.

class GoUI {
    constructor(elementId, playerColor = BLACK) {
        this.container = document.getElementById(elementId);
        this.game = new GoGame(9);
        this.playerColor = playerColor;
        this.tileSize = 40;
        this.padding = 20;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.session = null;
        this.isAIThinking = false;
        this.currentProbabilities = []; // Stores objects {row, col, percent}

        this.init();
    }

    async init() {
        // Setup Canvas
        const sizePx = (this.game.size - 1) * this.tileSize + this.padding * 2;
        this.canvas.width = sizePx;
        this.canvas.height = sizePx;
        this.canvas.style.cursor = 'pointer';
        this.container.appendChild(this.canvas);

        // Event Listeners
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Initial Render
        this.render();

        // Load Model
        try {
            this.updateStatus("Loading model...");
            this.session = await ort.InferenceSession.create('../assets/models/baduk_model_latest_features_web_clean_quint8.onnx', {
                executionProviders: ['wasm']
            });
            this.updateStatus(`Model loaded. You are ${this.playerColor === BLACK ? 'Black' : 'White'}. ${this.playerColor === BLACK ? 'Click to play.' : 'AI is thinking...'}`);

            // If player is White, AI (Black) moves first
            if (this.playerColor === WHITE) {
                this.makeAIMove();
            }
        } catch (e) {
            console.error("Failed to load model", e);
            this.updateStatus("Error loading model. Check console.");
        }
    }

    updateStatus(msg) {
        if (!this.canvas.isConnected) return; // Prevent updates from dead instances
        const statsEl = document.getElementById('game-status');
        if (statsEl) statsEl.innerText = msg;
    }

    updateMoveStats(text) {
        if (!this.canvas.isConnected) return;
        const statsEl = document.getElementById('move-stats');
        if (statsEl) statsEl.innerText = text;
    }

    handleClick(e) {
        if (this.game.gameOver || this.isAIThinking || this.game.turn !== this.playerColor) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - this.padding;
        const y = e.clientY - rect.top - this.padding;

        const col = Math.round(x / this.tileSize);
        const row = Math.round(y / this.tileSize);

        if (this.game.play(row, col)) {
            this.currentProbabilities = []; // Clear previous AI stats on user move
            this.render();
            // Trigger AI move
            this.makeAIMove();
        }
    }

    pass() {
        if (this.game.gameOver || this.isAIThinking || this.game.turn !== this.playerColor) return;

        if (this.game.play(-1, -1)) {
            if (this.game.gameOver) {
                this.updateStatus("Game Over (Both passed)");
            } else {
                this.updateStatus("You passed.");
                this.makeAIMove();
            }
        }
    }

    undo() {
        if (this.game.gameOver || this.isAIThinking || this.game.turn !== this.playerColor) return;

        // Determine how many steps to undo
        // If it's Player's turn, AI just moved. The stack has [Start, PlayerMoved].
        // Wait, if AI moved, stack has [Start, PlayerMoved, AIMoved]. 
        // We want to go back to [Start].
        // So we undo AI move, then Player move.
        // What if user just started and hasn't moved? history is empty.

        // Try undoing once (AI move)
        if (this.game.undo()) {
            // Now check if it's our turn. NO, undoing AI move makes it AI's turn (or rather, state before AI move was Player moved, so AI's turn).
            // Wait: 
            // 1. Player (Black) moves. saveState() called. Stack: [EmptyBoard (Black turn)]. State is now [BlackStone (White turn)].
            // 2. AI (White) moves. saveState() called. Stack: [EmptyBoard, BlackStone]. State is now [Black+White (Black turn)].

            // Client is Black. It's Black's Turn.
            // We want to go back to Black's turn (EmptyBoard).
            // So we assume the last state in history is the state BEFORE AI moved (BlackStone).
            // And state before that is EmptyBoard.

            // So we undo current state -> restore BlackStone (White turn).
            // Then we undo again -> restore EmptyBoard (Black turn).

            // But what if AI passed? Same logic.
            // What if user passed? Same.

            // If we undo once and it becomes AI's turn (which is !playerColor), we should undo again.
            // Unless we are playing HvH or something, but this is PvP(AI).

            if (this.game.turn !== this.playerColor) {
                if (!this.game.undo()) {
                    // We reached the start of the game (Black to move), and we are White.
                    // Trigger AI to move again.
                    this.currentProbabilities = [];
                    this.render();
                    this.updateStatus("Undoing to start...");
                    this.makeAIMove();
                    return;
                }
            }

            this.currentProbabilities = [];
            this.updateStatus("Undoing...");
            this.render();
            this.updateStatus("Your turn.");
        }
    }

    async makeAIMove() {
        if (!this.session || this.game.gameOver || !this.canvas.isConnected) return;

        this.isAIThinking = true;
        this.updateStatus("AI is thinking...");

        // Safety check: ensure it is AI's turn
        if (this.game.turn === this.playerColor) {
            console.warn("makeAIMove called but it is Player's turn! Aborting.");
            this.isAIThinking = false;
            return;
        }

        try {
            console.log(`AI Thinking... Turn: ${this.game.turn === 1 ? 'Black' : 'White'}`);
            // Prepare input
            const inputTensorData = this.game.generateTensorInput();

            // Check model input name - usually 'input' or 'input.1' etc.
            // We can inspect session.inputNames
            const inputName = this.session.inputNames[0];

            const tensor = new ort.Tensor('float32', inputTensorData, [1, 9, 9, 9]);

            const feeds = {};
            feeds[inputName] = tensor;

            // Run inference
            const results = await this.session.run(feeds);
            console.log(results);

            // Output - usually logits or probabilities
            const outputName = "policy"
            const outputData = results[outputName].data; // Float32Array

            // Softmax
            let maxLogit = -Infinity;
            for (let i = 0; i < outputData.length; i++) {
                if (outputData[i] > maxLogit) maxLogit = outputData[i];
            }

            let sumExp = 0;
            const probs = new Float32Array(outputData.length);
            for (let i = 0; i < outputData.length; i++) {
                probs[i] = Math.exp(outputData[i] - maxLogit);
                sumExp += probs[i];
            }
            for (let i = 0; i < outputData.length; i++) {
                probs[i] /= sumExp;
            }

            // Find best legal move
            const moves = [];
            for (let i = 0; i < probs.length; i++) {
                moves.push({ idx: i, sc: probs[i] }); // Use probability for sorting
            }
            moves.sort((a, b) => b.sc - a.sc);

            let moveMade = false;
            let chosenMove = null;
            // let statsText = "AI Move Analysis:\n";

            for (const m of moves) {
                const idx = m.idx;
                let isPass = false;
                let r = -1, c = -1;

                if (idx === 81) { // Pass
                    isPass = true;
                } else {
                    r = Math.floor(idx / 9);
                    c = idx % 9;
                }

                const probPercent = (m.sc * 100).toFixed(1);
                const coord = isPass ? "Pass" : `${["A", "B", "C", "D", "E", "F", "G", "H", "J"][c]}${9 - r}`;

                // Try to play if not yet moved
                if (!moveMade) {
                    if (isPass) {
                        if (this.game.play(-1, -1)) {
                            moveMade = true;
                            chosenMove = m;
                            console.log("AI Passed");
                        }
                    } else if (r >= 0 && r < 9 && c >= 0 && c < 9) {
                        if (this.game.play(r, c)) {
                            moveMade = true;
                            chosenMove = m;
                            console.log(`AI played at ${r}, ${c}`);
                        }
                    }
                }

                // For stats: show chosen move and any > 5%
                // We construct the string here, but we might want to highlight the chosen one differently?
                // The user asked: "AI makes a move, I wanna see what was the probability assigned to that move also for any other moves above 5% chance"

                // if (m.sc > 0.05) {
                //     statsText += `${coord}: ${probPercent}%${moveMade && chosenMove === m ? ' (Chosen)' : ''}\n`;
                // }
            }

            // If the chosen move was <= 5%, we must still append it if not already added
            if (chosenMove && chosenMove.sc <= 0.05) {
                const idx = chosenMove.idx;
                const isPass = idx === 81;
                const c = idx % 9;
                const r = Math.floor(idx / 9);
                const coord = isPass ? "Pass" : `${["A", "B", "C", "D", "E", "F", "G", "H", "J"][c]}${9 - r}`;
                const probPercent = (chosenMove.sc * 100).toFixed(1);
                // statsText += `${coord}: ${probPercent}% (Chosen)\n`;
            }

            // this.updateMoveStats(statsText);

            // Populate currentProbabilities for rendering
            this.currentProbabilities = [];
            for (const m of moves) {
                // Show if > 5% OR if it is the chosen move
                if (m.sc > 0.05 || (chosenMove && m.idx === chosenMove.idx)) {
                    if (m.idx !== 81) { // Ignore pass for board rendering
                        const r = Math.floor(m.idx / 9);
                        const c = m.idx % 9;
                        this.currentProbabilities.push({
                            row: r,
                            col: c,
                            percent: (m.sc * 100).toFixed(1)
                        });
                    }
                }
            }

            // --- Visualize relu_37 Feature Maps ---
            try {
                // Should receive [1, 2, 9, 9] flattend to Float32Array
                const reluOutput = results['relu_37'];
                if (reluOutput) {
                    const data = reluOutput.data;
                    // Plane size = 9*9 = 81.
                    // Plane 1: data[0..80], Plane 2: data[81..161]
                    const plane1 = data.slice(0, 81);
                    const plane2 = data.slice(81, 162);

                    this.renderFeatureMap('feat-1-std', plane1, "Heatmap");
                    this.renderFeatureMapGlow('feat-1-glow', plane1, "Local Influence");
                    this.renderFeatureMapCircle('feat-1-circle', plane1, "Hint");

                    this.renderFeatureMap('feat-2-std', plane2, "Heatmap");
                    this.renderFeatureMapGlow('feat-2-glow', plane2, "Local Influence");
                    this.renderFeatureMapCircle('feat-2-circle', plane2, "Hint");
                }
            } catch (err) {
                console.error("Error visualizing feature maps:", err);
            }

            if (!moveMade) {
                console.warn("AI found no legal moves, passing.");
                this.game.play(-1, -1);
                this.updateMoveStats("AI forced pass (No legal moves).");
            }

            this.render();
            if (this.game.gameOver) {
                this.updateStatus("Game Over");
            } else {
                if (moveMade && this.game.lastMove === 'PASS') {
                    this.updateStatus("AI passed. Your turn.");
                } else {
                    this.updateStatus("Your turn.");
                }
            }

        } catch (e) {
            console.error("AI Inference error:", e);
            this.updateStatus("AI Error.");
        } finally {
            this.isAIThinking = false;
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = '#DCB35C'; // Wood color
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.beginPath();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let i = 0; i < this.game.size; i++) {
            const x = this.padding + i * this.tileSize;
            ctx.moveTo(x, this.padding);
            ctx.lineTo(x, h - this.padding);
        }

        // Horizontal lines
        for (let i = 0; i < this.game.size; i++) {
            const y = this.padding + i * this.tileSize;
            ctx.moveTo(this.padding, y);
            ctx.lineTo(w - this.padding, y);
        }
        ctx.stroke();

        // Star points (9x9 usually has 5: 2,2; 2,6; 6,2; 6,6; 4,4 - indices are 0-based so 2,2 -> 2*size+size...)
        // Actually 3,3 (center of quadrant) so index 2 and index 6. Center is index 4.
        const stars = [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
        ctx.fillStyle = '#000';
        for (const [r, c] of stars) {
            const x = this.padding + c * this.tileSize;
            const y = this.padding + r * this.tileSize;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Stones
        for (let r = 0; r < this.game.size; r++) {
            for (let c = 0; c < this.game.size; c++) {
                const stone = this.game.board[r][c];
                if (stone !== EMPTY) {
                    const x = this.padding + c * this.tileSize;
                    const y = this.padding + r * this.tileSize;

                    ctx.beginPath();
                    ctx.arc(x, y, this.tileSize / 2 - 2, 0, Math.PI * 2);

                    // Shadow
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 3;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    if (stone === BLACK) {
                        ctx.fillStyle = '#000'; // Black
                    } else {
                        ctx.fillStyle = '#fff'; // White
                    }
                    ctx.fill();
                    ctx.shadowColor = 'transparent'; // Reset shadow

                    // Last move marker
                    if (this.game.lastMove && this.game.lastMove.row === r && this.game.lastMove.col === c) {
                        ctx.beginPath();
                        ctx.strokeStyle = (stone === BLACK) ? '#fff' : '#000';
                        ctx.lineWidth = 2;
                        ctx.arc(x, y, this.tileSize / 4, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
        }

        // Render Probabilities
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const prob of this.currentProbabilities) {
            const x = this.padding + prob.col * this.tileSize;
            const y = this.padding + prob.row * this.tileSize;

            // Check if there is a stone there
            const stone = this.game.board[prob.row][prob.col];

            if (stone !== EMPTY) {
                // Stone present (likely the move just made)
                // Text color contrasting stone
                ctx.fillStyle = (stone === BLACK) ? '#fff' : '#000';
                ctx.fillText(prob.percent, x, y);
            } else {
                // Empty spot (candidate move)
                // Draw background bubble
                ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
                ctx.beginPath();
                ctx.arc(x, y, this.tileSize / 2 - 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#000';
                ctx.fillText(prob.percent, x, y);
            }
        }
    }

    renderFeatureMap(canvasId, data, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        // Assume 9x9 board logic reuse or simplified
        const padding = 20;
        const boardSize = w - 2 * padding;
        const tileSize = boardSize / (9 - 1);

        // Clear
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
            const p = padding + i * tileSize;
            ctx.moveTo(p, padding);
            ctx.lineTo(p, h - padding);
            ctx.moveTo(padding, p);
            ctx.lineTo(w - padding, p);
        }
        ctx.stroke();

        // Normalize
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        const range = max - min;

        // Draw Heatmap
        for (let i = 0; i < data.length; i++) {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const x = padding + c * tileSize;
            const y = padding + r * tileSize;

            const val = data[i];
            const norm = range > 0.000001 ? (val - min) / range : 0;

            // Draw Rect
            // Color: Blue (low) -> Cyan -> Green -> Yellow -> Red (high)
            // HSL: 240 (blue) -> 0 (red). So 240 * (1-norm)
            const hue = 240 * (1 - norm);
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.7)`;

            ctx.beginPath();
            ctx.rect(x - tileSize / 2 + 1, y - tileSize / 2 + 1, tileSize - 2, tileSize - 2);
            ctx.fill();
        }
    }

    renderFeatureMapGlow(canvasId, data, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 20;
        const boardSize = w - 2 * padding;
        const tileSize = boardSize / (9 - 1);

        // Dark Background for glow
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        // Grid (faint)
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
            const p = padding + i * tileSize;
            ctx.moveTo(p, padding);
            ctx.lineTo(p, h - padding);
            ctx.moveTo(padding, p);
            ctx.lineTo(w - padding, p);
        }
        ctx.stroke();

        // Normalize
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        const range = max - min;

        // Draw Glows (Composite for better blending)
        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            const norm = range > 0.000001 ? (val - min) / range : 0;

            // Threshold: 0 is invisible
            if (norm < 0.05) continue;

            const r = Math.floor(i / 9);
            const c = i % 9;
            const x = padding + c * tileSize;
            const y = padding + r * tileSize;

            // Gradient: Center is bright, edges fade
            // Color: Cyan (or Magenta)
            const grad = ctx.createRadialGradient(x, y, 0, x, y, tileSize * 1.5);
            // Alpha proportional to strength
            grad.addColorStop(0, `rgba(0, 255, 255, ${norm})`); // Cyan center
            grad.addColorStop(0.5, `rgba(0, 255, 255, ${norm * 0.2})`);
            grad.addColorStop(1, `rgba(0, 255, 255, 0)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, tileSize * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    renderFeatureMapCircle(canvasId, data, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 20;
        const boardSize = w - 2 * padding;
        const tileSize = boardSize / (9 - 1);

        // Clean white background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.beginPath();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
            const p = padding + i * tileSize;
            ctx.moveTo(p, padding);
            ctx.lineTo(p, h - padding);
            ctx.moveTo(padding, p);
            ctx.lineTo(w - padding, p);
        }
        ctx.stroke();

        // Normalize
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        const range = max - min;

        // Draw Circles
        ctx.fillStyle = '#000';

        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            const norm = range > 0.000001 ? (val - min) / range : 0;

            if (norm < 0.05) continue;

            const r = Math.floor(i / 9);
            const c = i % 9;
            const x = padding + c * tileSize;
            const y = padding + r * tileSize;

            // Radius proportional to value
            // Max radius approx tileSize/2 (almost touching)
            const maxRadius = tileSize / 2 - 2;
            const radius = norm * maxRadius;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export { GoUI, BLACK, WHITE };
