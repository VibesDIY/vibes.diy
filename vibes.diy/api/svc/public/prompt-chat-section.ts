import {
  EventoHandler,
  Result,
  Option,
  HandleTriggerCtx,
  EventoResult,
  exception2Result,
  chunkyAsync,
  BuildURI,
  pathOps,
  URI,
} from "@adviser/cement";
import { Scope, scopey } from "@adviser/scopey";
import {
  InMsgBase,
  isReqCreationPromptChatSection,
  isReqPromptApplicationChatSection,
  isReqPromptFSChatSection,
  isReqPromptFSUpdateChatSection,
  isReqPromptImageChatSection,
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
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import {
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
  LLMRequest,
  ChatMessage,
  CodeMsg,
  CodeBeginMsg,
  CodeLineMsg,
  FileSystemRef,
  PromptContextSql,
  BlockEndMsg,
  isBlockStreamMsg,
  CodeEndMsg,
  BlockBeginMsg,
} from "@vibes.diy/call-ai-v2";
import { makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
import { ensureAppSlugItem } from "./ensure-app-slug-item.js";
import { ChatIdCtx } from "../svc-ws-send-provider.js";
import { sqlite } from "@vibes.diy/api-sql";
import { getModelDefaults } from "../intern/get-model-defaults.js";

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

async function appendBlockEvent({
  ctx,
  vctx,
  req,
  promptId,
  blockSeq,
  evt,
  emitMode = "store",
}: AppendBlockEventParams): Promise<Result<void>> {
  const now = new Date();
  // console.log("Appending block event:", { promptId, blockSeq, evt, timestamp: now });
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
  // console.log("Emitting block event for promptId:", promptId, "blockSeq:", blockSeq, "connections:", vctx.connections);
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
}: {
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  resChat: ResChat;
  promptId: string;
  blockSeq: number;
  value: BlockEndMsg;
  collectedMsgs: PromptAndBlockMsgs[];
  blockChunks?: number;
}): Promise<Result<{ blockSeq: number; fsRef: Option<FileSystemRef> }>> {
  let fsRef: Option<FileSystemRef> = Option.None();
  const code: CodeBlocks[] = [];
  const sections: sqlite.SqlChatSection[] = [];

  // the collectedMsgs are Queue
  const collectedMsgs = [...iCollectedMsgs];

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
    if (isCodeBegin(msg)) {
      code.push({ begin: msg, lines: [] });
    } else if (isCodeLine(msg)) {
      if (code.length === 0) {
        console.warn("Received code line without a preceding code begin:", msg);
      } else {
        code[code.length - 1].lines.push(msg);
      }
    } else if (isCodeEnd(msg)) {
      if (code.length === 0) {
        console.warn("Received code end without a preceding code begin:", msg);
      } else {
        code[code.length - 1].end = msg;
      }
    }
  }
  if (code.length > 0 && resChat.mode === "chat") {
    // here is where the music plays
    const rFs = await ensureAppSlugItem(vctx, {
      type: "vibes.diy.req-ensure-app-slug",
      mode: "dev",
      // chatId: req.chatId,
      appSlug: resChat.appSlug,
      userSlug: resChat.userSlug,
      fileSystem: code.reduce((acc, block, idx) => {
        if (block.end) {
          const content = block.lines.map((l) => l.line).join("\n");
          // console.log("Code to add to file system:", content, block.begin.lang);
          let filename!: string;
          if (idx === 0) {
            filename = `/App`;
          } else {
            filename = `/File-${idx}`;
          }
          let llmLangFix = block.begin.lang.toLowerCase();
          if (["js", "jsx"].includes(llmLangFix)) {
            llmLangFix = "jsx";
            filename += ".jsx";
          } else {
            filename += llmLangFix ? `.${llmLangFix}` : "";
          }
          acc.push({
            type: "code-block",
            filename,
            lang: llmLangFix, // llm think between jsx and js is not a big deal
            content,
          });
        }
        return acc;
      }, [] as VibeFile[]),
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
  const userMessages: ChatMessage[] = [];
  for (const rowSection of sections) {
    const { filtered: sectionMsgs, warning: sectionWarning } = parseArrayWarning(rowSection.blocks, PromptAndBlockMsgs);
    if (sectionWarning.length > 0) {
      ensureLogger(vctx.sthis, "buildUserMessages").Warn().Any({ parseErrors: sectionWarning }).Msg("skip");
    }
    for (const msg of sectionMsgs) {
      if (isPromptReq(msg)) {
        userMessages.push(...msg.request.messages.filter((m) => m.role === "user"));
      }
    }
  }
  const systemPrompt = await exception2Result(async () =>
    makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      dependenciesUserOverride: true,
      dependencies: ["fireproof", "callai", "web-audio"],
      fetch: async (url: RequestInfo | URL, _init?: RequestInit) => {
        console.log("Fetching asset for system prompt from URL:", url.toString(), vctx.params.pkgRepos.workspace);
        const uri = URI.from(url);
        if (uri.protocol === "file:") {
          return fetch(url, _init);
        }
        const promptTxtUrl = BuildURI.from(vctx.params.pkgRepos.workspace)
          .appendRelative("@vibes.diy/prompts")
          .appendRelative("llms")
          .appendRelative(pathOps.basename(URI.from(url).pathname))
          .toString();
        const rRes = await vctx.fetchAsset(promptTxtUrl);
        if (rRes.isErr()) {
          console.error("Failed to fetch asset for system prompt from URL:", url.toString(), "with error:", rRes.Err());
          return new Response(JSON.stringify({ error: rRes.Err() }), { status: 500 });
          // return Result.Err(rRes);
        }
        const res = new Response(rRes.Ok());
        // res.clone().text().then((text) => {
        //   console.log("Fetched asset for system prompt from URL:", url.toString(), "with content:", text);
        // })
        return res;
        //   return Result.Ok(await new Response(rRes.Ok()).text());
      },
      callAi: {
        ModuleAndOptionsSelection: async (_msgs: ChatMessage[]) => {
          return Result.Err(`Module and options selection is not supported in system prompts at this time`);
        },
      },
    })
  );
  if (systemPrompt.isErr()) {
    console.error("Failed to create system prompt:", systemPrompt.Err());
    return Result.Err(systemPrompt);
  }
  if (userMessages.length === 0) {
    return Result.Err(`No user messages found in the prompt`);
  }

  return Result.Ok({
    model,
    messages: [
      ...userMessages,
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt.Ok().systemPrompt,
          },
        ],
      },
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
  // let resChat!: ResChat;
  // if (isReqCreationPromptChatSection(orig) || isReqPromptApplicationChatSection(orig) || isReqPromptImageChatSection(orig)) {
  const iResChat = await vctx.sql.db
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
  // }
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
      } else if (req.mode === "app") {
        withSystemPrompt = Result.Ok({
          model: req.prompt.model ?? modelId,
          messages: req.prompt.messages,
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
    logprobs: true,
    stream: true,
    ...(isInitialTurn ? { verbosity: "low" as const } : {}),
  };

  // add system prompt here

  // console.log(promptId, "LLM request for promptId:");
  const res = await scope
    .evalResult<Response>(async () => {
      console.log(promptId, "Sending LLM request:", llmReq.model);
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

async function handleEndMsg({
  collectedMsgs,
  vctx,
  req,
  ctx,
  resChat,
  promptId,
  value,
  blockSeq,
}: {
  collectedMsgs: PromptAndBlockMsgs[];
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  resChat: ResChat;
  promptId: string;
  value: BlockEndMsg;
  blockSeq: number;
}): Promise<Result<number>> {
  const r = await handlePromptContext({ vctx, req, promptId, resChat, value, blockSeq, collectedMsgs });
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
      // const codeBlocks: CodeBlocks[] = [];
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
            } as CodeEndMsg,
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

      return handleEndMsg({
        collectedMsgs,
        vctx,
        req,
        ctx,
        resChat,
        promptId,
        value,
        blockSeq,
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

      let prompSectionAction!: (scope: Scope, blockSeq: number) => Promise<Result<number>>;
      if (isReqPromptLLMChatSection(orig)) {
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
