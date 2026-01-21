import {
  ReqEnsureAppSlug,
  ReqEnsureChatContext,
  ReqAppendChatSection,
  ResEnsureAppSlug,
  ResEnsureChatContext,
  ResAppendChatSection,
  VibesDiyError,
} from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

export interface VibesDiyApiIface<Ops = object> {
  ensureAppSlug(req: ReqEnsureAppSlug & Ops): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
  ensureChatContext(req: ReqEnsureChatContext & Ops): Promise<Result<ResEnsureChatContext, VibesDiyError>>;
  appendChatSection(req: ReqAppendChatSection & Ops): Promise<Result<ResAppendChatSection, VibesDiyError>>;
}
