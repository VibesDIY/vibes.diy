import { transform } from "sucrase";

/**
 * Compile a vibe's TSX/JSX source to an ESM JavaScript string (#2802, slice 2).
 *
 * Pure Sucrase, with the same options the hot-swap path uses
 * (`register-dependencies.ts` `applyHotSwap`) plus the `typescript` transform so
 * `.tsx` type annotations are stripped. Sucrase is Workers-safe — no wasm, no
 * `eval` — so this same function runs both in the Node executor (CI + container
 * fallback) and inside the Cloudflare Worker Loader isolate.
 *
 * No import-map / dependency resolution happens here: that is the executor's job
 * (Node resolves bare specifiers against its node_modules; the isolate resolves
 * them through the worker's module graph). The returned `module` still carries
 * bare specifiers like `react/jsx-runtime` exactly as Sucrase emits them.
 */
export interface TransformResult {
  /** Compiled ESM JavaScript source. */
  readonly module: string;
}

export function transformVibeSource(src: string): TransformResult {
  const { code } = transform(src, {
    transforms: ["jsx", "typescript"],
    production: true,
    jsxRuntime: "automatic",
  });
  return { module: code };
}
