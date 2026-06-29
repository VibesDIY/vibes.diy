import { NodeExecutor } from "./node-executor.js";
import { WorkerLoaderExecutor, type WorkerLoaderBinding } from "./worker-loader-executor.js";

/**
 * The executor seam for vibe SSR (#2802, slice 2). Each executor takes raw vibe
 * TSX + a mount context, transforms + evaluates the component in an isolated
 * server runtime, and calls slice-1's `renderVibeToString` to produce the HTML
 * the client will hydrate.
 *
 * Two halves of the seam (see the design doc): `NodeExecutor` runs the compiled
 * module in this process (CI + the container fallback); `WorkerLoaderExecutor`
 * loads it into a fresh Cloudflare Dynamic Worker isolate at the edge. Both
 * converge on the same slice-1 renderer, deep-imported as
 * `@vibes.diy/vibe-runtime/render-vibes.js`, never through the package root
 * (the `react-dom/server` client-entry guard).
 *
 * NOTE: this module pulls `NodeExecutor` (which transitively reaches
 * `react-dom/server`), so it is intentionally NOT re-exported from `index.ts`.
 * Server callers deep-import it.
 */
export interface VibeExecuteInput {
  /** Raw vibe source (TSX/JSX). The executor transforms it itself. */
  readonly source: string;
  /** Mount context (slice-1 `VibeMountParams` shape), forwarded to `renderVibeToString`. */
  readonly mountParams: unknown;
}

export interface VibeExecuteResult {
  /** Server-rendered HTML, ready to inject into the `vibe-app-container`. */
  readonly html: string;
}

export interface Executor {
  render(input: VibeExecuteInput): Promise<VibeExecuteResult>;
}

/** `VIBES_SSR` selects the executor. `off` (the default) leaves SSR dark. */
export type VibesSsrMode = "off" | "node" | "loader";

/**
 * Parse the `VIBES_SSR` env value. Anything unrecognized — including `undefined`
 * and the empty string — falls back to `off`, the safe default mandated by the
 * design's Risks section until the Worker Loader binding is GA.
 */
export function parseVibesSsrMode(raw: string | undefined): VibesSsrMode {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "node":
      return "node";
    case "loader":
      return "loader";
    default:
      return "off";
  }
}

export interface SelectExecutorOptions {
  /** Required for `loader` mode — the Cloudflare `env.LOADER` Worker Loader binding. */
  readonly loader?: WorkerLoaderBinding;
}

/**
 * Build the executor for a `VIBES_SSR` mode. `off` ⇒ `undefined` (caller keeps
 * today's client-only iframe behavior). No call site wires this into the real
 * worker yet — route wiring is slice 4; this is a pure factory.
 */
export function selectExecutor(mode: VibesSsrMode, opts: SelectExecutorOptions = {}): Executor | undefined {
  switch (mode) {
    case "off":
      return undefined;
    case "node":
      return new NodeExecutor();
    case "loader":
      if (!opts.loader) {
        throw new Error("VIBES_SSR=loader requires a Worker Loader (env.LOADER) binding");
      }
      return new WorkerLoaderExecutor(opts.loader);
  }
}
