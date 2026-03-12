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
  EventoHandler,
  OnFunc,
} from "@adviser/cement";
import {
  isReqVibeRegisterFPDb,
  ReqVibeRegisterFPDb,
  ResOkVibeRegisterFPDb,
  isReqCallAI,
  ReqCallAI,
  EvtAttachFPDb,
  ReqFetchCloudToken,
  isReqFetchCloudToken,
  ResFetchCloudToken,
  isEvtRuntimeReady,
  EvtRuntimeReady,
} from "@vibes.diy/vibe-types";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { VibesDiyApiIface } from "@vibes.diy/api-types";
import { executeCallAI } from "./call-ai-flow.js";

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
  errorLogger: (r: string | Result<unknown> | Error) => void;
  eventListeners: {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
  };
}

interface ShareableDBInfo {
  key: string;
  data: ResOkVibeRegisterFPDb["data"];
  attachAction: "attach" | "detach" | "none";
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
  const {
    shareableDBs,
    args: { dashApi },
  } = sandbox;
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
        const rUser = await dashApi.ensureUser({});
        if (rUser.isErr()) {
          sandbox.args.errorLogger(`Failed to ensure user: ${rUser.Err().message}`);
        }
        const rCloudToken = await dashApi.ensureCloudToken({ appId: key });
        if (rCloudToken.isErr()) {
          sandbox.args.errorLogger(`Failed to ensure cloud token: ${rCloudToken.Err().message}`);
        }
        void ctx.send.send(ctx, {
          // tid: ctx.validated.tid,
          type: "vibe.evt.attach.fpdb",
          // status: "ok",
          data: v.data,
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
          fsId: ctx.validated.fsId,
          // appId: rCloudToken.Ok().appId,
          // tenant: rCloudToken.Ok().tenant,
          // ledger: rCloudToken.Ok().ledger,
        },
      } satisfies ResOkVibeRegisterFPDb;
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

function vibeFetchCloudToken(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { dashApi } = sandbox.args;
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
      dashApi.ensureCloudToken({ appId: `${data.dbName}-${data.userSlug}-${data.appSlug}` }).then((rCloudToken) => {
        if (rCloudToken.isErr()) {
          sandbox.args.errorLogger(`Failed to ensure cloud token: ${rCloudToken.Err().message}`);
          return rCloudToken;
        }
        const token = rCloudToken.Ok();
        ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibe.res.fetchCloudToken",
          data,
          token,
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
      const response = await executeCallAI(ctx.validated, vibeDiyApi);
      await ctx.send.send(ctx, response);
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
    // if (event.data?.type === "vibes-diy-srv-sandbox-event") {
    // const detail = event.data.detail;
    // window.dispatchEvent(new CustomEvent("vibes-diy-srv-sandbox-event", { detail }));
    // }
  };

  readonly removeEventListeners: typeof window.removeEventListener;
  readonly args: VibesDiySrvSandboxArgs;

  constructor(args: VibesDiySrvSandboxArgs) {
    this.args = args;
    this.evento = new Evento(new MessageEventEventoEnDecoder());
    this.evento.push(vibeRuntimeReady(this));
    this.evento.push(vibeRegisterFPDB(this));
    this.evento.push(vibeCallAI(this));
    this.evento.push(vibeFetchCloudToken(this));
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
