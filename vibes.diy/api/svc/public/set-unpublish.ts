import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqSetUnpublish,
  ReqSetUnpublish,
  ReqWithVerifiedAuth,
  ResError,
  ResSetUnpublish,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, and } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";

// Soft-unpublish / republish a vibe (#2688). Mirrors pin-recent-vibe exactly:
// a read-only ownership check (join AppSlugBindings × UserSlugBindings on the
// caller's userId — NOT ensureSlugBinding, which would create a binding for a
// typo'd slug and leave stray state) followed by a single-column write of
// unpublishedAt. unpublish:true tombstones (ISO timestamp), false republishes
// (empty string). Nothing in Apps / AppDocuments / grants is touched, so the
// action is fully reversible and restore is exact.
export const setUnpublishEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqSetUnpublish>, ResSetUnpublish | VibesDiyError> = {
  hash: "set-unpublish",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSetUnpublish(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqSetUnpublish>>, ResSetUnpublish | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const usb = vctx.sql.tables.handleBinding;
      const asb = vctx.sql.tables.appSlugBinding;

      // Read-only owner check: the row only comes back if the authenticated
      // caller owns the handle. A missing or non-owned slug returns no row —
      // we error rather than create anything.
      const appRow = await vctx.sql.db
        .select({ ownerHandle: asb.ownerHandle, appSlug: asb.appSlug, unpublishedAt: asb.unpublishedAt })
        .from(asb)
        .innerJoin(usb, and(eq(usb.handle, asb.ownerHandle), eq(usb.userId, userId)))
        .where(and(eq(asb.ownerHandle, req.ownerHandle), eq(asb.appSlug, req.appSlug)))
        .limit(1)
        .then((r) => r[0]);
      if (appRow === undefined) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: {
            message: `not found or not authorized to unpublish ${req.ownerHandle}/${req.appSlug}`,
            code: "set-unpublish-not-found",
          },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const previousUnpublishedAt = appRow.unpublishedAt;
      const unpublishedAt = req.unpublish ? new Date().toISOString() : "";
      await vctx.sql.db
        .update(asb)
        .set({ unpublishedAt })
        .where(and(eq(asb.ownerHandle, req.ownerHandle), eq(asb.appSlug, req.appSlug)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-set-unpublish",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        unpublishedAt,
        previousUnpublishedAt,
      } satisfies ResSetUnpublish);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
