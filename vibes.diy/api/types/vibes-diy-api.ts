import { Result } from "@adviser/cement";
import {
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  ReqGetChatDetails,
  ResGetChatDetails,
  ReqGetAppByFsId,
  ReqGetAppByAppSlug,
  ResGetAppByFsId,
  ReqOpenChat,
  VibesDiyError,
  DashAuthType,
  ResPromptChatSection,
  ResError,
  SectionEvent,
  ReqEnsureUserSettings,
  ResEnsureUserSettings,
  ReqListApplicationChats,
  ResListApplicationChats,
  ReqGetCertFromCsr,
  ResGetCertFromCsr,
  ReqRegisterHandle,
  ResRegisterHandle,
} from "./msg-types.js";
import { type } from "arktype";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
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
export type Req<T> = Omit<T, "type" | "auth"> & OptionalAuth;

export interface VibesDiyApiIface<_T = unknown> {
  ensureAppSlug(req: Req<ReqEnsureAppSlug>): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
  registerHandle(req: Req<ReqRegisterHandle>): Promise<Result<ResRegisterHandle, VibesDiyError>>;
  // getByUserSlugAppSlug(req: Req<ReqGetByUserSlugAppSlug>): Promise<Result<ResGetByUserSlugAppSlug, VibesDiyError>>;
  listUserSlugAppSlug(req: Req<ReqListUserSlugAppSlug>): Promise<Result<ResListUserSlugAppSlug, VibesDiyError>>;
  getChatDetails(req: Req<ReqGetChatDetails>): Promise<Result<ResGetChatDetails, VibesDiyError>>;
  getAppByFsId(req: Req<ReqGetAppByFsId>): Promise<Result<ResGetAppByFsId, VibesDiyError>>;
  getAppByAppSlug(req: Req<ReqGetAppByAppSlug>): Promise<Result<ResGetAppByFsId, VibesDiyError>>;
  openChat(req: Req<ReqOpenChat>): Promise<Result<LLMChat>>;
  ensureUserSettings(req: Req<ReqEnsureUserSettings>): Promise<Result<ResEnsureUserSettings, VibesDiyError>>;
  listApplicationChats(req: Req<ReqListApplicationChats>): Promise<Result<ResListApplicationChats, VibesDiyError>>;
  getCertFromCsr(req: Req<ReqGetCertFromCsr>): Promise<Result<ResGetCertFromCsr, VibesDiyError>>;

  getTokenClaims(): Promise<Result<VerifiedClaimsResult & { claims: ClerkClaim }>>;
}
