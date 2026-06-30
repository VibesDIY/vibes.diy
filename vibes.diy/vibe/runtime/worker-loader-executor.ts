import { TxtEnDecoderSingleton } from "@adviser/cement";
import { transformVibeSource } from "./transform-vibe-source.js";
import { type Executor, type VibeExecuteInput, type VibeExecuteResult } from "./vibe-executor.js";
import { loadSsrIsolateDeps } from "./ssr-isolate-deps.js";

/**
 * Cloudflare Worker Loader `WorkerCode` — the runtime-supplied code that
 * `env.LOADER.get` instantiates into a fresh V8 isolate. Minimal slice-2 shape:
 * a named main module plus the module map it imports from.
 */
export interface WorkerCode {
  readonly compatibilityDate: string;
  readonly mainModule: string;
  readonly modules: Record<string, string>;
  /**
   * Outbound-network policy for the loaded isolate. The Worker Loader API
   * defaults a missing `globalOutbound` to INHERITING the parent worker's
   * network access, so untrusted vibe code could `fetch()`/`connect()` the
   * public Internet from the edge. We pin it to `null` (no outbound) as the
   * secure default. Slice 3 will replace this with an explicit restricted
   * binding (a Fireproof reader) when the data path needs proxied access.
   */
  readonly globalOutbound: null;
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
 *
 * The live path supplies `depModules` (#2845 cb2): Cloudflare's Worker Loader
 * does not resolve npm specifiers, so `@vibes.diy/vibe-runtime/render-vibes.js`
 * and the vibe's `react` / `react/jsx-runtime` imports must be pre-bundled into
 * the `modules` map. Those entries come from the generated SSR isolate dep bundle
 * (scripts/build-ssr-isolate-deps.mjs); the executor merges them in. Omitting
 * `depModules` yields the slice-2 shape (just main + vibe) — still used by the
 * pure-shaping unit tests, whose fake binding echoes a Response and never loads
 * the modules, so the unresolved imports are harmless there.
 */
export function buildVibeWorkerCode(input: {
  module: string;
  mountParams: unknown;
  depModules?: Record<string, string>;
}): WorkerCode {
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
      // Dep modules first so a vibe can never shadow `react` / render-vibes by
      // colliding on a reserved key; main + vibe are written last.
      ...(input.depModules ?? {}),
      [MAIN_MODULE]: main,
      [VIBE_MODULE]: input.module,
    },
    globalOutbound: null,
  };
}

/**
 * Hex SHA-256 — the `env.LOADER.get` id, so identical code reuses one isolate.
 * Hashes the per-vibe modules (main + vibe) plus `depVersion` — a content digest
 * of the bundled dep modules — NOT the full multi-hundred-KB bundle inline: the
 * deps are identical across every vibe, so folding their content into each
 * per-vibe hash would be wasted work, while `depVersion` still re-keys the isolate
 * whenever ANY dep changes (render-vibes, react-dom/server, arktype, shims, React
 * — #2967 Codex P2), preventing stale-runtime isolate reuse after a deploy.
 */
async function hashWorkerCode(code: WorkerCode, depVersion: string): Promise<string> {
  const payload = `${code.compatibilityDate}\n${code.mainModule}\n${code.modules[MAIN_MODULE]}\n${code.modules[VIBE_MODULE]}\n${depVersion}`;
  // `TxtEnDecoderSingleton().encode` is the cement UTF-8 encoder `sthis.txt`
  // wraps — rules-bag forbids `new TextEncoder` directly.
  const digest = await crypto.subtle.digest("SHA-256", TxtEnDecoderSingleton().encode(payload));
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
    // Pre-bundled react / react-dom-server / render-vibes modules so the isolate
    // resolves every import with no npm resolution at the edge (#2845 cb2). Absent
    // (empty) only in unbuilt unit runs, where the fake binding never loads them.
    const deps = await loadSsrIsolateDeps();
    const code = buildVibeWorkerCode({ module, mountParams: input.mountParams, depModules: deps.modules });
    const id = await hashWorkerCode(code, deps.depsVersion);
    const stub = this.loader.get(id, () => code);
    const response = await stub.getEntrypoint().fetch(new Request(SSR_REQUEST_URL));
    return { html: await response.text() };
  }
}
