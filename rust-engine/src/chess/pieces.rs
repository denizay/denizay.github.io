pub const E: i8 = 0; // Empty

pub const WP: i8 = 1; // White Pawn
pub const WN: i8 = 2; // White Knight
pub const WB: i8 = 3; // White Bishop
pub const WR: i8 = 4; // White Rook
pub const WQ: i8 = 5; // White Queen
pub const WK: i8 = 6; // White King

pub const BP: i8 = -1; // Black Pawn
pub const BN: i8 = -2; // Black Knight
pub const BB: i8 = -3; // Black Bishop
pub const BR: i8 = -4; // Black Rook
pub const BQ: i8 = -5; // Black Queen
pub const BK: i8 = -6; // Black King

#[derive(PartialEq, Copy, Clone)]
pub enum Color {
    White,
    Black,
}

fn get_piece_color(piece: i8) -> Color {
    if piece > 0 {
        Color::White
    } else {
        Color::Black
    }
}

pub fn get_piece_value(piece: i8) -> i32 {
    match piece {
        WP => 1,
        WN => 3,
        WB => 3,
        WR => 5,
        WQ => 9,
        WK => 200,
        BP => -1,
        BN => -3,
        BB => -3,
        BR => -5,
        BQ => -9,
        BK => -200,
        _ => 0,
    }
}

fn get_knight_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let mut legal_moves = Vec::new();
    let (rank, file) = position;

    let r_idx = rank as isize;
    let f_idx = file as isize;

    let moves = [
        (r_idx - 2, f_idx - 1),
        (r_idx - 2, f_idx + 1),
        (r_idx - 1, f_idx - 2),
        (r_idx - 1, f_idx + 2),
        (r_idx + 1, f_idx - 2),
        (r_idx + 1, f_idx + 2),
        (r_idx + 2, f_idx - 1),
        (r_idx + 2, f_idx + 1),
    ];

    for (r, f) in moves {
        if r >= 0 && r < 8 && f >= 0 && f < 8 {
            let u_r = r as usize;
            let u_f = f as usize;

            let piece = board[u_r][u_f];

            if piece == E {
                legal_moves.push((u_r, u_f));
            } else {
                let piece_color = get_piece_color(piece);

                if piece_color != color {
                    legal_moves.push((u_r, u_f));
                }
            }
        }
    }
    legal_moves
}

fn is_on_board(r: isize, f: isize) -> bool {
    r >= 0 && r < 8 && f >= 0 && f < 8
}

fn get_pawn_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let mut legal_moves = Vec::new();
    let (rank, file) = position;
    let r_idx = rank as isize;
    let f_idx = file as isize;

    // White moves up (decreasing index), black moves down (increasing index)
    // Assuming row 0 is rank 8, meaning black side
    let direction = match color {
        Color::White => -1,
        Color::Black => 1,
    };

    // One step forward
    let r_next = r_idx + direction;
    if is_on_board(r_next, f_idx) {
        if board[r_next as usize][f_idx as usize] == E {
            legal_moves.push((r_next as usize, f_idx as usize));

            // Double step forward
            let start_rank = match color {
                Color::White => 6,
                Color::Black => 1,
            };

            if rank == start_rank {
                let r_double = r_idx + 2 * direction;
                if is_on_board(r_double, f_idx) {
                    if board[r_double as usize][f_idx as usize] == E {
                        legal_moves.push((r_double as usize, f_idx as usize));
                    }
                }
            }
        }
    }

    // Captures
    let capture_offsets = [-1, 1];
    for &offset in &capture_offsets {
        let r_cap = r_idx + direction;
        let f_cap = f_idx + offset;

        if is_on_board(r_cap, f_cap) {
            let target = board[r_cap as usize][f_cap as usize];
            if target != E {
                let target_color = get_piece_color(target);
                if target_color != color {
                    legal_moves.push((r_cap as usize, f_cap as usize));
                }
            }
        }
    }

    legal_moves
}

fn get_sliding_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
    directions: &[(isize, isize)],
) -> Vec<(usize, usize)> {
    let mut legal_moves = Vec::new();
    let (rank, file) = position;

    for &(dr, df) in directions {
        let mut r = rank as isize + dr;
        let mut f = file as isize + df;

        while is_on_board(r, f) {
            let u_r = r as usize;
            let u_f = f as usize;
            let piece = board[u_r][u_f];

            if piece == E {
                legal_moves.push((u_r, u_f));
            } else {
                // Blocked
                // Add capture move as well if blocked by opponent's stone
                if get_piece_color(piece) != color {
                    legal_moves.push((u_r, u_f));
                }
                break;
            }

            r += dr;
            f += df;
        }
    }
    legal_moves
}

fn get_bishop_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)];
    get_sliding_legals(board, color, position, &directions)
}

fn get_rook_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let directions = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    get_sliding_legals(board, color, position, &directions)
}

fn get_queen_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let directions = [
        (-1, -1),
        (-1, 1),
        (1, -1),
        (1, 1),
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
    ];
    get_sliding_legals(board, color, position, &directions)
}

fn get_king_legals(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let mut legal_moves = Vec::new();
    let (rank, file) = position;
    let r_idx = rank as isize;
    let f_idx = file as isize;

    let moves = [
        (r_idx - 1, f_idx - 1),
        (r_idx - 1, f_idx),
        (r_idx - 1, f_idx + 1),
        (r_idx, f_idx - 1),
        (r_idx, f_idx + 1),
        (r_idx + 1, f_idx - 1),
        (r_idx + 1, f_idx),
        (r_idx + 1, f_idx + 1),
    ];

    for (r, f) in moves {
        if is_on_board(r, f) {
            let u_r = r as usize;
            let u_f = f as usize;
            let piece = board[u_r][u_f];

            if piece == E || get_piece_color(piece) != color {
                legal_moves.push((u_r, u_f));
            }
        }
    }
    legal_moves
}

fn get_legal_moves(
    board: &[[i8; 8]; 8],
    color: Color,
    position: (usize, usize),
) -> Vec<(usize, usize)> {
    let (rank, file) = position;

    let r_idx = rank as usize;
    let f_idx = file as usize;

    let piece_type = board[r_idx][f_idx].abs();
    match piece_type {
        WN => get_knight_legals(board, color, position),
        WP => get_pawn_legals(board, color, position),
        WB => get_bishop_legals(board, color, position),
        WR => get_rook_legals(board, color, position),
        WQ => get_queen_legals(board, color, position),
        WK => get_king_legals(board, color, position),
        _ => Vec::new(),
    }
}

pub fn get_all_legal_moves(
    board: &[[i8; 8]; 8],
    color: Color,
) -> Vec<((usize, usize), (usize, usize))> {
    let mut all_legal_moves = Vec::new();
    for rank in 0..8 {
        for file in 0..8 {
            let piece = board[rank][file];
            if piece == E {
                continue;
            }
            let piece_color = get_piece_color(board[rank][file]);
            if piece_color != color {
                continue;
            }
            let legal_moves = get_legal_moves(board, color, (rank, file));
            for legal_move in legal_moves {
                all_legal_moves.push(((rank, file), legal_move));
            }
        }
    }
    all_legal_moves
}
