import {
  EventoHandler,
  HandleTriggerCtx,
  Result,
  ValidateTriggerCtx,
  Option,
  EventoResultType,
  EventoResult,
  processStream,
  exception2Result,
  Future,
} from "@adviser/cement";
import {
  isReqCallAI,
  type ReqCallAI,
  type ResErrorCallAI,
  type ResOkCallAI,
  isReqImgGen,
  type ReqImgGen,
  type ResOkImgGen,
  type ResErrorImgGen,
  type ImgGenFile,
} from "@vibes.diy/vibe-types";
import { isPromptBlockEnd, isPromptReq, isSectionEvent, type PromptReq, type SectionEvent } from "@vibes.diy/api-types";
import { type ChatMessage, type CodeEndMsg, isBlockImage, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";
import { buildSchemaSystemMessage } from "@vibes.diy/prompts";
import { requireVibeApi } from "./srv-sandbox-firefly-doc-handlers.js";
import type { VibeApiCapableSandbox } from "./srv-sandbox-types.js";

export function getCodeBlock(stream: ReadableStream<unknown>): Promise<{
  code: string;
  sectionEvt: SectionEvent;
  promptReq: PromptReq;
  codeEnd: CodeEndMsg;
}> {
  const codeParts: string[] = [];
  let promptReq!: PromptReq;
  const firstCodeBlock = new Future<{ code: string; sectionEvt: SectionEvent; promptReq: PromptReq; codeEnd: CodeEndMsg }>();
  processStream(stream, (msg) => {
    if (isSectionEvent(msg)) {
      for (const block of msg.blocks) {
        if (isPromptReq(block)) {
          promptReq = block;
        }
        if (isCodeBegin(block) && block.lang.toLocaleUpperCase() === "JSON") {
          codeParts.splice(0, codeParts.length); // clear previous code parts
        }
        if (isCodeLine(block)) {
          codeParts.push(block.line);
        }
        if (isCodeEnd(block)) {
          firstCodeBlock.resolve({ code: codeParts.join("\n"), sectionEvt: msg, promptReq, codeEnd: block });
        }
      }
    }
  });
  return firstCodeBlock.asPromise();
}

export function vibeCallAI(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.callAI",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqCallAI(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqCallAI, unknown>): Promise<Result<EventoResultType>> => {
      // Access chatApi lazily inside handle so the proxy's get trap (which
      // constructs the real VibesDiyApi) only fires when a chat action is
      // actually needed — not during sandbox setup on non-chat pages. (#2265 B Phase 5)
      const { chatApi } = sandbox.args;
      await chatApi
        .openChat({ ownerHandle: ctx.validated.ownerHandle, appSlug: ctx.validated.appSlug, mode: "runtime" })
        .then(async (rChat) => {
          if (rChat.isErr()) {
            return ctx.send.send(ctx, {
              tid: ctx.validated.tid,
              type: "vibe.res.callAI",
              status: "error",
              message: rChat.Err().message,
            } satisfies ResErrorCallAI);
          }
          getCodeBlock(rChat.Ok().sectionStream)
            .then(({ code, sectionEvt: msg }) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.callAI",
                status: "ok",
                promptId: msg.promptId,
                result: code,
              } satisfies ResOkCallAI);
            })
            .catch((err) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.callAI",
                status: "error",
                message: err?.message ?? String(err),
              } satisfies ResErrorCallAI);
            });
          const generateSchema: ChatMessage[] = [];
          if (ctx.validated.schema) {
            generateSchema.push({
              role: "system",
              content: [
                {
                  type: "text",
                  text: await buildSchemaSystemMessage(ctx.validated.schema),
                },
              ],
            });
          }
          const rPrompt = await rChat.Ok().prompt({
            messages: [
              ...generateSchema,
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: ctx.validated.prompt,
                  },
                ],
              },
            ],
          });

          if (rPrompt.isErr()) {
            return ctx.send.send(ctx, {
              tid: ctx.validated.tid,
              type: "vibe.res.callAI",
              status: "error",
              message: rPrompt.Err().message,
            } satisfies ResErrorCallAI);
          }
        });
      return Result.Ok(EventoResult.Stop);
    },
  };
}

// Walk the chat section stream and collect file refs from each `block.image`
// event. Server-side image-gen writes bytes through `storeAndAuditAsset`
// before emitting the block, so each entry already has an AssetUploads row.
// The hook installs these as `_files.v<N>` on the doc; Stage C's URL minter
// adds `meta.url` on read.
export function getImageFiles(stream: ReadableStream<unknown>): Promise<ImgGenFile[]> {
  const files: ImgGenFile[] = [];
  const done = new Future<ImgGenFile[]>();
  processStream(stream, (msg) => {
    if (isSectionEvent(msg)) {
      for (const block of msg.blocks) {
        if (isBlockImage(block)) {
          if (block.uploadId && block.cid && block.mimeType && typeof block.size === "number") {
            files.push({ uploadId: block.uploadId, cid: block.cid, mimeType: block.mimeType, size: block.size });
          }
        }
        if (isPromptBlockEnd(block)) {
          done.resolve(files);
        }
      }
    }
  });
  return done.asPromise();
}

export function vibeImgGen(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.imgGen",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqImgGen(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqImgGen, unknown>): Promise<Result<EventoResultType>> => {
      // Single-flight response. The previous design raced
      // `getImageFiles` and `prompt()` and let whichever resolved first
      // call `ctx.send.send`. When the upstream provider errored, the
      // section stream often resolved first with an empty `files`
      // array, masking the real error as `ResOkImgGen { files: [] }`.
      // We now wait for `prompt()` first and only emit OK once we have
      // actual files to report.
      const tid = ctx.validated.tid;
      const sendErr = (message: string) =>
        ctx.send.send(ctx, {
          tid,
          type: "vibe.res.imgGen",
          status: "error",
          message,
        } satisfies ResErrorImgGen);
      const sendOk = (files: ImgGenFile[]) =>
        ctx.send.send(ctx, {
          tid,
          type: "vibe.res.imgGen",
          status: "ok",
          files,
        } satisfies ResOkImgGen);

      const api = await requireVibeApi(sandbox, ctx, "vibe.res.imgGen");
      if (api === undefined) return Result.Ok(EventoResult.Stop);

      await api
        .openChat({ ownerHandle: ctx.validated.ownerHandle, appSlug: ctx.validated.appSlug, mode: "img" })
        .then(async (rChat) => {
          if (rChat.isErr()) return sendErr(rChat.Err().message);
          const chat = rChat.Ok();
          // Start consuming the section stream eagerly so file-block
          // events aren't lost while `prompt()` runs.
          const filesPromise = getImageFiles(chat.sectionStream);
          const rPrompt = await chat.prompt(
            {
              ...(ctx.validated.model ? { model: ctx.validated.model } : {}),
              messages: [{ role: "user", content: [{ type: "text", text: ctx.validated.prompt }] }],
            },
            ctx.validated.inputImageBase64 ? { inputImageBase64: ctx.validated.inputImageBase64 } : undefined
          );
          if (rPrompt.isErr()) return sendErr(rPrompt.Err().message);
          const rFiles = await exception2Result(() => filesPromise);
          if (rFiles.isErr()) return sendErr(rFiles.Err().message);
          const files = rFiles.Ok();
          if (!files || files.length === 0) {
            return sendErr("Image generation completed without producing a file");
          }
          return sendOk(files);
        });
      return Result.Ok(EventoResult.Stop);
    },
  };
}
