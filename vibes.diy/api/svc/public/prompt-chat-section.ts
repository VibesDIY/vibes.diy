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
import { scopey } from "@adviser/scopey";
import {
  InMsgBase,
  isReqCreationPromptChatSection,
  isReqPromptApplicationChatSection,
  LLMHeaders,
  MsgBase,
  PromptAndBlockMsgs,
  ReqPromptChatSection,
  reqPromptChatSection,
  ReqWithVerifiedAuth,
  ResPromptChatSection,
  SectionEvent,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import {
  sqlApplicationChats,
  sqlChatContexts,
  SqlChatSection,
  sqlChatSections,
  sqlPromptContexts,
} from "../sql/vibes-diy-api-schema.js";
import { and, eq } from "drizzle-orm/sql/expressions";
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
  isPromptReq,
  CodeMsg,
  CodeBeginMsg,
  CodeLineMsg,
  FileSystemRef,
  PromptContextSql,
  BlockEndMsg,
  BlockMsgs,
  isBlockStreamMsg,
} from "@vibes.diy/call-ai-v2";
import { makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
import { ensureAppSlugItem } from "./ensure-app-slug-item.js";

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
    // console.log("Emitting block event for promptId:", promptId, "blockSeq:", blockSeq, "to clients", conn.chatIds);
    for (const tuple of conn.chatIds) {
      if (tuple.chatId === req.chatId) {
        // console.log("promptChatSection: Sending blockSeq", blockSeq, "to chatId:", req.chatId, "via tid:", tuple.tid);
        await conn.send(ctx, { ...msgBase, tid: tuple.tid });
      }
    }
  }
  if (emitMode === "store") {
    // Store block in DB
    const rUpdate = await exception2Result(() =>
      vctx.db
        .insert(sqlChatSections)
        .values({
          chatId: req.chatId,
          promptId,
          blockSeq,
          blocks: [evt],
          created: now.toISOString(),
        })
        .run()
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
  collectedMsgs,
  blockChunks = 100,
}: {
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  resChat: { appSlug: string; userSlug: string; mode: "creation" | "application" };
  promptId: string;
  blockSeq: number;
  value: BlockEndMsg;
  collectedMsgs: BlockMsgs[];
  blockChunks?: number;
}): Promise<Result<{ blockSeq: number; fsRef: Option<FileSystemRef> }>> {
  let fsRef: Option<FileSystemRef> = Option.None();
  const code: CodeBlocks[] = [];
  const sections: SqlChatSection[] = [];
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
  if (code.length > 0 && resChat.mode === "creation") {
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
    vctx.db
      .insert(sqlPromptContexts)
      .values({
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
      .run()
  );
  if (rSql.isErr()) {
    return Result.Err(rSql);
  }

  await chunkyAsync({
    input: sections,
    splitCondition: (secChunk) => secChunk.length >= 20,
    commit: async (secChunk) => {
      await exception2Result(() => vctx.db.insert(sqlChatSections).values(secChunk).run());
      // console.log("Inserted block section into DB for promptId:", secChunk, rSections);
    },
  });

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
  const sections = await vctx.db
    .select()
    .from(sqlChatSections)
    .where(eq(sqlChatSections.chatId, chatId))
    .orderBy(sqlChatSections.created)
    .all();
  const userMessages: ChatMessage[] = [];
  for (const rowSection of sections) {
    const msgs = PromptAndBlockMsgs.array()(rowSection.blocks);
    if (msgs instanceof type.errors) {
      return Result.Err(`Failed to parse blocks for section ${rowSection}, with error: ${msgs.summary}`);
    }
    for (const msg of msgs) {
      if (isPromptReq(msg)) {
        userMessages.push(...msg.request.messages.filter((m) => m.role === "user"));
      }
    }
  }
  const systemPrompt = await exception2Result(async () =>
    makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      dependenciesUserOverride: true,
      dependencies: ["callai", "image-gen"],
      fetch: async (url: RequestInfo | URL, _init?: RequestInit) => {
        const promptTxtUrl = BuildURI.from(vctx.params.pkgRepos.workspace)
          .appendRelative("@vibes.diy/prompts")
          .appendRelative("llms")
          .appendRelative(pathOps.basename(URI.from(url).pathname))
          .toString();
        // console.log("Fetching asset for system prompt from URL:", url, promptTxtUrl);
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
      const orig = (ctx.enRequest as MsgBase<ReqPromptChatSection>).payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      let resChat!: { appSlug: string; userSlug: string; mode: "creation" | "application" };
      if (isReqCreationPromptChatSection(orig)) {
        const iResChat = await vctx.db
          .select()
          .from(sqlChatContexts)
          .where(and(eq(sqlChatContexts.chatId, req.chatId), eq(sqlChatContexts.userId, req._auth.verifiedAuth.claims.userId)))
          .get();
        if (!iResChat) {
          return Result.Err(`Creation Chat ID ${req.chatId} not found`);
        }
        resChat = { ...iResChat, mode: "creation" };
      }
      if (isReqPromptApplicationChatSection(orig)) {
        const iResChat = await vctx.db
          .select()
          .from(sqlApplicationChats)
          .where(
            and(eq(sqlApplicationChats.userId, req._auth.verifiedAuth.claims.userId), eq(sqlApplicationChats.chatId, req.chatId))
          )
          .get();
        if (!iResChat) {
          return Result.Err(`Application Chat ID ${req.chatId} not found`);
        }
        resChat = { ...iResChat, mode: "application" };
      }
      if (!resChat) {
        return Result.Err(
          `Chat ID ${req.chatId} not found: ${req.mode}: ${isReqCreationPromptChatSection(orig) ? "creation" : isReqPromptApplicationChatSection(orig) ? "application" : "unknown"}`
        );
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

      await scopey(async (scope) => {
        let blockSeq = 0;

        scope.onCatch(async (e) => {
          await appendBlockEvent({
            ctx,
            vctx,
            req,
            promptId,
            blockSeq: blockSeq++,
            evt: {
              type: "prompt.error",
              streamId: promptId,
              chatId: req.chatId,
              seq: blockSeq,
              timestamp: new Date(),
              error: (e as Error).message,
            },
          });
          // console.error("Failed to append initial block event for promptId:", promptId, "with error:", e);
        }, 0);

        await scope
          .evalResult(async () => {
            const res = await appendBlockEvent({
              ctx,
              vctx,
              req,
              promptId,
              blockSeq: blockSeq,
              evt: {
                type: "prompt.block-begin",
                streamId: promptId,
                chatId: req.chatId,
                // streamId:
                seq: blockSeq,
                timestamp: new Date(),
              },
            });
            blockSeq++;
            return res;
          })
          .finally(async () => {
            if (blockSeq > 1) {
              await appendBlockEvent({
                ctx,
                vctx,
                req,
                promptId,
                blockSeq: blockSeq,
                evt: {
                  type: "prompt.block-end",
                  streamId: promptId,
                  chatId: req.chatId,
                  seq: blockSeq,
                  timestamp: new Date(),
                },
              });
              blockSeq++;
            }
          })
          .do();

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

        const withSystemPrompt = await scope
          .evalResult(async () => {
            let withSystemPrompt = Result.Ok({
              model: req.prompt.model ?? vctx.params.llm.default.model,
              messages: [] as ChatMessage[],
            });
            if (req.mode === "creation") {
              withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, req.prompt.model ?? vctx.params.llm.default.model);
            } else if (req.mode === "application") {
              withSystemPrompt = Result.Ok({
                model: req.prompt.model ?? vctx.params.llm.default.model,
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
        const llmReq: LLMRequest & { headers: LLMHeaders } = {
          ...vctx.params.llm.default,
          ...{
            ...req.prompt,
            messages: withSystemPrompt.messages,
          },
          ...vctx.params.llm.enforced,
          model: withSystemPrompt.model,
          headers: vctx.params.llm.headers,
          logprobs: true,
          stream: true,
        };

        // add system prompt here

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
        await scope
          .evalResult(async () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const pipeline = res
              .body!.pipeThrough(createStatsCollector(promptId, 1000))
              .pipeThrough(createLineStream(promptId))
              .pipeThrough(createDataStream(promptId))
              .pipeThrough(createSseStream(promptId))
              .pipeThrough(createDeltaStream(promptId, () => vctx.sthis.nextId(12).str))
              .pipeThrough(createSectionsStream(promptId, () => vctx.sthis.nextId(12).str));

            const reader = pipeline.getReader();

            const collectedMsgs: BlockMsgs[] = [];
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
                collectedMsgs.push(value);
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
                if (rEvt.isErr()) {
                  return Result.Err(rEvt);
                }
                collectedMsgs.splice(0, collectedMsgs.length); // clear collected blocks after handling prompt context
              }
            }
            return Result.Ok();
          })
          .do();
      });
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
