import {
  MsgBase,
  MsgBaseCfg,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ResultVibesDiy,
  VibesDiyError,
  MsgBox,
  ReqOpenChat,
  isResEnsureAppSlug,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  isResListUserSlugAppSlug,
  ReqListRecentVibes,
  ResListRecentVibes,
  isResListRecentVibes,
  ReqPinRecentVibe,
  ResPinRecentVibe,
  isResPinRecentVibe,
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
  ReqSubscribeRequestGrants,
  ResSubscribeRequestGrants,
  isResSubscribeRequestGrants,
  ReqRequestAccess,
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
  ReqListHandleBindings,
  ResListHandleBindings,
  isResListHandleBindings,
  ReqCreateHandleBinding,
  ResCreateHandleBinding,
  isResCreateHandleBinding,
  ReqDeleteHandleBinding,
  ResDeleteHandleBinding,
  isResDeleteHandleBinding,
  ReqListModels,
  ResListModels,
  isResListModels,
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
  ReqListDmThreads,
  ResListDmThreads,
  isResListDmThreads,
  ReqMarkDmRead,
  ResMarkDmRead,
  isResMarkDmRead,
  ReqListMembers,
  ResListMembers,
  isResListMembers,
  ReqListMemberships,
  ResListMemberships,
  isResListMemberships,
  ReqAssetUploadGrant,
  ReqReportGrowthMemberships,
  ResReportGrowthMemberships,
  isResReportGrowthMemberships,
  ReqReportGrowthVibesWithData,
  ResReportGrowthVibesWithData,
  isResReportGrowthVibesWithData,
  ReqReportActiveMembers,
  ResReportActiveMembers,
  isResReportActiveMembers,
  ReqReportTopVibesByMembers,
  ResReportTopVibesByMembers,
  isResReportTopVibesByMembers,
  ReqReportAttributionReferrers,
  ResReportAttributionReferrers,
  isResReportAttributionReferrers,
  ReqReportCampaignHealth,
  ResReportCampaignHealth,
  isResReportCampaignHealth,
  ReqReportCampaignAdPreviews,
  ResReportCampaignAdPreviews,
  isResReportCampaignAdPreviews,
  ResAssetUploadGrant,
  isResAssetUploadGrant,
  EvtRequestGrant,
  EvtUserNotification,
  ResSubscribeUserNotifications,
  isResSubscribeUserNotifications,
} from "@vibes.diy/api-types";
import { Result, Lazy, BuildURI } from "@adviser/cement";
import { ClerkClaim, SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { VibeDiyApiConnection } from "./api-connection.js";
import { getVibesDiyWebSocketConnection } from "./websocket-connection.js";
import { ClerkApiToken } from "@fireproof/core-protocols-dashboard";
import { DashAuthType, ReqCertFromCsr, ResCertFromCsr, VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { ReqVibeWhoAmI, ResVibeWhoAmI, isResVibeWhoAmI } from "@vibes.diy/vibe-types";
import { LLMChatImpl } from "./llm-chat.js";
import {
  attachDocChangedToConnection as attachDocChangedToConnectionImpl,
  attachRequestGrantToConnection as attachRequestGrantToConnectionImpl,
  attachUserNotificationToConnection as attachUserNotificationToConnectionImpl,
  replayConnectionState,
} from "./vibes-diy-api-listeners.js";
import { requestApiResponse, sendApiMessage } from "./vibes-diy-api-transport.js";

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
  // Optional perf hint: pin this connection's DO shard to a stable value (e.g.
  // "${ownerHandle}--${appSlug}" for a viewer route) so multiple visitors to the
  // same vibe land on the same warm DO instead of each paying ~1s cold-start.
  // Omit for codegen / load-balanced traffic — random UUID is used.
  readonly shardKey?: string;
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

type WithAuth<T> = Omit<T, "auth"> & { readonly auth: DashAuthType };

export class VibesDiyApi implements VibesDiyApiIface<{
  auth?: DashAuthType;
  type?: string;
}> {
  readonly cfg: VibesDiyApiConfig;
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly docChangedListeners: ((ownerHandle: string, appSlug: string, dbName: string, docId: string) => void)[] = [];
  private readonly docChangedDetachers = new Map<
    (ownerHandle: string, appSlug: string, dbName: string, docId: string) => void,
    () => void
  >();
  private readonly docSubscriptions: { ownerHandle: string; appSlug: string; dbName: string }[] = [];
  private readonly requestGrantListeners: ((evt: EvtRequestGrant) => void)[] = [];
  private readonly requestGrantDetachers = new Map<(evt: EvtRequestGrant) => void, () => void>();
  private readonly requestGrantSubscriptions: { ownerHandle: string; appSlug: string }[] = [];
  private readonly userNotificationListeners: ((evt: EvtUserNotification) => void)[] = [];
  private readonly userNotificationDetachers = new Map<(evt: EvtUserNotification) => void, () => void>();
  private userNotificationSubscribed = false;
  private currentConnection: VibeDiyApiConnection | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(cfg: VibesDiyApiParam) {
    const sthis = cfg.sthis ?? ensureSuperThis();
    // Each API instance gets its own DO shard to avoid CPU limits under concurrent load.
    // When a preset WebSocket is provided (tests), skip sharding — tests bypass worker routing.
    // If shardKey is provided (e.g. a viewer landing on /vibe/<u>/<a>), pin to that
    // stable value so all visitors of the same vibe land on the same warm DO.
    const shard = cfg.shardKey ?? crypto.randomUUID();
    const apiUrl = cfg.ws ? cfg.apiUrl : BuildURI.from(cfg.apiUrl).setParam("shard", shard).toString();
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
      timeoutMs: cfg.timeoutMs ?? 30000,
      msg: {
        src: "vibes.diy.client",
        dst: "vibes.diy.server",
        ttl: 10,
        ...cfg.msg,
      },
      sthis,
    };
    // Open the WebSocket eagerly. The handshake is unauthenticated (auth is
    // per-message, not per-upgrade) so we don't need to wait for getToken().
    // Overlapping the WS open with Clerk SDK loading shaves up to a full Clerk
    // round-trip off time-to-first-message.
    this.getReadyConnection().catch((_e: unknown) => {
      /* best-effort eager connect; first send will retry */
    });
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
      replayConnectionState({
        conn,
        docChangedListeners: this.docChangedListeners,
        docChangedDetachers: this.docChangedDetachers,
        requestGrantListeners: this.requestGrantListeners,
        requestGrantDetachers: this.requestGrantDetachers,
        userNotificationListeners: this.userNotificationListeners,
        userNotificationDetachers: this.userNotificationDetachers,
        docSubscriptions: this.docSubscriptions,
        requestGrantSubscriptions: this.requestGrantSubscriptions,
        userNotificationSubscribed: this.userNotificationSubscribed,
        subscribeDocs: (sub) => this.subscribeDocs(sub),
        subscribeRequestGrants: (sub) => this.subscribeRequestGrants(sub),
        subscribeUserNotifications: (req) => this.subscribeUserNotifications(req),
      });
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
    return sendApiMessage(this, req, msgParam);
  }

  async request<Q extends OptionalAuth, S>(
    req: Q,
    msgParam: {
      tid?: string;
      resMatch: (res: unknown) => boolean;
    }
  ): Promise<ResultVibesDiy<S>> {
    return requestApiResponse(this, req, msgParam);
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

  listRecentVibes(req: Req<ReqListRecentVibes>): Promise<Result<ResListRecentVibes, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-list-recent-vibes" },
      {
        resMatch: isResListRecentVibes,
      }
    );
  }

  pinRecentVibe(req: Req<ReqPinRecentVibe>): Promise<Result<ResPinRecentVibe, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-pin-recent-vibe" },
      {
        resMatch: isResPinRecentVibe,
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

  async subscribeRequestGrants(req: Req<ReqSubscribeRequestGrants>): Promise<Result<ResSubscribeRequestGrants, VibesDiyError>> {
    const result: Result<ResSubscribeRequestGrants, VibesDiyError> = await this.request(
      { ...req, type: "vibes.diy.req-subscribe-request-grants" },
      { resMatch: isResSubscribeRequestGrants }
    );
    if (result.isOk()) {
      const sub = { ownerHandle: req.ownerHandle, appSlug: req.appSlug };
      const key = `${sub.ownerHandle}/${sub.appSlug}`;
      if (!this.requestGrantSubscriptions.some((s) => `${s.ownerHandle}/${s.appSlug}` === key)) {
        this.requestGrantSubscriptions.push(sub);
      }
    }
    return result;
  }

  hasAccessRequest(req: Req<ReqHasAccessRequest>): Promise<Result<ResHasAccessRequest, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-has-access-request" }, { resMatch: isResHasAccessRequestFlow });
  }

  listHandleBindings(req: Req<ReqListHandleBindings>): Promise<Result<ResListHandleBindings, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-user-slug-bindings" }, { resMatch: isResListHandleBindings });
  }

  createHandleBinding(req: Req<ReqCreateHandleBinding>): Promise<Result<ResCreateHandleBinding, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-create-user-slug-binding" }, { resMatch: isResCreateHandleBinding });
  }

  deleteHandleBinding(req: Req<ReqDeleteHandleBinding>): Promise<Result<ResDeleteHandleBinding, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-delete-user-slug-binding" }, { resMatch: isResDeleteHandleBinding });
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
      const sub = { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName: req.dbName };
      const key = `${sub.ownerHandle}/${sub.appSlug}/${sub.dbName}`;
      if (!this.docSubscriptions.some((s) => `${s.ownerHandle}/${s.appSlug}/${s.dbName}` === key)) {
        this.docSubscriptions.push(sub);
      }
    }
    return result;
  }

  listDbNames(req: Req<ReqListDbNames>): Promise<Result<ResListDbNames, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-db-names" }, { resMatch: isResListDbNames });
  }

  listDmThreads(req: Req<ReqListDmThreads>): Promise<Result<ResListDmThreads, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-dm-threads" }, { resMatch: isResListDmThreads });
  }

  markDmRead(req: Req<ReqMarkDmRead>): Promise<Result<ResMarkDmRead, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-mark-dm-read" }, { resMatch: isResMarkDmRead });
  }

  listMembers(req: Req<ReqListMembers>): Promise<Result<ResListMembers, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-members" }, { resMatch: isResListMembers });
  }

  listMemberships(req: Req<ReqListMemberships>): Promise<Result<ResListMemberships, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-list-memberships" }, { resMatch: isResListMemberships });
  }

  whoAmI(req: Req<ReqVibeWhoAmI>): Promise<Result<ResVibeWhoAmI, VibesDiyError>> {
    return this.request({ ...req, type: "vibe.req.whoAmI" }, { resMatch: isResVibeWhoAmI });
  }

  requestAssetUploadGrant(req: Req<ReqAssetUploadGrant>): Promise<Result<ResAssetUploadGrant, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-asset-upload-grant" }, { resMatch: isResAssetUploadGrant });
  }

  reportGrowthMemberships(req: Req<ReqReportGrowthMemberships>): Promise<Result<ResReportGrowthMemberships, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-report-growth-memberships" }, { resMatch: isResReportGrowthMemberships });
  }

  reportGrowthVibesWithData(req: Req<ReqReportGrowthVibesWithData>): Promise<Result<ResReportGrowthVibesWithData, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-report-growth-vibes-with-data" },
      { resMatch: isResReportGrowthVibesWithData }
    );
  }

  reportActiveMembers(req: Req<ReqReportActiveMembers>): Promise<Result<ResReportActiveMembers, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-report-active-members" }, { resMatch: isResReportActiveMembers });
  }

  reportTopVibesByMembers(req: Req<ReqReportTopVibesByMembers>): Promise<Result<ResReportTopVibesByMembers, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-report-top-vibes-by-members" }, { resMatch: isResReportTopVibesByMembers });
  }

  reportAttributionReferrers(
    req: Req<ReqReportAttributionReferrers>
  ): Promise<Result<ResReportAttributionReferrers, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-report-attribution-referrers" },
      { resMatch: isResReportAttributionReferrers }
    );
  }

  reportCampaignHealth(req: Req<ReqReportCampaignHealth>): Promise<Result<ResReportCampaignHealth, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-report-campaign-health" }, { resMatch: isResReportCampaignHealth });
  }

  reportCampaignAdPreviews(req: Req<ReqReportCampaignAdPreviews>): Promise<Result<ResReportCampaignAdPreviews, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-report-campaign-ad-previews" }, { resMatch: isResReportCampaignAdPreviews });
  }

  private attachDocChangedToConnection(
    conn: VibeDiyApiConnection,
    fn: (ownerHandle: string, appSlug: string, dbName: string, docId: string) => void
  ): () => void {
    return attachDocChangedToConnectionImpl(conn, fn);
  }

  onDocChanged(fn: (ownerHandle: string, appSlug: string, dbName: string, docId: string) => void): () => void {
    this.docChangedListeners.push(fn);
    const conn = this.currentConnection;
    if (conn) {
      // Connection already established — attach immediately
      const detach = this.attachDocChangedToConnection(conn, fn);
      this.docChangedDetachers.set(fn, detach);
    } else {
      // Trigger connection — replay loop in getReadyConnection will attach all stored listeners
      this.getReadyConnection().catch((_e: unknown) => {
        /* best-effort; next activity will establish connection */
      });
    }
    return () => {
      const idx = this.docChangedListeners.indexOf(fn);
      if (idx >= 0) this.docChangedListeners.splice(idx, 1);
      const detach = this.docChangedDetachers.get(fn);
      this.docChangedDetachers.delete(fn);
      detach?.();
    };
  }

  private attachRequestGrantToConnection(conn: VibeDiyApiConnection, fn: (evt: EvtRequestGrant) => void): () => void {
    return attachRequestGrantToConnectionImpl(conn, fn);
  }

  onRequestGrant(fn: (evt: EvtRequestGrant) => void): () => void {
    this.requestGrantListeners.push(fn);
    const conn = this.currentConnection;
    if (conn) {
      // Connection already established — attach immediately
      const detach = this.attachRequestGrantToConnection(conn, fn);
      this.requestGrantDetachers.set(fn, detach);
    } else {
      // Trigger connection — replay loop in getReadyConnection will attach all stored listeners
      this.getReadyConnection().catch((_e: unknown) => {
        /* best-effort; next activity will establish connection */
      });
    }
    return () => {
      const idx = this.requestGrantListeners.indexOf(fn);
      if (idx >= 0) this.requestGrantListeners.splice(idx, 1);
      const detach = this.requestGrantDetachers.get(fn);
      this.requestGrantDetachers.delete(fn);
      detach?.();
    };
  }

  private attachUserNotificationToConnection(conn: VibeDiyApiConnection, fn: (evt: EvtUserNotification) => void): () => void {
    return attachUserNotificationToConnectionImpl(conn, fn);
  }

  async subscribeUserNotifications(req: Req<{ auth?: unknown }>): Promise<Result<ResSubscribeUserNotifications, VibesDiyError>> {
    const result: Result<ResSubscribeUserNotifications, VibesDiyError> = await this.request(
      { ...req, type: "vibes.diy.req-subscribe-user-notifications" },
      { resMatch: isResSubscribeUserNotifications }
    );
    if (result.isOk()) {
      this.userNotificationSubscribed = true;
    }
    return result;
  }

  onUserNotification(fn: (evt: EvtUserNotification) => void): () => void {
    this.userNotificationListeners.push(fn);
    const conn = this.currentConnection;
    if (conn) {
      // Connection already established — attach immediately
      const detach = this.attachUserNotificationToConnection(conn, fn);
      this.userNotificationDetachers.set(fn, detach);
    } else {
      // Trigger connection — replay loop in getReadyConnection will attach all stored listeners
      this.getReadyConnection().catch((_e: unknown) => {
        /* best-effort; next activity will establish connection */
      });
    }
    return () => {
      const idx = this.userNotificationListeners.indexOf(fn);
      if (idx >= 0) this.userNotificationListeners.splice(idx, 1);
      const detach = this.userNotificationDetachers.get(fn);
      this.userNotificationDetachers.delete(fn);
      detach?.();
    };
  }

  /** @internal — test inspection only */
  get _testInternals(): {
    docSubscriptions: readonly { ownerHandle: string; appSlug: string; dbName: string }[];
    requestGrantSubscriptions: readonly { ownerHandle: string; appSlug: string }[];
    docChangedListenerCount: number;
    requestGrantListenerCount: number;
    currentConnection: VibeDiyApiConnection | undefined;
    reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  } {
    return {
      docSubscriptions: this.docSubscriptions,
      requestGrantSubscriptions: this.requestGrantSubscriptions,
      docChangedListenerCount: this.docChangedListeners.length,
      requestGrantListenerCount: this.requestGrantListeners.length,
      currentConnection: this.currentConnection,
      reconnectTimer: this.reconnectTimer,
    };
  }
}

export * from "./api-connection.js";
export { FireflyApiAdapter } from "./firefly-api-adapter.js";
