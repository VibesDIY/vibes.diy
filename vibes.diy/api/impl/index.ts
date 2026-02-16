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
  SectionEvent,
  sectionEvent,
  ResPromptChatSection,
  isResEnsureAppSlug,
  isResOpenChat,
  isResPromptChatSection,
  ReqGetByUserSlugAppSlug,
  ResGetByUserSlugAppSlug,
  isResGetByUserSlugAppSlug,
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
  BuildURI,
  URI,
} from "@adviser/cement";
import { ClerkClaim, SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibesDiyApiIface, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";
import { type } from "arktype";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { ClerkApiToken } from "@fireproof/core-protocols-dashboard";
import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";

// interface PkgRepos {
//   readonly private: string;
//   readonly public: string;
// }

export interface VibesDiyApiParam {
  readonly apiUrl: string;
  // readonly pkgRepos?: Partial<PkgRepos>;
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
  // readonly pkgRepos: PkgRepos;
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

export const LLMChatEntry = type({
  tid: "string",
  chatId: "string",
  userSlug: "string",
  appSlug: "string",
});
export type LLMChatEntry = typeof LLMChatEntry.infer;

export interface LLMChat extends LLMChatEntry {
  prompt(req: LLMRequest): Promise<Result<ResPromptChatSection, VibesDiyError>>;

  readonly sectionStream: ReadableStream<OnResponseTypes>;
  // onResponse(fn: (msg: OnResponseTypes) => void): void;
  // onError(fn: (err: VibesDiyError) => void): void;
  close(force?: boolean): Promise<void>;
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
    const apiUrl = cfg.apiUrl; // ?? "wss://api.vibes.diy/v1/ws";
    // const pkgRepos: PkgRepos = {
    //   private: cfg.pkgRepos?.private ?? "https://esm.sh/",
    //   public: cfg.pkgRepos?.public ?? BuildURI.from(window.location.origin).appendRelative("/dev-npm").toString(),
    // };
    this.cfg = {
      apiUrl,
      // pkgRepos,
      me: cfg.me ?? `vibes.diy.client.${sthis.nextId().str}`,
      getToken: cfg.getToken,
      fetch: cfg.fetch ?? fetch.bind(globalThis),
      ws:
        cfg.ws ??
        new WebSocket(
          BuildURI.from(apiUrl)
            .protocol(["https", "wss"].find((i) => URI.from(apiUrl).protocol.startsWith(i)) ? "wss:" : "ws:")
            .toString()
        ),
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

  async getTokenClaims(): Promise<Result<VerifiedClaimsResult & { claims: ClerkClaim }>> {
    const rToken = await this.cfg.getToken();
    if (rToken.isErr()) {
      return Result.Err(rToken);
    }
    console.log("VibeDiyApi getTokenClaims token", rToken.Ok().token);
    const sthis = ensureSuperThis();
    const tokenapi = new ClerkApiToken(sthis);
    const rClaims = await tokenapi.decode(rToken.Ok().token);
    if (rClaims.isErr()) {
      console.error("getTokenClaims verify failed:", rClaims.Err());
      return Result.Err(rClaims);
    }
    return Result.Ok(rClaims.Ok() as VerifiedClaimsResult & { claims: ClerkClaim });
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

  async request<Q extends OptionalAuth, S>(
    req: Q,
    msgParam: {
      tid?: string;
      resMatch: (res: unknown) => boolean;
    }
  ): Promise<ResultVibesDiy<S>> {
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
            if (msg.tid === tid && msgParam.resMatch(msg.payload as S)) {
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
          // console.log("VibeDiyApi request onMessage received", tid);
          evento.trigger({
            request: event,
            send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
              console.log("VibeDiyApi request sending from evento", data);
              const res = await this.send(data as Parameters<this["send"]>[0], { tid });
              return res;
            }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
          });
        });
        // console.log("Sending request with tid:", tid);
        // console.log("VibeDiyApi request sending", req, tid);
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
    return this.request(
      { ...req, type: "vibes.diy.req-ensure-app-slug" },
      {
        resMatch: isResEnsureAppSlug,
      }
    );
  }

  async getByUserSlugAppSlug(req: Req<ReqGetByUserSlugAppSlug>): Promise<Result<ResGetByUserSlugAppSlug, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-get-by-user-slug-app-slug" },
      {
        resMatch: isResGetByUserSlugAppSlug,
      }
    );
  }

  async openChat(req: Req<ReqOpenChat>): Promise<Result<LLMChat>> {
    return LLMChatImpl.open({ ...req, type: "vibes.diy.req-open-chat" }, this);
  }
}

class LLMChatImpl implements LLMChat {
  readonly api: VibeDiyApi;
  readonly tid: string;
  readonly res: ResOpenChat;

  readonly sectionStream: ReadableStream<OnResponseTypes>;

  readonly #writer: WritableStreamDefaultWriter<OnResponseTypes>;
  // promptId?: string
  // onResponse = OnFunc<(msg: OnResponseTypes) => void>();
  // onError = OnFunc<(err: VibesDiyError) => void>();

  get chatId(): string {
    return this.res.chatId;
  }
  get userSlug(): string {
    return this.res.userSlug;
  }
  get appSlug(): string {
    return this.res.appSlug;
  }

  static async open(open: ReqType<ReqOpenChat>, api: VibeDiyApi): Promise<Result<LLMChat>> {
    const conn = await api.getReadyConnection();
    const tid = api.cfg.sthis.nextId(12).str;

    const sectionEvents = new TransformStream<OnResponseTypes, OnResponseTypes>();

    const sectionEventsWriter = sectionEvents.writable.getWriter();
    // const activePromptIds = new LRUMap<string, void>();
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
        const isError = resError(trigger.validated.payload);
        if (!(isError instanceof type.errors)) {
          // console.log("Response message is an error for chatId:", req.chatId, isError);
          return Result.Err(isError as VibesDiyError);
        } else {
          const se = sectionEvent(trigger.validated.payload);
          if (!(se instanceof type.errors)) {
            // console.log("send to Stream:", tid, trigger.validated.tid, se.type)
            await sectionEventsWriter.write(se);
            // const beginPrompt = se.blocks.find((b) => isPromptBlockBegin(b))
            // if (beginPrompt) {
            //   activePromptIds.set(se.promptId, undefined);
            // }
            // const closePrompt = se.blocks.find((b) => isPromptBlockEnd(b))
            // if (closePrompt) {
            //   activePromptIds.delete(se.promptId);
            // }
          }
          // else {
          //   console.log("LLMChat open succeeded for chatId:", se.summary, trigger.validated.payload);
          // }
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
          sectionEventsWriter.write({
            type: "vibes.diy.error",
            message: `LLMChat evento trigger error: ${err.message}`,
            code: "llmchat-evento-error",
          });
          sectionEventsWriter.abort();
        });
    });
    conn.onError(unreg);
    conn.onClose(unreg);

    const res = await api.request<Req<ReqOpenChat>, ResOpenChat>(open, { tid, resMatch: isResOpenChat });
    if (res.isErr()) {
      return Result.Err<LLMChat>(res.Err());
    }
    // console.log("LLMChat open succeeded for chatId:", res.Ok());
    const llmChat = new LLMChatImpl(api, tid, res.Ok(), sectionEvents.readable, sectionEventsWriter);
    return Result.Ok(llmChat);
  }

  // readonly #activePromptIds: LRUMap<string, void>;
  private constructor(
    api: VibeDiyApi,
    tid: string,
    res: ResOpenChat,
    sectionEvents: ReadableStream<OnResponseTypes>,
    writer: WritableStreamDefaultWriter<OnResponseTypes>
  ) {
    this.api = api;
    this.tid = tid;
    this.res = res;
    this.sectionStream = sectionEvents;
    this.#writer = writer;
    // this.#activePromptIds = activePromptIds;
  }

  async prompt(msg: LLMRequest) {
    const res = await this.api.request<ReqType<ReqPromptChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        chatId: this.res.chatId,
        outerTid: this.tid, //leaking but necessary streaming
        prompt: msg,
      },
      {
        resMatch: isResPromptChatSection,
      }
    );
    // if (res.isOk()) {
    // this.#activePromptIds.set(res.Ok().promptId, undefined);
    // }
    return res;
  }
  async close(_force = false) {
    this.#writer.close();
    console.log("LLMChat close called for chatId:", this.chatId, this.tid); 
    // if (this.#activePromptIds.size === 0 || force) {
    //   console.log("LLMChat close called, active prompts:", this.chatId, this.#activePromptIds.size, "force:", force);
    //   this.#writer.close().catch((err) => {
    //     console.error("Error closing LLMChat section stream writer:", err);
    //   });
    //   return;
    // }
    // return new Promise<void>((resolve) => {
    //   this.#activePromptIds.onDelete(() => {
    //     if (this.#activePromptIds.size <= 1) {
    //       console.log("LLMChat prompt closed, remaining active prompts:", this.chatId, this.#activePromptIds.size, this.#writer);
    //       this.#writer.close().catch((err) => {
    //           console.error("Error Active closing LLMChat section stream writer:", err);
    //         })
    //       .finally(resolve)
    //     }
    //   })
    // })
  }
}

export * from "./api-connection.js";
