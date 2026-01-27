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
  W3CWebSocketEvent,
  msgBase,
  resEnsureAppSlug,
  resError,
} from "@vibes.diy/api-types";
import {
  Evento,
  EventoSendProvider,
  Future,
  JSONEnDecoderSingleton,
  Result,
  Option,
  TriggerCtx,
  timeouted,
  HandleTriggerCtx,
  EventoResult,
  ValidateTriggerCtx,
} from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibesDiyApiIface, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";
import { type } from "arktype";

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
    // console.log("Prepared message box:", msgBox);
    const conn = await this.getReadyConnection();
    // console.log("Got ready connection, sending message with tid:", msgParam.tid);
    const ende = JSONEnDecoderSingleton();
    const uint8ify = ende.uint8ify(msgBox);
    // console.log("Encoded message to Uint8Array:", msgParam.tid, uint8ify.length, conn.send.toString());
    conn.send(uint8ify);
    return Result.Ok(msgBox as MsgBox<T>);
  }

  async request<Q extends { auth?: DashAuthType }, S>(req: Q): Promise<ResultVibesDiy<S>> {
    const tid = this.cfg.sthis.nextId(12).str;
    let unreg: (() => void) | undefined;
    const rtRes = await timeouted(
      async () => {
        const conn = await this.getReadyConnection();
        const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
        evento.push({
          hash: tid,
          validate: async (trigger: ValidateTriggerCtx<W3CWebSocketEvent, MsgBase, ResEnsureAppSlug>) => {
            const msg = msgBase(trigger.enRequest);
            if (msg instanceof type.errors) {
              // console.log("Invalid message received, ignoring:", msg, trigger.enRequest);
              return Result.Ok(Option.None());
            }
            if (msg.tid === tid) {
              // console.log("Valid event matched for tid:", tid);
              return Result.Ok(Option.Some(trigger.enRequest));
            }
            return Result.Ok(Option.None());
          },
          handle: async (trigger: HandleTriggerCtx<W3CWebSocketEvent, MsgBase, ResEnsureAppSlug>) => {
            // console.log("Handling incoming event for tid:", tid, trigger);
            const isError = resError(trigger.validated.payload);
            if (!(isError instanceof type.errors)) {
              // console.log("Response message is an error for tid:", tid, isError);
              waitForResponse.resolve(Result.Err<S, VibesDiyError>(isError as VibesDiyError));
            } else {
              waitForResponse.resolve(Result.Ok<S, VibesDiyError>(trigger.validated.payload as S));
            }
            return Result.Ok(EventoResult.Stop);
          },
        });
        // console.log("Setting up onMessage handler for tid:", tid);
        const waitForResponse = new Future();
        unreg = conn.onMessage((event) => {
          evento.trigger({
            request: event,
            send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
              const res = await this.send(data as Parameters<this["send"]>[0], { tid: "x" });
              return res;
            }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
          });
        });
        // console.log("Sending request with tid:", tid);
        const rReq = await this.send(req, { tid });
        // console.log("Sended request with tid:", tid, rReq);
        if (rReq.isErr()) {
          return Result.Err<S, VibesDiyError>(rReq.Err());
        }
        return waitForResponse.asPromise();
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
}

export * from "./api-connection.js";
