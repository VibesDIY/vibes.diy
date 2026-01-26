import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { reqClaimUserSlug, ReqClaimUserSlug, ResClaimUserSlug, ProfileType } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { ensureUserSlug } from "../intern/ensure-slug-binding.js";
import { moderateContent } from "../intern/moderate-content.js";
import { sqlUserProfiles } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm";

export const claimUserSlug: EventoHandler<Request, ReqClaimUserSlug, ResClaimUserSlug> = {
  hash: "claim-user-slug",
  validate: unwrapMsgBase(async (payload: unknown) => {
    const ret = reqClaimUserSlug(payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(ret));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<Request, ReqWithVerifiedAuth<ReqClaimUserSlug>, ResClaimUserSlug>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Content moderation (if API key configured)
      if (vctx.params.openRouterApiKey) {
        const moderationResult = await moderateContent(vctx.params.openRouterApiKey, {
          userSlug: req.userSlug,
          name: req.profile?.name,
          url: req.profile?.url,
        });
        if (moderationResult.isErr()) {
          vctx.logger.Warn().Str("error", moderationResult.Err().message).Msg("Content moderation failed");
          // Don't block on moderation errors, just log
        } else if (!moderationResult.Ok().safe) {
          return Result.Err(`Content not allowed: ${moderationResult.Ok().reason || "Policy violation"}`);
        }
      }

      const rUserSlug = await ensureUserSlug(vctx, {
        userId: req.auth.verifiedAuth.claims.userId,
        userSlug: req.userSlug,
      });

      if (rUserSlug.isErr()) {
        return Result.Err(rUserSlug);
      }

      // Upsert profile if provided
      if (req.profile) {
        await vctx.db
          .insert(sqlUserProfiles)
          .values({
            userSlug: req.userSlug,
            profile: req.profile,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: sqlUserProfiles.userSlug,
            set: { profile: req.profile, updated: new Date().toISOString() },
          })
          .run();
      }

      // Fetch existing profile for response
      const existingProfile = await vctx.db
        .select()
        .from(sqlUserProfiles)
        .where(eq(sqlUserProfiles.userSlug, req.userSlug))
        .get();

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-claim-user-slug",
        userSlug: rUserSlug.Ok(),
        owned: true,
        profile: existingProfile?.profile as ProfileType | undefined,
      } satisfies ResClaimUserSlug);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
