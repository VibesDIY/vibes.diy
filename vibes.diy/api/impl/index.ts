import {
  DashAuthType,
  MsgBase,
  MsgBaseCfg,
  ReqEnsureAppSlug,
  ReqEnsureChatContext,
  ReqAppendChatSection,
  ReqClaimUserSlug,
  ReqListUserSlugs,
  ResEnsureAppSlug,
  ResEnsureChatContext,
  ResAppendChatSection,
  ResClaimUserSlug,
  ResListUserSlugs,
  ResultVibesDiy,
  VibesDiyError,
  MsgBox,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { Evento, EventoSendProvider, Result, TriggerCtx, timeouted } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibesDiyApiIface, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";

export interface VibesDiyApiParam {
  readonly apiUrl?: string;
  readonly me?: string;
  fetch?(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readonly ws?: WebSocket;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg?: MsgBaseCfg;
  readonly sthis?: SuperThis;
  readonly timeoutMs?: number;
}

interface VibesDiyApiConfig {
  readonly apiUrl: string;
  readonly me: string;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readonly ws?: WebSocket;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg: MsgBaseCfg;
  readonly sthis: SuperThis;
  readonly timeoutMs: number;
}

interface PendingRequest<S> {
  resolve: (result: ResultVibesDiy<S>) => void;
}

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
      fetch: cfg.fetch ?? fetch.bind(globalThis),
      ws: cfg.ws ?? new WebSocket("wss://api.vibes.diy/v1/ws"),
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

  getReadyConnection(): Promise<VibeDiyApiConnection> {
    return getVibesDiyWebSocketConnection(this.cfg.apiUrl, this.cfg.ws);
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
    const conn = await this.getReadyConnection();
    conn.send(JSON.stringify(msgBox));
    return Result.Ok(msgBox as MsgBox<T>);
  }

  async request<Q extends { auth?: DashAuthType }, S>(req: Q): Promise<ResultVibesDiy<S>> {
    const tid = this.cfg.sthis.nextId(12).str;
    let unreg: (() => void) | undefined;
    const rtRes = await timeouted(
      async () => {
        const conn = await this.getReadyConnection();
        const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
        unreg = conn.onMessage((event) => {
          evento.trigger({
            request: event,
            send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
              const res = await this.send(data as Parameters<this["send"]>[0], { tid: "x" });
              return res;
            }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
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

  async claimUserSlug(
    req: Omit<ReqClaimUserSlug, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResClaimUserSlug, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-claim-user-slug" });
  }

  async listUserSlugs(
    req: Omit<ReqListUserSlugs, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResListUserSlugs, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-user-slugs" });
  }
}

export * from "./api-connection.js";
