import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqSeedStarterChips,
  ReqSeedStarterChips,
  ResSeedStarterChips,
  VibesDiyError,
  mkResError,
  W3CWebSocketEvent,
  ReqWithOptionalAuth,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { seedStarterChips } from "../intern/seed-starter-chips.js";

// Owner-gated WRITE that seeds a starter vibe's curated suggestion chips (#2941).
// The operator (curator) runs this once per starter after deploy to set up the
// on-ramp tree — it persists a talk-only narration turn so `getVibeChips` surfaces
// the curated chips (display-only; never a producible cached-suggestion, Charlie
// #2950). Gated on owning the handle the vibe lives under, so only the curator who
// pushed the Blooms can seed them. Idempotent (the seed turn replaces, not stacks).
export const seedStarterChipsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqSeedStarterChips>,
  ResSeedStarterChips | VibesDiyError
> = {
  hash: "seed-starter-chips",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSeedStarterChips(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqSeedStarterChips>>,
        ResSeedStarterChips | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const callerUserId = req._auth?.verifiedAuth.claims.userId;
      if (!callerUserId) {
        await ctx.send.send(ctx, mkResError("seedStarterChips: authentication required", "unauthorized"));
        return Result.Ok(EventoResult.Continue);
      }

      // Owner-gated: the caller must own the handle the vibe lives under. Owning
      // the handle == owning every vibe under it, so this is the same authority the
      // curator used to `vibes-diy push` the starters in the first place.
      const ownerRow = await vctx.sql.db
        .select({ userId: vctx.sql.tables.handleBinding.userId })
        .from(vctx.sql.tables.handleBinding)
        .where(eq(vctx.sql.tables.handleBinding.handle, req.ownerHandle))
        .limit(1)
        .then((r) => r[0]);
      if (!ownerRow || ownerRow.userId !== callerUserId) {
        await ctx.send.send(ctx, mkResError(`seedStarterChips: not the owner of ${req.ownerHandle}`, "forbidden"));
        return Result.Ok(EventoResult.Continue);
      }

      const r = await seedStarterChips(vctx, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        chips: req.chips,
        ...(req.leadLine ? { leadLine: req.leadLine } : {}),
      });
      if (r.isErr()) {
        await ctx.send.send(ctx, mkResError(r.Err().message, "seed-failed"));
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-seed-starter-chips",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        seededChips: [...r.Ok().seededChips],
      } satisfies ResSeedStarterChips);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
