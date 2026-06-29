import { transformVibeSource } from "./transform-vibe-source.js";
import { type Executor, type VibeExecuteInput, type VibeExecuteResult } from "./vibe-executor.js";

/**
 * Cloudflare Worker Loader `WorkerCode` — the runtime-supplied code that
 * `env.LOADER.get` instantiates into a fresh V8 isolate. Minimal slice-2 shape:
 * a named main module plus the module map it imports from.
 */
export interface WorkerCode {
  readonly compatibilityDate: string;
  readonly mainModule: string;
  readonly modules: Record<string, string>;
}

/** The entrypoint a loaded isolate exposes — a standard fetch handler. */
export interface WorkerEntrypoint {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerStub {
  getEntrypoint(): WorkerEntrypoint;
}

/**
 * The `env.LOADER` Worker Loader binding (open beta). `get(id, factory)` returns
 * a handle to an isolate, instantiating it from `factory()` on first use and
 * reusing it for the same `id` thereafter.
 */
export interface WorkerLoaderBinding {
  get(id: string, factory: () => WorkerCode | Promise<WorkerCode>): WorkerStub;
}

const MAIN_MODULE = "main.js";
const VIBE_MODULE = "vibe.js";
// Pinned so the cache key (and isolate behavior) is reproducible. Bump
// deliberately when the runtime contract changes.
const COMPATIBILITY_DATE = "2025-05-01";
// Internal request URL — the dynamic worker only has the one fetch handler.
const SSR_REQUEST_URL = "https://vibe-ssr.internal/";

/**
 * Shape the `WorkerCode` for a compiled vibe module (#2802, slice 2). The main
 * module stitches together: the slice-1 server renderer (deep-imported as
 * `@vibes.diy/vibe-runtime/render-vibes.js`, never the package root — the
 * `react-dom/server` guard), the vibe component (a sibling module carrying the
 * already-transformed `module`), and a `fetch` default export that renders the
 * HTML with the JSON-embedded `mountParams`.
 *
 * Pure string-shaping — this is the part of the Worker Loader path that is
 * unit-testable without a live `env.LOADER` binding.
 */
export function buildVibeWorkerCode(input: { module: string; mountParams: unknown }): WorkerCode {
  const mountParamsJson = JSON.stringify(input.mountParams ?? null);
  const main = [
    `import { renderVibeToString } from "@vibes.diy/vibe-runtime/render-vibes.js";`,
    `import VibeApp from "./${VIBE_MODULE}";`,
    `const MOUNT_PARAMS = ${mountParamsJson};`,
    `export default {`,
    `  async fetch() {`,
    `    const html = renderVibeToString([VibeApp], MOUNT_PARAMS);`,
    `    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });`,
    `  },`,
    `};`,
    ``,
  ].join("\n");
  return {
    compatibilityDate: COMPATIBILITY_DATE,
    mainModule: MAIN_MODULE,
    modules: {
      [MAIN_MODULE]: main,
      [VIBE_MODULE]: input.module,
    },
  };
}

/** Hex SHA-256 of the worker code — the `env.LOADER.get` id, so identical code reuses one isolate. */
async function hashWorkerCode(code: WorkerCode): Promise<string> {
  const payload = `${code.compatibilityDate}\n${code.mainModule}\n${JSON.stringify(code.modules)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Runs a vibe in a fresh Cloudflare Dynamic Worker isolate at the edge (#2802,
 * slice 2). The `env.LOADER` binding is open beta and absent from CI, so the
 * factory only instantiates this where the binding exists (guarded by the
 * `VIBES_SSR=loader` flag + `selectExecutor`). Its `buildVibeWorkerCode` shaping
 * and `get → getEntrypoint → fetch` orchestration are unit-tested against a fake
 * binding; a live isolate load is not exercised in this repo.
 */
export class WorkerLoaderExecutor implements Executor {
  constructor(private readonly loader: WorkerLoaderBinding) {}

  async render(input: VibeExecuteInput): Promise<VibeExecuteResult> {
    const { module } = transformVibeSource(input.source);
    const code = buildVibeWorkerCode({ module, mountParams: input.mountParams });
    const id = await hashWorkerCode(code);
    const stub = this.loader.get(id, () => code);
    const response = await stub.getEntrypoint().fetch(new Request(SSR_REQUEST_URL));
    return { html: await response.text() };
  }
}
