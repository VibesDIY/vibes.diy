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
// cards only materialize when `block.end` flushes them. So the per-turn code
// must be emitted as ONE self-framed burst — `block.begin → (per file:
// code.begin → code.line* → code.end) → block.end`, in order, sections never
// interleaved — and `block.begin` must travel WITH the code, not ahead of it.
// (A `block.begin` hoisted to turn-start is missed by a client that reconnects
// mid-turn — `replayReset` drops it — so the late code burst attaches to a block
// with no opening frame and crashes. The whole sequence emitted together stays
// correctly framed even for a reconnecting client.) Every event is pushed onto a
// single awaited promise chain so on-wire order == emit order.
//
// Live streaming + keepalive: the loop's full-response stream DOES yield
// incrementally under workerd, but coarsely — the model plans for ~18s before
// the first `write_file` argument delta, then deltas arrive in ~50-line chunks
// every few seconds (Cloudflare coalesces the SSE body). We stream each completed
// line live through `onLine` and tag each `code.begin` with `reveal: "typewriter"`
// so the client paces the chunks into a steady per-line reveal. A `block.begin`
// heartbeat covers only the ~18s initial plan gap (it stops on the first streamed
// line, since once code is flowing a heartbeat `block.begin` would wipe the
// in-progress card); after that the ~few-second delta cadence keeps the client's
// 45s watchdog alive on its own. If a run ever buffers to the end, `onLine` fires
// in one burst — still self-framed — so the path degrades safely. See #2650.
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

/** How often to beat a keepalive `block.begin` during the (silent) loop, in ms. Comfortably under the client's 45s watchdog. */
const HEARTBEAT_MS = 20_000;

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

  /** UTF-8 byte length of a string (wired from `sthis.txt.encode` — no `new TextEncoder`). Drives the cosmetic code stats. */
  byteLength: (s: string) => number;

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
 *   2. Run the loop, streaming each completed file line live through `onLine`
 *      (lazy `block.begin` on the first line, then per-file
 *      code.begin(reveal)→code.line; a `block.begin` heartbeat covers only the
 *      initial plan gap — see file header).
 *   3. Reconcile against the resolved files (close the open section, top up its
 *      withheld trailing line, emit any file that never streamed a line), then
 *      `block.end` — the client's card-finalize signal.
 *   4. Persist the resolved files + the canonical `buildBlockEvents` sequence via
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
    byteLength,
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
  // burst and the persisted `buildBlockEvents` sequence agree on section
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

  // --- Serialized wire emitter ------------------------------------------------
  // Every event is pushed onto a single promise chain that awaits each
  // `appendBlockEvent` before the next, so on-wire order == enqueue order. The
  // heartbeat and the closing burst share this chain, so a heartbeat can never
  // interleave the burst (it is stopped before the burst is enqueued).
  // `blockSeq` (the wire/persistence seq) is bumped synchronously at enqueue
  // time so it reflects every emitted event by the time `handlePromptContext`
  // continues from it; `liveSeq` is the block-relative seq embedded in the
  // heartbeat events (the burst carries its own seqs from `buildBlockEvents`).
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

  // --- Keepalive heartbeat (until the first streamed line) -------------------
  // The model plans for ~18s before the first write_file argument delta; after
  // that, deltas arrive every few seconds and keep the client's 45s watchdog
  // alive on their own. So beat a benign `block.begin` until the first onLine,
  // then stop (a heartbeat block.begin splices the client's blockMsgs, which is
  // inert while empty but would WIPE an in-progress card once code is streaming).
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const heartbeat = (): void => {
    if (stopped) return;
    enqueue({
      type: "block.begin",
      seq: liveSeq++,
      blockId,
      streamId: promptId,
      blockNr: 0,
      timestamp: new Date(),
    } satisfies BlockBeginMsg);
    timer = setTimeout(heartbeat, HEARTBEAT_MS);
  };
  timer = setTimeout(heartbeat, HEARTBEAT_MS);
  const stopHeartbeat = (): void => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  // --- Live per-file framing driven by `onLine` ------------------------------
  // Emit one self-framed sequence: block.begin (lazy, on the first line) →
  // per-file code.begin(reveal) → code.line* → code.end → block.end. block.begin
  // travels WITH the code so a client that reconnected mid-turn stays framed.
  const base = () => ({ blockId, streamId: promptId, blockNr: 0, timestamp: new Date() });
  const streamedFiles = new Set<string>();
  const lineCount = new Map<string, number>();
  const byteCount = new Map<string, number>();
  let blockBegun = false;
  let openFile: string | null = null;
  const emitCodeBegin = (filename: string, lang: string): void => {
    enqueue({
      type: "block.code.begin",
      sectionId: sectionIdFor(filename),
      lang,
      path: filename,
      reveal: "typewriter",
      seq: liveSeq++,
      ...base(),
    } satisfies CodeBeginMsg);
  };
  const emitCodeLine = (args: { file: string; lang: string; line: string; lineNr: number }): void => {
    enqueue({
      type: "block.code.line",
      sectionId: sectionIdFor(args.file),
      lang: args.lang,
      path: args.file,
      line: args.line,
      lineNr: args.lineNr,
      seq: liveSeq++,
      ...base(),
    } satisfies CodeLineMsg);
  };
  const emitCodeEnd = (args: { file: string; lang: string; lines: number; bytes: number }): void => {
    enqueue({
      type: "block.code.end",
      sectionId: sectionIdFor(args.file),
      lang: args.lang,
      path: args.file,
      stats: { lines: args.lines, bytes: args.bytes },
      seq: liveSeq++,
      ...base(),
    } satisfies CodeEndMsg);
  };
  const onLine: OnLine = ({ file, lang, line, lineNr }) => {
    if (blockBegun === false) {
      blockBegun = true;
      stopHeartbeat();
      enqueue({ type: "block.begin", seq: liveSeq++, ...base() } satisfies BlockBeginMsg);
    }
    if (openFile !== file) {
      if (openFile !== null) {
        emitCodeEnd({
          file: openFile,
          lang: langFor(openFile),
          lines: lineCount.get(openFile) ?? 0,
          bytes: byteCount.get(openFile) ?? 0,
        });
      }
      openFile = file;
      streamedFiles.add(file);
      emitCodeBegin(file, lang);
    }
    emitCodeLine({ file, lang, line, lineNr });
    lineCount.set(file, (lineCount.get(file) ?? 0) + 1);
    byteCount.set(file, (byteCount.get(file) ?? 0) + byteLength(line) + 1);
  };

  // 2. Run the loop, streaming completed lines live through `onLine`.
  let result: WholeFileResult;
  try {
    result = await runWholeFileCodegen({
      systemPrompt,
      userPrompt,
      needsAccess,
      maxSteps,
      maxCostUsd,
      model: (ctx) => (ctx.numberOfTurns > 1 ? cheapModel : frontierModel),
      onLine,
    });
  } finally {
    stopHeartbeat();
  }

  // The loop's terminal verify failed (e.g. a stop-limit exit left a broken file
  // set): refuse to persist it. Drain what already streamed live, then end the
  // turn — the rejected files are never written, so a reload shows nothing.
  if (result.verify?.ok === false) {
    await chain;
    return Result.Err(`whole-file codegen produced a verify-failing file set: ${result.verify.problems.join("; ")}`);
  }

  // 3. Reconcile the live stream against the resolved files. If a run buffered,
  //    onLine fired at the end and produced the same self-framed burst; either way
  //    close the open section (topping up the withheld trailing line) and emit any
  //    file that never streamed a line as a full section.
  if (blockBegun === false) {
    blockBegun = true;
    enqueue({ type: "block.begin", seq: liveSeq++, ...base() } satisfies BlockBeginMsg);
  }
  const byName = new Map(result.files.map((f) => [f.filename, f] as const));
  if (openFile !== null) {
    const f = byName.get(openFile);
    if (f !== undefined) {
      const finalLines = f.content.split("\n");
      for (let nr = lineCount.get(openFile) ?? 0; nr < finalLines.length; nr++) {
        emitCodeLine({ file: openFile, lang: f.lang, line: finalLines[nr], lineNr: nr });
      }
      emitCodeEnd({ file: openFile, lang: f.lang, lines: finalLines.length, bytes: byteLength(f.content) });
    } else {
      emitCodeEnd({
        file: openFile,
        lang: langFor(openFile),
        lines: lineCount.get(openFile) ?? 0,
        bytes: byteCount.get(openFile) ?? 0,
      });
    }
    openFile = null;
  }
  for (const f of result.files) {
    if (streamedFiles.has(f.filename)) continue;
    emitCodeBegin(f.filename, f.lang);
    const lines = f.content.split("\n");
    for (let nr = 0; nr < lines.length; nr++) emitCodeLine({ file: f.filename, lang: f.lang, line: lines[nr], lineNr: nr });
    emitCodeEnd({ file: f.filename, lang: f.lang, lines: lines.length, bytes: byteLength(f.content) });
  }

  // 4. Build the canonical persisted sequence (also carrying the reveal marker so a
  //    reload renders identically), then close the live block.
  let seqForBuild = 0;
  const collectedMsgs = buildBlockEvents(result.files, {
    blockId,
    streamId: promptId,
    sectionIdFor,
    nextSeq: () => seqForBuild++,
    blockNr: 0,
    reveal: "typewriter",
    byteLength,
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
  enqueue({ ...blockEnd, seq: liveSeq++, timestamp: new Date() });

  await chain;
  if (firstErr) return Result.Err(firstErr);

  // 5. Persist. Hand the resolved files in directly so handlePromptContext
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

  // Convergence anchor: re-emit the canonical block.end carrying fsRef so a
  // client that flipped to "reconnecting" mid-generation settles back to "live"
  // (prompt-state.ts isBlockEnd gate is `!!block.fsRef`) and PreviewApp repoints
  // the iframe for first paint (PreviewApp.tsx isBlockEnd && msg.fsRef). The
  // pre-persist block.end above stays as the live card-finalize signal.
  const fsRefVal = rPersist.Ok().fsRef.toValue();
  if (fsRefVal !== undefined) {
    const wireSeq = blockSeq++;
    const rEnd = await appendBlockEvent({
      promptId,
      blockSeq: wireSeq,
      evt: { ...blockEnd, fsRef: fsRefVal, seq: liveSeq++, timestamp: new Date() },
      emitMode: "emit-only",
    });
    if (rEnd.isErr()) return Result.Err(rEnd);
  }

  return Result.Ok(rPersist.Ok().blockSeq);
}
