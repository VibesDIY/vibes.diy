import {
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
  isResError,
  ResOpenChat,
  ReqOpenChat,
  sectionEvent,
  ResPromptChatSection,
  isResEnsureAppSlug,
  isResOpenChat,
  isResPromptChatSection,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  isResListUserSlugAppSlug,
  ReqGetChatDetails,
  ResGetChatDetails,
  isResGetChatDetails,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  isResGetAppByFsId,
  VibesDiyApiIface,
  OptionalAuth,
  Req,
  LLMChat,
  OnResponseTypes,
  ReqEnsureUserSettings,
  ResEnsureUserSettings,
  isResEnsureUserSettings,
  ReqListApplicationChats,
  ResListApplicationChats,
  isResListApplicationChats,
  ReqEnsureAppSettings,
  ResEnsureAppSettings,
  isResEnsureAppSettings,
  ReqSetModeFs,
  ResSetModeFs,
  isResSetModeFs,
  ReqForkApp,
  ResForkApp,
  isResForkApp,
  ReqFPCloudToken,
  ResFPCloudToken,
  isResFPCloudToken,
  VibeFile,
  ReqCreateInvite,
  ResCreateInvite,
  isResCreateInvite,
  ReqRevokeInvite,
  ResRevokeInvite,
  isResRevokeInvite,
  ReqRedeemInvite,
  ResRedeemInviteOK,
  isResRedeemInvite,
  ReqHasAccessInvite,
  ResHasAccessInvite,
  isResHasAccessInvite,
  ReqInviteSetRole,
  ResInviteSetRole,
  isResInviteSetRole,
  ReqListInviteGrants,
  ResListInviteGrants,
  isResListInviteGrants,
  ReqListRequestGrants,
  ResListRequestGrants,
  isResListRequestGrants,
  ReqRequestAccess,
  // ResRequestAccess,
  ReqApproveRequest,
  ResApproveRequest,
  isResApproveRequest,
  ReqRequestSetRole,
  ResRequestSetRole,
  isResRequestSetRole,
  ReqRevokeRequest,
  ResRevokeRequest,
  isResRevokeRequest,
  ReqHasAccessRequest,
  ResHasAccessRequest,
  isResRequestAccessFlow,
  isResHasAccessRequestFlow,
  ResRequestAccess,
  ReqListUserSlugBindings,
  ResListUserSlugBindings,
  isResListUserSlugBindings,
  ReqCreateUserSlugBinding,
  ResCreateUserSlugBinding,
  isResCreateUserSlugBinding,
  ReqDeleteUserSlugBinding,
  ResDeleteUserSlugBinding,
  isResDeleteUserSlugBinding,
  ReqListModels,
  ResListModels,
  isResListModels,
  isPromptLLMStyle,
  ReqPutDoc,
  ResPutDoc,
  isResPutDoc,
  ReqGetDoc,
  ResGetDoc,
  ResGetDocNotFound,
  isResGetDoc,
  isResGetDocNotFound,
  ReqQueryDocs,
  ResQueryDocs,
  isResQueryDocs,
  ReqDeleteDoc,
  ResDeleteDoc,
  isResDeleteDoc,
  ReqSubscribeDocs,
  ResSubscribeDocs,
  isResSubscribeDocs,
  ReqListDbNames,
  ResListDbNames,
  isResListDbNames,
  isEvtDocChanged,
  ReqPromptLLMChatSection,
  FSUpdate,
  isFSUpdate,
  vibeFile,
  ReqPromptFSSetChatSection,
  ReqPromptFSUpdateChatSection,
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
  Lazy,
  BuildURI,
} from "@adviser/cement";
import { ClerkClaim, SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";
import { type } from "arktype";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { ClerkApiToken } from "@fireproof/core-protocols-dashboard";
import { DashAuthType, ReqCertFromCsr, ResCertFromCsr, VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";

export interface VibesDiyApiParam {
  readonly apiUrl: string;
  // readonly pkgRepos?: Partial<PkgRepos>;
  readonly ca?: string[];
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
  readonly ca?: string[];
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

// type LLMPrompt = Omit<LLMRequest, "model" | "stream"> & { model?: string; };

type ReqType<T> = Omit<T, "auth"> & OptionalAuth;
type WithAuth<T> = Omit<T, "auth"> & { readonly auth: DashAuthType };

export class VibesDiyApi implements VibesDiyApiIface<{
  auth?: DashAuthType;
  type?: string;
}> {
  readonly cfg: VibesDiyApiConfig;
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly docChangedListeners: ((userSlug: string, appSlug: string, docId: string) => void)[] = [];
  private readonly docSubscriptions: { userSlug: string; appSlug: string; dbName: string }[] = [];
  private currentConnection: VibeDiyApiConnection | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(cfg: VibesDiyApiParam) {
    const sthis = cfg.sthis ?? ensureSuperThis();
    // Each API instance gets its own DO shard to avoid CPU limits under concurrent load.
    // When a preset WebSocket is provided (tests), skip sharding — tests bypass worker routing.
    const apiUrl = cfg.ws ? cfg.apiUrl : BuildURI.from(cfg.apiUrl).setParam("shard", crypto.randomUUID()).toString();
    // const pkgRepos: PkgRepos = {
    //   private: cfg.pkgRepos?.private ?? "https://esm.sh/",
    //   public: cfg.pkgRepos?.public ?? BuildURI.from(window.location.origin).appendRelative("/dev-npm").toString(),
    // };
    this.cfg = {
      apiUrl,
      ca: cfg.ca,
      // pkgRepos,
      me: cfg.me ?? `vibes.diy.client.${sthis.nextId().str}`,
      getToken: cfg.getToken,
      fetch: cfg.fetch ?? fetch.bind(globalThis),
      ws: cfg.ws,
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
    // console.log("VibeDiyApi getTokenClaims token", rToken.Ok().token);
    const sthis = ensureSuperThis();
    const tokenapi = new ClerkApiToken(sthis);
    const rClaims = await tokenapi.decode(rToken.Ok().token);
    if (rClaims.isErr()) {
      console.error("getTokenClaims verify failed:", rClaims.Err());
      return Result.Err(rClaims);
    }
    return Result.Ok(rClaims.Ok() as VerifiedClaimsResult & { claims: ClerkClaim });
  }

  close(): Promise<void> {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    return this.getReadyConnection().then((conn) => conn.close());
  }

  async getReadyConnection(): Promise<VibeDiyApiConnection> {
    const conn = await getVibesDiyWebSocketConnection(this.cfg.apiUrl, this.cfg.ws, this.cfg.ca);
    if (conn !== this.currentConnection) {
      this.currentConnection = conn;
      // Re-attach all onDocChanged listeners to the new connection
      for (const fn of this.docChangedListeners) {
        this.attachDocChangedToConnection(conn, fn);
      }
      // Re-subscribe to all doc subscriptions (server needs to know again)
      for (const sub of this.docSubscriptions) {
        this.subscribeDocs(sub).catch((_e: unknown) => {
          /* re-subscribe best-effort; next reconnect will retry */
        });
      }
      // When this connection dies, schedule proactive reconnect (unless explicitly closed)
      conn.onClose(() => {
        if (this.currentConnection === conn) {
          this.currentConnection = undefined;
          if (!this.closed) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = undefined;
              this.getReadyConnection().catch((_e: unknown) => {
                /* reconnect best-effort; next activity will retry */
              });
            }, 1000);
          }
        }
      });
    }
    return conn;
  }

  async send<T extends { auth?: DashAuthType }>(
    req: T,
    msgParam: Partial<Omit<MsgBase, "tid">> & { tid: string }
  ): Promise<Result<MsgBox<WithAuth<T>>, VibesDiyError>> {
    let auth = req.auth;
    if (!req.auth) {
      const rDashAuth = await this.cfg.getToken();
      if (rDashAuth.isOk()) {
        auth = rDashAuth.Ok();
      }
      // if getToken fails, proceed unauthenticated
    }
    const msgBox: MsgBase = {
      src: this.cfg.apiUrl,
      dst: this.cfg.me,
      ttl: 6,
      ...msgParam,
      payload: {
        ...req,
        ...(auth ? { auth } : {}),
      },
    };
    // console.log("Prepared message box:", msgBox);
    const conn = await this.getReadyConnection();
    // console.log("Got ready connection, sending message with tid:", msgParam.tid);
    const ende = JSONEnDecoderSingleton();
    const uint8ify = ende.uint8ify(msgBox);
    // console.log("Encoded message to Uint8Array:", msgParam.tid, uint8ify.length, conn.send.toString());
    const rSend = conn.send(uint8ify);
    if (rSend.isErr()) {
      return Result.Err<MsgBox<WithAuth<T>>, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Reconnecting, please retry (${String(rSend.Err())})`,
        code: "websocket-send-failed",
      });
    }
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
            if (msg.tid === tid && (msgParam.resMatch(msg.payload) || isResError(msg.payload))) {
              return Result.Ok(Option.Some(trigger.enRequest));
            }
            return Result.Ok(Option.None());
          },
          handle: async (trigger: HandleTriggerCtx<W3CWebSocketEvent, MsgBase, ResEnsureAppSlug>) => {
            if (isResError(trigger.validated.payload)) {
              waitForResponse.resolve(Result.Err<S, VibesDiyError>(trigger.validated.payload as VibesDiyError));
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
              // console.log("VibeDiyApi request sending from evento", data);
              const res = await this.send(data as Parameters<this["send"]>[0], { tid });
              return res;
            }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
          });
        });
        const rReq = await this.send(req, { tid });
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

  ensureAppSlug(req: Req<ReqEnsureAppSlug>): Promise<Result<ResEnsureAppSlug, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-ensure-app-slug" },
      {
        resMatch: isResEnsureAppSlug,
      }
    );
  }

  // getByUserSlugAppSlug(req: Req<ReqGetByUserSlugAppSlug>): Promise<Result<ResGetByUserSlugAppSlug, VibesDiyError>> {
  //   return this.request(
  //     { ...req, type: "vibes.diy.req-get-by-user-slug-app-slug" },
  //     {
  //       resMatch: isResGetByUserSlugAppSlug,
  //     }
  //   );
  // }

  listUserSlugAppSlug(req: Req<ReqListUserSlugAppSlug>): Promise<Result<ResListUserSlugAppSlug, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-list-user-slug-app-slug" },
      {
        resMatch: isResListUserSlugAppSlug,
      }
    );
  }

  getChatDetails(req: Req<ReqGetChatDetails>): Promise<Result<ResGetChatDetails, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-get-chat-details" },
      {
        resMatch: isResGetChatDetails,
      }
    );
  }

  getAppByFsId(req: Req<ReqGetAppByFsId>): Promise<Result<ResGetAppByFsId, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-get-app-by-fsid" },
      {
        resMatch: isResGetAppByFsId,
      }
    );
  }

  ensureUserSettings(req: Req<ReqEnsureUserSettings>): Promise<Result<ResEnsureUserSettings, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-ensure-user-settings" },
      {
        resMatch: isResEnsureUserSettings,
      }
    );
  }

  ensureAppSettings(req: Req<ReqEnsureAppSettings>): Promise<Result<ResEnsureAppSettings, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-ensure-app-settings" },
      {
        resMatch: isResEnsureAppSettings,
      }
    );
  }

  listApplicationChats(req: Req<ReqListApplicationChats>): Promise<Result<ResListApplicationChats, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-list-application-chats" },
      {
        resMatch: isResListApplicationChats,
      }
    );
  }

  setSetModeFs(req: Req<ReqSetModeFs>): Promise<Result<ResSetModeFs>> {
    return this.request(
      { ...req, type: "vibes.diy.req-set-mode-fs" },
      {
        resMatch: isResSetModeFs,
      }
    );
  }

  forkApp(req: Req<ReqForkApp>): Promise<Result<ResForkApp, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-fork-app" },
      {
        resMatch: isResForkApp,
      }
    );
  }

  getFPCloudToken(req: Req<ReqFPCloudToken>): Promise<Result<ResFPCloudToken>> {
    return this.request(
      { ...req, type: "vibes.diy.req-fpcloud-token" },
      {
        resMatch: isResFPCloudToken,
      }
    );
  }

  getCertFromCsr(req: Req<ReqCertFromCsr>): Promise<Result<ResCertFromCsr>> {
    return this.request(
      { ...req, type: "reqCertFromCsr" },
      {
        resMatch: (res): res is ResCertFromCsr => {
          const r = (res as ResCertFromCsr).type === "resCertFromCsr";
          return r;
        },
      }
    );
  }

  openChat(req: Req<ReqOpenChat>): Promise<Result<LLMChat>> {
    return LLMChatImpl.open({ ...req, type: "vibes.diy.req-open-chat" }, this);
  }

  createInvite(req: Req<ReqCreateInvite>): Promise<Result<ResCreateInvite, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-create-invite" }, { resMatch: isResCreateInvite });
  }

  revokeInvite(req: Req<ReqRevokeInvite>): Promise<Result<ResRevokeInvite, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-revoke-invite" }, { resMatch: isResRevokeInvite });
  }

  redeemInvite(req: Req<ReqRedeemInvite>): Promise<Result<ResRedeemInviteOK, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-redeem-invite" }, { resMatch: isResRedeemInvite });
  }

  hasAccessInvite(req: Req<ReqHasAccessInvite>): Promise<Result<ResHasAccessInvite, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-has-access-invite" }, { resMatch: isResHasAccessInvite });
  }

  inviteSetRole(req: Req<ReqInviteSetRole>): Promise<Result<ResInviteSetRole, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-invite-set-role" }, { resMatch: isResInviteSetRole });
  }

  listInviteGrants(req: Req<ReqListInviteGrants>): Promise<Result<ResListInviteGrants, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-invite-grants" }, { resMatch: isResListInviteGrants });
  }

  requestAccess(req: Req<ReqRequestAccess>): Promise<Result<ResRequestAccess, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-request-access" }, { resMatch: isResRequestAccessFlow });
  }

  approveRequest(req: Req<ReqApproveRequest>): Promise<Result<ResApproveRequest, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-approve-request" }, { resMatch: isResApproveRequest });
  }

  requestSetRole(req: Req<ReqRequestSetRole>): Promise<Result<ResRequestSetRole, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-request-set-role" }, { resMatch: isResRequestSetRole });
  }

  revokeRequest(req: Req<ReqRevokeRequest>): Promise<Result<ResRevokeRequest, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-revoke-request" }, { resMatch: isResRevokeRequest });
  }

  listRequestGrants(req: Req<ReqListRequestGrants>): Promise<Result<ResListRequestGrants, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-request-grants" }, { resMatch: isResListRequestGrants });
  }

  hasAccessRequest(req: Req<ReqHasAccessRequest>): Promise<Result<ResHasAccessRequest, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-has-access-request" }, { resMatch: isResHasAccessRequestFlow });
  }

  listUserSlugBindings(req: Req<ReqListUserSlugBindings>): Promise<Result<ResListUserSlugBindings, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-user-slug-bindings" }, { resMatch: isResListUserSlugBindings });
  }

  createUserSlugBinding(req: Req<ReqCreateUserSlugBinding>): Promise<Result<ResCreateUserSlugBinding, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-create-user-slug-binding" }, { resMatch: isResCreateUserSlugBinding });
  }

  deleteUserSlugBinding(req: Req<ReqDeleteUserSlugBinding>): Promise<Result<ResDeleteUserSlugBinding, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-delete-user-slug-binding" }, { resMatch: isResDeleteUserSlugBinding });
  }

  listModels = Lazy(
    (req: Req<ReqListModels>): Promise<Result<ResListModels, VibesDiyError>> => {
      return this.request({ ...req, type: "vibes.diy.req-list-models" }, { resMatch: isResListModels });
    },
    { resetAfter: 10 * 60 * 1000 /* 10 minutes */ }
  );

  // Firefly document operations
  putDoc(req: Req<ReqPutDoc>): Promise<Result<ResPutDoc, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-put-doc" }, { resMatch: isResPutDoc });
  }

  getDoc(req: Req<ReqGetDoc>): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-get-doc" },
      { resMatch: (obj: unknown) => isResGetDoc(obj) || isResGetDocNotFound(obj) }
    );
  }

  queryDocs(req: Req<ReqQueryDocs>): Promise<Result<ResQueryDocs, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-query-docs" }, { resMatch: isResQueryDocs });
  }

  deleteDoc(req: Req<ReqDeleteDoc>): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-delete-doc" }, { resMatch: isResDeleteDoc });
  }

  async subscribeDocs(req: Req<ReqSubscribeDocs>): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const result: Result<ResSubscribeDocs, VibesDiyError> = await this.request(
      { ...req, type: "vibes.diy.req-subscribe-docs" },
      { resMatch: isResSubscribeDocs }
    );
    if (result.isOk()) {
      const sub = { userSlug: req.userSlug, appSlug: req.appSlug, dbName: req.dbName };
      const key = `${sub.userSlug}/${sub.appSlug}/${sub.dbName}`;
      if (!this.docSubscriptions.some((s) => `${s.userSlug}/${s.appSlug}/${s.dbName}` === key)) {
        this.docSubscriptions.push(sub);
      }
    }
    return result;
  }

  listDbNames(req: Req<ReqListDbNames>): Promise<Result<ResListDbNames, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-db-names" }, { resMatch: isResListDbNames });
  }

  private attachDocChangedToConnection(
    conn: VibeDiyApiConnection,
    fn: (userSlug: string, appSlug: string, docId: string) => void
  ): void {
    conn.onMessage((wsEvent) => {
      if (wsEvent.type !== "MessageEvent") return;
      const raw = wsEvent.event.data;
      const textPromise =
        raw instanceof Blob
          ? raw.text()
          : Promise.resolve(typeof raw === "string" ? raw : new TextDecoder().decode(raw as Uint8Array));
      textPromise
        .then((text) => {
          const parsed = JSON.parse(text);
          const msg = msgBase(parsed);
          if (!(msg instanceof type.errors) && isEvtDocChanged(msg.payload)) {
            fn(msg.payload.userSlug, msg.payload.appSlug, msg.payload.docId);
          }
        })
        .catch((_e: unknown) => {
          // Not a valid message — ignore
        });
    });
  }

  onDocChanged(fn: (userSlug: string, appSlug: string, docId: string) => void): void {
    this.docChangedListeners.push(fn);
    const conn = this.currentConnection;
    if (conn) {
      // Connection already established — attach immediately
      this.attachDocChangedToConnection(conn, fn);
    } else {
      // Trigger connection — replay loop in getReadyConnection will attach all stored listeners
      this.getReadyConnection().catch((_e: unknown) => {
        /* best-effort; next activity will establish connection */
      });
    }
  }

  /** @internal — test inspection only */
  get _testInternals(): {
    docSubscriptions: readonly { userSlug: string; appSlug: string; dbName: string }[];
    docChangedListenerCount: number;
    currentConnection: VibeDiyApiConnection | undefined;
    reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  } {
    return {
      docSubscriptions: this.docSubscriptions,
      docChangedListenerCount: this.docChangedListeners.length,
      currentConnection: this.currentConnection,
      reconnectTimer: this.reconnectTimer,
    };
  }
}

class LLMChatImpl implements LLMChat {
  readonly api: VibesDiyApi;
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

  static async open(open: ReqType<ReqOpenChat>, api: VibesDiyApi): Promise<Result<LLMChat>> {
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
        if (msg.tid === tid) {
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
            await sectionEventsWriter.write(se);
          } else {
            // sectionEvent parse failed — skip silently
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
    api: VibesDiyApi,
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

  // addFS(fs: VibeFile[]) {
  //   console.log("LLMChat addFS called for chatId:", this.chatId, this.tid, fs);
  //   return this.api.request<ReqType<ReqAddFS>, ResAddFS>(
  //     {
  //       type: "vibes.diy.req-add-fs",
  //       chatId: this.chatId,
  //       outerTid: this.tid,
  //       fs,
  //     },
  //     {
  //       resMatch: isResAddFS,
  //     }
  //   );
  // }

  async promptFS(req: FSUpdate | VibeFile[]): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    if (isFSUpdate(req)) {
      return this.api.request<ReqType<ReqPromptFSUpdateChatSection>, ResPromptChatSection>(
        {
          type: "vibes.diy.req-prompt-chat-section",
          mode: "fs-update",
          chatId: this.res.chatId,
          outerTid: this.tid, //leaking but necessary streaming
          fsUpdate: req,
        },
        {
          resMatch: isResPromptChatSection,
        }
      );
    } else {
      const possibleArray = vibeFile.array()(req);
      if (possibleArray instanceof type.errors) {
        return Result.Err({
          type: "vibes.diy.error",
          name: "VibesDiyError",
          message: `Invalid VibeFile array`,
          code: "invalid-vibefile-array",
        } as VibesDiyError);
      }
      return this.api.request<ReqType<ReqPromptFSSetChatSection>, ResPromptChatSection>(
        {
          type: "vibes.diy.req-prompt-chat-section",
          mode: "fs-set",
          chatId: this.res.chatId,
          outerTid: this.tid, //leaking but necessary streaming
          fsSet: possibleArray,
        },
        {
          resMatch: isResPromptChatSection,
        }
      );
    }
  }

  async prompt(msg: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    const mode = this.res.mode;
    if (!isPromptLLMStyle(mode)) {
      return Result.Err({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Chat mode ${this.res.mode} does not support prompting`,
        code: "unsupported-chat-mode",
      } as VibesDiyError);
    }
    const res = await this.api.request<ReqType<ReqPromptLLMChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        mode,
        chatId: this.res.chatId,
        outerTid: this.tid, //leaking but necessary streaming
        prompt: msg,
        ...(mode === "img" && opts?.inputImageBase64 ? { inputImageBase64: opts.inputImageBase64 } : {}),
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
  }
}

export * from "./api-connection.js";
