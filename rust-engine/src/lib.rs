use wasm_bindgen::prelude::*;

// Import the math module
mod math;

// Expose the function to JavaScript
#[wasm_bindgen]
pub fn calculate_fib(n: u32) -> u32 {
    math::fibonacci(n)
}