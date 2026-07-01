import { exception2Result } from "@adviser/cement";
import { FileSystemItem } from "@vibes.diy/api-types";
// The slice-2 executor seam is server-only (it pulls react-dom/server, kept off
// the vibe-runtime client entry by the browser-iframe guard). These are reached
// through the `@vibes.diy/vibe-runtime` PACKAGE via subpath imports — a real
// package edge, not the package root (so the client-entry guard still holds) and
// not a `../../../vibe/runtime` relative reach into another package's source. The
// relative form resolved in the esbuild worker bundle but broke the standalone
// `@vibes.diy/api-svc` npm publish build (TS2307), because that build copies only
// this package's sources, leaving the out-of-package paths dangling (#2855).
import { selectExecutor, parseVibesSsrMode, type VibesSsrMode } from "@vibes.diy/vibe-runtime/vibe-executor.js";

// Re-exported so render-vibe.ts has a single import surface for the SSR wiring.
export { parseVibesSsrMode };

// Bump when the SSR-injected root-HTML body shape changes (the hydrate marker,
// the mount contract, a future slice-5 markdown layer, …) so caches that
// validated an older body shape revalidate. Part of the canonical SSR cache-key
// contract (#2845 cb3): any content-affecting change must flip the key.
export const SSR_BODY_VERSION = "v1";

/**
 * The SSR mode that actually runs on live traffic. The live render route admits
 * ONLY the isolate-backed `loader` executor — `node` is barred for security and
 * everything else is `off` (see render-vibe.ts). Single source of truth shared by
 * render-vibe (which mode to run) and the cache validator (whether the body can
 * vary), so the two can never disagree.
 */
export function liveVibeSsrMode(rawSsrEnv: string | undefined): "loader" | "off" {
  return parseVibesSsrMode(rawSsrEnv) === "loader" ? "loader" : "off";
}

/**
 * The body-affecting SSR signature folded into the root-HTML cache validator
 * (#2845 cb3). The served body is SSR-varying ONLY when the flag is `loader` AND
 * the Worker Loader binding is actually present on this deploy — otherwise
 * `loader` degrades to the empty client-only shell via `select_error`. Keying on
 * the env flag alone would leave a stale-body hole: a cache validated under
 * (flag=loader, binding absent) holding the empty shell would keep 304ing once
 * the binding lands and the body becomes SSR. So the binding presence is part of
 * the key, and the flip is symmetric on rollback (binding removed ⇒ signature
 * reverts ⇒ revalidate). Over-invalidation — e.g. a relative-import vibe that
 * still falls back to client-only under loader+binding — is the safe direction:
 * one extra revalidation, never a stale body.
 */
export function ssrBodySignature(opts: { readonly rawSsrEnv: string | undefined; readonly loaderPresent: boolean }): string {
  const active = liveVibeSsrMode(opts.rawSsrEnv) === "loader" && opts.loaderPresent;
  return active ? `loader.${SSR_BODY_VERSION}` : "off";
}
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import { hasRelativeImports } from "@vibes.diy/vibe-runtime/ssr-source-check.js";
import { resolveVibeModuleGraph, type ResolveSibling } from "@vibes.diy/vibe-runtime/resolve-vibe-module-graph.js";

/**
 * Why an SSR attempt did (`ok`) or did not produce HTML. Every non-`ok` outcome
 * ships the empty container (client-only render). `ssr_disabled` is the normal
 * flag-`off` path, not a failure. Recorded + asserted so regressions are
 * observable (per @CharlieHelps review on #2835).
 */
export type SsrFallbackReason =
  | "ssr_disabled"
  | "select_error"
  | "source_missing"
  | "entry_ambiguous"
  | "relative_import_unsupported"
  | "executor_error";

export type SsrAttempt = { reason: "ok"; ssrHtml: string } | { reason: SsrFallbackReason; ssrHtml?: undefined };

export interface AttemptVibeSsrInput {
  readonly mode: VibesSsrMode;
  /** The Cloudflare `env.LOADER` binding — required for `loader` mode. */
  readonly loader?: WorkerLoaderBinding;
  readonly fsItems: readonly FileSystemItem[];
  /** Mount context forwarded to the executor / `renderVibeToString`. */
  readonly mountParams: unknown;
  /**
   * Fetch the entry item's RAW source bytes. Injected so this stays pure and
   * unit-testable; `render-vibe.ts` supplies the real asset-store read.
   */
  readonly loadSource: (item: FileSystemItem) => Promise<string>;
}

const JS_MIME = ["text/javascript", "application/javascript"];
const CONVENTION_ENTRY = /\/App\.(jsx|tsx)$/;

export type EntrySelection = { kind: "one"; item: FileSystemItem } | { kind: "none" } | { kind: "ambiguous" };

// Directory of a vibe-absolute path: `/lib/x.jsx` → `/lib`, `/App.jsx` → `/`.
function vibeDirname(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx <= 0 ? "/" : p.slice(0, idx);
}

// Resolve a relative specifier against a vibe directory (POSIX-style, `.`/`..`).
function vibeResolve(fromDir: string, specifier: string): string {
  const segs = fromDir.split("/").filter(Boolean);
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segs.pop();
    else segs.push(part);
  }
  return `/${segs.join("/")}`;
}

// Extension/index candidates a relative import may resolve to, matched against
// the vibe's fsItems (imports commonly omit the extension or use `.jsx`).
const SIBLING_CANDIDATES = ["", ".jsx", ".tsx", ".ts", ".js", ".mjs", "/index.jsx", "/index.tsx", "/index.ts", "/index.js"];

// Back the graph resolver with the vibe's fsItems: resolve a relative specifier
// to the sibling fsItem and load its raw source. Returns null when nothing
// matches (a broken import → the caller falls back to client-only).
function makeResolveSibling(
  fsItems: readonly FileSystemItem[],
  loadSource: (item: FileSystemItem) => Promise<string>
): ResolveSibling {
  const byName = new Map(fsItems.map((i) => [i.fileName, i]));
  return async (fromPath, specifier) => {
    const base = vibeResolve(vibeDirname(fromPath), specifier);
    for (const ext of SIBLING_CANDIDATES) {
      const item = byName.get(base + ext);
      if (item) return { path: item.fileName, source: await loadSource(item) };
    }
    return null;
  };
}

/**
 * Pick the single SSR entry deterministically (no guessing, per @CharlieHelps).
 * Only the `App.jsx | App.tsx` convention entry among the jsx-to-js items counts:
 * exactly one → that item; zero → `none`; both present → `ambiguous`. (Unlike
 * render-vibe's client-mount path, SSR does NOT fall back to "all jsx items".)
 */
export function selectConventionEntry(fsItems: readonly FileSystemItem[]): EntrySelection {
  const entries = fsItems.filter(
    (i) => JS_MIME.includes(i.mimeType) && i.transform?.type === "jsx-to-js" && CONVENTION_ENTRY.test(i.fileName)
  );
  if (entries.length === 0) return { kind: "none" };
  if (entries.length > 1) return { kind: "ambiguous" };
  return { kind: "one", item: entries[0] };
}

/**
 * Attempt a server-side render of a vibe's entry component (#2802 slice 4).
 *
 * Every step — executor _selection_ (which throws on a missing-binding misconfig,
 * per slice-2 contract), entry resolution, source load, the single-file
 * relative-import gate, and the render — is caught here, so this NEVER throws and
 * always returns a structured outcome. SSR is additive: `render-vibe.ts` injects
 * `ssrHtml` (with the `data-vibe-ssr` marker) only on `ok`, and ships the empty
 * container (client-only render, today's path) on every other reason.
 */
export async function attemptVibeSsr(input: AttemptVibeSsrInput): Promise<SsrAttempt> {
  // Selection is inside the fallback boundary: a misconfigured `loader` mode with
  // no binding throws here, and must degrade to client-only, never a 500.
  const rExec = exception2Result(() => selectExecutor(input.mode, { loader: input.loader }));
  if (rExec.isErr()) return { reason: "select_error" };
  const executor = rExec.Ok();
  if (executor === undefined) return { reason: "ssr_disabled" }; // flag off — the normal path

  const entry = selectConventionEntry(input.fsItems);
  if (entry.kind === "none") return { reason: "source_missing" };
  if (entry.kind === "ambiguous") return { reason: "entry_ambiguous" };

  const rSource = await exception2Result(async () => input.loadSource(entry.item));
  if (rSource.isErr()) return { reason: "source_missing" };
  const source = rSource.Ok();
  if (source.length === 0) return { reason: "source_missing" };

  const rRelative = await exception2Result(async () => hasRelativeImports(source));
  if (rRelative.isErr()) return { reason: "executor_error" }; // can't analyze → bail safely

  // #2845 cb6: a single-file entry renders directly; an entry that imports sibling
  // files gets its whole relative-import graph resolved + transformed and shipped
  // to the isolate. A broken/unresolvable relative import degrades to client-only
  // (never a partial isolate).
  let moduleGraph: { entryKey: string; modules: Record<string, string> } | undefined;
  if (rRelative.Ok()) {
    const rGraph = await exception2Result(async () =>
      resolveVibeModuleGraph({ path: entry.item.fileName, source }, makeResolveSibling(input.fsItems, input.loadSource))
    );
    if (rGraph.isErr()) return { reason: "relative_import_unsupported" };
    moduleGraph = rGraph.Ok();
  }

  const rRender = await exception2Result(async () =>
    executor.render({ source, mountParams: input.mountParams, ...(moduleGraph ? { moduleGraph } : {}) })
  );
  if (rRender.isErr()) return { reason: "executor_error" };
  return { reason: "ok", ssrHtml: rRender.Ok().html };
}
