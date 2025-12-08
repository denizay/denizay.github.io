use crate::chess::pieces::{
    get_all_pseudo_legal_moves, get_piece_value, get_pseudo_legal_moves_for_piece, Color, BK, BP, BQ,
    BR, E, WB, WK, WN, WP, WQ, WR,
};
use rand::prelude::IndexedRandom;

pub const CASTLE_WK: u8 = 1;
pub const CASTLE_WQ: u8 = 2;
pub const CASTLE_BK: u8 = 4;
pub const CASTLE_BQ: u8 = 8;
pub const ALL_CASTLE_RIGHTS: u8 = 15;

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

pub fn score_move(board: &[[i8; 8]; 8], move_: ((usize, usize), (usize, usize))) -> i32 {
    let ((from_r, from_f), (to_r, to_f)) = move_;
    let move_piece = board[from_r][from_f];
    let captured_piece = board[to_r][to_f];

    if captured_piece != E {
        // MVV-LVA: 10 * Victim Value - Attacker Value
        let victim_val = get_piece_value(captured_piece).abs();
        let attacker_val = get_piece_value(move_piece).abs();
        
        return 10 * victim_val - attacker_val;
    }

    0
}

pub fn make_move(
    board: &mut [[i8; 8]; 8],
    move_: ((usize, usize), (usize, usize)),
    current_rights: u8,
) -> (i8, u8) {
    let ((from_r, from_f), (to_r, to_f)) = move_;
    let piece = board[from_r][from_f];
    let captured = board[to_r][to_f];

    board[to_r][to_f] = piece;
    board[from_r][from_f] = E;

    let mut new_rights = current_rights;

    // Handle Castling Move (King moves 2 steps)
    // White King 7,4 -> 7,6 (Kingside) or 7,2 (Queenside)
    // Black King 0,4 -> 0,6 (Kingside) or 0,2 (Queenside)
    let is_castling = (piece == WK || piece == BK) && (from_f as isize - to_f as isize).abs() == 2;

    if is_castling {
        // Move Rook
        if to_f == 6 {
            // Kingside
            // Rook at 7 -> 5
            let rook = board[from_r][7];
            board[from_r][5] = rook;
            board[from_r][7] = E;
        } else if to_f == 2 {
            // Queenside
            // Rook at 0 -> 3
            let rook = board[from_r][0];
            board[from_r][3] = rook;
            board[from_r][0] = E;
        }
    }

    // Update Rights
    // 1. If King moves, lose all rights for that color
    if piece == WK {
        new_rights &= !(CASTLE_WK | CASTLE_WQ);
    } else if piece == BK {
        new_rights &= !(CASTLE_BK | CASTLE_BQ);
    }

    // 2. If Rook moves, lose right for that side
    // White Rooks
    if piece == WR {
        if from_r == 7 && from_f == 0 {
            new_rights &= !CASTLE_WQ;
        } else if from_r == 7 && from_f == 7 {
            new_rights &= !CASTLE_WK;
        }
    }
    // Black Rooks
    if piece == BR {
        if from_r == 0 && from_f == 0 {
            new_rights &= !CASTLE_BQ;
        } else if from_r == 0 && from_f == 7 {
            new_rights &= !CASTLE_BK;
        }
    }

    // 3. If Rook is captured, lose right for that side
    // If captured was a Rook at original position
    if captured == WR {
        if to_r == 7 && to_f == 0 {
            new_rights &= !CASTLE_WQ;
        } else if to_r == 7 && to_f == 7 {
            new_rights &= !CASTLE_WK;
        }
    } else if captured == BR {
        if to_r == 0 && to_f == 0 {
            new_rights &= !CASTLE_BQ;
        } else if to_r == 0 && to_f == 7 {
            new_rights &= !CASTLE_BK;
        }
    }

    (captured, new_rights)
}

pub fn undo_move(
    board: &mut [[i8; 8]; 8],
    move_: ((usize, usize), (usize, usize)),
    captured: i8,
) {
    let ((from_r, from_f), (to_r, to_f)) = move_;
    
    // Check if it was castling (moved piece is King and dist 2)
    // Note: board[to_r][to_f] is the piece that moved (King)
    let piece = board[to_r][to_f];
    let is_castling = (piece == WK || piece == BK) && (from_f as isize - to_f as isize).abs() == 2;

    // Restore piece
    board[from_r][from_f] = piece;
    board[to_r][to_f] = captured;

    if is_castling {
        // Unmove Rook
        if to_f == 6 {
            // Kingside: Rook is at 5, move back to 7
            let rook = board[from_r][5];
            board[from_r][7] = rook;
            board[from_r][5] = E;
        } else if to_f == 2 {
            // Queenside: Rook is at 3, move back to 0
            let rook = board[from_r][3];
            board[from_r][0] = rook;
            board[from_r][3] = E;
        }
    }
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
    castling_rights: u8,
) -> Vec<((usize, usize), (usize, usize))> {
    let pseudo_moves = get_all_pseudo_legal_moves(board, color);
    let mut legal_moves = Vec::new();

    let mut board_clone = *board;

    // Normal pseudo moves
    for move_ in pseudo_moves {
        let (captured, _) = make_move(&mut board_clone, move_, castling_rights);
        if !is_in_check(&board_clone, color) {
            legal_moves.push(move_);
        }
        undo_move(&mut board_clone, move_, captured);
    }

    // Castling Logic
    if !is_in_check(board, color) {
        let (rank, king_mask, queen_mask, k_side_sqs, q_side_sqs) = match color {
            Color::White => (
                7,
                CASTLE_WK,
                CASTLE_WQ,
                vec![5, 6],    // Empty for KS: f1, g1
                vec![1, 2, 3], // Empty for QS: b1, c1, d1
            ),
            Color::Black => (
                0,
                CASTLE_BK,
                CASTLE_BQ,
                vec![5, 6],    // Empty for KS: f8, g8
                vec![1, 2, 3], // Empty for QS: b8, c8, d8
            ),
        };

        // Safety: Check if King is actually on the board at start pos
        // (Prevents phantom castling if rights are desynced)
        let king_piece = if color == Color::White { WK } else { BK };
        if board[rank][4] == king_piece {
            // Kingside
            if (castling_rights & king_mask) != 0 {
                let mut clear = true;
                for &f in &k_side_sqs {
                    if board[rank][f] != E {
                        clear = false;
                        break;
                    }
                }
                if clear {
                    if !is_square_attacked(board, (rank, 5), get_opponent(color))
                        && !is_square_attacked(board, (rank, 6), get_opponent(color))
                    {
                        legal_moves.push(((rank, 4), (rank, 6)));
                    }
                }
            }

            // Queenside
            if (castling_rights & queen_mask) != 0 {
                let mut clear = true;
                for &f in &q_side_sqs {
                    if board[rank][f] != E {
                        clear = false;
                        break;
                    }
                }
                if clear {
                    if !is_square_attacked(board, (rank, 3), get_opponent(color))
                        && !is_square_attacked(board, (rank, 2), get_opponent(color))
                    {
                        legal_moves.push(((rank, 4), (rank, 2)));
                    }
                }
            }
        }
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
    castling_rights: u8,
    use_pruning: bool,
    use_move_ordering: bool,
) -> i32 {
    if depth == 0 {
        return evaluate_board(board);
    }

    let mut legal_moves = get_legal_moves(board, color, castling_rights);
    
    if use_move_ordering {
        legal_moves.sort_by(|a, b| {
            let score_a = score_move(board, *a);
            let score_b = score_move(board, *b);
            score_b.cmp(&score_a) // Descending
        });
    }

    if legal_moves.is_empty() {
        if is_in_check(board, color) {
            // Checkmate
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
        let (captured, new_rights) = make_move(board, move_, castling_rights);
        let point = minimax(board, get_opponent(color), depth - 1, alpha, beta, new_rights, use_pruning, use_move_ordering);
        undo_move(board, move_, captured);

        if maximizing {
            best_point = best_point.max(point);
            alpha = alpha.max(point);
            if use_pruning && beta <= alpha {
                break;
            }
        } else {
            best_point = best_point.min(point);
            beta = beta.min(point);
            if use_pruning && beta <= alpha {
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
    castling_rights: u8,
    use_pruning: bool,
    use_move_ordering: bool,
) -> Option<((usize, usize), (usize, usize))> {
    // We need a mutable board for minimax
    let mut board_clone = *board;
    let mut legal_moves = get_legal_moves(&board_clone, color, castling_rights);

    if use_move_ordering {
        legal_moves.sort_by(|a, b| {
            let score_a = score_move(board, *a);
            let score_b = score_move(board, *b);
            score_b.cmp(&score_a)
        });
    }

    if legal_moves.is_empty() {
        return None;
    }

    let mut points_w_moves = Vec::new();
    let maximizing = is_maximizing(color);

    let alpha = -50000;
    let beta = 50000;

    for move_ in legal_moves {
        let (captured, new_rights) = make_move(&mut board_clone, move_, castling_rights);
        let point = minimax(
            &mut board_clone,
            get_opponent(color),
            depth - 1,
            alpha,
            beta,
            new_rights,
            use_pruning,
            use_move_ordering,
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
