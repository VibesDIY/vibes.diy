// The whole-file codegen handler (Plan: generation-core verify gate).
//
// Runs the agentic write_file tool-loop (Task 5/6) behind the existing
// block-stream wire protocol, so the unchanged client preview renders a
// whole-file generation exactly like the SEARCH/REPLACE path. The handler is a
// thin orchestrator: assemble the agentic system prompt, run the loop, then emit
// the deterministic block sequence and persist the resolved files through the
// same `handlePromptContext` the LLM/FS paths use.
//
// Emission ordering (important): the client section reducer
// (components/MessageList.tsx) is a strict sequential state machine — a
// `block.code.end` consumes the *last* `block.code.begin` it saw, so if any
// `code.end`/`block.end` reaches the client before its `code.begin` it builds a
// block with `begin: undefined` and crashes on `block.begin.sectionId`. Code
// cards only materialize when `block.end` flushes them. So events must arrive
// strictly ordered, one section at a time (`code.begin → code.line* →
// code.end`), sections never interleaved, `block.begin` first and `block.end`
// last.
//
// We stream live: `block.begin` opens the turn immediately (the keepalive
// anchor — the client's 45s stream watchdog flips to "Reconnecting" on a silent
// gap, which the old reveal-on-completion path hit during the ~30-60s the loop
// ran silent), then `onLine` drips each completed file line as the model writes
// it, then `block.end` reveals the cards. `onLine` fires synchronously from the
// stream consumer, so every event is pushed onto a single awaited promise chain
// (NOT fire-and-forget `void emit(...)`, which reordered a code.end ahead of its
// code.begin and crashed the client) — guaranteeing on-wire order == emit order.
// The resolved files are persisted separately via the canonical
// `buildBlockEvents` sequence, so reload is always complete and exact
// regardless of any live-stream imperfection.
//
// Workers-safe by construction: the loop's gate is `verifyFiles` (pure JS +
// the structural scoring helper), never esbuild. Nothing here imports a
// node-only module. The collaborators that touch the DB / websocket
// (`appendBlockEvent`, `handlePromptContext`) and the live request context are
// injected via `deps`, so this module stays decoupled from
// `prompt-chat-section.ts` (which wires it, behind the USE_WHOLE_FILE_CODEGEN
// flag, in Task 8) and is unit-testable with plain fakes.

import { Option, Result } from "@adviser/cement";
import type { BlockBeginMsg, BlockEndMsg, CodeBeginMsg, CodeEndMsg, CodeLineMsg, FileSystemRef } from "@vibes.diy/call-ai-v2";
import type { PromptAndBlockMsgs, VibeFile } from "@vibes.diy/api-types";
import { buildBlockEvents } from "../intern/codegen-loop/emit-blocks.js";
import type { OnLine, WholeFileResult } from "../intern/codegen-loop/whole-file-loop.js";

/**
 * Persist contract consumed from `prompt-chat-section.ts#handlePromptContext`.
 * Typed structurally (not imported by value) so this handler does not depend on
 * the call-site module's internal wiring; Task 8 passes the real function. When
 * `fileSystem` is supplied, persistence uses it verbatim and skips
 * SEARCH/REPLACE resolution.
 */
export type HandlePromptContextFn = (args: {
  promptId: string;
  blockSeq: number;
  value: BlockEndMsg;
  collectedMsgs: PromptAndBlockMsgs[];
  fileSystem?: VibeFile[];
}) => Promise<Result<{ blockSeq: number; fsRef: Option<FileSystemRef> }>>;

/**
 * Live-emit contract consumed from `prompt-chat-section.ts#appendBlockEvent`.
 * The handler only ever calls it with `emitMode: "emit-only"` (the canonical
 * persisted copy is written once by `handlePromptContext`).
 */
export type AppendBlockEventFn = (args: {
  promptId: string;
  blockSeq: number;
  evt: PromptAndBlockMsgs;
  emitMode: "emit-only";
}) => Promise<Result<void>>;

/** The single field this handler reads off the session doc to compose the system prompt. */
export interface WholeFileCodegenSessionDoc {
  userPrompt?: string;
  [key: string]: unknown;
}

/**
 * System-prompt builder contract (Task 3's agentic variant). Typed structurally
 * so the handler does not pull `@vibes.diy/prompts` types into its surface; the
 * call site passes the real `makeBaseSystemPrompt`.
 */
export type MakeBaseSystemPromptFn = (
  model: string,
  sessionDoc: WholeFileCodegenSessionDoc & { variant: "agentic-whole-file" }
) => Promise<{ systemPrompt: string }>;

/** The loop entry point (Task 5/6), injected so the handler can be tested with a fake. */
export type RunWholeFileCodegenFn = (args: {
  systemPrompt: string;
  userPrompt: string;
  needsAccess: boolean;
  maxSteps: number;
  maxCostUsd: number;
  model: string | ((ctx: { numberOfTurns: number }) => string);
  onLine?: OnLine;
}) => Promise<WholeFileResult>;

export interface WholeFileCodegenDeps {
  /** The promptId for this turn (block events stream under it). */
  promptId: string;
  /** The seq the next block event uses (handed in by the call site's allocator). */
  blockSeq: number;
  /** Id allocator: a fresh, collision-resistant id string per call. */
  nextId: () => string;
  /** The user's app-request text (already extracted from the prompt messages). */
  userPrompt: string;
  /** Session/settings doc forwarded into the agentic system prompt (theme/style/skills/etc.). */
  sessionDoc: WholeFileCodegenSessionDoc;
  /** Whether the app needs per-document permissions (drives the access.js gate). */
  needsAccess: boolean;
  /** Model id (or selector) used on the first turn — the strong/frontier model. */
  frontierModel: string;
  /** Model id used after the first turn — the cheaper fix-up model. */
  cheapModel: string;
  /** Hard cap on tool-loop steps. */
  maxSteps: number;
  /** Hard cap on spend (USD) for the loop. */
  maxCostUsd: number;
  /** Terminal signal shared with the call site's `.finally()` (see PromptTerminalSignal). */
  terminal: { promptBlockEndEmitted: boolean };

  // Injected collaborators (bound to the live request at the call site).
  makeBaseSystemPrompt: MakeBaseSystemPromptFn;
  runWholeFileCodegen: RunWholeFileCodegenFn;
  appendBlockEvent: AppendBlockEventFn;
  handlePromptContext: HandlePromptContextFn;
}

/** Tag a file's language from its extension: jsx/tsx → "jsx", everything else → "js". */
function langFor(filename: string): string {
  return filename.endsWith(".jsx") || filename.endsWith(".tsx") ? "jsx" : "js";
}

/**
 * Run the whole-file codegen turn end to end and return the final block
 * sequence — the same return contract the existing LLM/FS handlers produce.
 *
 * Sequence:
 *   1. Build the agentic system prompt (`variant: "agentic-whole-file"`).
 *   2. Open the live block (`block.begin`) and run the loop, streaming each
 *      completed file line live through `onLine` (serialized, in order).
 *   3. Reconcile the live stream against the resolved files (close the open
 *      section, emit any file that produced no streamed line), then close the
 *      block (`block.end` — the client's card-reveal signal).
 *   4. Persist the resolved files + canonical `buildBlockEvents` sequence via
 *      `handlePromptContext` (DB only; never re-emitted to the wire).
 *
 * `prompt.block-end` (the UI-release signal, distinct from `block.end`) is the
 * call site's responsibility — it owns the shared `terminal` flag and emits it
 * once around persistence, exactly as the LLM/FS paths do via `handleEndMsg`.
 */
export async function handleWholeFileCodegenRequest(deps: WholeFileCodegenDeps): Promise<Result<number>> {
  const {
    promptId,
    nextId,
    userPrompt,
    sessionDoc,
    needsAccess,
    frontierModel,
    cheapModel,
    maxSteps,
    maxCostUsd,
    makeBaseSystemPrompt,
    runWholeFileCodegen,
    appendBlockEvent,
    handlePromptContext,
  } = deps;

  // 1. Agentic system prompt — same placeholder substitution as the existing
  //    templates, just the whole-file write_file output protocol (Task 3).
  const { systemPrompt } = await makeBaseSystemPrompt(frontierModel, {
    ...sessionDoc,
    variant: "agentic-whole-file",
  });

  // Stable ids for this block. A single blockId groups the whole turn; each
  // file gets its own sectionId (allocated lazily on first sight so the live
  // stream and the persisted `buildBlockEvents` sequence agree on section
  // identity — stable React keys across the live→reload transition).
  const blockId = nextId();
  const sectionIds = new Map<string, string>();
  const sectionIdFor = (filename: string): string => {
    let id = sectionIds.get(filename);
    if (id === undefined) {
      id = nextId();
      sectionIds.set(filename, id);
    }
    return id;
  };

  // --- Serialized live wire emitter -------------------------------------------
  // `onLine` fires synchronously from the stream consumer, so we cannot await
  // per line. Instead every event is pushed onto a single promise chain that
  // awaits each `appendBlockEvent` before the next, so on-wire order == enqueue
  // order without blocking the stream. `blockSeq` (the wire/persistence seq) is
  // bumped synchronously at enqueue time so it reflects all live events by the
  // time `handlePromptContext` continues from it; `liveSeq` is the block-relative
  // seq embedded in each event.
  let blockSeq = deps.blockSeq;
  let liveSeq = 0;
  let chain: Promise<void> = Promise.resolve();
  let firstErr: Result<void> | undefined;
  const enqueue = (evt: PromptAndBlockMsgs): void => {
    const wireSeq = blockSeq++;
    chain = chain.then(async () => {
      if (firstErr) return; // a prior send failed — stop emitting this turn
      const r = await appendBlockEvent({ promptId, blockSeq: wireSeq, evt, emitMode: "emit-only" });
      if (r.isErr()) firstErr = Result.Err(r);
    });
  };
  const base = () => ({ blockId, streamId: promptId, blockNr: 0, timestamp: new Date() });
  const emitBlockBegin = (): void => {
    enqueue({ type: "block.begin", seq: liveSeq++, ...base() } satisfies BlockBeginMsg);
  };
  const emitCodeBegin = (filename: string, lang: string): void => {
    enqueue({
      type: "block.code.begin",
      sectionId: sectionIdFor(filename),
      lang,
      path: filename,
      seq: liveSeq++,
      ...base(),
    } satisfies CodeBeginMsg);
  };
  const emitCodeLine = (filename: string, lang: string, line: string, lineNr: number): void => {
    enqueue({
      type: "block.code.line",
      sectionId: sectionIdFor(filename),
      lang,
      path: filename,
      line,
      lineNr,
      seq: liveSeq++,
      ...base(),
    } satisfies CodeLineMsg);
  };
  const emitCodeEnd = (filename: string, lang: string, lines: number, bytes: number): void => {
    enqueue({
      type: "block.code.end",
      sectionId: sectionIdFor(filename),
      lang,
      path: filename,
      stats: { lines, bytes },
      seq: liveSeq++,
      ...base(),
    } satisfies CodeEndMsg);
  };

  // --- Live per-file framing driven by `onLine` ------------------------------
  // `onLine` delivers each newly-completed (newline-terminated) line per file.
  // Open a section on first sight of a file, close the previous one before
  // opening the next (never interleave), and track per-file line/byte counts for
  // the closing `code.end` stats.
  const streamedFiles = new Set<string>();
  const lineCount = new Map<string, number>();
  const byteCount = new Map<string, number>();
  let openFile: string | null = null;
  const onLine: OnLine = (filename, lang, line, lineNr) => {
    if (openFile !== filename) {
      if (openFile !== null) {
        emitCodeEnd(openFile, langFor(openFile), lineCount.get(openFile) ?? 0, byteCount.get(openFile) ?? 0);
      }
      openFile = filename;
      streamedFiles.add(filename);
      emitCodeBegin(filename, lang);
    }
    emitCodeLine(filename, lang, line, lineNr);
    lineCount.set(filename, (lineCount.get(filename) ?? 0) + 1);
    byteCount.set(filename, (byteCount.get(filename) ?? 0) + new TextEncoder().encode(line).length + 1);
  };

  // Open the block immediately — the keepalive anchor (see file header).
  emitBlockBegin();

  // 2. Run the loop, streaming completed file lines live through `onLine`.
  const result = await runWholeFileCodegen({
    systemPrompt,
    userPrompt,
    needsAccess,
    maxSteps,
    maxCostUsd,
    // Frontier on the first turn, the cheaper fix-up model thereafter (Task 6).
    model: (ctx) => (ctx.numberOfTurns > 1 ? cheapModel : frontierModel),
    onLine,
  });

  // 3a. Reconcile the live stream against the resolved files. Close the still-open
  //     section, topping it up to its final content — the line emitter withholds
  //     a file's trailing partial line until its newline arrives, and for the last
  //     file that newline never comes.
  const byName = new Map(result.files.map((f) => [f.filename, f] as const));
  if (openFile !== null) {
    const f = byName.get(openFile);
    if (f) {
      const finalLines = f.content.split("\n");
      for (let nr = lineCount.get(openFile) ?? 0; nr < finalLines.length; nr++) {
        emitCodeLine(openFile, f.lang, finalLines[nr], nr);
      }
      emitCodeEnd(openFile, f.lang, finalLines.length, new TextEncoder().encode(f.content).length);
    } else {
      emitCodeEnd(openFile, langFor(openFile), lineCount.get(openFile) ?? 0, byteCount.get(openFile) ?? 0);
    }
    openFile = null;
  }

  // 3b. Emit any file that produced no streamed line at all (single-line or
  //     no-trailing-newline files never fire `onLine`) as a full section.
  for (const f of result.files) {
    if (streamedFiles.has(f.filename)) continue;
    emitCodeBegin(f.filename, f.lang);
    const lines = f.content.split("\n");
    for (let nr = 0; nr < lines.length; nr++) emitCodeLine(f.filename, f.lang, lines[nr], nr);
    emitCodeEnd(f.filename, f.lang, lines.length, new TextEncoder().encode(f.content).length);
  }

  // 4. Build the canonical block sequence from the resolved files — the source
  //    of truth replayed on reload (always complete and exact, independent of
  //    any live-stream imperfection). Persisted, not re-emitted to the wire:
  //    block.begin → (per file: code.begin → code.line* → code.end) → block.end,
  //    the closing block.end carrying the turn's token usage.
  let seqForBuild = 0;
  const collectedMsgs = buildBlockEvents(result.files, {
    blockId,
    streamId: promptId,
    sectionIdFor,
    nextSeq: () => seqForBuild++,
    blockNr: 0,
    usage: {
      given: [],
      calculated: {
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
      },
    },
  });
  const blockEnd = collectedMsgs[collectedMsgs.length - 1] as BlockEndMsg;

  // 5. Close the live block. MessageList materializes the code cards on
  //    block.end, so this is the reveal/finalize signal. Reuse the canonical
  //    block.end's stats/usage; the live copy carries no fsRef yet (the
  //    post-persist re-emit that supplies fsRef is a tracked follow-up).
  enqueue({ ...blockEnd, seq: liveSeq++, timestamp: new Date() });

  // Drain the serialized emit chain and surface the first send failure, if any.
  await chain;
  if (firstErr) return Result.Err(firstErr);

  // 6. Persist. Hand the resolved files in directly so handlePromptContext
  //    skips SEARCH/REPLACE resolution and writes them verbatim, then records
  //    usage + fsRef. Returns the advanced block sequence.
  const vibeFiles: VibeFile[] = result.files.map((f) => ({
    type: "code-block" as const,
    filename: f.filename,
    lang: langFor(f.filename),
    content: f.content,
  }));

  const rPersist = await handlePromptContext({
    promptId,
    blockSeq,
    value: blockEnd,
    collectedMsgs,
    fileSystem: vibeFiles,
  });
  if (rPersist.isErr()) return Result.Err(rPersist);

  return Result.Ok(rPersist.Ok().blockSeq);
}
