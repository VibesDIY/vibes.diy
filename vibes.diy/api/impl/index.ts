import {
  DashAuthType,
  MsgBase,
  MsgBaseCfg,
  ReqEnsureAppSlug,
  ReqEnsureChatContext,
  ReqAppendChatSection,
  ResEnsureAppSlug,
  ResEnsureChatContext,
  ResAppendChatSection,
  ResultVibesDiy,
  VibesDiyError,
  MsgBox,
  W3CWebSocketErrorEvent,
  W3CWebSocketMessageEvent,
  W3CWebSocketCloseEvent,
} from "@vibes.diy/api-types";
import {
  Evento,
  Future,
  JSONEnDecoderSingleton,
  KeyedResolvOnce,
  OnFunc,
  Result,
  ReturnOnFunc,
  ToDecoder,
  TriggerCtx,
  exception2Result,
  timeouted,
} from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibesDiyApiIface, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { on } from "node:cluster";

export interface VibesDiyApiParam {
  readonly apiUrl?: string;
  readonly me?: string;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg?: MsgBaseCfg;
  readonly sthis?: SuperThis;
  readonly timeoutMs?: number;
}

interface VibesDiyApiConfig {
  readonly apiUrl: string;
  readonly me: string;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg: MsgBaseCfg;
  readonly sthis: SuperThis;
  readonly timeoutMs: number;
}

interface PendingRequest<S> {
  resolve: (result: ResultVibesDiy<S>) => void;
}

interface VibeDiyApiConnection {
  readonly ws: WebSocket;
  onError: ReturnOnFunc<[W3CWebSocketErrorEvent]>;
  onMessage: ReturnOnFunc<[W3CWebSocketMessageEvent]>;
  onClose: ReturnOnFunc<[W3CWebSocketCloseEvent]>;
  send(data: ToDecoder): void;
}

const vibesDiyApiPerConnection = new KeyedResolvOnce<Result<VibeDiyApiConnection>>();
export class VibeDiyApi implements VibesDiyApiIface<{
  auth?: DashAuthType;
  type?: string;
}> {
  readonly cfg: VibesDiyApiConfig;
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>();

  constructor(cfg: VibesDiyApiParam) {
    const sthis = cfg.sthis ?? ensureSuperThis();
    this.cfg = {
      apiUrl: cfg.apiUrl ?? "wss://api.vibes.diy/v1/ws",
      me: cfg.me ?? `vibes.diy.client.${sthis.nextId().str}`,
      getToken: cfg.getToken,
      timeoutMs: cfg.timeoutMs ?? 10000,
      msg: {
        src: "vibes.diy.client",
        dst: "vibes.diy.server",
        ttl: 10,
        ...cfg.msg,
      },
      sthis,
    };
  }

  getReadyConnection(): Promise<Result<VibeDiyApiConnection>> {
    return vibesDiyApiPerConnection.get(this.cfg.apiUrl).once(async () => {
      const ws = new WebSocket(this.cfg.apiUrl);
      const waitOpen = new Future<WebSocket>();

      const onError = OnFunc<(event: W3CWebSocketErrorEvent) => void>();
      const onMessage = OnFunc<(event: W3CWebSocketMessageEvent) => void>();
      const onClose = OnFunc<(event: W3CWebSocketCloseEvent) => void>();
      const ende = JSONEnDecoderSingleton();

      ws.onopen = () => {
        waitOpen.resolve(ws);
      };
      ws.onerror = (event) => {
        onError.invoke({ type: "ErrorEvent", event: event as W3CWebSocketErrorEvent["event"] });
        waitOpen.reject(new Error(`WebSocket error: ${event}`));
      };
      ws.close = (code, reason) => {
        onClose.invoke({ type: "CloseEvent", event: { wasClean: true, code: code ?? 1000, reason: reason ?? "Closed by client" } });
        vibesDiyApiPerConnection.delete(this.cfg.apiUrl);
      };
      ws.onmessage = (event) => {
        onMessage.invoke({ type: "MessageEvent", event });
      };
      return exception2Result(() =>
        waitOpen.asPromise().then((ws) => ({
          ws,
          onError,
          onMessage,
          onClose,
          send: (data: ToDecoder) => ws.send(ende.stringify(data)),
        }))
      );
    });
  }

  async send<T extends { auth?: DashAuthType }>(
    req: T,
    msgParam: Partial<Omit<MsgBase, "tid">> & { tid: string }
  ): Promise<Result<MsgBox<T>, VibesDiyError>> {
    const rDashAuth = await (req.auth ? Promise.resolve(Result.Ok(req.auth)) : this.cfg.getToken());
    if (rDashAuth.isErr()) {
      return Result.Err<MsgBox<T>, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: rDashAuth.Err().message,
        code: "auth-error",
      });
    }
    const auth = rDashAuth.unwrap();
    const msgBox: MsgBase = {
      src: this.cfg.apiUrl,
      dst: this.cfg.me,
      ttl: 6,
      ...msgParam,
      payload: {
        ...req,
        auth,
      },
    };
    const rConn = await this.getReadyConnection();
    if (rConn.isErr()) {
      return Result.Err<MsgBox<T>, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: rConn.Err().message,
        code: "websocket-connection-error",
      });
    }
    const conn = rConn.unwrap();
    conn.send(JSON.stringify(msgBox));
    return Result.Ok(msgBox as MsgBox<T>);
  }

  async request<Q extends { auth?: DashAuthType }, S>(req: Q): Promise<ResultVibesDiy<S>> {
    // const rConn = await this.getReadyConnection();
    // if (rConn.isErr()) {
    //   return Result.Err<S, VibesDiyError>({
    //     type: "vibes.diy.error",
    //     name: "VibesDiyError",
    //     message: rConn.Err().message,
    //     code: "websocket-connection-error",
    //   });
    // }
    // const conn = rConn.unwrap();
    const tid = this.cfg.sthis.nextId(12).str;
    let unreg: (() => void) | undefined;
    const rtRes = await timeouted(
      async () => {
        const rConn = await this.getReadyConnection();
        if (rConn.isErr()) {
          return Result.Err<S, VibesDiyError>({
            type: "vibes.diy.error",
            name: "VibesDiyError",
            message: rConn.Err().message,
            code: "websocket-connection-error",
          });
        }

        const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
        const conn = rConn.unwrap();
        unreg = conn.onMessage((event) => {
          evento.trigger({
            request: event,
            send: async (_ctx: TriggerCtx<unknown, unknown, unknown>, data: unknown) => {
              const res = await this.send(data, { tid: "x" });
              return Result.Ok(res);
            },
            /// <IS, OS>(trigger: HandleTriggerCtx<INREQ, REQ, RES>, data: IS): Promise<Result<OS>>;
          });
        });

        const rReq = await this.send(req, { tid });
        if (rReq.isErr()) {
          return Result.Err<S, VibesDiyError>(rReq.Err());
        }
      },
      {
        timeout: this.cfg.timeoutMs,
      }
    );
    unreg?.();
    if (!rtRes.isSuccess()) {
      return Result.Err<S, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Request timeout after ${this.cfg.timeoutMs}ms`,
        code: "request-timeout",
      });
    }
    return rtRes.value as ResultVibesDiy<S>;

    // return new Promise<ResultVibesDiy<S>>((resolve) => {

    // const tid = this.cfg.sthis.nextId().str;
    // const msgBody: MsgBase = {
    //   ...this.cfg.msg,
    //   tid,
    //   payload: {
    //     ...req,
    //     auth,
    //   },
    // };

    // try {
    //   const conn = this.connection.value();
    //   await conn.ready;

    //   return new Promise<ResultVibesDiy<S>>((resolve) => {
    //     this.pendingRequests.set(tid, {
    //       resolve: resolve as (result: ResultVibesDiy<unknown>) => void,
    //     });

    //     conn.ws.send(JSON.stringify(msgBody));
    //   });
    // } catch (err) {
    //   return Result.Err<S, VibesDiyError>({
    //     type: "vibes.diy.error",
    //     name: "VibesDiyError",
    //     message: `WebSocket error: ${err instanceof Error ? err.message : String(err)}`,
    //     code: "websocket-error",
    //   });
    // }
  }

  async ensureAppSlug(
    req: Omit<ReqEnsureAppSlug, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResEnsureAppSlug, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-ensure-app-slug" });
  }

  async ensureChatContext(
    req: Omit<ReqEnsureChatContext, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResEnsureChatContext, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-ensure-chat-context" });
  }

  async appendChatSection(
    req: Omit<ReqAppendChatSection, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResAppendChatSection, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-append-chat-section" });
  }
}
