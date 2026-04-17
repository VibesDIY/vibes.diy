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
  isReqImageGen,
  ReqImageGen,
  ResOkImageGen,
  ResErrorImageGen,
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
    if (isSectionEvent(msg)) {
      for (const block of msg.blocks) {
        if (isBlockImage(block)) {
          console.log("[vibeImageGen] Image URL from stream:", block.url);
          urls.push(block.url);
        }
        if (isPromptBlockEnd(block)) {
          done.resolve(urls);
        }
      }
    }
  });
  return done.asPromise();
}

function vibeImageGen(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.imageGen",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqImageGen(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqImageGen, unknown>): Promise<Result<EventoResultType>> => {
      await vibeDiyApi
        .openChat({ userSlug: ctx.validated.userSlug, appSlug: ctx.validated.appSlug, mode: "img" })
        .then(async (rChat) => {
          if (rChat.isErr()) {
            return ctx.send.send(ctx, {
              tid: ctx.validated.tid,
              type: "vibe.res.imageGen",
              status: "error",
              message: rChat.Err().message,
            } satisfies ResErrorImageGen);
          }
          getImageUrls(rChat.Ok().sectionStream)
            .then((imageUrls) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.imageGen",
                status: "ok",
                imageUrls,
              } satisfies ResOkImageGen);
            })
            .catch((err) => {
              ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.imageGen",
                status: "error",
                message: err?.message ?? String(err),
              } satisfies ResErrorImageGen);
            });
          const rPrompt = await rChat.Ok().prompt({
            messages: [
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
              type: "vibe.res.imageGen",
              status: "error",
              message: rPrompt.Err().message,
            } satisfies ResErrorImageGen);
          }
        });
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly shareableDBs = new LRUMap<string, ShareableDBInfo>();

  readonly onRuntimeReady = OnFunc<(evt: EvtRuntimeReady) => void>();

  readonly handleMessage = (event: MessageEvent): void => {
    // console.log(`Received message event in vibesDiySrvSandbox`, event);
    this.evento.trigger<MessageEvent, unknown, unknown>({
      request: event,
      send: new PostMsgSendProvider(window, event),
    });
  };

  readonly removeEventListeners: typeof window.removeEventListener;
  readonly args: VibesDiySrvSandboxArgs;

  constructor(args: VibesDiySrvSandboxArgs) {
    this.args = args;
    this.evento = new Evento(new MessageEventEventoEnDecoder());
    this.evento.push(
      ...[vibeRuntimeReady(this), vibeRegisterFPDB(this), vibeCallAI(this), vibeImageGen(this), vibeFetchCloudToken(this)]
    );
    // console.log(`Adding event listener for vibesDiySrvSandbox`, this.handleMessage);
    this.args.eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = this.args.eventListeners.removeEventListener;
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
