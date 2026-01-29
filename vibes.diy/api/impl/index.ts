import {
  DashAuthType,
  MsgBase,
  MsgBaseCfg,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ResultVibesDiy,
  VibesDiyError,
  MsgBox,
  W3CWebSocketEvent,
  msgBase,
  resError,
  ResOpenChat,
  ReqPromptChatSection,
  ResError,
  ReqOpenChat,
  w3cMessageEventBox,
  SectionEvent,
  sectionEvent,
  ResPromptChatSection,
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
  OnFunc,
} from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibesDiyApiIface, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";
import { type } from "arktype";
import { LLMRequest } from "@vibes.diy/call-ai-v2";

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

type OnResponseTypes = ResError | SectionEvent;

// type LLMPrompt = Omit<LLMRequest, "model" | "stream"> & { model?: string; };

interface LLMChat {
  readonly tid: string;
  readonly chatId: string;
  prompt(req: LLMRequest): Promise<Result<ResPromptChatSection, VibesDiyError>>;
  onResponse(fn: (msg: OnResponseTypes) => void): void;
  onError(fn: (err: VibesDiyError) => void): void;
}

interface OptionalAuth {
  readonly auth?: DashAuthType;
}
type Req<T> = Omit<T, "type" | "auth"> & OptionalAuth;
type ReqType<T> = Omit<T, "auth"> & OptionalAuth;
type WithAuth<T> = Omit<T, "auth"> & { readonly auth: DashAuthType };

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
  ): Promise<Result<MsgBox<WithAuth<T>>, VibesDiyError>> {
    const rDashAuth = await (req.auth ? Promise.resolve(Result.Ok(req.auth)) : this.cfg.getToken());
    if (rDashAuth.isErr()) {
      return Result.Err<MsgBox<WithAuth<T>>, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Auth Error: ${rDashAuth.Err().message}`,
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
    return Result.Ok(msgBox as MsgBox<WithAuth<T>>);
  }

  async request<Q extends OptionalAuth, S>(req: Q, msgParam?: { tid: string }): Promise<ResultVibesDiy<S>> {
    const tid = msgParam?.tid ?? this.cfg.sthis.nextId(12).str;
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
        const waitForResponse = new Future<Result<S, VibesDiyError>>();
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
    return rtRes.value; // as ResultVibesDiy<S>;
  }

  async ensureAppSlug(req: Req<ReqEnsureAppSlug>): Promise<Result<ResEnsureAppSlug, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-ensure-app-slug" });
  }

  async openChat(req: Req<ReqOpenChat>): Promise<Result<LLMChat>> {
    return LLMChatImpl.open({ ...req, type: "vibes.diy.req-open-chat" }, this);
  }
}

class LLMChatImpl implements LLMChat {
  readonly api: VibeDiyApi;
  readonly tid: string;
  readonly res: ResOpenChat;
  readonly sectionEvents: SectionEvent[];
  // promptId?: string
  onResponse = OnFunc<(msg: OnResponseTypes) => void>();
  onError = OnFunc<(err: VibesDiyError) => void>();

  get chatId(): string {
    return this.res.chatId;
  }

  static async open(open: ReqType<ReqOpenChat>, api: VibeDiyApi): Promise<Result<LLMChat>> {
    const conn = await api.getReadyConnection();
    const tid = api.cfg.sthis.nextId(12).str;

    const sectionEvents: SectionEvent[] = [];

    const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
    evento.push({
      hash: "wait-open-chat-" + tid,
      validate: async (trigger: ValidateTriggerCtx<W3CWebSocketEvent, MsgBase, ResOpenChat>) => {
        const msg = msgBase(trigger.enRequest);
        if (msg instanceof type.errors) {
          return Result.Ok(Option.None());
        }
        // console.log("LLMChat validate received message for chatId:", msg, tid);
        if (msg.tid === tid) {
          // console.log("Valid event matched for chatId:", req.chatId);
          return Result.Ok(Option.Some(msg));
        }
        return Result.Ok(Option.None());
      },
      handle: async (trigger: HandleTriggerCtx<W3CWebSocketEvent, MsgBase, ResOpenChat>) => {
        // console.log("Handling incoming event for chatId:", req.chatId, trigger);
        const isError = resError(trigger.validated.payload);
        if (!(isError instanceof type.errors)) {
          // console.log("Response message is an error for chatId:", req.chatId, isError);
          llmChat.onError.invoke(isError as VibesDiyError);
        } else {
          const se = sectionEvent(trigger.validated.payload);
          if (!(se instanceof type.errors)) {
            sectionEvents.push(se);
            llmChat.onResponse.invoke(se);
          }
        }
        return Result.Ok(EventoResult.Continue);
      },
    });
    const unreg = conn.onMessage((event) => {
      // const msg = w3cMessageEventBox(event);
      // if (!(msg instanceof type.errors)) {
      //   // console.log("LLMChat received message event:", new TextDecoder().decode(msg.event.data as Uint8Array));
      // }
      evento
        .trigger({
          request: event,
          send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
            const res = await api.send(data as Parameters<typeof api.send>[0], { tid });
            return res;
          }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
        })
        .catch((err) => {
          llmChat.onError.invoke({
            type: "vibes.diy.error",
            name: "VibesDiyError",
            message: `LLMChat evento trigger error: ${err.message}`,
            code: "llmchat-evento-error",
          });
        });
    });
    conn.onError(unreg);
    conn.onClose(unreg);

    const res = await api.request<Req<ReqOpenChat>, ResOpenChat>(open, { tid });
    if (res.isErr()) {
      return Result.Err<LLMChat>(res.Err());
    }
    const llmChat = new LLMChatImpl(api, tid, res.Ok(), sectionEvents);
    return Result.Ok(llmChat);
  }

  private constructor(api: VibeDiyApi, tid: string, res: ResOpenChat, sectionEvents: SectionEvent[]) {
    this.api = api;
    this.tid = tid;
    this.res = res;
    this.sectionEvents = sectionEvents;
    this.onResponse.onRegister((fn) => {
      for (const se of this.sectionEvents) {
        fn(se);
      }
    });
  }
  prompt(msg: LLMRequest) {
    return this.api.request<ReqType<ReqPromptChatSection>, MsgBox<ResPromptChatSection>>({
      type: "vibes.diy.req-prompt-chat-section",
      chatId: this.res.chatId,
      outerTid: this.tid,
      prompt: {
        type: "prompt.txt",
        request: msg,
        timestamp: new Date(),
      },
    });
  }
}

export * from "./api-connection.js";
