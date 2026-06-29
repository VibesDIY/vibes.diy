import { exception2Result } from "@adviser/cement";
import { FileSystemItem } from "@vibes.diy/api-types";
// The slice-2 executor seam is server-only (it pulls react-dom/server, kept off
// the vibe-runtime client entry by the browser-iframe guard). The api worker is
// bundled from monorepo source, so these are reached relatively — the same way
// the slice-2 tests deep-import render-vibes.js — not via the package root.
import { selectExecutor, parseVibesSsrMode, type VibesSsrMode } from "../../../vibe/runtime/vibe-executor.js";

// Re-exported so render-vibe.ts has a single import surface for the SSR wiring.
export { parseVibesSsrMode };
import { type WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";
import { hasRelativeImports } from "../../../vibe/runtime/ssr-source-check.js";

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
  if (rRelative.Ok()) return { reason: "relative_import_unsupported" };

  const rRender = await exception2Result(async () => executor.render({ source, mountParams: input.mountParams }));
  if (rRender.isErr()) return { reason: "executor_error" };
  return { reason: "ok", ssrHtml: rRender.Ok().html };
}
