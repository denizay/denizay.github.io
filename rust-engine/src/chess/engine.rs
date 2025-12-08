use crate::chess::pieces::{
    get_all_pseudo_legal_moves, get_piece_value, get_pseudo_legal_moves_for_piece, Color, BK, E, WK,
};
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

pub fn is_square_attacked(
    board: &[[i8; 8]; 8],
    position: (usize, usize),
    attacker_color: Color,
) -> bool {
    for r in 0..8 {
        for f in 0..8 {
            let piece = board[r][f];
            if piece == E {
                continue;
            }
            // Check if piece belongs to attacker
            let is_white = piece > 0;
            let piece_color = if is_white { Color::White } else { Color::Black };

            if piece_color == attacker_color {
                let moves = get_pseudo_legal_moves_for_piece(board, attacker_color, (r, f));
                if moves.contains(&position) {
                    return true;
                }
            }
        }
    }
    false
}

pub fn is_in_check(board: &[[i8; 8]; 8], color: Color) -> bool {
    let king_val = match color {
        Color::White => WK,
        Color::Black => BK,
    };

    let mut king_pos = None;
    for r in 0..8 {
        for f in 0..8 {
            if board[r][f] == king_val {
                king_pos = Some((r, f));
                break;
            }
        }
        if king_pos.is_some() {
            break;
        }
    }

    match king_pos {
        Some(pos) => is_square_attacked(board, pos, get_opponent(color)),
        None => true, // Should not happen, but if no king, yes we are in "check"?
    }
}

pub fn get_legal_moves(
    board: &[[i8; 8]; 8],
    color: Color,
) -> Vec<((usize, usize), (usize, usize))> {
    let pseudo_moves = get_all_pseudo_legal_moves(board, color);
    let mut legal_moves = Vec::new();

    let mut board_clone = *board;

    for move_ in pseudo_moves {
        let captured = make_move(&mut board_clone, move_);
        if !is_in_check(&board_clone, color) {
            legal_moves.push(move_);
        }
        undo_move(&mut board_clone, move_, captured);
    }

    legal_moves
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
    if depth == 0 {
        return evaluate_board(board);
    }

    let legal_moves = get_legal_moves(board, color);

    if legal_moves.is_empty() {
        if is_in_check(board, color) {
            if color == Color::White {
                return -10000 - depth;
            } else {
                return 10000 + depth;
            }
        }
        // Stalemate
        return 0;
    }

    let maximizing = is_maximizing(color);
    let mut best_point = if maximizing { i32::MIN } else { i32::MAX };

    for move_ in legal_moves {
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
    let legal_moves = get_legal_moves(&board_clone, color);

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
