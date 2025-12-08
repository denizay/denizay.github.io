pub mod chess;
use crate::chess::engine::{get_best_move, get_opponent, make_move};
use crate::chess::pieces::*;

fn get_piece_symbol(piece: i8) -> &'static str {
    match piece {
        WK => "♔",
        WQ => "♕",
        WR => "♖",
        WB => "♗",
        WN => "♘",
        WP => "♙",

        BK => "♚",
        BQ => "♛",
        BR => "♜",
        BB => "♝",
        BN => "♞",
        BP => "♟",

        E => "·",
        _ => "?",
    }
}

fn print_board(board: &[[i8; 8]; 8]) {
    println!("   A B C D E F G H\n");
    for row in 0..8 {
        print!("{}  ", 8 - row);
        for col in 0..8 {
            let piece = board[row][col];
            print!("{} ", get_piece_symbol(piece));
        }
        println!();
    }
    println!();
}

fn main() {
    let mut board: [[i8; 8]; 8] = [
        [BR, BN, BB, BQ, BK, BB, BN, BR],
        [BP, BP, BP, BP, BP, BP, BP, BP],
        [E, E, E, E, E, E, E, E],
        [E, E, E, E, E, E, E, E],
        [E, E, E, E, E, E, E, E],
        [E, E, E, E, E, E, E, E],
        [WP, WP, WP, WP, WP, WP, WP, WP],
        [WR, WN, WB, WQ, WK, WB, WN, WR],
    ];
    print_board(&board);
    let mut color = Color::White;
    for _ in 0..100 {
        let best_move = get_best_move(&board, color, 4);
        match best_move {
            Some(best_move) => {
                println!("{}", best_move.0 .0);
                make_move(&mut board, best_move);
                print_board(&board);
                color = get_opponent(color);
            }
            None => {
                println!("Game Over! No moves left.");
                break;
            }
        }
    }
}
