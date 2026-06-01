import type { Logger } from "@adviser/cement";
import type { VibeFile } from "@vibes.diy/api-types";
import {
  applyEdits,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  parseFenceBody,
  type ApplyEditsError,
  type CodeBeginMsg,
  type CodeEndMsg,
  type CodeLineMsg,
  type CodeMsg,
  type FenceParseError,
} from "@vibes.diy/call-ai-v2";

export interface CodeBlocks {
  begin: CodeBeginMsg;
  lines: CodeLineMsg[];
  end?: CodeMsg;
}

// Resolve a sequence of streamed code blocks into a VibeFile[] by grouping
// blocks by their `path` (aider-style), running parseFenceBody on each
// block's body, and applying the resulting edits in order. A body with no
// SEARCH markers is a `create`; bodies with markers are `replace` edits.
//
// `seed` carries prior-turn file content keyed by filename — required so
// that a turn consisting only of `replace` blocks can compose against the
// previously persisted state. Without it, SEARCH would run against an
// empty buffer and produce a 0-byte App.jsx.
//
// Falls back to filename `/App.jsx` when a block has no `path` (back-compat
// for blocks emitted before block-stream tracked path lines).
export function resolveCodeBlocksToFileSystem(blocks: readonly CodeBlocks[], seed?: ReadonlyMap<string, string>): VibeFile[] {
  const byPath = new Map<string, { lang: string; lines: string[][] }>();
  for (const block of blocks) {
    if (!block.end) continue;
    const path = block.begin.path ?? "App.jsx";
    const langRaw = block.begin.lang.toLowerCase();
    const lang = ["js", "jsx"].includes(langRaw) ? "jsx" : langRaw;
    const acc = byPath.get(path) ?? { lang, lines: [] };
    acc.lines.push(block.lines.map((l) => l.line));
    byPath.set(path, acc);
  }
  const result: VibeFile[] = [];
  for (const [path, { lang, lines }] of byPath.entries()) {
    const filename = path.startsWith("/") ? path : `/${path}`;
    let resolved = seed?.get(filename) ?? seed?.get(path) ?? "";
    for (const blockLines of lines) {
      const parsed = parseFenceBody(blockLines);
      const r = applyEdits(resolved, parsed.edits);
      resolved = r.content;
    }
    result.push({
      type: "code-block",
      filename,
      lang,
      content: resolved,
    });
  }
  // Carry forward seed entries for files this turn didn't touch.
  if (seed) {
    for (const [seededName, seededContent] of seed.entries()) {
      const filename = seededName.startsWith("/") ? seededName : `/${seededName}`;
      const path = filename.startsWith("/") ? filename.slice(1) : filename;
      if (byPath.has(path) || byPath.has(filename)) continue;
      // Determine lang from extension.
      const ext = filename.match(/\.([^.]+)$/)?.[1] ?? "jsx";
      const lang = ["js", "jsx"].includes(ext.toLowerCase()) ? "jsx" : ext.toLowerCase();
      result.push({
        type: "code-block",
        filename,
        lang,
        content: seededContent,
      });
    }
  }
  return result;
}

// Per-block streaming apply-error observer. Mirrors the parseFenceBody +
// applyEdits work that resolveCodeBlocksToFileSystem performs at end-of-turn,
// but runs against each block.code.end as it arrives so we can surface apply
// errors the moment they happen. The end-of-turn resolver still produces the
// authoritative VibeFile[] for storage — this path is observability only and
// must not mutate any state visible to the wire output.
//
// Filename normalization mirrors resolveCodeBlocksToFileSystem so the running
// vfs sees the same content the end-of-turn pass would compose against.
export interface ApplyErrorEvent {
  readonly chatId: string;
  readonly promptId: string;
  readonly blockId: string;
  readonly sectionId: string;
  // "fence-parse" → parseFenceBody flagged a structural problem before edits ran.
  // "apply" → an individual SEARCH/REPLACE edit failed to match.
  readonly kind: "fence-parse" | "apply";
  readonly reason: string;
  readonly searchPrefix?: string;
}

export interface StreamingResolverDeps {
  readonly chatId: string;
  readonly promptId: string;
  readonly seed: ReadonlyMap<string, string>;
  readonly onApplyError: (evt: ApplyErrorEvent) => void;
}

// Result of applying one closed block. Returned from observeBlock so a
// caller (e.g. the recovery orchestrator) can decide what to do without
// re-running parseFenceBody/applyEdits against a parallel vfs.
export interface BlockApplyResult {
  readonly path: string;
  readonly errors: readonly ApplyErrorEvent[];
}

export interface StreamingResolver {
  readonly observeBlock: (block: { begin: CodeBeginMsg; lines: readonly CodeLineMsg[]; end: CodeEndMsg }) => BlockApplyResult;
  // Snapshot of the resolver's running per-path content. The recovery
  // orchestrator passes this to buildRecoveryRequest as the CURRENT FILES
  // section. Returns a fresh Map so callers cannot mutate internal state.
  readonly getVfs: () => ReadonlyMap<string, string>;
}

function normalizeFilename(rawPath: string | undefined): string {
  const path = rawPath ?? "App.jsx";
  return path.startsWith("/") ? path : `/${path}`;
}

function searchPrefixOf(search: string): string {
  // First non-empty line, capped to 80 chars — enough to identify the failing
  // edit in logs without spilling an entire file body into the metric stream.
  const firstLine = search.split("\n").find((l) => l.trim().length > 0) ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

export function createStreamingResolver(deps: StreamingResolverDeps): StreamingResolver {
  // Running per-path content. Seeded lazily on first touch of each path so
  // create-only blocks don't read stale content from prior turns.
  const vfs = new Map<string, string>();
  const seedFor = (filename: string, rawPath: string): string => {
    return deps.seed.get(filename) ?? deps.seed.get(rawPath) ?? "";
  };
  return {
    observeBlock(block) {
      const rawPath = block.begin.path ?? "App.jsx";
      const filename = normalizeFilename(rawPath);
      const current = vfs.has(filename) ? (vfs.get(filename) ?? "") : seedFor(filename, rawPath);
      const parsed = parseFenceBody(block.lines.map((l) => l.line));
      const errors: ApplyErrorEvent[] = [];
      for (const fenceErr of parsed.errors) {
        const evt: ApplyErrorEvent = {
          chatId: deps.chatId,
          promptId: deps.promptId,
          blockId: block.end.blockId,
          sectionId: block.end.sectionId,
          kind: "fence-parse",
          reason: fenceErr.kind,
        };
        deps.onApplyError(evt);
        errors.push(evt);
      }
      const applied = applyEdits(current, parsed.edits);
      for (const applyErr of applied.errors) {
        const evt: ApplyErrorEvent = {
          chatId: deps.chatId,
          promptId: deps.promptId,
          blockId: block.end.blockId,
          sectionId: block.end.sectionId,
          kind: "apply",
          reason: applyErr.reason,
          searchPrefix: searchPrefixOf(applyErr.search),
        };
        deps.onApplyError(evt);
        errors.push(evt);
      }
      vfs.set(filename, applied.content);
      return { path: filename, errors };
    },
    getVfs() {
      return new Map(vfs);
    },
  };
}

// Tracks open `block.code.*` messages by blockId and emits a closed
// {begin, lines, end} triple as soon as the matching block.code.end arrives.
// Used by both the streaming pipeline (handleLlmResponse) and the end-of-turn
// replay (handlePromptContext) so the two paths agree on how lines map to
// blocks. Keying by blockId is required for the streaming path because
// nothing in the protocol guarantees code lines for different blocks don't
// interleave; the end-of-turn path benefits from the same routing instead of
// the older positional "latest open block" heuristic.
export interface ClosedCodeBlock {
  readonly begin: CodeBeginMsg;
  readonly lines: readonly CodeLineMsg[];
  readonly end: CodeEndMsg;
}

export interface BlockAccumulator {
  readonly ingest: (msg: unknown) => ClosedCodeBlock | undefined;
}

export function createBlockAccumulator(): BlockAccumulator {
  const open = new Map<string, { begin: CodeBeginMsg; lines: CodeLineMsg[] }>();
  return {
    ingest(msg) {
      if (isCodeBegin(msg)) {
        open.set(msg.blockId, { begin: msg, lines: [] });
        return undefined;
      }
      if (isCodeLine(msg)) {
        open.get(msg.blockId)?.lines.push(msg);
        return undefined;
      }
      if (isCodeEnd(msg)) {
        const acc = open.get(msg.blockId);
        if (!acc) return undefined;
        open.delete(msg.blockId);
        return { begin: acc.begin, lines: acc.lines, end: msg };
      }
      return undefined;
    },
  };
}

// Adapter that builds an ApplyErrorEvent sink writing to a Logger. Kept
// separate so tests can substitute a plain collector without going through
// ensureLogger plumbing.
export function logApplyError(logger: Logger, evt: ApplyErrorEvent): void {
  // Debug, not Info: these fire on every parser hiccup (divider-as-end,
  // no-match, content-before-search) which is routine in the
  // tiny-edits design where 20–40 small SR pairs may have one or two
  // hiccups. Recovery handles them. Failures that actually matter
  // (recovery-exhausted, recovery-call-failed) stay at Info.
  logger
    .Debug()
    .Any({
      chatId: evt.chatId,
      promptId: evt.promptId,
      blockId: evt.blockId,
      sectionId: evt.sectionId,
      kind: evt.kind,
      reason: evt.reason,
      ...(evt.searchPrefix === undefined ? {} : { searchPrefix: evt.searchPrefix }),
    })
    .Msg("apply-error");
}

// For consumers (tests, future recovery PR) that want the raw types without
// reaching into apply-edits / fence-body-parser directly.
export type { ApplyEditsError, FenceParseError };
