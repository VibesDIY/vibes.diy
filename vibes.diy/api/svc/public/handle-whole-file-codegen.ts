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
// block with `begin: undefined` and crashes on `block.begin.sectionId`. We
// therefore emit the canonical `buildBlockEvents` sequence (block.begin →
// per-file code.begin→line*→code.end → block.end) **awaited, in order**. The
// model writes whole files, so this is a fast "reveal" on completion rather than
// token-by-token streaming during generation; live per-line streaming is a
// follow-up that must preserve this strict per-file ordering.
//
// Workers-safe by construction: the loop's gate is `verifyFiles` (pure JS +
// the structural scoring helper), never esbuild. Nothing here imports a
// node-only module. The collaborators that touch the DB / websocket
// (`appendBlockEvent`, `handlePromptContext`) and the live request context are
// injected via `deps`, so this module stays decoupled from
// `prompt-chat-section.ts` (which wires it, behind the USE_WHOLE_FILE_CODEGEN
// flag, in Task 8) and is unit-testable with plain fakes.

import { Option, Result } from "@adviser/cement";
import type { BlockEndMsg, FileSystemRef } from "@vibes.diy/call-ai-v2";
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
 *   2. Run the loop to produce the complete file set.
 *   3. Build the canonical, correctly-ordered block sequence with
 *      `buildBlockEvents` and emit it to the client awaited/in-order.
 *   4. Persist the resolved files via `handlePromptContext`.
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
  // stream and the persisted `buildBlockEvents` sequence agree).
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

  // Live wire seq is independent of the sequence's embedded block seqs: every
  // emitted event consumes the next persistence seq, mirroring handleFSPrompt.
  let blockSeq = deps.blockSeq;
  const emit = (evt: PromptAndBlockMsgs): Promise<Result<void>> =>
    appendBlockEvent({ promptId, blockSeq: blockSeq++, evt, emitMode: "emit-only" });

  // 2. Run the loop to produce the complete files. (Live token-by-token
  //    streaming during generation is a deliberate follow-up — see the file
  //    header. Emitting the deterministic ordered sequence below is correct by
  //    construction and is exactly what the client section reducer expects.)
  const result = await runWholeFileCodegen({
    systemPrompt,
    userPrompt,
    needsAccess,
    maxSteps,
    maxCostUsd,
    // Frontier on the first turn, the cheaper fix-up model thereafter (Task 6).
    model: (ctx) => (ctx.numberOfTurns > 1 ? cheapModel : frontierModel),
  });

  // 3. Build the canonical block sequence for the turn:
  //    block.begin → (per file: code.begin → code.line* → code.end) → block.end.
  //    The closing block.end carries the turn's token usage.
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

  // 4. Emit the whole sequence to the client IN ORDER. Awaiting each emit
  //    serializes the sends, so the section reducer never sees a code.line or
  //    code.end before its code.begin — the fire-and-forget streaming this
  //    replaced could reorder them, building a block with `begin: undefined`
  //    and crashing the client on `block.begin.sectionId`.
  for (const msg of collectedMsgs) {
    const rEmit = await emit(msg);
    if (rEmit.isErr()) return Result.Err(rEmit);
  }

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

  return Result.Ok(rPersist.Ok().blockSeq);
}
