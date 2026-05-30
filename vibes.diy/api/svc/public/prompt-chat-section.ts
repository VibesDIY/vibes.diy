import {
  EventoHandler,
  Result,
  Option,
  HandleTriggerCtx,
  EventoResult,
  exception2Result,
  chunkyAsync,
  BuildURI,
  URI,
} from "@adviser/cement";
import { storeAndAuditAsset } from "./store-and-audit-asset.js";
import { convertImageEvtToFileRef } from "./convert-image-evt.js";
import { Scope, scopey } from "@adviser/scopey";
import {
  InMsgBase,
  isReqCreationPromptChatSection,
  isReqPromptApplicationChatSection,
  isPromptFSStyle,
  isReqPromptFSChatSection,
  isReqPromptFSUpdateChatSection,
  isReqPromptImageChatSection,
  reqPromptImageChatSection,
  isReqPromptLLMChatSection,
  LLMHeaders,
  type PromptStyle,
  MsgBase,
  parseArrayWarning,
  PromptAndBlockMsgs,
  ReqPromptChatSection,
  reqPromptChatSection,
  ReqPromptFSChatSection,
  ReqPromptLLMChatSection,
  ReqWithVerifiedAuth,
  ResPromptChatSection,
  SectionEvent,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
  isPromptReq,
  isReqPromptFSSetChatSection,
  parseArray,
  vibeFile,
  isVibeCodeBlock,
  ActiveEntry,
  isActiveEnrichedPrompt,
  isActiveSkills,
  isActiveTheme,
  isActiveTitle,
  type SelectedSlotInput,
  type SlotConfig,
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import {
  applyEdits,
  createStatsCollector,
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  createSectionsStream,
  isBlockEnd,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isDeltaLine,
  isToplevelLine,
  LLMRequest,
  ChatMessage,
  CodeMsg,
  parseFenceBody,
  CodeBeginMsg,
  CodeLineMsg,
  FileSystemRef,
  PromptContextSql,
  BlockEndMsg,
  isBlockStreamMsg,
  isBlockImage,
  CodeEndMsg,
  BlockBeginMsg,
  type ApplyEditsError,
  type DeltaStreamMsg,
  type FenceParseError,
} from "@vibes.diy/call-ai-v2";
import type { Logger } from "@adviser/cement";
import { getRecoveryAddendum, getRecoveryStitchAddendum, makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
import { ensureAppSlugItem } from "./ensure-app-slug-item.js";
import { sqlite } from "@vibes.diy/api-sql";
import { getModelDefaults } from "../intern/get-model-defaults.js";
import {
  buildRecoveryRequest,
  buildTruncatedEvent,
  shouldAttemptRecovery,
  updateRecoveryCounter,
  type RecoveryCounter,
} from "../intern/recovery.js";
import { loadVersionTimeline, selectSlotSources, loadLatestPromptId } from "../intern/version-timeline.js";
import { assembleSlotMessages, renderSlotMessagesAs, resolveSlotConfig } from "../intern/slot-assembler.js";
import { bumpAppRecency } from "../intern/bump-app-recency.js";

// Build the `fetch` override that makeBaseSystemPrompt uses to load asset
// files (system-prompt.md, llms/*.md) from the worker's `/vibe-pkg/`
// endpoint instead of esm.sh. With `pkgBaseUrl` passed into prompts.ts, the
// URL we receive here is already the workspace URL — just delegate to
// fetchAsset, no path math.
export interface PromptAssetFetchDeps {
  readonly fetchAsset: (url: string) => Promise<Result<ReadableStream<Uint8Array>>>;
}

export function createPromptAssetFetch(deps: PromptAssetFetchDeps): typeof fetch {
  return async (url, _init) => {
    const uri = URI.from(url);
    if (uri.protocol === "file:") {
      return fetch(url, _init);
    }
    const rRes = await deps.fetchAsset(uri.toString());
    if (rRes.isErr()) {
      return new Response(JSON.stringify({ error: rRes.Err() }), { status: 500 });
    }
    return new Response(rRes.Ok());
  };
}

export function promptsPkgBaseUrl(workspace: string): string {
  return BuildURI.from(workspace).appendRelative("@vibes.diy/prompts/").toString();
}

interface AppendBlockEventParams {
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  promptId: string;
  blockSeq: number;
  evt: PromptAndBlockMsgs;
  emitMode?: "store" | "emit-only";
  // Required for the base64 image branch (LLM-streamed data: URLs) so the
  // bytes go through storeAndAuditAsset with the right (userSlug, appSlug).
  // Non-image events may omit this.
  resChat?: ResChat;
}

interface CodeBlocks {
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

async function appendBlockEvent({
  ctx,
  vctx,
  req,
  promptId,
  blockSeq,
  evt,
  emitMode = "store",
  resChat,
}: AppendBlockEventParams): Promise<Result<void>> {
  let processedEvt: PromptAndBlockMsgs = evt;
  if (isBlockImage(evt) && evt.url && resChat) {
    // Persist `block.image` events that carry a `url` (data: from LLM
    // streaming, or remote http(s): from server-side image-gen
    // providers like Prodia) by routing the bytes through
    // `storeAndAuditAsset`. This keeps the wire contract uniform: every
    // persisted `block.image` carries `{uploadId, cid, mimeType, size}`
    // with no `url`, so the bridge in `srv-sandbox.ts` can rely on the
    // file-ref shape and Stage C mints the display URL.
    const rConv = await convertImageEvtToFileRef(vctx, {
      evt,
      userId: req._auth.verifiedAuth.claims.userId,
      userSlug: resChat.userSlug,
      appSlug: resChat.appSlug,
    });
    if (rConv.isOk()) {
      processedEvt = rConv.Ok();
    } else {
      // Degraded path: log and let the original event flow through. The
      // bridge will drop it (no file-ref fields) but the section stream
      // stays intact for the rest of the prompt.
      vctx.logger.Error().Err(rConv).Msg("[block.image] convert failed");
    }
  }
  const now = new Date();
  const msgBase = wrapMsgBase(ctx.validated, {
    payload: {
      type: "vibes.diy.section-event",
      chatId: req.chatId,
      promptId,
      blockSeq,
      blocks: [processedEvt],
      timestamp: now,
    },
    tid: req.outerTid,
    src: "promptChatSection",
  } satisfies InMsgBase<SectionEvent>);
  for (const conn of vctx.connections) {
    const chatCtx = conn.chatIds.get(req.chatId);
    if (chatCtx) {
      for (const tid of chatCtx.tids) {
        await conn.send(ctx, { ...msgBase, tid });
      }
    }
  }
  if (emitMode === "store") {
    // Store block in DB
    const rUpdate = await exception2Result(() =>
      vctx.sql.db.insert(vctx.sql.tables.chatSections).values({
        chatId: req.chatId,
        promptId,
        blockSeq,
        blocks: [processedEvt],
        created: now.toISOString(),
      })
    );
    if (rUpdate.isErr()) {
      return Result.Err(rUpdate);
    }
  }
  return Result.Ok();
}

export async function handlePromptContext({
  vctx,
  req,
  resChat,
  promptId,
  blockSeq,
  value,
  collectedMsgs: iCollectedMsgs,
  blockChunks = 100,
  fileSystem,
}: {
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  resChat: ResChat;
  promptId: string;
  blockSeq: number;
  value: BlockEndMsg;
  collectedMsgs: PromptAndBlockMsgs[];
  blockChunks?: number;
  fileSystem?: VibeFile[];
}): Promise<Result<{ blockSeq: number; fsRef: Option<FileSystemRef> }>> {
  let fsRef: Option<FileSystemRef> = Option.None();
  const code: CodeBlocks[] = [];
  const sections: sqlite.SqlChatSection[] = [];

  // the collectedMsgs are Queue
  const collectedMsgs = [...iCollectedMsgs];
  const blockAcc = createBlockAccumulator();

  for (const msg of collectedMsgs) {
    if (!isBlockStreamMsg(msg)) {
      continue;
    }
    let sqlVal = sections[sections.length - 1];
    if (sections.length === 0 || sqlVal.blocks.length >= blockChunks) {
      sections.push({
        chatId: req.chatId,
        promptId,
        blockSeq: blockSeq++,
        blocks: [],
        created: msg.timestamp.toISOString(),
      });
      sqlVal = sections[sections.length - 1];
    }
    sqlVal.blocks.push(msg);
    const closed = blockAcc.ingest(msg);
    if (closed) code.push({ begin: closed.begin, lines: [...closed.lines], end: closed.end });
  }
  if (code.length > 0 && (resChat.mode === "chat" || isPromptFSStyle(resChat.mode))) {
    // here is where the music plays
    let resolvedFileSystem: VibeFile[];
    if (fileSystem) {
      resolvedFileSystem = fileSystem;
    } else {
      // Seed from the most recent persisted fileSystem for this chat so that
      // replace-only turns compose against prior content rather than against
      // an empty buffer. Without this, a `<<<<<<< SEARCH ... >>>>>>> REPLACE`
      // block has nothing to match and the new fsId persists 0 bytes.
      const timelineResult = await loadVersionTimeline(vctx, req.chatId);
      if (timelineResult.isErr()) return Result.Err(timelineResult);
      const timeline = timelineResult.Ok();
      const seed = timeline.length > 0 ? timeline[timeline.length - 1].vfs : new Map<string, string>();
      resolvedFileSystem = resolveCodeBlocksToFileSystem(code, seed);
    }
    const rFs = await ensureAppSlugItem(vctx, {
      type: "vibes.diy.req-ensure-app-slug",
      mode: "dev",
      // chatId: req.chatId,
      appSlug: resChat.appSlug,
      userSlug: resChat.userSlug,
      fileSystem: resolvedFileSystem,
      auth: req.auth,
      _auth: req._auth,
    });
    // console.log("ensureAppSlugItem result for code blocks:", rFs);
    if (rFs.isErr()) {
      console.error("Failed to ensure app slug item for code blocks:", rFs.Err());
      return Result.Err(rFs);
    }
    const tFsRef = type(FileSystemRef).onDeepUndeclaredKey("delete")(rFs.Ok());
    if (tFsRef instanceof type.errors) {
      return Result.Err(`Failed to parse FileSystemRef: ${tFsRef.summary}`);
    }
    fsRef = Option.Some(tFsRef);
  }
  // update prompt context with usage and fsRef into sections BlockEndMsg

  value.fsRef = fsRef.toValue();
  const rSql = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.promptContexts).values({
      userId: req._auth.verifiedAuth.claims.userId,
      chatId: req.chatId,
      promptId,
      fsId: fsRef.IsSome() ? fsRef.unwrap().fsId : undefined,
      nethash: vctx.netHash(),
      promptTokens: value.usage.calculated.prompt_tokens,
      completionTokens: value.usage.calculated.completion_tokens,
      totalTokens: value.usage.calculated.total_tokens,
      ref: {
        type: "prompt.usage.sql",
        usage: value.usage,
        fsRef: fsRef.toValue(),
      } satisfies PromptContextSql, // BlockUsageSql has optional properties, so it can be satisfied by an empty object
      created: new Date().toISOString(),
    })
  );
  if (rSql.isErr()) {
    return Result.Err(rSql);
  }

  await chunkyAsync({
    input: sections,
    splitCondition: (secChunk) => secChunk.length >= 20,
    commit: async (secChunk) => {
      await exception2Result(() => vctx.sql.db.insert(vctx.sql.tables.chatSections).values(secChunk));
      // console.log("Inserted block section into DB for promptId:", secChunk.reduce((acc, curr) => acc+curr.blocks.length, 0), res);
    },
  });
  // there is on disc and during phase we use the iCollectedMsgs as resendBuffer
  // now we could clean the iCollectedMsgs, now the written content will come
  // from the DB
  iCollectedMsgs.splice(0, collectedMsgs.length); // clear the original array while keeping the reference, so that new messages can be pushed into it from other parts of the code while we process the existing ones

  return Result.Ok({ blockSeq, fsRef });
}

export interface ReconstructOpts {
  readonly keepFullTurnStreamId?: string;
}

/**
 * Reconstruct conversation messages (user + assistant) from stored section blocks.
 * Assistant responses are rebuilt from ToplevelLine and Code block messages.
 *
 * When opts.keepFullTurnStreamId is set, code blocks in older turns (identified
 * by the prompt.req streamId) are compacted to summary lines instead of being
 * emitted verbatim. The turn whose streamId matches keepFullTurnStreamId is
 * kept in full.
 */
export function reconstructConversationMessages(sectionMsgs: PromptAndBlockMsgs[], opts: ReconstructOpts = {}): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const assistantLines: string[] = [];
  let currentStreamId: string | undefined;
  let blockBuffer: { path: string; lineCount: number; firstNonBlank?: string } | null = null;

  function flushAssistant() {
    if (assistantLines.length === 0) return;
    messages.push({
      role: "assistant",
      content: [{ type: "text", text: assistantLines.join("\n") }],
    });
    assistantLines.length = 0;
  }

  for (const msg of sectionMsgs) {
    switch (true) {
      case isPromptReq(msg):
        flushAssistant();
        // Invariant: each stored prompt.req carries only the newest user turn
        // (see handlePromptContext); full history is rebuilt across sections
        // rather than duplicated per request.
        currentStreamId = msg.streamId;
        messages.push(...msg.request.messages.filter((m) => m.role === "user"));
        break;
      case isToplevelLine(msg):
        assistantLines.push(msg.line);
        break;
      case isCodeBegin(msg): {
        const compact = opts.keepFullTurnStreamId !== undefined && currentStreamId !== opts.keepFullTurnStreamId;
        if (compact) {
          blockBuffer = { path: msg.path ?? "App.jsx", lineCount: 0 };
        } else {
          assistantLines.push("```" + msg.lang);
        }
        break;
      }
      case isCodeLine(msg):
        if (blockBuffer) {
          blockBuffer.lineCount++;
          if (!blockBuffer.firstNonBlank && msg.line.trim().length > 0) {
            blockBuffer.firstNonBlank = msg.line.trim();
          }
        } else {
          assistantLines.push(msg.line);
        }
        break;
      case isCodeEnd(msg):
        if (blockBuffer) {
          const isEdit = blockBuffer.firstNonBlank === "<<<<<<< SEARCH";
          if (isEdit) {
            assistantLines.push(`[${blockBuffer.lineCount}-line edit to ${blockBuffer.path}]`);
          } else {
            const lines = msg.stats.lines !== 0 ? msg.stats.lines : blockBuffer.lineCount;
            const bytes = msg.stats.bytes;
            assistantLines.push(`[Created ${blockBuffer.path} — ${lines} lines, ${bytes} bytes]`);
          }
          blockBuffer = null;
        } else {
          assistantLines.push("```");
        }
        break;
    }
  }
  flushAssistant();
  return messages;
}

async function loadActiveSettings(
  vctx: VibesApiSQLCtx,
  chatId: string
): Promise<{ skills?: string[]; theme?: string; title?: string; enrichedPrompt?: string }> {
  const rChat = await exception2Result(() =>
    vctx.sql.db
      .select({ appSlug: vctx.sql.tables.chatContexts.appSlug, userSlug: vctx.sql.tables.chatContexts.userSlug })
      .from(vctx.sql.tables.chatContexts)
      .where(eq(vctx.sql.tables.chatContexts.chatId, chatId))
      .limit(1)
      .then((r) => r[0])
  );
  if (rChat.isErr() || !rChat.Ok()) return {};
  const { appSlug, userSlug } = rChat.Ok();
  const rApp = await exception2Result(() =>
    vctx.sql.db
      .select({ settings: vctx.sql.tables.appSettings.settings })
      .from(vctx.sql.tables.appSettings)
      .where(and(eq(vctx.sql.tables.appSettings.appSlug, appSlug), eq(vctx.sql.tables.appSettings.userSlug, userSlug)))
      .limit(1)
      .then((r) => r[0])
  );
  if (rApp.isErr() || !rApp.Ok()) return {};
  const entries = (rApp.Ok().settings ?? []) as ActiveEntry[];
  return {
    skills: entries.find(isActiveSkills)?.skills,
    theme: entries.find(isActiveTheme)?.theme,
    title: entries.find(isActiveTitle)?.title,
    enrichedPrompt: entries.find(isActiveEnrichedPrompt)?.enrichedPrompt,
  };
}

export interface AssemblePromptPayloadArgs {
  readonly chatId: string;
  readonly model: string;
  // Next user turn(s) appended to the reconstructed conversation. Callers
  // pass these explicitly instead of writing a prompt.req block first and
  // letting reconstruction pick it up — so the same function serves both
  // the dispatch path (writes after assembly) and the dry-run path (no write).
  // Non-user roles are filtered.
  readonly newUserMessages: readonly ChatMessage[];
  // Optional: the version or draft the user currently has selected in the UI.
  // Drives the SELECTED_DRAFT or SELECTED_VERSION slot.
  readonly selected?: SelectedSlotInput;
  // Optional: per-slot mute configuration.
  readonly slots?: SlotConfig;
  // Optional: the file path to focus on in slot rendering. Defaults to "App.jsx".
  readonly focusPath?: string;
  // Optional: override which role slot messages are delivered as. When absent,
  // falls back to the SLOT_DELIVERY_MODE env var (defaulting to "user").
  readonly slotDeliveryMode?: "user" | "system";
}

export async function assemblePromptPayload(
  vctx: VibesApiSQLCtx,
  args: AssemblePromptPayloadArgs
): Promise<
  Result<{
    model: string;
    messages: ChatMessage[];
  }>
> {
  const { chatId, model, newUserMessages } = args;
  const sections = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.chatSections)
    .where(eq(vctx.sql.tables.chatSections.chatId, chatId))
    .orderBy(vctx.sql.tables.chatSections.created);
  // A single assistant turn can span multiple chatSections rows (blockChunks
  // boundary), so concat every section's parsed messages and reconstruct once —
  // reconstructing per-row would flush mid-turn and fragment the assistant message.
  const allSectionMsgs: PromptAndBlockMsgs[] = [];
  for (const rowSection of sections) {
    const { filtered: sectionMsgs, warning: sectionWarning } = parseArrayWarning(rowSection.blocks, PromptAndBlockMsgs);
    if (sectionWarning.length > 0) {
      ensureLogger(vctx.sthis, "assemblePromptPayload").Warn().Any({ parseErrors: sectionWarning }).Msg("skip");
    }
    allSectionMsgs.push(...sectionMsgs);
  }

  // Load timeline and latest promptId for slot assembly + compaction.
  // Both return Result<T>; on error we propagate the failure.
  const timelineResult = await loadVersionTimeline(vctx, chatId);
  if (timelineResult.isErr()) return Result.Err(timelineResult);

  const latestPromptIdResult = await loadLatestPromptId(vctx, chatId);
  if (latestPromptIdResult.isErr()) return Result.Err(latestPromptIdResult);

  const timeline = timelineResult.Ok();
  const latestPromptId = latestPromptIdResult.Ok();

  // Reconstruct conversation history, compacting older turns when a latest
  // promptId is available (keeps only the most recent turn in full fidelity).
  // SLOTS_COMPACTION=off (or slots.compaction: "off") disables compaction
  // entirely — all turns render verbatim. Kill-switch for rollback / A-B.
  const compactionDisabled = args.slots?.compaction === "off";
  const reconstructed = reconstructConversationMessages(allSectionMsgs, {
    keepFullTurnStreamId: compactionDisabled ? undefined : latestPromptId,
  });
  const newUserOnly = newUserMessages.filter((m) => m.role === "user");

  // Resolve the app's ActiveSkills + ActiveTitle from app_settings. Pre-allocation
  // seeds both on new chats; legacy rows without skills fall back to
  // makeBaseSystemPrompt's getDefaultSkills(), and an unset title drops the
  // title hint line entirely.
  const { skills, theme, title, enrichedPrompt } = await loadActiveSettings(vctx, chatId);
  const isInitial = timeline.length === 0;

  const systemPrompt = await exception2Result(async () => {
    return makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      skills,
      theme,
      title,
      enrichedPrompt,
      demoData: false,
      variant: isInitial ? "initial" : "continuation",
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    });
  });
  if (systemPrompt.isErr()) {
    console.error("Failed to create system prompt:", systemPrompt.Err());
    return Result.Err(systemPrompt);
  }
  const hasUserMessage = [...reconstructed, ...newUserOnly].some((m) => m.role === "user");
  if (hasUserMessage === false) {
    return Result.Err(`No user messages found in the prompt`);
  }

  // Build slot messages from the version timeline. The PREVIOUS slot carries
  // the current file state (replacing the old CURRENT FILES system-prompt append),
  // ORIGINAL anchors to the scaffold, and LAST_EDIT provides the preceding diff.
  const slotSources = selectSlotSources(timeline);

  // Resolve a historical version if the caller specified selected:{kind:"version",fsId}.
  let selectedVersion: { readonly vfs: ReadonlyMap<string, string>; readonly turnsAgo: number } | undefined;
  const sel = args.selected;
  if (sel?.kind === "version") {
    const idx = timeline.findIndex((t) => t.fsId === sel.fsId);
    if (idx >= 0) {
      selectedVersion = { vfs: timeline[idx].vfs, turnsAgo: timeline.length - 1 - idx };
    }
  }

  // Resolve a draft map if the caller supplied selected draft files.
  // Only files with string content (code-block, str-asset-block) are included.
  const selectedDraftMap: ReadonlyMap<string, string> | undefined =
    args.selected?.kind === "draft"
      ? new Map(
          args.selected.files.flatMap((f) =>
            f.type === "code-block" || f.type === "str-asset-block" ? [[f.filename, f.content]] : []
          )
        )
      : undefined;

  const slotMessages = assembleSlotMessages({
    original: slotSources.original !== undefined ? { vfs: slotSources.original.vfs, turnsAgo: timeline.length - 1 } : undefined,
    prev2: slotSources.prev2?.vfs,
    previous: slotSources.previous?.vfs,
    selectedVersion,
    selectedDraft: selectedDraftMap,
    focusPath: args.focusPath ?? "App.jsx",
    config: args.slots ?? {},
  });

  // Build final message list: system → conversation history → slot messages → new user.
  const slotDeliveryMode: "user" | "system" =
    args.slotDeliveryMode ?? (vctx.sthis.env.get("SLOT_DELIVERY_MODE") === "system" ? "system" : "user");
  const slotChatMessages = renderSlotMessagesAs(slotMessages, slotDeliveryMode);

  return Result.Ok({
    model,
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt.Ok().systemPrompt,
          },
        ],
      },
      ...reconstructed,
      ...slotChatMessages,
      ...newUserOnly,
    ],
  });
}

interface ResChat {
  appSlug: string;
  userSlug: string;
  mode: PromptStyle;
}

async function getResChatFromMode(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqPromptChatSection>,
  orig: ReqPromptChatSection
): Promise<Result<ResChat>> {
  let iResChat;
  if (isReqPromptApplicationChatSection(orig) || isReqPromptImageChatSection(orig)) {
    iResChat = await vctx.sql.db
      .select()
      .from(vctx.sql.tables.applicationChats)
      .where(
        and(
          eq(vctx.sql.tables.applicationChats.userId, req._auth.verifiedAuth.claims.userId),
          eq(vctx.sql.tables.applicationChats.chatId, req.chatId)
        )
      )
      .limit(1)
      .then((r) => r[0]);
  } else {
    iResChat = await vctx.sql.db
      .select()
      .from(vctx.sql.tables.chatContexts)
      .where(
        and(
          eq(vctx.sql.tables.chatContexts.userId, req._auth.verifiedAuth.claims.userId),
          eq(vctx.sql.tables.chatContexts.chatId, req.chatId)
        )
      )
      .limit(1)
      .then((r) => r[0]);
  }
  if (!iResChat) {
    if (isReqCreationPromptChatSection(orig)) {
      return Result.Err(`Creation Chat ID ${req.chatId} not found`);
    } else if (isReqPromptApplicationChatSection(orig)) {
      return Result.Err(`Application Chat ID ${req.chatId} not found`);
    } else if (isReqPromptImageChatSection(orig)) {
      return Result.Err(`Image Chat ID ${req.chatId} not found`);
    }
  }
  const resChat = { ...iResChat, mode: orig.mode };
  return Result.Ok(resChat);
}

async function handlerLlmRequest({
  scope,
  ctx,
  vctx,
  blockSeq,
  req,
  resChat,
  promptId,
  preAssembled,
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptLLMChatSection>;
  resChat: ResChat;
  promptId: string;
  blockSeq: number;
  // For chat mode, the top-level handler hoists the assembly call so dry-run
  // and dispatch share one code path. When set, the assemble branch below is
  // skipped. For app/img modes this is undefined and the inline image_url
  // logic still runs.
  preAssembled?: { model: string; messages: ChatMessage[] };
}): Promise<{ res: Response; blockSeq: number; llmReq: LLMRequest & { headers: LLMHeaders }; abort: AbortController }> {
  const modelId: string = await scope
    .evalResult(async (): Promise<Result<string>> => {
      const r = await getModelDefaults(vctx, { appSlug: resChat.appSlug, userSlug: resChat.userSlug });
      if (r.isErr()) {
        return Result.Err(r);
      }
      switch (req.mode) {
        case "chat":
          return Result.Ok(req.prompt.model ?? r.Ok().chat.model.id);
        case "app":
          return Result.Ok(req.prompt.model ?? r.Ok().app.model.id);
        case "img":
          return Result.Ok(req.prompt.model ?? r.Ok().img.model.id);
        default:
          return Result.Err(`Unknown prompt mode: ${(req as { mode: string }).mode}`);
      }
    })
    .do();

  // Assemble BEFORE writing prompt.req. Chat mode receives a pre-assembled
  // payload from the top-level handler (single code path with dry-run);
  // app/img modes still build their messages inline here. The prompt.req
  // append happens after this block so reconstruction does not depend on
  // it for the current turn.
  const withSystemPrompt = await scope
    .evalResult(async () => {
      let withSystemPrompt = Result.Ok({
        model: modelId,
        messages: [] as ChatMessage[],
      });
      if (preAssembled !== undefined) {
        withSystemPrompt = Result.Ok(preAssembled);
      } else if (req.mode === "app" || req.mode === "img") {
        let messages = req.prompt.messages;
        if (req.mode === "img") {
          const imgReq = req as ReqWithVerifiedAuth<typeof reqPromptImageChatSection.infer>;
          if (imgReq.inputImageBase64) {
            // Forward the input image as an OpenAI/OpenRouter-compatible image_url content part
            // on the last user message so providers like openai/gpt-5-image-mini actually see it.
            const lastUserIdx = (() => {
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === "user") return i;
              }
              return -1;
            })();
            if (lastUserIdx >= 0) {
              const target = messages[lastUserIdx];
              messages = [
                ...messages.slice(0, lastUserIdx),
                {
                  ...target,
                  content: [...target.content, { type: "image_url" as const, image_url: { url: imgReq.inputImageBase64 } }],
                },
                ...messages.slice(lastUserIdx + 1),
              ];
            }
          }
        }
        withSystemPrompt = Result.Ok({
          model: req.prompt.model ?? modelId,
          messages,
        });
      }
      return withSystemPrompt;
    })
    .do();
  // if (withSystemPrompt.isErr()) {
  //   return Result.Err(withSystemPrompt);
  // }
  // Write prompt.req to chatSections AFTER assembly. The block is needed so
  // the NEXT turn's reconstruction sees this turn's user prompt; it must NOT
  // be a precondition of assembly so the dry-run handler (inspect) can reuse
  // assemblePromptPayload without any DB writes.
  await scope
    .evalResult(async () => {
      const r = await appendBlockEvent({
        ctx,
        vctx,
        req,
        promptId,
        blockSeq: blockSeq,
        evt: {
          type: "prompt.req",
          streamId: promptId,
          chatId: req.chatId,
          seq: blockSeq,
          request: req.prompt,
          timestamp: new Date(),
        },
      });
      blockSeq++;
      return r;
    })
    .do();
  // console.log("Sending LLM request for promptId:", promptId);
  // "Initial turn" means we only have the current user message in the conversation history.
  const isInitialTurn = withSystemPrompt.messages.filter((m) => m.role === "user").length <= 1;
  const llmReq: LLMRequest & { headers: LLMHeaders } = {
    // ...vctx.params.llm.default,
    // model,
    ...{
      ...req.prompt,
      messages: withSystemPrompt.messages,
    },
    ...vctx.params.llm.enforced,
    model: withSystemPrompt.model,
    headers: vctx.params.llm.headers,
    stream: true,
    ...(isInitialTurn && req.mode === "chat" ? { verbosity: "low" as const } : {}),
    ...(req.mode === "img" ? { modalities: ["text", "image"] } : {}),
  };

  // add system prompt here

  // console.log(promptId, "LLM request for promptId:");
  const abort = new AbortController();
  const res = await scope
    .evalResult<Response>(async () => {
      const res = await vctx.llmRequest(llmReq, { signal: abort.signal });
      if (!res.ok) {
        return Result.Err(`LLM request failed with status ${res.status} :${llmReq.model} : ${res.statusText}`);
      }
      if (!res.body) {
        return Result.Err(`LLM request returned no body`);
      }
      return Result.Ok(res);
    })
    .do();

  return { res, blockSeq, llmReq, abort };
}

async function handleProdiaImageRequest({
  scope,
  ctx,
  vctx,
  req,
  promptId,
  blockSeq,
  resolvedModel,
  resChat,
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<typeof reqPromptImageChatSection.infer>;
  promptId: string;
  blockSeq: number;
  resolvedModel: string;
  resChat: ResChat;
}): Promise<Result<number>> {
  const prodiaToken = vctx.prodiaToken;
  if (!prodiaToken) {
    return Result.Err("PRODIA_TOKEN not configured");
  }
  // Prodia inference type is built from the model id stem (everything after "prodia/").
  // e.g. "prodia/flux-2.klein.9b" -> "inference.flux-2.klein.9b.{txt2img|img2img}.v1"
  const prodiaStem = resolvedModel.startsWith("prodia/") ? resolvedModel.slice("prodia/".length) : "";
  if (!prodiaStem) {
    return Result.Err(`Invalid Prodia model id: ${resolvedModel}`);
  }

  // Extract prompt text from the last user message
  const userMessages = req.prompt.messages.filter((m) => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1];
  const firstTextPart = lastUserMsg?.content?.find((c) => c.type === "text");
  const promptText = firstTextPart?.type === "text" ? firstTextPart.text : "";
  if (!promptText) {
    return Result.Err("No prompt text found in user messages");
  }
  const inputImageDataUrl = req.inputImageBase64;

  // Emit prompt.req
  await scope
    .evalResult(async () => {
      const r = await appendBlockEvent({
        ctx,
        vctx,
        req,
        promptId,
        blockSeq,
        evt: {
          type: "prompt.req",
          streamId: promptId,
          chatId: req.chatId,
          seq: blockSeq,
          request: req.prompt,
          timestamp: new Date(),
        },
      });
      blockSeq++;
      return r;
    })
    .do();

  // Call Prodia API (img2img if input image provided, otherwise txt2img)
  let prodiaRes: Response;
  if (inputImageDataUrl) {
    const base64Data = inputImageDataUrl.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const formData = new FormData();
    formData.append(
      "job",
      new Blob([JSON.stringify({ type: `inference.${prodiaStem}.img2img.v1`, config: { prompt: promptText } })], {
        type: "application/json",
      }),
      "job.json"
    );
    formData.append("input", new Blob([bytes], { type: "image/jpeg" }), "input.jpg");
    prodiaRes = await fetch("https://inference.prodia.com/v2/job", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${prodiaToken}`,
        Accept: "image/png",
      },
      body: formData,
    });
  } else {
    prodiaRes = await fetch("https://inference.prodia.com/v2/job", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${prodiaToken}`,
        Accept: "image/png",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: `inference.${prodiaStem}.txt2img.v1`,
        config: { prompt: promptText },
      }),
    });
  }

  if (!prodiaRes.ok) {
    const errorText = await prodiaRes.text().catch(() => "");
    return Result.Err(`Prodia request failed: ${prodiaRes.status} ${prodiaRes.statusText} ${errorText}`);
  }

  // Store PNG bytes via the shared helper so AssetUploads owns the audit
  // row and the doc serializes as a `_files` ref shape (no CID-URL string).
  if (!prodiaRes.body) {
    return Result.Err("Prodia response has no body");
  }
  const rStored = await storeAndAuditAsset(vctx, {
    bytes: prodiaRes.body,
    userId: req._auth.verifiedAuth.claims.userId,
    userSlug: resChat.userSlug,
    appSlug: resChat.appSlug,
    mimeType: "image/png",
  });
  if (rStored.isErr()) {
    return Result.Err(`Failed to store Prodia image: ${rStored.Err().message}`);
  }
  const stored = rStored.Ok();
  const fileMimeType = stored.mimeType ?? "image/png";

  const blockId = vctx.sthis.nextId(12).str;
  const now = new Date();

  // Emit block.begin
  await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq++,
    evt: {
      type: "block.begin",
      blockId,
      streamId: promptId,
      seq: blockSeq,
      blockNr: 0,
      timestamp: now,
    },
  });

  // Emit block.image carrying the file ref shape (uploadId/cid/type/size).
  // The hook turns this into _files.v<N> = FileMeta on the doc, and Stage C
  // mints meta.url for display.
  await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq++,
    evt: {
      type: "block.image",
      sectionId: vctx.sthis.nextId(12).str,
      uploadId: stored.uploadId,
      cid: stored.cid,
      mimeType: fileMimeType,
      size: stored.size,
      blockId,
      streamId: promptId,
      seq: blockSeq,
      blockNr: 1,
      timestamp: now,
      stats: { lines: 0, bytes: stored.size, cnt: 1 },
    },
  });

  const zeroStats = { lines: 0, bytes: 0 };
  const imageStats = { lines: 0, bytes: stored.size, cnt: 1 };

  // Emit block.end
  await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq++,
    evt: {
      type: "block.end",
      blockId,
      streamId: promptId,
      seq: blockSeq,
      blockNr: 2,
      timestamp: now,
      stats: {
        toplevel: zeroStats,
        code: zeroStats,
        image: imageStats,
        total: imageStats,
      },
      usage: {
        given: [],
        calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      },
    },
    emitMode: "emit-only",
  });

  // Store prompt context for the block.end
  const promptContextSql: PromptContextSql = {
    type: "prompt.usage.sql",
    usage: {
      given: [],
      calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    },
  };
  await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.chatSections).values({
      chatId: req.chatId,
      promptId,
      blockSeq: blockSeq++,
      blocks: [promptContextSql],
      created: now.toISOString(),
    })
  );

  // Clean up promptId tracking
  for (const conn of vctx.connections) {
    const chatCtx = conn.chatIds.get(req.chatId);
    const promptIdCtx = chatCtx?.promptIds.get(promptId);
    if (promptIdCtx && chatCtx) {
      chatCtx.promptIds.delete(promptId);
    }
  }

  return Result.Ok(blockSeq);
}

async function handleEndMsg({
  collectedMsgs,
  vctx,
  req,
  ctx,
  resChat,
  promptId,
  value,
  blockSeq,
  fileSystem,
}: {
  collectedMsgs: PromptAndBlockMsgs[];
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  resChat: ResChat;
  promptId: string;
  value: BlockEndMsg;
  blockSeq: number;
  fileSystem?: VibeFile[];
}): Promise<Result<number>> {
  const r = await handlePromptContext({ vctx, req, promptId, resChat, value, blockSeq, collectedMsgs, fileSystem });
  if (r.isErr()) {
    return Result.Err(r);
  }
  blockSeq = r.Ok().blockSeq;
  const rEvt = await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq++,
    evt: { ...value, fsRef: r.Ok().fsRef.toValue() },
    emitMode: "emit-only",
  });
  for (const conn of vctx.connections) {
    const chatCtx = conn.chatIds.get(req.chatId);
    const promptIdCtx = chatCtx?.promptIds.get(promptId);
    if (promptIdCtx && chatCtx) {
      chatCtx.promptIds.delete(promptId);
    }
  }
  if (rEvt.isErr()) {
    return Result.Err(rEvt);
  }
  return Result.Ok(blockSeq);
}

async function handleLlmResponse({
  scope,
  vctx,
  req,
  ctx,
  res,
  resChat,
  promptId,
  blockSeq,
  llmReq,
  abort,
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptLLMChatSection>;
  resChat: ResChat;
  res: Response;
  promptId: string;
  blockSeq: number;
  llmReq: LLMRequest & { headers: LLMHeaders };
  abort: AbortController;
}): Promise<number> {
  await scope
    .evalResult(async () => {
      // Resolve chat connection context once; same collectedMsgs survives
      // across original + recovery streams.
      let collectedMsgs!: PromptAndBlockMsgs[];
      for (const conn of vctx.connections) {
        const tChatCtx = conn.chatIds.get(req.chatId);
        if (tChatCtx) {
          const promptIdCtx = tChatCtx.promptIds.get(promptId);
          if (!promptIdCtx) {
            collectedMsgs = [];
            tChatCtx.promptIds.set(promptId, {
              blocks: collectedMsgs,
              promptId,
              type: "vibes.diy.section-event",
              chatId: req.chatId,
              blockSeq: 0,
              timestamp: new Date(),
            });
          } else {
            collectedMsgs = promptIdCtx.blocks;
          }
        }
      }
      if (!collectedMsgs) {
        return Result.Err(`Chat context not found for chatId: ${req.chatId}`);
      }

      // Per-turn state that survives across the original stream and any
      // recovery continuation: streaming resolver vfs, block accumulator,
      // and the recovery counter. Per-stream state (partial buffer + safe
      // cut + reader + abort controller) is rebuilt each iteration.
      const seedTimelineResult = await loadVersionTimeline(vctx, req.chatId);
      if (seedTimelineResult.isErr()) return Result.Err(seedTimelineResult);
      const seedTimeline = seedTimelineResult.Ok();
      const seedForResolver = seedTimeline.length > 0 ? seedTimeline[seedTimeline.length - 1].vfs : new Map<string, string>();
      const resolverLogger = ensureLogger(vctx.sthis, "streamingResolver");
      const recoveryLogger = ensureLogger(vctx.sthis, "applyRecovery");
      const streamingResolver = createStreamingResolver({
        chatId: req.chatId,
        promptId,
        seed: seedForResolver,
        onApplyError: (evt) => logApplyError(resolverLogger, evt),
      });
      const blockAcc = createBlockAccumulator();
      // Bounded by *consecutive fruitless* recoveries, not total. Any clean
      // apply during a recovery stream resets this to 0; only the case where
      // the model returns a malformed response that produces zero clean
      // blocks N times in a row will trip the budget.
      let recoveryCounter: RecoveryCounter = { consecutiveFruitless: 0 };
      let isRecoveryStream = false;

      // Continue-mode recovery: each iteration consumes one upstream stream.
      // On apply error, the iteration sets a `recoverHint`, aborts upstream,
      // and drains. After the inner loop exits we update the counter (only
      // for recovery streams), check the budget, build a continuation via
      // buildRecoveryRequest, and dispatch it. The model never sees the
      // failure — just CURRENT FILES + its own captured voice + "continue."
      let currentRes: Response = res;
      let currentAbort: AbortController = abort;
      while (true) {
        // Whether this stream produced any clean code.end. Used after the
        // inner loop to update the recovery counter.
        let streamMadeProgress = false;
        // Per-stream partial buffer: accumulates delta.line.content as the
        // pipeline produces it. `safeCut` advances only on a clean code.end;
        // see the truncation rule note above (intentionally NOT advanced on
        // toplevel.line, so the partial never ends with prose announcing a
        // completed-but-failed edit).
        const partialBuffer: {
          text: string;
          safeCut: number;
          // File line count after the last successful SEARCH/REPLACE on the
          // focus file, or undefined when the last successful block was a
          // create. Used by the recovery wrapper as a "you were at line N"
          // anchor so the model has a concrete in-file location to reason
          // about instead of skim-reading partial narrative.
          lastReplaceFileLines: number | undefined;
        } = { text: "", safeCut: 0, lastReplaceFileLines: undefined };
        const captureDeltas = new TransformStream<DeltaStreamMsg, DeltaStreamMsg>({
          transform(msg, controller) {
            if (isDeltaLine(msg)) partialBuffer.text += msg.content;
            controller.enqueue(msg);
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const pipeline = currentRes
          .body!.pipeThrough(createStatsCollector(promptId, 1000))
          .pipeThrough(createLineStream(promptId))
          .pipeThrough(createDataStream(promptId))
          .pipeThrough(createSseStream(promptId))
          .pipeThrough(createDeltaStream(promptId, () => vctx.sthis.nextId(12).str))
          .pipeThrough(captureDeltas)
          .pipeThrough(createSectionsStream(promptId, () => vctx.sthis.nextId(12).str));
        const reader = pipeline.getReader();

        // recoverHint is set when this stream should be replaced by a
        // continuation; null means "this stream finished naturally."
        let recoverHint: {
          readonly partial: string;
          readonly focusPath: string;
          readonly blockId: string;
          readonly sectionId: string;
          readonly reason: string;
          readonly kind: string;
          readonly errorCount: number;
          readonly lastReplaceFileLines?: number;
        } | null = null;
        let drainOnly = false;
        readLoop: while (true) {
          // Distinguish intentional aborts (recovery dispatch — drainOnly
          // is set, currentAbort is signaling) from real transport/parser
          // failures. Both end the loop, but the latter is surfaced via
          // the recoveryLogger so it isn't silently swallowed as EOF.
          const rRead = await exception2Result(() => reader.read());
          if (rRead.isErr()) {
            const intentional = drainOnly || currentAbort.signal.aborted;
            if (!intentional) {
              recoveryLogger
                .Info()
                .Any("event", {
                  chatId: req.chatId,
                  promptId,
                  err: String(rRead.Err()),
                })
                .Msg("upstream-read-failed");
            }
            break readLoop;
          }
          const { done, value } = rRead.Ok();
          if (done) break readLoop;
          if (drainOnly) continue; // recovery already triggered; drain to EOF/abort.
          if (!isBlockEnd(value)) {
            if (!isBlockStreamMsg(value)) continue;
            const closed = blockAcc.ingest(value);
            const applyResult = closed ? streamingResolver.observeBlock(closed) : undefined;
            const isFailedCodeEnd = closed !== undefined && applyResult !== undefined && applyResult.errors.length > 0;

            if (isFailedCodeEnd) {
              // Suppress the failed block.code.end on the wire AND in
              // collectedMsgs. Emit block.code.truncated in its place. The
              // recovery's eventual block.end persists collectedMsgs, so the
              // truncate event must replace the failed code.end in that
              // record — otherwise reload would either miss the truncation
              // entirely (no truncate persisted) or replay the malformed
              // code.end through the renderer.
              const first = applyResult.errors[0];
              const truncateEvt = buildTruncatedEvent({
                closed,
                firstError: first,
                errorCount: applyResult.errors.length,
                promptId,
                blockSeq,
                now: new Date(),
              });
              collectedMsgs.push(truncateEvt);
              const r = await appendBlockEvent({
                ctx,
                vctx,
                req,
                promptId,
                blockSeq: blockSeq++,
                evt: truncateEvt,
                emitMode: "emit-only",
              });
              if (r.isErr()) {
                return Result.Err(r);
              }
              recoverHint = {
                partial: partialBuffer.text.slice(0, partialBuffer.safeCut),
                focusPath: applyResult.path,
                blockId: closed.end.blockId,
                sectionId: closed.end.sectionId,
                reason: first.reason,
                kind: first.kind,
                errorCount: applyResult.errors.length,
                lastReplaceFileLines: partialBuffer.lastReplaceFileLines,
              };
              // Abort upstream so the body stream wraps up; we'll loop and
              // dispatch the continuation after updating the counter and
              // checking the budget. Drain until reader EOF, skip events.
              currentAbort.abort();
              drainOnly = true;
              continue;
            }

            collectedMsgs.push(value);
            const r = await appendBlockEvent({
              ctx,
              vctx,
              req,
              promptId,
              blockSeq: blockSeq++,
              evt: value,
              emitMode: "emit-only",
              resChat,
            });
            if (r.isErr()) {
              return Result.Err(r);
            }
            if (closed !== undefined && applyResult !== undefined && applyResult.errors.length === 0) {
              // Clean code.end — advance safe cut so the partial captured
              // up to here is a valid handoff for any later recovery.
              partialBuffer.safeCut = partialBuffer.text.length;
              streamMadeProgress = true;
              // SEARCH/REPLACE blocks contain `<<<<<<< SEARCH` markers in
              // their lines; create blocks (full-file) don't. Capture the
              // resolved file's line count after a replace so the recovery
              // wrapper can cite "after that edit the file was N lines
              // long" — only when the last successful block was a replace.
              const wasReplace = closed.lines.some((l) => l.line.startsWith("<<<<<<< SEARCH"));
              if (wasReplace) {
                const resolvedText = streamingResolver.getVfs().get(applyResult.path);
                partialBuffer.lastReplaceFileLines = resolvedText ? resolvedText.split("\n").length : undefined;
              } else {
                partialBuffer.lastReplaceFileLines = undefined;
              }
            }
          } else {
            collectedMsgs.push(value);
            const x = await handleEndMsg({ collectedMsgs, vctx, req, ctx, resChat, promptId, value, blockSeq });
            if (x.isErr()) return Result.Err(x);
            blockSeq = x.Ok();
            collectedMsgs.splice(0, collectedMsgs.length);
          }
        }

        // Update counter at the boundary between streams. Only recovery
        // streams contribute to the budget — the original stream's progress
        // (or lack of) is not counted: the first apply error is always
        // worth one recovery attempt.
        if (isRecoveryStream) {
          recoveryCounter = updateRecoveryCounter(recoveryCounter, { madeProgress: streamMadeProgress });
          recoveryLogger
            .Debug()
            .Any("event", {
              chatId: req.chatId,
              promptId,
              madeProgress: streamMadeProgress,
              consecutiveFruitless: recoveryCounter.consecutiveFruitless,
            })
            .Msg("recovery-stream-end");
        }

        if (recoverHint === null) {
          // Stream finished naturally and no recovery was triggered.
          return Result.Ok();
        }

        if (!shouldAttemptRecovery(recoveryCounter)) {
          recoveryLogger
            .Info()
            .Any("event", {
              chatId: req.chatId,
              promptId,
              blockId: recoverHint.blockId,
              consecutiveFruitless: recoveryCounter.consecutiveFruitless,
            })
            .Msg("recovery-exhausted");
          // Finalize the turn even though no clean stream produced a real
          // block.end. Without this, the client never sees a completion
          // event and the per-prompt context (chatCtx.promptIds) leaks. We
          // synthesize a zero-stats block.end with the recovery's blockId
          // so handleEndMsg's persistence + cleanup paths run normally.
          // collectedMsgs already contains every truncate event and
          // intermediate stream message, so the persisted record reflects
          // exactly what the user saw before exhaustion.
          const exhaustedEnd: BlockEndMsg = {
            type: "block.end",
            blockId: recoverHint.blockId,
            streamId: promptId,
            seq: blockSeq,
            blockNr: 0,
            timestamp: new Date(),
            stats: {
              toplevel: { lines: 0, bytes: 0 },
              code: { lines: 0, bytes: 0 },
              image: { lines: 0, bytes: 0 },
              total: { lines: 0, bytes: 0 },
            },
            usage: {
              given: [],
              calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            },
          };
          collectedMsgs.push(exhaustedEnd);
          const xEnd = await handleEndMsg({
            collectedMsgs,
            vctx,
            req,
            ctx,
            resChat,
            promptId,
            value: exhaustedEnd,
            blockSeq,
          });
          if (xEnd.isErr()) return Result.Err(xEnd);
          return Result.Ok();
        }

        const stitchMode = recoveryCounter.consecutiveFruitless === 2;

        recoveryLogger
          .Debug()
          .Any("event", {
            chatId: req.chatId,
            promptId,
            blockId: recoverHint.blockId,
            sectionId: recoverHint.sectionId,
            path: recoverHint.focusPath,
            reason: recoverHint.reason,
            kind: recoverHint.kind,
            errorCount: recoverHint.errorCount,
            consecutiveFruitless: recoveryCounter.consecutiveFruitless,
            mode: stitchMode ? "stitch" : "continue",
          })
          .Msg("recovery-start");

        // Build and dispatch the continuation. If anything goes wrong here we
        // log and stop — partial result already in storage from any clean
        // blocks produced before the error.
        const pkgBaseUrl = promptsPkgBaseUrl(vctx.params.pkgRepos.workspace);
        const fetchOverride = createPromptAssetFetch({ fetchAsset: vctx.fetchAsset });
        const addendum = await exception2Result(() =>
          stitchMode ? getRecoveryStitchAddendum(pkgBaseUrl, fetchOverride) : getRecoveryAddendum(pkgBaseUrl, fetchOverride)
        );
        if (addendum.isErr()) {
          recoveryLogger
            .Info()
            .Any("event", { chatId: req.chatId, promptId, err: String(addendum.Err()) })
            .Msg("recovery-addendum-failed");
          return Result.Ok();
        }
        // In stitch mode, do NOT pass the partial. The stitch addendum
        // tells the model "Stop trying to continue from where you were
        // left off mid-stream. Output the full app file in one single
        // code block." If we also append a "Continue your turn from
        // there" wrapper around the captured partial, the wrapper wins
        // (more specific + later in the conversation) and the model
        // ignores stitch — observed in chat z5Lf28PYADmjyhkt9s where
        // stitch fired but the model still emitted SEARCH/REPLACE blocks
        // and exhausted the budget.
        const recReq = buildRecoveryRequest({
          originalRequest: llmReq,
          recoveryAddendum: addendum.Ok(),
          vfs: streamingResolver.getVfs(),
          focusPath: recoverHint.focusPath,
          assistantPartial: stitchMode ? undefined : recoverHint.partial,
          lastReplaceFileLines: stitchMode ? undefined : recoverHint.lastReplaceFileLines,
        });
        if (recReq.isErr()) {
          recoveryLogger
            .Info()
            .Any("event", {
              chatId: req.chatId,
              promptId,
              err: String(recReq.Err()),
              originalMessageCount: llmReq.messages.length,
              originalRoles: llmReq.messages.map((m) => m.role),
            })
            .Msg("recovery-build-failed");
          return Result.Ok();
        }
        const recPayload = recReq.Ok();
        const recMessageCount = recPayload.messages.length;
        const recRoles = recPayload.messages.map((m) => m.role);
        const recModel = recPayload.model;
        const nextAbort = new AbortController();
        const rNextRes = await exception2Result(() =>
          vctx.llmRequest({ ...recPayload, headers: llmReq.headers }, { signal: nextAbort.signal })
        );
        if (rNextRes.isErr()) {
          recoveryLogger
            .Info()
            .Any("event", {
              chatId: req.chatId,
              promptId,
              err: String(rNextRes.Err()),
              model: recModel,
              messageCount: recMessageCount,
              roles: recRoles,
            })
            .Msg("recovery-call-failed");
          return Result.Ok();
        }
        const nextRes = rNextRes.Ok();
        if (!nextRes.ok || !nextRes.body) {
          const rBody = await exception2Result(() => nextRes.text());
          const rawBody = rBody.isOk() ? rBody.Ok() : `<read-failed: ${String(rBody.Err())}>`;
          const bodySnippet = rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}…[+${rawBody.length - 2000}b]` : rawBody;
          recoveryLogger
            .Info()
            .Any("event", {
              chatId: req.chatId,
              promptId,
              status: nextRes.status,
              statusText: nextRes.statusText,
              model: recModel,
              messageCount: recMessageCount,
              roles: recRoles,
              bodySnippet,
            })
            .Msg("recovery-call-failed");
          return Result.Ok();
        }
        recoveryLogger
          .Debug()
          .Any("event", {
            chatId: req.chatId,
            promptId,
            partialBytes: recoverHint.partial.length,
            focusPath: recoverHint.focusPath,
            model: recModel,
            messageCount: recMessageCount,
            roles: recRoles,
          })
          .Msg("recovery-call-started");
        currentRes = nextRes;
        currentAbort = nextAbort;
        isRecoveryStream = true;
        // Loop: consume the recovery stream the same way.
      }
    })
    .do();
  return blockSeq;
}

export async function handleFSPrompt({
  scope,
  vctx,
  resChat,
  req,
  ctx,
  promptId,
}: {
  scope: Scope;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptFSChatSection>;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  resChat: ResChat;
  promptId: string;
  blockSeq: number;
}): Promise<Result<number>> {
  let fileSystem!: VibeFile[];
  if (isReqPromptFSSetChatSection(req)) {
    fileSystem = req.fsSet;
  } else if (isReqPromptFSUpdateChatSection(req)) {
    const refFS: VibeFile[] = [];
    if (!req.refFsId) {
      const lastestPrompt = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.promptContexts)
        .innerJoin(vctx.sql.tables.apps, eq(vctx.sql.tables.apps.fsId, vctx.sql.tables.promptContexts.fsId))
        .where(and(eq(vctx.sql.tables.promptContexts.chatId, req.chatId), eq(vctx.sql.tables.promptContexts.promptId, promptId)))
        .orderBy(desc(vctx.sql.tables.promptContexts.created))
        .limit(1)
        .then((r) => r[0]);
      if (lastestPrompt) {
        refFS.push(...parseArray(lastestPrompt.Apps.fileSystem, vibeFile));
      }
    }
    const mapFS = refFS.reduce(
      (acc, file) => {
        acc.set(file.filename, file);
        return acc;
      },
      {} as Map<string, VibeFile>
    );
    req.fsUpdate.update.forEach((update) => {
      mapFS.set(update.filename, update);
    });
    req.fsUpdate.remove?.forEach((item) => {
      mapFS.delete(item.filename);
    });
    fileSystem = Array.from(mapFS.values());
  }
  const rEndMsg = await scope
    .evalResult(async () => {
      const sectionId = vctx.sthis.nextId(12).str;
      let blockNr = 0;
      const blockId = vctx.sthis.nextId(12).str;
      let blockSeq = 0;
      let bytes = 0;
      const collectedMsgs: PromptAndBlockMsgs[] = [
        {
          type: "block.begin",
          blockId,
          streamId: promptId,
          seq: blockSeq++,
          blockNr: blockNr++,
          timestamp: new Date(),
        } satisfies BlockBeginMsg,
        ...fileSystem.flatMap((file) => {
          if (!isVibeCodeBlock(file)) {
            return [];
          }
          return [
            {
              type: "block.code.begin",
              sectionId,
              lang: file.lang,
              blockId: blockId,
              streamId: promptId,
              seq: blockSeq++,
              blockNr,
              timestamp: new Date(),
            } satisfies CodeBeginMsg,
            ...file.content.split("\n").map((line, lineNr) => {
              bytes += line.length + 1; // +1 for the newline character that was removed by split
              return {
                type: "block.code.line",
                sectionId,
                blockId,
                line,
                streamId: promptId,
                seq: blockSeq++,
                timestamp: new Date(),
                lang: file.lang,
                blockNr,
                lineNr,
              } satisfies CodeLineMsg;
            }),
            {
              type: "block.code.end",
              sectionId,
              blockId,
              streamId: promptId,
              seq: blockSeq++,
              timestamp: new Date(),
              lang: file.lang,
              blockNr,
              stats: { lines: file.content.split("\n").length, bytes },
            } satisfies CodeEndMsg,
          ];
        }),
      ];
      const value = {
        type: "block.end",
        stats: {
          toplevel: { lines: 0, bytes: 0 },
          code: { lines: blockSeq, bytes },
          image: { lines: 0, bytes: 0 },
          total: { lines: blockSeq, bytes },
        },
        usage: {
          given: [],
          calculated: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        },
        blockId: blockId,
        streamId: promptId,
        seq: blockSeq++,
        blockNr: blockNr,
        timestamp: new Date(),
      } satisfies BlockEndMsg;
      collectedMsgs.push(value);

      // Emit code blocks to WebSocket so the client can display them
      for (const msg of collectedMsgs) {
        if (!isBlockEnd(msg)) {
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId,
            blockSeq: blockSeq++,
            evt: msg,
            emitMode: "emit-only",
          });
        }
      }

      return handleEndMsg({
        collectedMsgs,
        vctx,
        req,
        ctx,
        resChat,
        promptId,
        value,
        blockSeq,
        fileSystem,
      });
    })
    .do();
  return Result.Ok(rEndMsg);
}

export const promptChatSection: EventoHandler<W3CWebSocketEvent, MsgBase<ReqPromptChatSection>, never | VibesDiyError> = {
  hash: "prompt-chat-section-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // console.log("Validating promptChatSection with payload:", msg.payload);
    const ret = reqPromptChatSection(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    // console.log("Validation successful for promptChatSection, payload:", ret);
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>) => {
      const req = ctx.validated.payload;
      // is need to determine the chat type and get the appSlug and userSlug based on the chatId and the authenticated user
      const orig = (ctx.enRequest as MsgBase<ReqPromptChatSection>).payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rResChat = await getResChatFromMode(vctx, req, orig);
      if (rResChat.isErr()) {
        return Result.Err(rResChat);
      }
      const resChat = rResChat.Ok();

      // Chat-mode assembly hoisted from handlerLlmRequest. Computing the
      // {model, messages} payload here keeps assembly on a single code
      // path that both dispatch and dryRun consume — they cannot drift.
      // For app/img/fs modes preAssembled stays undefined; handlerLlmRequest
      // falls through to its existing inline message build.
      let preAssembled: { model: string; messages: ChatMessage[] } | undefined;
      if (isReqCreationPromptChatSection(orig)) {
        if (!orig.prompt.messages.some((m) => m.role === "user")) {
          return Result.Err(`prompt.messages must include at least one user message`);
        }
        const rDefaults = await getModelDefaults(vctx, { appSlug: resChat.appSlug, userSlug: resChat.userSlug });
        if (rDefaults.isErr()) return Result.Err(rDefaults);
        const modelId = orig.prompt.model ?? rDefaults.Ok().chat.model.id;
        const rAssembled = await assemblePromptPayload(vctx, {
          chatId: req.chatId,
          model: modelId,
          newUserMessages: orig.prompt.messages,
          selected: orig.selected,
          slots: resolveSlotConfig(orig.slots, {
            SLOTS_ORIGINAL: vctx.sthis.env.get("SLOTS_ORIGINAL"),
            SLOTS_SELECTED: vctx.sthis.env.get("SLOTS_SELECTED"),
            SLOTS_LAST_EDIT: vctx.sthis.env.get("SLOTS_LAST_EDIT"),
            SLOTS_PREVIOUS: vctx.sthis.env.get("SLOTS_PREVIOUS"),
            SLOTS_COMPACTION: vctx.sthis.env.get("SLOTS_COMPACTION"),
          }),
          focusPath: orig.focusPath,
        });
        if (rAssembled.isErr()) return Result.Err(rAssembled);
        preAssembled = rAssembled.Ok();

        // Dry-run branch — chat-mode only by type. Emits res-prompt-chat-section
        // ack so the client's api.request resolves on tid, then emits a framed
        // (begin → dry-run-payload → end) section event via emit-only. No
        // bumpAppRecency, no DB writes, no LLM dispatch, no billing.
        if (orig.dryRun === true) {
          const dryRunPromptId = `dry-run-${vctx.sthis.nextId(12).str}`;
          await ctx.send.send(
            ctx,
            wrapMsgBase(ctx.validated, {
              payload: {
                type: "vibes.diy.res-prompt-chat-section",
                chatId: req.chatId,
                userSlug: resChat.userSlug,
                appSlug: resChat.appSlug,
                promptId: dryRunPromptId,
                outerTid: req.outerTid,
                mode: req.mode,
              },
              tid: ctx.validated.tid,
              src: "promptChatSection",
            } satisfies InMsgBase<ResPromptChatSection>)
          );
          const now = () => new Date();
          let seq = 0;
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId: dryRunPromptId,
            blockSeq: seq,
            emitMode: "emit-only",
            evt: { type: "prompt.block-begin", streamId: dryRunPromptId, chatId: req.chatId, seq, timestamp: now() },
          });
          seq++;
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId: dryRunPromptId,
            blockSeq: seq,
            emitMode: "emit-only",
            evt: {
              type: "prompt.dry-run-payload",
              streamId: dryRunPromptId,
              chatId: req.chatId,
              seq,
              timestamp: now(),
              // Same duck-type as PromptReq.request — tooling that walks
              // block events by `msg.request.messages` reads dry-run and
              // real turns identically. The contents are the assembled
              // would-be-dispatched request (system + history + new turn),
              // not the user's raw prompt.
              request: { ...orig.prompt, model: preAssembled.model, messages: preAssembled.messages },
            },
          });
          seq++;
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId: dryRunPromptId,
            blockSeq: seq,
            emitMode: "emit-only",
            evt: { type: "prompt.block-end", streamId: dryRunPromptId, chatId: req.chatId, seq, timestamp: now() },
          });
          return Result.Ok(EventoResult.Continue);
        }
      }

      // Resolved img model id picks the backend: "prodia/*" -> Prodia, else LLM handler.
      // When the request carries an input image (img2img edit) and the
      // user didn't pick a model, prefer the catalog's `img-edit`
      // default (typically the LLM image backend); fall back to the
      // plain `img` default otherwise. The LLM path attaches the input
      // as `image_url` on the last user message (see ~line 866) and
      // produces edits faithful to the source — Prodia's img2img is a
      // single-shot inference that doesn't preserve subject identity.
      let resolvedImgModel: string | undefined;
      if (isReqPromptImageChatSection(orig)) {
        const override = orig.prompt.model;
        if (override) {
          resolvedImgModel = override;
        } else {
          const rDefaults = await getModelDefaults(vctx, { appSlug: resChat.appSlug, userSlug: resChat.userSlug });
          if (rDefaults.isOk()) {
            const defaults = rDefaults.Ok();
            const hasInputImage = !!(orig as { inputImageBase64?: string }).inputImageBase64;
            const editDefault = hasInputImage ? defaults["img-edit"] : undefined;
            resolvedImgModel = (editDefault ?? defaults.img).model.id;
            // Mirror the resolution onto orig.prompt.model so the
            // downstream LLM handler picks up the same choice instead
            // of re-resolving from models.json (which would always
            // pick the plain `img` default).
            (orig as { prompt: { model?: string } }).prompt.model = resolvedImgModel;
          }
        }
      }
      // Last-resort fallback: prodia default selected but token missing.
      // Switch to the LLM image backend so the request can complete.
      if (resolvedImgModel?.startsWith("prodia/") && !vctx.prodiaToken) {
        resolvedImgModel = "openai/gpt-5.4-image-2";
        if (isReqPromptImageChatSection(orig)) {
          (orig as { prompt: { model?: string } }).prompt.model = resolvedImgModel;
        }
      }
      const useProdia = !!(isReqPromptImageChatSection(orig) && vctx.prodiaToken && resolvedImgModel?.startsWith("prodia/"));

      let prompSectionAction!: (scope: Scope, blockSeq: number) => Promise<Result<number>>;
      if (isReqPromptImageChatSection(orig) && useProdia) {
        prompSectionAction = async (scope: Scope, blockSeq: number) => {
          // `orig` carries the live model override (mutated above) but
          // not `_auth`; `req` (the validated payload) carries `_auth`
          // but is a separate object reference. Merge so the Prodia
          // handler sees both.
          const reqWithAuth = { ...orig, _auth: req._auth } as ReqWithVerifiedAuth<typeof reqPromptImageChatSection.infer>;
          return handleProdiaImageRequest({
            scope,
            ctx,
            vctx,
            req: reqWithAuth,
            promptId,
            blockSeq,
            resolvedModel: resolvedImgModel as string,
            resChat,
          });
        };
      } else if (isReqPromptLLMChatSection(orig)) {
        prompSectionAction = async (scope: Scope, blockSeq: number) => {
          const res = await handlerLlmRequest({
            ctx,
            blockSeq,
            scope,
            vctx,
            req: req as ReqWithVerifiedAuth<ReqPromptLLMChatSection>,
            resChat,
            promptId,
            preAssembled,
          });
          const finalBlockSeq = await handleLlmResponse({
            scope,
            vctx,
            req: req as ReqWithVerifiedAuth<ReqPromptLLMChatSection>,
            ctx,
            res: res.res,
            resChat,
            promptId,
            blockSeq: res.blockSeq,
            llmReq: res.llmReq,
            abort: res.abort,
          });
          return Result.Ok(finalBlockSeq);
        };
      }
      if (isReqPromptFSChatSection(orig)) {
        prompSectionAction = async (scope: Scope, blockSeq: number) => {
          const r = await handleFSPrompt({
            scope,
            vctx,
            req: req as ReqWithVerifiedAuth<ReqPromptFSChatSection>,
            ctx,
            resChat,
            promptId,
            blockSeq,
          });
          return r;
        };
      }

      if (!prompSectionAction) {
        return Result.Err(`Unsupported prompt chat section mode: ${orig.mode}`);
      }

      // Bump recency BEFORE acknowledging the request so the client's
      // notifyRecentVibesChanged() (which fires when prompt() resolves on
      // res-prompt-chat-section below) reads a freshly-bumped row. Without
      // this, the client refresh would race the LLM stream's eventual bump
      // and surface stale ordering until the next page load.
      const rBump = await bumpAppRecency(vctx, { userSlug: resChat.userSlug, appSlug: resChat.appSlug });
      if (rBump.isErr()) {
        vctx.logger.Warn().Err(rBump).Msg("bumpAppRecency failed");
      }

      const promptId = vctx.sthis.nextId(96 / 8).str;
      // needs to be sent before any block events
      // to allow the client to associate incoming blocks with the promptId

      await ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.res-prompt-chat-section",
            chatId: req.chatId,
            userSlug: resChat.userSlug,
            appSlug: resChat.appSlug,
            promptId,
            outerTid: req.outerTid,
            mode: req.mode,
          },
          tid: ctx.validated.tid,
          src: "promptChatSection",
        } satisfies InMsgBase<ResPromptChatSection>)
      );

      // console.log(promptId, "Starting promptChatSection for promptId: with request:");

      await scopey(async (scope) => {
        const seq = { val: 0 };

        scope.onCatch(async (e) => {
          // Silenced — error is propagated via the prompt.error event below
          // and surfaced to the client. Re-enable for low-level debugging.
          // console.error(promptId, "Error in promptChatSection scope for promptId: with error:", e);
          const errorSeq = seq.val;
          seq.val++;
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId,
            blockSeq: errorSeq,
            evt: {
              type: "prompt.error",
              streamId: promptId,
              chatId: req.chatId,
              seq: errorSeq,
              timestamp: new Date(),
              error: (e as Error).message,
            },
          });
        }, 0);

        await scope
          .evalResult(async () => {
            const res = await appendBlockEvent({
              ctx,
              vctx,
              req,
              promptId,
              blockSeq: seq.val,
              evt: {
                type: "prompt.block-begin",
                streamId: promptId,
                chatId: req.chatId,
                seq: seq.val,
                timestamp: new Date(),
              },
            });
            seq.val++;

            const rAction = await prompSectionAction(scope, seq.val);
            if (rAction.isErr()) return rAction;
            seq.val = rAction.Ok();

            return res;
          })
          .finally(async () => {
            if (seq.val === 0) return;
            await appendBlockEvent({
              ctx,
              vctx,
              req,
              promptId,
              blockSeq: seq.val,
              evt: {
                type: "prompt.block-end",
                streamId: promptId,
                chatId: req.chatId,
                seq: seq.val,
                timestamp: new Date(),
              },
            });
          })
          .do();
      });
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
