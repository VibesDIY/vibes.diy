import { Result } from "@adviser/cement";
import { VibesDiyError, ResError, VibeFile } from "./common.js";
import {
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  ReqGetChatDetails,
  ResGetChatDetails,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  ReqSetModeFs,
  ResSetModeFs,
  ReqForkApp,
  ResForkApp,
  ReqListUserSlugBindings,
  ResListUserSlugBindings,
  ReqCreateUserSlugBinding,
  ResCreateUserSlugBinding,
  ReqDeleteUserSlugBinding,
  ResDeleteUserSlugBinding,
} from "./app.js";
import { ReqOpenChat, ResPromptChatSection, SectionEvent, ReqListModels, ResListModels, FSUpdate } from "./chat.js";
import {
  ReqEnsureUserSettings,
  ResEnsureUserSettings,
  ReqListApplicationChats,
  ResListApplicationChats,
  ReqEnsureAppSettings,
  ResEnsureAppSettings,
} from "./settings.js";
import { ReqFPCloudToken, ResFPCloudToken } from "./fpcloud-token.js";
import {
  ReqCreateInvite,
  ResCreateInvite,
  ReqRevokeInvite,
  ResRevokeInvite,
  ReqRedeemInvite,
  ResRedeemInviteOK,
  ReqHasAccessInvite,
  ResHasAccessInvite,
  ReqInviteSetRole,
  ResInviteSetRole,
  ReqListInviteGrants,
  ResListInviteGrants,
} from "./invite-flow.js";
import {
  ReqListRequestGrants,
  ResListRequestGrants,
  ReqRequestAccess,
  ResRequestAccess,
  ReqApproveRequest,
  ResApproveRequest,
  ReqRequestSetRole,
  ResRequestSetRole,
  ReqRevokeRequest,
  ResRevokeRequest,
  ReqHasAccessRequest,
  ResHasAccessRequest,
} from "./request-access.js";
import {
  ReqPutDoc,
  ResPutDoc,
  ReqGetDoc,
  ResGetDoc,
  ResGetDocNotFound,
  ReqQueryDocs,
  ResQueryDocs,
  ReqDeleteDoc,
  ResDeleteDoc,
  ReqSubscribeDocs,
  ResSubscribeDocs,
  ReqListDbNames,
  ResListDbNames,
} from "./app-documents.js";
import { type } from "arktype";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { DashAuthType, ReqCertFromCsr, ResCertFromCsr, VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { ClerkClaim } from "@fireproof/core-types-base";

export const LLMChatEntry = type({
  tid: "string",
  chatId: "string",
  userSlug: "string",
  appSlug: "string",
});
export type LLMChatEntry = typeof LLMChatEntry.infer;

export type OnResponseTypes = ResError | SectionEvent;

export interface LLMChat extends LLMChatEntry {
  prompt(req: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>>;
  promptFS(req: FSUpdate | VibeFile[]): Promise<Result<ResPromptChatSection, VibesDiyError>>;

  readonly sectionStream: ReadableStream<OnResponseTypes>;
  // onResponse(fn: (msg: OnResponseTypes) => void): void;
  // onError(fn: (err: VibesDiyError) => void): void;
  close(force?: boolean): Promise<void>;
}

export interface OptionalAuth {
  readonly auth?: DashAuthType;
}
// export type Req<T> = Omit<T, "type" | "auth"> & OptionalAuth;

export type Req<T> = T extends unknown ? Omit<T, "type" | "auth"> & OptionalAuth : never;

export interface VibesDiyApiIface<_T = unknown> {
  close(): Promise<void>;
  ensureAppSlug(req: Req<ReqEnsureAppSlug>): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
  // getByUserSlugAppSlug(req: Req<ReqGetByUserSlugAppSlug>): Promise<Result<ResGetByUserSlugAppSlug, VibesDiyError>>;
  listUserSlugAppSlug(req: Req<ReqListUserSlugAppSlug>): Promise<Result<ResListUserSlugAppSlug, VibesDiyError>>;
  getChatDetails(req: Req<ReqGetChatDetails>): Promise<Result<ResGetChatDetails, VibesDiyError>>;
  getAppByFsId(req: Req<ReqGetAppByFsId>): Promise<Result<ResGetAppByFsId, VibesDiyError>>;
  openChat(req: Req<ReqOpenChat>): Promise<Result<LLMChat>>;
  ensureUserSettings(req: Req<ReqEnsureUserSettings>): Promise<Result<ResEnsureUserSettings, VibesDiyError>>;
  ensureAppSettings(req: Req<ReqEnsureAppSettings>): Promise<Result<ResEnsureAppSettings, VibesDiyError>>;
  listApplicationChats(req: Req<ReqListApplicationChats>): Promise<Result<ResListApplicationChats, VibesDiyError>>;

  getTokenClaims(): Promise<Result<VerifiedClaimsResult & { claims: ClerkClaim }>>;

  setSetModeFs(req: Req<ReqSetModeFs>): Promise<Result<ResSetModeFs>>;

  forkApp(req: Req<ReqForkApp>): Promise<Result<ResForkApp, VibesDiyError>>;

  getCertFromCsr(req: Req<ReqCertFromCsr>): Promise<Result<ResCertFromCsr>>;

  getFPCloudToken(req: Req<ReqFPCloudToken>): Promise<Result<ResFPCloudToken>>;

  createInvite(req: Req<ReqCreateInvite>): Promise<Result<ResCreateInvite, VibesDiyError>>;
  revokeInvite(req: Req<ReqRevokeInvite>): Promise<Result<ResRevokeInvite, VibesDiyError>>;
  redeemInvite(req: Req<ReqRedeemInvite>): Promise<Result<ResRedeemInviteOK, VibesDiyError>>;
  hasAccessInvite(req: Req<ReqHasAccessInvite>): Promise<Result<ResHasAccessInvite, VibesDiyError>>;
  inviteSetRole(req: Req<ReqInviteSetRole>): Promise<Result<ResInviteSetRole, VibesDiyError>>;
  listInviteGrants(req: Req<ReqListInviteGrants>): Promise<Result<ResListInviteGrants, VibesDiyError>>;
  requestAccess(req: Req<ReqRequestAccess>): Promise<Result<ResRequestAccess, VibesDiyError>>;
  approveRequest(req: Req<ReqApproveRequest>): Promise<Result<ResApproveRequest, VibesDiyError>>;
  requestSetRole(req: Req<ReqRequestSetRole>): Promise<Result<ResRequestSetRole, VibesDiyError>>;
  revokeRequest(req: Req<ReqRevokeRequest>): Promise<Result<ResRevokeRequest, VibesDiyError>>;
  listRequestGrants(req: Req<ReqListRequestGrants>): Promise<Result<ResListRequestGrants, VibesDiyError>>;
  hasAccessRequest(req: Req<ReqHasAccessRequest>): Promise<Result<ResHasAccessRequest, VibesDiyError>>;

  listUserSlugBindings(req: Req<ReqListUserSlugBindings>): Promise<Result<ResListUserSlugBindings, VibesDiyError>>;
  createUserSlugBinding(req: Req<ReqCreateUserSlugBinding>): Promise<Result<ResCreateUserSlugBinding, VibesDiyError>>;
  deleteUserSlugBinding(req: Req<ReqDeleteUserSlugBinding>): Promise<Result<ResDeleteUserSlugBinding, VibesDiyError>>;

  listModels(req: Req<ReqListModels>): Promise<Result<ResListModels, VibesDiyError>>;

  // Firefly document operations
  putDoc(req: Req<ReqPutDoc>): Promise<Result<ResPutDoc, VibesDiyError>>;
  getDoc(req: Req<ReqGetDoc>): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>>;
  queryDocs(req: Req<ReqQueryDocs>): Promise<Result<ResQueryDocs, VibesDiyError>>;
  deleteDoc(req: Req<ReqDeleteDoc>): Promise<Result<ResDeleteDoc, VibesDiyError>>;
  subscribeDocs(req: Req<ReqSubscribeDocs>): Promise<Result<ResSubscribeDocs, VibesDiyError>>;
  listDbNames(req: Req<ReqListDbNames>): Promise<Result<ResListDbNames, VibesDiyError>>;

  // Register a callback for document change events pushed from the API
  onDocChanged(fn: (userSlug: string, appSlug: string, docId: string) => void): void;
}
