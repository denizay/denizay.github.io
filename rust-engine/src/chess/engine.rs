use crate::chess::pieces::{get_all_legal_moves, get_piece_value, Color, BK, E, WK};
use rand::prelude::IndexedRandom;

pub fn evaluate_board(board: &[[i8; 8]; 8]) -> i32 {
    let mut total_point = 0;
    for row in board {
        for &piece in row {
            total_point += get_piece_value(piece);
        }
    }
    total_point
}

pub fn get_opponent(color: Color) -> Color {
    match color {
        Color::White => Color::Black,
        Color::Black => Color::White,
    }
}

pub fn make_move(board: &mut [[i8; 8]; 8], move_: ((usize, usize), (usize, usize))) -> i8 {
    let ((from_r, from_f), (to_r, to_f)) = move_;
    let captured = board[to_r][to_f];
    board[to_r][to_f] = board[from_r][from_f];
    board[from_r][from_f] = E;
    captured
}

pub fn undo_move(board: &mut [[i8; 8]; 8], move_: ((usize, usize), (usize, usize)), captured: i8) {
    let ((from_r, from_f), (to_r, to_f)) = move_;
    board[from_r][from_f] = board[to_r][to_f];
    board[to_r][to_f] = captured;
}

pub fn check_game_finished(board: &[[i8; 8]; 8]) -> (bool, i32) {
    let mut white_king_exists = false;
    let mut black_king_exists = false;

    for row in board {
        for &piece in row {
            if piece == WK {
                white_king_exists = true;
            } else if piece == BK {
                black_king_exists = true;
            }
        }
    }

    if !white_king_exists {
        return (true, -10000);
    }
    if !black_king_exists {
        return (true, 10000);
    }
    (false, 0)
}

fn is_maximizing(color: Color) -> bool {
    color == Color::White
}

pub fn minimax(
    board: &mut [[i8; 8]; 8],
    color: Color,
    depth: i32,
    mut alpha: i32,
    mut beta: i32,
) -> i32 {
    let (finished, score) = check_game_finished(board);
    if finished {
        return score;
    }
    if depth == 0 {
        return evaluate_board(board);
    }

    let legal_moves_raw = get_all_legal_moves(board, color);

    if legal_moves_raw.is_empty() {
        // Checkmate check needed.
        // Will return evaluate_board for now.
        return evaluate_board(board);
    }

    let maximizing = is_maximizing(color);
    let mut best_point = if maximizing { i32::MIN } else { i32::MAX };

    for move_ in legal_moves_raw {
        let captured = make_move(board, move_);
        let point = minimax(board, get_opponent(color), depth - 1, alpha, beta);
        undo_move(board, move_, captured);

        if maximizing {
            best_point = best_point.max(point);
            alpha = alpha.max(point);
            if beta <= alpha {
                break;
            }
        } else {
            best_point = best_point.min(point);
            beta = beta.min(point);
            if beta <= alpha {
                break;
            }
        }
    }
    best_point
}

pub fn get_best_move(
    board: &[[i8; 8]; 8],
    color: Color,
    depth: i32,
) -> Option<((usize, usize), (usize, usize))> {
    // We need a mutable board for minimax
    let mut board_clone = *board;
    let legal_moves = get_all_legal_moves(&board_clone, color);

    if legal_moves.is_empty() {
        return None;
    }

    let mut points_w_moves = Vec::new();
    let maximizing = is_maximizing(color);

    let alpha = -50000;
    let beta = 50000;

    for move_ in legal_moves {
        let captured = make_move(&mut board_clone, move_);
        let point = minimax(
            &mut board_clone,
            get_opponent(color),
            depth - 1,
            alpha,
            beta,
        );
        points_w_moves.push((point, move_));
        undo_move(&mut board_clone, move_, captured);
    }

    if points_w_moves.is_empty() {
        return None;
    }

    // Doing this stuff cuz wanna choose randomly between highest score moves
    let best_score = if maximizing {
        points_w_moves.iter().map(|(p, _)| *p).max().unwrap()
    } else {
        points_w_moves.iter().map(|(p, _)| *p).min().unwrap()
    };

    let best_moves: Vec<_> = points_w_moves
        .into_iter()
        .filter(|(p, _)| *p == best_score)
        .map(|(_, m)| m)
        .collect();

    let mut rng = rand::rng();
    best_moves.choose(&mut rng).cloned()
}
