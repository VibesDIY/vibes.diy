import { Result } from "@adviser/cement";
import {
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  ReqGetChatDetails,
  ResGetChatDetails,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  ReqOpenChat,
  VibesDiyError,
  ResPromptChatSection,
  ResError,
  SectionEvent,
  ReqEnsureUserSettings,
  ResEnsureUserSettings,
  ReqListApplicationChats,
  ResListApplicationChats,
  ReqEnsureAppSettings,
  ResEnsureAppSettings,
  ReqSetModeFs,
  ResSetModeFs,
  ReqFPCloudToken,
  ResFPCloudToken,
} from "./msg-types.js";
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
}
