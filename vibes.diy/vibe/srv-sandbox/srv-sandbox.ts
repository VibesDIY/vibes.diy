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
} from "@adviser/cement";
import {
  isReqVibeRegisterFPDb,
  ReqVibeRegisterFPDb,
  ResErrorVibeRegisterFPDb,
  ResOkVibeRegisterFPDb,
} from "@vibes.diy/vibe-types";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";

interface EventListeners {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

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
    console.log("PostMsgSendProvider sending data", data, "to", this.event.origin);
    (this.event.source as Window).postMessage(data, this.event.origin);
    return Promise.resolve(Result.Ok(data as unknown as OS));
  }
}

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly shareableDBs = new LRUMap<string, ResOkVibeRegisterFPDb>();

  readonly handleMessage = (event: MessageEvent): void => {
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

  constructor(dashApi: ReturnType<typeof clerkDashApi>, eventListeners: EventListeners) {
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
          appSlug: ctx.validated.appSlug,
          userSlug: ctx.validated.userSlug,
          dbName: ctx.validated.dbName,
          fsId: ctx.validated.fsId,
          appId: rCloudToken.Ok().appId,
          tenant: rCloudToken.Ok().tenant,
          ledger: rCloudToken.Ok().ledger,
        } satisfies ResOkVibeRegisterFPDb;
        await ctx.send.send(ctx, ok);
        if (!this.shareableDBs.has(key)) {
          this.shareableDBs.set(key, ok);
        }
        return Result.Ok(EventoResult.Stop);
      },
    });
    eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = eventListeners.removeEventListener;
  }

  [Symbol.dispose](): void {
    this.removeEventListeners("message", this.handleMessage);
  }
}

export const VibesDiySrvSandbox = Lazy((dashApi: ReturnType<typeof clerkDashApi>, el: EventListeners) => {
  if (!el) {
    return {} as vibesDiySrvSandbox;
  }
  return new vibesDiySrvSandbox(dashApi, el);
});
