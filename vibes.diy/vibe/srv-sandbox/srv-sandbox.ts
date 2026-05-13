import {
  Evento,
  EventoEnDecoder,
  HandleTriggerCtx,
  Lazy,
  Result,
  ValidateTriggerCtx,
  Option,
  EventoResultType,
  EventoResult,
  EventoSendProvider,
  LRUMap,
  processStream,
  EventoHandler,
  exception2Result,
  Future,
  OnFunc,
} from "@adviser/cement";
import {
  isReqVibeRegisterFPDb,
  ReqVibeRegisterFPDb,
  ResOkVibeRegisterFPDb,
  isReqCallAI,
  ReqCallAI,
  ResErrorCallAI,
  ResOkCallAI,
  ReqFetchCloudToken,
  isReqFetchCloudToken,
  ResFetchCloudToken,
  isEvtRuntimeReady,
  EvtRuntimeReady,
  EvtRuntimeAck,
  EvtAttachFPDb,
  isReqImgGen,
  ReqImgGen,
  ResOkImgGen,
  ResErrorImgGen,
  ImgGenFile,
  isReqPutDoc,
  ReqPutDoc,
  isReqGetDoc,
  ReqGetDoc,
  isReqQueryDocs,
  ReqQueryDocs,
  isReqDeleteDoc,
  ReqDeleteDoc,
  isReqSubscribeDocs,
  ReqSubscribeDocs,
  isReqListDbNames,
  ReqListDbNames,
  EvtVibeSetSource,
  isEvtVibeHotSwapError,
  isReqVibePutAsset,
  ReqVibePutAsset,
  ResOkVibePutAsset,
  ResErrorVibePutAsset,
  EvtVibePutAssetProgress,
  isReqVibeWhoAmI,
  ReqVibeWhoAmI,
  ResVibeWhoAmI,
} from "@vibes.diy/vibe-types";
import {
  isPromptBlockEnd,
  isPromptReq,
  isResFPCloudTokenGrant,
  isSectionEvent,
  PromptReq,
  SectionEvent,
  VibesDiyApiIface,
} from "@vibes.diy/api-types";
import { ChatMessage, CodeEndMsg, isBlockImage, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";
import { buildSchemaSystemMessage } from "@vibes.diy/prompts";

export class MessageEventEventoEnDecoder implements EventoEnDecoder<MessageEvent, unknown> {
  async encode(me: MessageEvent): Promise<Result<unknown>> {
    return Result.Ok(me);
  }
  decode(data: unknown): Promise<Result<unknown>> {
    return Promise.resolve(Result.Ok(data));
  }
}

export class PostMsgSendProvider implements EventoSendProvider<MessageEvent, unknown, unknown> {
  readonly window: Window;
  readonly event: MessageEvent;

  constructor(window: Window, event: MessageEvent) {
    this.window = window;
    this.event = event;
  }

  send<IS, OS>(trigger: HandleTriggerCtx<MessageEvent<unknown>, unknown, unknown>, data: IS): Promise<Result<OS, Error>> {
    // console.log("PostMsgSendProvider sending data", data, "to", this.event.origin);
    (this.event.source as Window).postMessage(data, this.event.origin);
    return Promise.resolve(Result.Ok(data as unknown as OS));
  }
}

interface VibesDiySrvSandboxArgs {
  // dashApi: ReturnType<typeof clerkDashApi>;
  vibeDiyApi: VibesDiyApiIface;
  errorLogger: (r: string | Result<unknown> | Error) => void;
  eventListeners: {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
  };
  // Optional injected fetcher — defaults to globalThis.fetch. Tests pass
  // a fake here to avoid mocking globals.
  fetch?: typeof fetch;
  // Stage C: hook the asset-host cookie bridge into the iframe boot
  // handshake. Called BEFORE we post vibe.evt.runtime.ack — the iframe
  // gates every RPC on that ack, so any meta.url the iframe ever sees
  // is already post-cookie. Idempotent + cached at the module level
  // (see pkg/app/lib/asset-session.ts), so redundant calls are no-ops.
  // Optional: tests omit it; production binds it via the provider.
  ensureAssetSession?: () => Promise<void>;
}

interface ShareableDBInfo {
  key: string;
  data: ResOkVibeRegisterFPDb["data"];
  attachAction: "attach" | "detach" | "none" | "prepare-attach";
}

function vibeRuntimeReady(sandbox: vibesDiySrvSandbox): EventoHandler {
  return {
    hash: "vibe.runtime.ready",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, EvtRuntimeReady, unknown>) => {
      const { request: req } = ctx;
      if (isEvtRuntimeReady(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, EvtRuntimeReady, unknown>): Promise<Result<EventoResultType>> => {
      sandbox.onRuntimeReady.invoke(ctx.validated);
      // console.log(`Received vibe.runtime.ready event`, ctx);
      return Result.Ok(EventoResult.Continue);
    },
  };
}

function vibeRegisterFPDB(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { shareableDBs, args } = sandbox;
  return {
    hash: "vibe.register.fpdb",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeRegisterFPDb(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqVibeRegisterFPDb, unknown>): Promise<Result<EventoResultType>> => {
      const key = `${ctx.validated.userSlug}-${ctx.validated.appSlug}-${ctx.validated.dbName}`;
      shareableDBs.onSet(async (k, v, meta) => {
        if (k !== key || !meta.update) {
          return;
        }
        if (v.attachAction !== "attach") {
          return;
        }
        v.attachAction = "prepare-attach";
        // const rUser = await dashApi.ensureUser({});
        // if (rUser.isErr()) {
        //   sandbox.args.errorLogger(`Failed to ensure user: ${rUser.Err().message}`);
        // }
        const rCloudToken = await args.vibeDiyApi.getFPCloudToken({
          ...ctx.validated,
        });
        if (rCloudToken.isErr()) {
          sandbox.args.errorLogger(`Failed to ensure cloud token: ${rCloudToken.Err().message}`);
        }
        const token = rCloudToken.Ok();
        if (!isResFPCloudTokenGrant(token)) {
          sandbox.args.errorLogger(`Cloud token grant is ${token.grant}, cannot attach to DB`);
          return;
        }
        void ctx.send.send(ctx, {
          type: "vibe.evt.attach.fpdb",
          // status: "ok",
          data: {
            dbName: token.dbName,
            appSlug: token.appSlug,
            userSlug: token.userSlug,
            fpcloudUrl: token.fpCloudUrl,
          },
        } satisfies EvtAttachFPDb);
      });
      const ok = {
        tid: ctx.validated.tid,
        type: "vibe.res.register.fpdb",
        status: "ok",
        data: {
          appSlug: ctx.validated.appSlug,
          userSlug: ctx.validated.userSlug,
          dbName: ctx.validated.dbName,
          // appId: rCloudToken.Ok().appId,
          // tenant: rCloudToken.Ok().tenant,
          // ledger: rCloudToken.Ok().ledger,
        },
      } satisfies ResOkVibeRegisterFPDb;
      console.log("vibeRegisterFPDB sending response", ok);
      await ctx.send.send(ctx, ok);
      shareableDBs.set(key, {
        key,
        data: ok.data,
        attachAction: "none",
      });
      return Result.Ok(EventoResult.Stop);
    },
  };
}

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

function vibeFetchCloudToken(sandbox: vibesDiySrvSandbox): EventoHandler {
  return {
    hash: "vibe.fetchCloudToken",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqFetchCloudToken(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqFetchCloudToken, unknown>): Promise<Result<EventoResultType>> => {
      const { data } = ctx.validated;
      console.log(`Handling vibe.fetchCloudToken event with validated data`, data);
      sandbox.args.vibeDiyApi
        .getFPCloudToken({
          appSlug: data.appSlug,
          userSlug: data.userSlug,
          dbName: data.dbName,
        })
        .then((rRes) => {
          if (rRes.isErr()) {
            sandbox.args.errorLogger(`Failed to get FP Cloud token: ${rRes.Err().message}`);
            return rRes;
          }
          const res = rRes.Ok();
          if (!isResFPCloudTokenGrant(res)) {
            sandbox.args.errorLogger(`Cloud token grant is ${res.grant}, cannot fetch cloud token`);
            return Result.Err(`Cloud token grant is ${res.grant}, cannot fetch cloud token`);
          }
          ctx.send.send(ctx, {
            tid: ctx.validated.tid,
            type: "vibe.res.fetchCloudToken",
            data,
            token: {
              cloudToken: res.token.token,
              claims: res.token.claims,
              expiresInSec: res.token.expiresInSec,
            },
          } satisfies ResFetchCloudToken);
        });
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeCallAI(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
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
      await vibeDiyApi
        .openChat({ userSlug: ctx.validated.userSlug, appSlug: ctx.validated.appSlug, mode: "app" })
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

function vibeImgGen(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
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

      await vibeDiyApi
        .openChat({ userSlug: ctx.validated.userSlug, appSlug: ctx.validated.appSlug, mode: "img" })
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

// ── Firefly document handlers ──────────────────────────────────────

function vibePutDoc(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.putDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqPutDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqPutDoc, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.putDoc({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        doc: ctx.validated.doc,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-put-doc",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-put-doc",
          status: "ok",
          id: res.id,
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeGetDoc(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.getDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqGetDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqGetDoc, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.getDoc({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-get-doc",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-get-doc",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeQueryDocs(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.queryDocs",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqQueryDocs(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqQueryDocs, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.queryDocs({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-query-docs",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-query-docs",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeDeleteDoc(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.deleteDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqDeleteDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqDeleteDoc, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.deleteDoc({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-delete-doc",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-delete-doc",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeSubscribeDocs(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.subscribeDocs",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqSubscribeDocs(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqSubscribeDocs, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.subscribeDocs({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-subscribe-docs",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          ...rRes.Ok(),
          tid: ctx.validated.tid,
          type: "vibes.diy.res-subscribe-docs",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeListDbNames(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.listDbNames",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqListDbNames(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqListDbNames, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.listDbNames({
        userSlug: ctx.validated.userSlug,
        appSlug: ctx.validated.appSlug,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-list-db-names",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          ...rRes.Ok(),
          tid: ctx.validated.tid,
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

// Stage B Phase 5 host-side handler. Receives a Blob from the iframe,
// mints a put-asset grant via the server WS, then POSTs the bytes to the
// returned uploadUrl. Emits `vibe.evt.putAsset.progress` heartbeats every
// 3s while the fetch is in flight so the sandbox-side request's idle
// timer doesn't fire during a slow upload.
//
// Auth: the grant request goes through VibesDiyApi.send() which attaches
// the dashboard auth token automatically. The HTTP POST carries
// X-Asset-Grant; verifyAuth is NOT called server-side — the grant IS the
// auth (see vibes.diy/api/svc/public/put-asset.ts).
const PROGRESS_INTERVAL_MS = 3000;

function vibePutAsset(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  const doFetch: typeof fetch = sandbox.args.fetch ?? ((...a) => fetch(...a));
  return {
    hash: "vibe.putAsset",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibePutAsset(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibePutAsset, unknown>): Promise<Result<EventoResultType>> => {
      const { tid, blob, userSlug, appSlug, mimeType } = ctx.validated;
      const sendErr = async (message: string) => {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.putAsset",
          status: "error",
          message,
        } satisfies ResErrorVibePutAsset);
      };

      const rGrant = await vibeDiyApi.requestAssetUploadGrant({
        userSlug,
        appSlug,
        ...(mimeType ? { mimeType } : mimeType === undefined && blob.type ? { mimeType: blob.type } : {}),
      });
      if (rGrant.isErr()) {
        await sendErr(`grant minting failed: ${rGrant.Err().message}`);
        return Result.Ok(EventoResult.Stop);
      }
      const grant = rGrant.Ok();

      // Heartbeat the iframe every 3s while the upload is in flight so
      // its 10s idle-reset timer doesn't expire during slow networks.
      const progressTimer = setInterval(() => {
        ctx.send.send(ctx, {
          tid,
          type: "vibe.evt.putAsset.progress",
          bytes: blob.size,
        } satisfies EvtVibePutAssetProgress);
      }, PROGRESS_INTERVAL_MS);

      try {
        const res = await doFetch(grant.uploadUrl, {
          method: "POST",
          headers: {
            "X-Asset-Grant": grant.grant,
            "Content-Type": blob.type || "application/octet-stream",
          },
          body: blob,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          await sendErr(`POST ${grant.uploadUrl} returned ${res.status}: ${text}`);
          return Result.Ok(EventoResult.Stop);
        }
        const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.putAsset",
          status: "ok",
          cid: body.cid,
          getURL: body.getURL,
          size: body.size,
          uploadId: body.uploadId,
        } satisfies ResOkVibePutAsset);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendErr(`upload failed: ${msg}`);
      } finally {
        clearInterval(progressTimer);
      }

      return Result.Ok(EventoResult.Stop);
    },
  };
}

function vibeWhoAmI(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.whoAmI",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeWhoAmI(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibeWhoAmI, unknown>): Promise<Result<EventoResultType>> => {
      const { tid, appSlug, userSlug } = ctx.validated;
      const rRes = await vibeDiyApi.whoAmI({ tid, appSlug, userSlug });

      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.whoAmI",
          viewer: null,
          access: "none",
        } satisfies ResVibeWhoAmI);
        return Result.Ok(EventoResult.Stop);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.whoAmI",
        viewer: r.viewer,
        access: r.access,
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly shareableDBs = new LRUMap<string, ShareableDBInfo>();

  readonly onRuntimeReady = OnFunc<(evt: EvtRuntimeReady) => void>();

  // Iframe → parent hot-swap failure dispatch. Subscribers (PreviewApp) toast
  // so the user sees that a streamed edit failed to compile/mount, instead of
  // assuming the silently-stale preview is the latest state.
  readonly onHotSwapError = OnFunc<(err: { readonly message: string }) => void>();

  // Captured iframe postMessage target — set on first message from iframe
  private iframeSource: Window | undefined;
  private iframeOrigin: string | undefined;
  // Latest source we've ever attempted to push. Replayed on every runtime.ready
  // so the iframe is rehydrated whether the ready fires from a brand-new boot,
  // an HMR reload, or a cross-vibe navigation that destroyed the previous
  // iframe Window (the prior reference would still look "alive" to a naive
  // pushSource — postMessage to a detached Window is a silent no-op, so without
  // replay the first chat-B push would be lost between the dead iframeSource
  // and the new iframe's runtime.ready).
  private pendingSource: string | undefined;

  readonly handleMessage = async (event: MessageEvent): Promise<void> => {
    // vibe.* prefix filters out Clerk auth / analytics iframes that postMessage first.
    const isVibeMsg = event.source && typeof event.data?.type === "string" && event.data.type.startsWith("vibe.");
    // runtime.ready signals the iframe just (re-)booted with the hot-swap listener
    // registered. Always re-capture iframeSource here so HMR reloads, manual page
    // reloads, etc. don't leave us posting to a stale (dead) Window reference.
    const isRuntimeReady = isVibeMsg && (event.data as { type?: string } | undefined)?.type === "vibe.evt.runtime.ready";
    if (isRuntimeReady) {
      this.iframeSource = event.source as Window;
      this.iframeOrigin = event.origin;
      // Stage C: bridge the asset-host session cookie BEFORE acking the
      // iframe. The iframe gates every RPC on this ack, so any meta.url
      // the iframe ever sees comes back post-cookie. No race window for
      // <img> requests. Bridge failures (signed-out user, network blip)
      // still proceed to ack — public-readable vibes keep working;
      // private vibes show broken-image, which is correct.
      if (this.args.ensureAssetSession) {
        try {
          await this.args.ensureAssetSession();
        } catch (e) {
          console.warn("[stage-c] ensureAssetSession failed before runtime.ack", e);
        }
      }
      // Acknowledge so the iframe can stop its retry loop. The iframe re-posts
      // runtime.ready until it sees this ack, defeating the race where a
      // cached-assets iframe boots before the parent's React provider mounts.
      this.iframeSource.postMessage({ type: "vibe.evt.runtime.ack" } satisfies EvtRuntimeAck, this.iframeOrigin);
      if (this.pendingSource !== undefined) {
        const msg: EvtVibeSetSource = { type: "vibe.evt.set-source", source: this.pendingSource };
        this.iframeSource.postMessage(msg, this.iframeOrigin);
      }
    } else if (isVibeMsg && !this.iframeSource) {
      // Edge case: a non-runtime.ready vibe.* message arriving before runtime.ready
      // (shouldn't happen in normal flow, but capture defensively).
      this.iframeSource = event.source as Window;
      this.iframeOrigin = event.origin;
    }
    if (isEvtVibeHotSwapError(event.data)) {
      this.onHotSwapError.invoke({ message: event.data.message });
    }
    this.evento.trigger<MessageEvent, unknown, unknown>({
      request: event,
      send: new PostMsgSendProvider(window, event),
    });
  };

  // Forward a doc-changed event from the API to the iframe
  forwardDocChangedToIframe(userSlug: string, appSlug: string, dbName: string, docId: string): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage({ type: "vibes.diy.evt-doc-changed", userSlug, appSlug, dbName, docId }, this.iframeOrigin);
    }
  }

  // Hot-swap the iframe's App.jsx with new source. Always cache the source in
  // pendingSource so a subsequent runtime.ready (HMR reload, cross-vibe
  // navigation, iframe replacement) can replay it — postMessage to a detached
  // Window is a silent no-op, so without this cache the first push after the
  // old iframe dies but before the new one acks would be lost.
  pushSource(source: string): boolean {
    this.pendingSource = source;
    if (this.iframeSource === undefined || this.iframeOrigin === undefined) {
      return false;
    }
    const msg: EvtVibeSetSource = { type: "vibe.evt.set-source", source };
    this.iframeSource.postMessage(msg, this.iframeOrigin);
    return true;
  }

  // Drop the cached source. PreviewApp calls this on cross-vibe navigation so
  // a subsequent runtime.ready doesn't rehydrate the new iframe with the prior
  // vibe's code — the new iframe's entry URL already loads the correct app,
  // and a stale replay before chat B's processStream emits a qualifying push
  // (or in the case where it never does — empty chats, sub-200-char buffers,
  // missing `export default`) would overwrite it indefinitely.
  clearPendingSource(): void {
    if (this.pendingSource === undefined) return;
    this.pendingSource = undefined;
  }

  readonly removeEventListeners: typeof window.removeEventListener;
  readonly args: VibesDiySrvSandboxArgs;

  constructor(args: VibesDiySrvSandboxArgs) {
    this.args = args;
    this.evento = new Evento(new MessageEventEventoEnDecoder());
    this.evento.push(
      ...[
        vibeRuntimeReady(this),
        vibeRegisterFPDB(this),
        vibeCallAI(this),
        vibeImgGen(this),
        vibeFetchCloudToken(this),
        vibePutDoc(this),
        vibeGetDoc(this),
        vibeQueryDocs(this),
        vibeDeleteDoc(this),
        vibeSubscribeDocs(this),
        vibeListDbNames(this),
        vibePutAsset(this),
        vibeWhoAmI(this),
      ]
    );
    this.args.eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = this.args.eventListeners.removeEventListener;

    // Forward doc-changed events from the API WebSocket to the iframe
    this.args.vibeDiyApi.onDocChanged((userSlug, appSlug, dbName, docId) => {
      this.forwardDocChangedToIframe(userSlug, appSlug, dbName, docId);
    });
  }

  /** @internal — test inspection only */
  get _testInternals(): { iframeSource: Window | undefined; iframeOrigin: string | undefined } {
    return { iframeSource: this.iframeSource, iframeOrigin: this.iframeOrigin };
  }

  [Symbol.dispose](): void {
    this.removeEventListeners("message", this.handleMessage);
  }
}

export const VibesDiySrvSandbox = Lazy((ctx: VibesDiySrvSandboxArgs) => {
  // console.log(`Start VibesDiySrvSandbox`, { dashApi, el });
  if (!ctx.eventListeners) {
    return {} as vibesDiySrvSandbox;
  }
  return new vibesDiySrvSandbox(ctx);
});
