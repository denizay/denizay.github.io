# Personal website
I'll share my ideas, have some blog posts, some engines you can play against with and serve some models.<br>
I'm compiling Rust to WASM for high-performance client-side computation.

## Running locally

```bash
cd rust-engine
wasm-pack build --target web --out-dir ../docs/pkg

cd ../docs
python3 -m http.server
```