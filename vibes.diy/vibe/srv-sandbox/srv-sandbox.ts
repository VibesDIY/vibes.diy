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
} from "@adviser/cement";
import {
  isReqVibeRegisterFPDb,
  ReqVibeRegisterFPDb,
  ResErrorVibeRegisterFPDb,
  ResOkVibeRegisterFPDb,
  isReqCallAI,
  ReqCallAI,
  ResErrorCallAI,
  ResOkCallAI,
} from "@vibes.diy/vibe-types";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { isSectionEvent, VibesDiyApiIface } from "@vibes.diy/api-types";
import { ChatMessage, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";

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
  dashApi: ReturnType<typeof clerkDashApi>;
  vibeDiyApi: VibesDiyApiIface;
  eventListeners: {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
  };
}

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly shareableDBs = new LRUMap<string, ResOkVibeRegisterFPDb>();

  readonly handleMessage = (event: MessageEvent): void => {
    // console.log(`Received message event in vibesDiySrvSandbox`, event);
    this.evento.trigger<MessageEvent, unknown, unknown>({
      request: event,
      send: new PostMsgSendProvider(window, event),
    });
    // if (event.data?.type === "vibes-diy-srv-sandbox-event") {
    // const detail = event.data.detail;
    // window.dispatchEvent(new CustomEvent("vibes-diy-srv-sandbox-event", { detail }));
    // }
  };

  readonly removeEventListeners: typeof window.removeEventListener;

  constructor({ dashApi, vibeDiyApi, eventListeners }: VibesDiySrvSandboxArgs) {
    this.evento = new Evento(new MessageEventEventoEnDecoder());
    this.evento.push({
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
        const rUser = await dashApi.ensureUser({});
        if (rUser.isErr()) {
          console.error("Failed to ensure user", rUser.Err());
          await ctx.send.send(ctx, {
            tid: ctx.validated.tid,
            type: "vibe.res.register.fpdb",
            status: "error",
            message: `Failed to ensure user ${rUser.Err().message}`,
          } satisfies ResErrorVibeRegisterFPDb);
          return Result.Ok(EventoResult.Stop);
        }
        const rCloudToken = await dashApi.ensureCloudToken({ appId: key });
        if (rCloudToken.isErr()) {
          console.error("Failed to ensure cloud token", rCloudToken.Err());
          await ctx.send.send(ctx, {
            tid: ctx.validated.tid,
            type: "vibe.res.register.fpdb",
            status: "error",
            message: `Failed to ensure cloud token ${rCloudToken.Err().message}`,
          } satisfies ResErrorVibeRegisterFPDb);
          return Result.Ok(EventoResult.Stop);
        }
        const ok = {
          tid: ctx.validated.tid,
          type: "vibe.res.register.fpdb",
          status: "ok",
          data: {
            appSlug: ctx.validated.appSlug,
            userSlug: ctx.validated.userSlug,
            dbName: ctx.validated.dbName,
            fsId: ctx.validated.fsId,
            appId: rCloudToken.Ok().appId,
            tenant: rCloudToken.Ok().tenant,
            ledger: rCloudToken.Ok().ledger,
          },
        } satisfies ResOkVibeRegisterFPDb;
        await ctx.send.send(ctx, ok);
        if (!this.shareableDBs.has(key)) {
          this.shareableDBs.set(key, ok);
        }
        return Result.Ok(EventoResult.Stop);
      },
    });
    this.evento.push({
      hash: "vibe.callAI",
      validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
        const { request: req } = ctx;
        if (isReqCallAI(req?.data)) {
          return Promise.resolve(Result.Ok(Option.Some(req.data)));
        }
        return Promise.resolve(Result.Ok(Option.None()));
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqCallAI, unknown>): Promise<Result<EventoResultType>> => {
        console.log(`Handling vibe.callAI event with validated data`, ctx);
        await vibeDiyApi
          .openChat({ userSlug: ctx.validated.userSlug, appSlug: ctx.validated.appSlug, mode: "application" })
          .then(async (rChat) => {
            console.log(`openChat result in callAI handler`, rChat);
            if (rChat.isErr()) {
              return ctx.send.send(ctx, {
                tid: ctx.validated.tid,
                type: "vibe.res.callAI",
                status: "error",
                message: rChat.Err().message,
              } satisfies ResErrorCallAI);
            }
            const codeParts: string[] = [];
            void processStream(rChat.Ok().sectionStream, (msg) => {
              if (isSectionEvent(msg)) {
                for (const block of msg.blocks) {
                  if (isCodeBegin(block) && block.lang.toLocaleUpperCase() === "JSON") {
                    codeParts.splice(0, codeParts.length); // clear previous code parts
                  }
                  if (isCodeLine(block)) {
                    codeParts.push(block.line);
                  }
                  if (isCodeEnd(block)) {
                    ctx.send.send(ctx, {
                      tid: ctx.validated.tid,
                      type: "vibe.res.callAI",
                      status: "ok",
                      promptId: msg.promptId,
                      result: codeParts.join("\n"),
                    } satisfies ResOkCallAI);
                  }
                }
              }
            });
            // console.log(`Sending prompt to chat`, ctx.validated.prompt);
            const generateSchema: ChatMessage[] = [];
            if (ctx.validated.schema) {
              console.log(`Prompt has schema, sending schema`, ctx.validated.schema);
              generateSchema.push({
                role: "system",
                content: [
                  {
                    type: "text",
                    text: `Here is the JSON schema for the expected response. 
                    Please generate one result that conforms to this schema.
                    Output like Code Blocks and like \`\`\`JSON 
                    ${JSON.stringify(ctx.validated.schema)}`,
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
    });
    // console.log(`Adding event listener for vibesDiySrvSandbox`, this.handleMessage);
    eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = eventListeners.removeEventListener;
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
