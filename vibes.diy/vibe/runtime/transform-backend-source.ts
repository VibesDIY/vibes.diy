import { transformVibeSource, type TransformResult } from "./transform-vibe-source.js";

/**
 * Compile a vibe's `backend.js` source to an ESM JavaScript string (#2856, slice
 * B1).
 *
 * Backend handlers are authored as plain JS/TS (no JSX is required, though it is
 * tolerated), so the transform is identical to the vibe-source transform —
 * strip TS types, Workers-safe Sucrase, no `eval`/wasm, no import resolution.
 * This thin wrapper gives backend its own named seam so the options can diverge
 * later (e.g. dropping the `jsx` transform) without touching call sites.
 */
export function transformBackendSource(src: string): TransformResult {
  return transformVibeSource(src);
}
