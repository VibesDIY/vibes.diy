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
  uint8array2stream,
} from "@adviser/cement";
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
  isActiveSkills,
  isActiveTitle,
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
  type FenceParseError,
} from "@vibes.diy/call-ai-v2";
import type { Logger } from "@adviser/cement";
import { makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
import { ensureAppSlugItem } from "./ensure-app-slug-item.js";
import { ChatIdCtx } from "../svc-ws-send-provider.js";
import { sqlite } from "@vibes.diy/api-sql";
import { getModelDefaults } from "../intern/get-model-defaults.js";
import { tryConsumeRecovery } from "../intern/recovery.js";

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
}

interface CodeBlocks {
  begin: CodeBeginMsg;
  lines: CodeLineMsg[];
  end?: CodeMsg;
}

// Look up the most recent persisted fileSystem for a chat, across all prior
// promptIds. Returns a Map<filename, content> usable as the seed for the
// next turn's resolveCodeBlocksToFileSystem call. Empty map when the chat
// has no prior persisted state.
async function loadPriorFileSystem(vctx: VibesApiSQLCtx, chatId: string): Promise<ReadonlyMap<string, string>> {
  const latestPrompt = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.promptContexts)
    .innerJoin(vctx.sql.tables.apps, eq(vctx.sql.tables.apps.fsId, vctx.sql.tables.promptContexts.fsId))
    .where(eq(vctx.sql.tables.promptContexts.chatId, chatId))
    .orderBy(desc(vctx.sql.tables.promptContexts.created))
    .limit(1)
    .then((r) => r[0]);
  const seed = new Map<string, string>();
  if (!latestPrompt) return seed;
  const files = parseArray(latestPrompt.Apps.fileSystem, vibeFile);
  for (const f of files) {
    if (f.type !== "code-block") continue;
    if (typeof f.content !== "string") continue;
    seed.set(f.filename, f.content);
  }
  return seed;
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
  logger
    .Info()
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
}: AppendBlockEventParams): Promise<Result<void>> {
  if (isBlockImage(evt)) {
    const imgEvt = evt as { url: string };
    if (imgEvt.url.startsWith("data:")) {
      // Store base64 image as asset to avoid WebSocket message size limits
      const match = imgEvt.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const raw = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const [storageResult] = await vctx.storage.ensure(uint8array2stream(raw));
        if (storageResult?.isOk()) {
          imgEvt.url = `/assets/cid?url=${encodeURIComponent(storageResult.Ok().getURL)}&mime=${encodeURIComponent(mime)}`;
          console.log("[block.image] Stored as asset:", imgEvt.url, "size:", raw.length);
        } else {
          console.error("[block.image] Failed to store asset:", storageResult?.Err());
        }
      }
    } else {
      console.log("[block.image] Server received URL:", imgEvt.url.substring(0, 100));
    }
  }
  const now = new Date();
  const msgBase = wrapMsgBase(ctx.validated, {
    payload: {
      type: "vibes.diy.section-event",
      chatId: req.chatId,
      promptId,
      blockSeq,
      blocks: [evt],
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
        blocks: [evt],
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
      const seed = await loadPriorFileSystem(vctx, req.chatId);
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

/**
 * Reconstruct conversation messages (user + assistant) from stored section blocks.
 * Assistant responses are rebuilt from ToplevelLine and Code block messages.
 */
export function reconstructConversationMessages(sectionMsgs: PromptAndBlockMsgs[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const assistantLines: string[] = [];
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
        messages.push(...msg.request.messages.filter((m) => m.role === "user"));
        break;
      case isToplevelLine(msg):
        assistantLines.push(msg.line);
        break;
      case isCodeBegin(msg):
        assistantLines.push("```" + msg.lang);
        break;
      case isCodeLine(msg):
        assistantLines.push(msg.line);
        break;
      case isCodeEnd(msg):
        assistantLines.push("```");
        break;
    }
  }
  flushAssistant();
  return messages;
}

async function loadActiveSettings(vctx: VibesApiSQLCtx, chatId: string): Promise<{ skills?: string[]; title?: string }> {
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
    title: entries.find(isActiveTitle)?.title,
  };
}

async function injectSystemPrompt(
  vctx: VibesApiSQLCtx,
  chatId: string,
  model: string
): Promise<
  Result<{
    model: string;
    messages: ChatMessage[];
  }>
> {
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
      ensureLogger(vctx.sthis, "buildUserMessages").Warn().Any({ parseErrors: sectionWarning }).Msg("skip");
    }
    allSectionMsgs.push(...sectionMsgs);
  }
  const conversationMessages = reconstructConversationMessages(allSectionMsgs);

  // Resolve the app's ActiveSkills + ActiveTitle from app_settings. Pre-allocation
  // seeds both on new chats; legacy rows without skills fall back to
  // makeBaseSystemPrompt's getDefaultSkills(), and an unset title drops the
  // title hint line entirely.
  const { skills, title } = await loadActiveSettings(vctx, chatId);

  const systemPrompt = await exception2Result(async () =>
    makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      skills,
      title,
      demoData: false,
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    })
  );
  if (systemPrompt.isErr()) {
    console.error("Failed to create system prompt:", systemPrompt.Err());
    return Result.Err(systemPrompt);
  }
  if (!conversationMessages.some((m) => m.role === "user")) {
    return Result.Err(`No user messages found in the prompt`);
  }

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
      ...conversationMessages,
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
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptLLMChatSection>;
  resChat: ResChat;
  promptId: string;
  blockSeq: number;
}): Promise<{ res: Response; blockSeq: number }> {
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

  // console.log(promptId, "Pre-System request for promptId:");
  const withSystemPrompt = await scope
    .evalResult(async () => {
      let withSystemPrompt = Result.Ok({
        model: modelId,
        messages: [] as ChatMessage[],
      });
      if (req.mode === "chat") {
        withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, req.prompt.model ?? modelId);
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
    logprobs: req.mode !== "img",
    stream: true,
    ...(isInitialTurn && req.mode === "chat" ? { verbosity: "low" as const } : {}),
    ...(req.mode === "img" ? { modalities: ["text", "image"] } : {}),
  };

  // add system prompt here

  // console.log(promptId, "LLM request for promptId:");
  const res = await scope
    .evalResult<Response>(async () => {
      const res = await vctx.llmRequest(llmReq);
      if (!res.ok) {
        return Result.Err(`LLM request failed with status ${res.status} :${llmReq.model} : ${res.statusText}`);
      }
      if (!res.body) {
        return Result.Err(`LLM request returned no body`);
      }
      return Result.Ok(res);
    })
    .do();

  return { res, blockSeq };
}

async function handleProdiaImageRequest({
  scope,
  ctx,
  vctx,
  req,
  promptId,
  blockSeq,
  resolvedModel,
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<typeof reqPromptImageChatSection.infer>;
  promptId: string;
  blockSeq: number;
  resolvedModel: string;
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

  // Store PNG bytes as asset
  if (!prodiaRes.body) {
    return Result.Err("Prodia response has no body");
  }
  const [storageResult] = await vctx.storage.ensure(prodiaRes.body);
  if (!storageResult?.isOk()) {
    return Result.Err(`Failed to store Prodia image: ${storageResult?.Err()}`);
  }
  const assetUrl = `/assets/cid?url=${encodeURIComponent(storageResult.Ok().getURL)}&mime=${encodeURIComponent("image/png")}`;
  console.log("[block.image] Prodia stored as asset:", assetUrl);

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

  // Emit block.image
  await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq++,
    evt: {
      type: "block.image",
      sectionId: vctx.sthis.nextId(12).str,
      url: assetUrl,
      blockId,
      streamId: promptId,
      seq: blockSeq,
      blockNr: 1,
      timestamp: now,
      stats: { lines: 0, bytes: assetUrl.length, cnt: 1 },
    },
  });

  const zeroStats = { lines: 0, bytes: 0 };
  const imageStats = { lines: 0, bytes: assetUrl.length, cnt: 1 };

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
}: {
  scope: Scope;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptLLMChatSection>;
  resChat: ResChat;
  res: Response;
  promptId: string;
  blockSeq: number;
}): Promise<number> {
  await scope
    .evalResult(async () => {
      // console.log(promptId, "LLM response received for promptId: with status:", res.status, "statusText:", res.statusText);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const pipeline = res
        .body!.pipeThrough(createStatsCollector(promptId, 1000))
        .pipeThrough(createLineStream(promptId))
        .pipeThrough(createDataStream(promptId))
        .pipeThrough(createSseStream(promptId))
        .pipeThrough(createDeltaStream(promptId, () => vctx.sthis.nextId(12).str))
        .pipeThrough(createSectionsStream(promptId, () => vctx.sthis.nextId(12).str));

      const reader = pipeline.getReader();

      // const collectedMsgs: BlockMsgs[] = [];
      let collectedMsgs!: PromptAndBlockMsgs[];
      let chatCtx!: ChatIdCtx;
      for (const conn of vctx.connections) {
        const tChatCtx = conn.chatIds.get(req.chatId);
        if (tChatCtx) {
          chatCtx = tChatCtx;
          const promptIdCtx = chatCtx.promptIds.get(promptId);
          if (!promptIdCtx) {
            collectedMsgs = [];
            chatCtx.promptIds.set(promptId, {
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
      // Per-block streaming resolver (from #1557): runs parseFenceBody +
      // applyEdits as each block.code.end arrives so we can log apply errors
      // immediately. Authoritative VibeFile[] for storage is still produced
      // by the end-of-turn resolveCodeBlocksToFileSystem in handleEndMsg.
      //
      // Recovery orchestrator (this PR): consumes the same observeBlock
      // result and logs structured `recovery-*` events. Server-internal —
      // no wire-format change. The actual upstream-abort + continuation LLM
      // call is the primary follow-up; it will read the resolver's vfs
      // (TODO: expose) and splice ordinary block.code.* events into the
      // outgoing stream so clients see one continuous turn.
      const seedForResolver = await loadPriorFileSystem(vctx, req.chatId);
      const resolverLogger = ensureLogger(vctx.sthis, "streamingResolver");
      const recoveryLogger = ensureLogger(vctx.sthis, "applyRecovery");
      const streamingResolver = createStreamingResolver({
        chatId: req.chatId,
        promptId,
        seed: seedForResolver,
        onApplyError: (evt) => logApplyError(resolverLogger, evt),
      });
      const blockAcc = createBlockAccumulator();
      let recoveryCounter = { attempts: 0 };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!isBlockEnd(value)) {
          if (!isBlockStreamMsg(value)) {
            continue;
          }
          // console.log(promptId, "Received chunk for promptId:", value);
          collectedMsgs.push(value);
          const closed = blockAcc.ingest(value);
          const applyResult = closed ? streamingResolver.observeBlock(closed) : undefined;
          const r = await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId,
            blockSeq: blockSeq++,
            evt: value,
            emitMode: "emit-only",
          });
          if (r.isErr()) {
            return Result.Err(r);
          }
          // Recovery decision: when observeBlock reports apply errors, decide
          // whether to fire a continuation call. Server-internal — no wire
          // event today; clients see one continuous turn. The continuation
          // call itself is the primary follow-up: between recovery-start and
          // recovery-end, this branch will abort the upstream LLM stream
          // (AbortController on defaultLLMRequest), build a continuation via
          // buildRecoveryRequest using the resolver's vfs, pipe its tokens
          // through the same parser chain, and emit ordinary block.code.*
          // events on the outgoing stream so clients see a single virtual
          // turn that includes the recovered output.
          if (applyResult !== undefined && applyResult.errors.length > 0 && closed !== undefined) {
            const consumed = tryConsumeRecovery(recoveryCounter);
            recoveryCounter = consumed.next;
            const first = applyResult.errors[0];
            if (consumed.allowed) {
              recoveryLogger
                .Info()
                .Any("event", {
                  chatId: req.chatId,
                  promptId,
                  blockId: closed.end.blockId,
                  sectionId: closed.end.sectionId,
                  path: applyResult.path,
                  reason: first.reason,
                  kind: first.kind,
                  errorCount: applyResult.errors.length,
                })
                .Msg("recovery-start");
              // TODO(continuation): abort upstream + continuation call lands
              // here. `recovery-end` will be logged when that work actually
              // has something to bracket — emitting it now would just be a
              // synchronous noise pair after every recovery-start.
            } else {
              recoveryLogger
                .Info()
                .Any("event", {
                  chatId: req.chatId,
                  promptId,
                  blockId: closed.end.blockId,
                  attempts: recoveryCounter.attempts,
                })
                .Msg("recovery-exhausted");
            }
          }
        } else {
          // console.log(promptId, "BlockEnd", value, collectedMsgs.length, req.chatId);
          collectedMsgs.push(value);
          const x = await handleEndMsg({ collectedMsgs, vctx, req, ctx, resChat, promptId, value, blockSeq });
          if (x.isErr()) {
            return Result.Err(x);
          }
          blockSeq = x.Ok();
          collectedMsgs.splice(0, collectedMsgs.length); // clear collected blocks after handling prompt context
        }
      }
      return Result.Ok();
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

      // Resolved img model id picks the backend: "prodia/*" -> Prodia, else LLM handler.
      let resolvedImgModel: string | undefined;
      if (isReqPromptImageChatSection(orig)) {
        const override = orig.prompt.model;
        if (override) {
          resolvedImgModel = override;
        } else {
          const rDefaults = await getModelDefaults(vctx, { appSlug: resChat.appSlug, userSlug: resChat.userSlug });
          if (rDefaults.isOk()) {
            resolvedImgModel = rDefaults.Ok().img.model.id;
          }
        }
      }
      // Fallback to LLM image model when Prodia token is unavailable.
      // Inject into orig.prompt.model so handlerLlmRequest picks it up
      // instead of re-resolving to the prodia/* default from models.json.
      if (resolvedImgModel?.startsWith("prodia/") && !vctx.prodiaToken) {
        resolvedImgModel = "openai/gpt-5-image-mini";
        if (isReqPromptImageChatSection(orig) && !orig.prompt.model) {
          (orig as { prompt: { model?: string } }).prompt.model = resolvedImgModel;
        }
      }
      const useProdia = !!(isReqPromptImageChatSection(orig) && vctx.prodiaToken && resolvedImgModel?.startsWith("prodia/"));

      let prompSectionAction!: (scope: Scope, blockSeq: number) => Promise<Result<number>>;
      if (isReqPromptImageChatSection(orig) && useProdia) {
        prompSectionAction = async (scope: Scope, blockSeq: number) => {
          return handleProdiaImageRequest({
            scope,
            ctx,
            vctx,
            req: orig as ReqWithVerifiedAuth<typeof reqPromptImageChatSection.infer>,
            promptId,
            blockSeq,
            resolvedModel: resolvedImgModel as string,
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
          console.error(promptId, "Error in promptChatSection scope for promptId: with error:", e);
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
