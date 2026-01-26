import {
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
  VibesDiyError,
} from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

export interface VibesDiyApiIface<Ops = object> {
  ensureAppSlug(req: ReqEnsureAppSlug & Ops): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
  ensureChatContext(req: ReqEnsureChatContext & Ops): Promise<Result<ResEnsureChatContext, VibesDiyError>>;
  appendChatSection(req: ReqAppendChatSection & Ops): Promise<Result<ResAppendChatSection, VibesDiyError>>;
  claimUserSlug(req: ReqClaimUserSlug & Ops): Promise<Result<ResClaimUserSlug, VibesDiyError>>;
  listUserSlugs(req: ReqListUserSlugs & Ops): Promise<Result<ResListUserSlugs, VibesDiyError>>;
}
