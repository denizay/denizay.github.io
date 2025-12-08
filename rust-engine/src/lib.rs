use wasm_bindgen::prelude::*;

pub mod chess;
mod math;

#[wasm_bindgen]
pub fn calculate_fib(n: u32) -> u32 {
    math::fibonacci(n)
}

// Have to flatten the arrays for wasm
// Pass on flat arrays back and parse them in js
fn convert_flat_to_2d(flat_board: &[i8]) -> [[i8; 8]; 8] {
    let mut board_2d = [[0i8; 8]; 8];
    for i in 0..8 {
        for j in 0..8 {
            board_2d[i][j] = flat_board[i * 8 + j];
        }
    }
    board_2d
}

#[wasm_bindgen]
pub fn get_all_legal_moves(board: &[i8], color_int: i32, castling_rights: u8) -> Vec<usize> {
    let color = if color_int == 0 {
        chess::pieces::Color::White
    } else {
        chess::pieces::Color::Black
    };

    let board_2d = convert_flat_to_2d(&board);

    let moves = chess::engine::get_legal_moves(&board_2d, color, castling_rights);

    let mut flat = Vec::new();
    for ((from_rank, from_file), (to_rank, to_file)) in moves {
        flat.push(from_rank);
        flat.push(from_file);
        flat.push(to_rank);
        flat.push(to_file);
    }
    flat
}

#[wasm_bindgen]
pub fn get_best_move(board: &[i8], color_int: i32, depth: i32, castling_rights: u8) -> Vec<usize> {
    let color = if color_int == 0 {
        chess::pieces::Color::White
    } else {
        chess::pieces::Color::Black
    };

    let mut board_2d = [[0i8; 8]; 8];
    for i in 0..8 {
        for j in 0..8 {
            board_2d[i][j] = board[i * 8 + j];
        }
    }

    let best_move = chess::engine::get_best_move(&board_2d, color, depth, castling_rights);

    match best_move {
        Some(((from_rank, from_file), (to_rank, to_file))) => {
            vec![from_rank, from_file, to_rank, to_file]
        }
        None => vec![],
    }
}

#[wasm_bindgen]
pub fn is_in_check(board: &[i8], color_int: i32) -> bool {
    let color = if color_int == 0 {
        chess::pieces::Color::White
    } else {
        chess::pieces::Color::Black
    };
    let board_2d = convert_flat_to_2d(&board);
    chess::engine::is_in_check(&board_2d, color)
}
