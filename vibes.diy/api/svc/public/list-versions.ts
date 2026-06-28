import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListVersions,
  ReqListVersions,
  ResListVersions,
  ResListVersionsItem,
  ReqWithOptionalAuth,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";

// List every Apps release for (ownerHandle, appSlug) — the CLI `versions` command
// (#2772 D3). Mirrors get-app-by-fsid's owner gating: the owner sees ALL rows
// (dev drafts + production history); anyone else sees only production rows, so a
// draft fsId is never discoverable by a non-owner. `published` marks the served
// public latest (the highest-releaseSeq production row).
export const listVersionsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListVersions>, ResListVersions | VibesDiyError> = {
  hash: "list-versions",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListVersions(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqListVersions>>, ResListVersions | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const callerUserId = req._auth?.verifiedAuth.claims.userId;

      const rows = await vctx.sql.db
        .select({
          userId: vctx.sql.tables.apps.userId,
          fsId: vctx.sql.tables.apps.fsId,
          mode: vctx.sql.tables.apps.mode,
          releaseSeq: vctx.sql.tables.apps.releaseSeq,
          created: vctx.sql.tables.apps.created,
        })
        .from(vctx.sql.tables.apps)
        .where(and(eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle), eq(vctx.sql.tables.apps.appSlug, req.appSlug)));

      const isOwner = callerUserId !== undefined && rows.some((r) => r.userId === callerUserId);

      // The served public latest = the highest-releaseSeq production row.
      let topProdSeq = -Infinity;
      for (const r of rows) {
        if (r.mode === "production" && r.releaseSeq > topProdSeq) topProdSeq = r.releaseSeq;
      }

      const items: ResListVersionsItem[] = rows
        // Non-owners only ever see production rows (no draft leak).
        .filter((r) => isOwner || r.mode === "production")
        // Newest first by created, releaseSeq tiebreak (matches the draft resolver).
        .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : b.releaseSeq - a.releaseSeq))
        .map((r) => ({
          fsId: r.fsId,
          mode: r.mode as "production" | "dev",
          releaseSeq: r.releaseSeq,
          created: r.created,
          published: r.mode === "production" && r.releaseSeq === topProdSeq,
        }));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-versions",
        appSlug: req.appSlug,
        ownerHandle: req.ownerHandle,
        items,
      } satisfies ResListVersions);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
