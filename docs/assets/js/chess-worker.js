import init, { get_best_move } from '../../pkg/rust_engine.js';

await init();

self.onmessage = function (e) {
    const { board, color, depth, castlingRights, usePruning, useMoveOrdering } = e.data;
    try {
        const move = get_best_move(board, color, depth, castlingRights, usePruning, useMoveOrdering);
        self.postMessage({ type: 'success', move });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.toString() });
    }
};
