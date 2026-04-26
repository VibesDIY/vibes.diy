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
  EvtAttachFPDb,
  isReqImgVibes,
  ReqImgVibes,
  ResOkImgVibes,
  ResErrorImgVibes,
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

export function getImageUrls(stream: ReadableStream<unknown>): Promise<string[]> {
  const urls: string[] = [];
  const done = new Future<string[]>();
  processStream(stream, (msg) => {
    const msgType = (msg as Record<string, unknown>).type;
    if (isSectionEvent(msg)) {
      for (const block of msg.blocks) {
        console.log("[vibeImgVibes] block:", block.type, "isImage:", isBlockImage(block));
        if (isBlockImage(block)) {
          console.log("[vibeImgVibes] got image URL, length:", block.url?.length);
          urls.push(block.url);
        }
        if (isPromptBlockEnd(block)) {
          console.log("[vibeImgVibes] prompt.block-end, resolving with", urls.length, "urls");
          done.resolve(urls);
        }
      }
    } else {
      console.log("[vibeImgVibes] non-section msg:", msgType);
    }
  });
  return done.asPromise();
}

function vibeImageGen(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.imgVibes",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqImgVibes(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqImgVibes, unknown>): Promise<Result<EventoResultType>> => {
      await vibeDiyApi
        .openChat({ userSlug: ctx.validated.userSlug, appSlug: ctx.validated.appSlug, mode: "img" })
        .then(async (rChat) => {
          if (rChat.isErr()) {
            return ctx.send.send(ctx, {
              tid: ctx.validated.tid,
              type: "vibe.res.imgVibes",
              status: "error",
              message: rChat.Err().message,
            } satisfies ResErrorImgVibes);
          }
          getImageUrls(rChat.Ok().sectionStream)
            .then((imageUrls) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.imgVibes",
                status: "ok",
                imageUrls,
              } satisfies ResOkImgVibes);
            })
            .catch((err) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.imgVibes",
                status: "error",
                message: err?.message ?? String(err),
              } satisfies ResErrorImgVibes);
            });
          const rPrompt = await rChat.Ok().prompt(
            {
              ...(ctx.validated.model ? { model: ctx.validated.model } : {}),
              messages: [{ role: "user", content: [{ type: "text", text: ctx.validated.prompt }] }],
            },
            ctx.validated.inputImageBase64 ? { inputImageBase64: ctx.validated.inputImageBase64 } : undefined
          );
          if (rPrompt.isErr()) {
            return ctx.send.send(ctx, {
              tid: ctx.validated.tid,
              type: "vibe.res.imgVibes",
              status: "error",
              message: rPrompt.Err().message,
            } satisfies ResErrorImgVibes);
          }
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

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly shareableDBs = new LRUMap<string, ShareableDBInfo>();

  readonly onRuntimeReady = OnFunc<(evt: EvtRuntimeReady) => void>();

  // Captured iframe postMessage target — set on first message from iframe
  private iframeSource: Window | undefined;
  private iframeOrigin: string | undefined;

  readonly handleMessage = (event: MessageEvent): void => {
    // Capture iframe window reference — only from sandbox messages (vibe.* prefix)
    // to avoid capturing Clerk auth or analytics iframes that postMessage first
    if (!this.iframeSource && event.source && typeof event.data?.type === "string" && event.data.type.startsWith("vibe.")) {
      this.iframeSource = event.source as Window;
      this.iframeOrigin = event.origin;
    }
    this.evento.trigger<MessageEvent, unknown, unknown>({
      request: event,
      send: new PostMsgSendProvider(window, event),
    });
  };

  // Forward a doc-changed event from the API to the iframe
  forwardDocChangedToIframe(userSlug: string, appSlug: string, docId: string): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage({ type: "vibes.diy.evt-doc-changed", userSlug, appSlug, docId }, this.iframeOrigin);
    }
  }

  // Hot-swap the iframe's App.jsx with new source. Returns false if the iframe
  // hasn't sent its first message yet (no postMessage target captured). Caller
  // can ignore the false; end-of-turn autosave covers it via fsId navigation.
  pushSource(source: string): boolean {
    if (!this.iframeSource || !this.iframeOrigin) {
      console.warn("[parent-hot-swap] iframe not ready, drop", { sourceLen: source.length });
      return false;
    }
    console.log("[parent-hot-swap] postMessage to iframe", {
      origin: this.iframeOrigin,
      sourceLen: source.length,
      head: source.slice(0, 80),
    });
    this.iframeSource.postMessage({ type: "vibe.req.set-source", source }, this.iframeOrigin);
    return true;
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
        vibeImageGen(this),
        vibeFetchCloudToken(this),
        vibePutDoc(this),
        vibeGetDoc(this),
        vibeQueryDocs(this),
        vibeDeleteDoc(this),
        vibeSubscribeDocs(this),
        vibeListDbNames(this),
      ]
    );
    this.args.eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = this.args.eventListeners.removeEventListener;

    // Forward doc-changed events from the API WebSocket to the iframe
    this.args.vibeDiyApi.onDocChanged((userSlug, appSlug, docId) => {
      this.forwardDocChangedToIframe(userSlug, appSlug, docId);
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
