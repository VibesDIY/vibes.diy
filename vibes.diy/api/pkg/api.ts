import {
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  VibesDiyError,
} from "./msg-types.js";
import { Result } from "@adviser/cement";

export interface VibesDiyApiIface<Ops = object> {
  ensureAppSlug(
    req: ReqEnsureAppSlug & Ops,
  ): Promise<Result<ResEnsureAppSlug, VibesDiyError>>;
}
