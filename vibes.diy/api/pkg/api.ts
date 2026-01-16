import { ReqEnsureAppSlug, ResEnsureAppSlug, VibesDiyError } from "@vibes.diy/api-types/msg-types.ts";
import { Result } from "@adviser/cement";

export interface VibesDiyApiIface<Ops = object> {
  ensureAppSlug(req: ReqEnsureAppSlug & Ops): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
}
