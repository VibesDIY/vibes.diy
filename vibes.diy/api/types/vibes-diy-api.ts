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
  ReqListUserSlugBindings,
  ResListUserSlugBindings,
  ReqCreateUserSlugBinding,
  ResCreateUserSlugBinding,
  ReqDeleteUserSlugBinding,
  ResDeleteUserSlugBinding,
} from "./app.js";
import { ReqOpenChat, ResPromptChatSection, SectionEvent, ResAddFS, ReqListModels, ResListModels } from "./chat.js";
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
  prompt(req: LLMRequest): Promise<Result<ResPromptChatSection, VibesDiyError>>;
  addFS(fs: VibeFile[]): Promise<Result<ResAddFS, VibesDiyError>>;

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
}
