/* tslint:disable */
/* eslint-disable */

export function calculate_fib(n: number): number;

export function get_all_legal_moves(board: Int8Array, color_int: number, castling_rights: number): Uint32Array;

export function get_best_move(board: Int8Array, color_int: number, depth: number, castling_rights: number, use_pruning: boolean, use_move_ordering: boolean): Uint32Array;

export function is_in_check(board: Int8Array, color_int: number): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly get_all_legal_moves: (a: number, b: number, c: number, d: number) => [number, number];
  readonly get_best_move: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly is_in_check: (a: number, b: number, c: number) => number;
  readonly calculate_fib: (a: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
