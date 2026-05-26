import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportAttributionReferrers,
  ResReportAttributionReferrers,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportAttributionReferrers,
  resReportAttributionReferrers,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { sql, desc, eq, notInArray, and } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

const OWNED_HOSTS = [
  "vibesdiy.app",
  "www.vibesdiy.app",
  "vibesdiy.work",
  "www.vibesdiy.work",
  "vibing.cool",
  "www.vibing.cool",
  "vibecode.garden",
  "www.vibecode.garden",
  "www.justvibes.dev",
  "www.vibrate.dev",
  "www.realize.run",
  "www.dreamcode.live",
  "www.vibes.software",
];

const LEGACY_VIBE_PATH_RE = sql`'^/vibe/[^/]+$'`;

async function computeAttributionReferrers(vctx: VibesApiSQLCtx, reqPathFilter?: string): Promise<ResReportAttributionReferrers> {
  const t = vctx.sql.tables;

  const ownedFilter = notInArray(t.refererEvents.refHost, OWNED_HOSTS);
  const notLegacyVibeFilter = sql`${t.refererEvents.reqPath} !~ ${LEGACY_VIBE_PATH_RE}`;

  const baseQuery = vctx.sql.db
    .select({
      refHost: t.refererEvents.refHost,
      refPath: t.refererEvents.refPath,
      reqPath: t.refererEvents.reqPath,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(t.refererEvents)
    .$dynamic();

  const filtered =
    reqPathFilter !== undefined
      ? baseQuery.where(and(ownedFilter, notLegacyVibeFilter, eq(t.refererEvents.reqPath, reqPathFilter)))
      : baseQuery.where(and(ownedFilter, notLegacyVibeFilter));

  const rows = await filtered
    .groupBy(t.refererEvents.refHost, t.refererEvents.refPath, t.refererEvents.reqPath)
    .orderBy(desc(sql`count(*)`))
    .limit(100);

  const legacyVibeRows =
    reqPathFilter === undefined
      ? await vctx.sql.db
          .select({
            reqPath: t.refererEvents.reqPath,
            total: sql<number>`cast(count(*) as int)`,
          })
          .from(t.refererEvents)
          .where(sql`${t.refererEvents.reqPath} ~ ${LEGACY_VIBE_PATH_RE}`)
          .groupBy(t.refererEvents.reqPath)
          .orderBy(desc(sql`count(*)`))
          .limit(200)
      : [];

  return {
    type: "vibes.diy.res-report-attribution-referrers",
    generatedAt: new Date().toISOString(),
    rows,
    legacyVibeRows,
  };
}

export const reportAttributionReferrersEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportAttributionReferrers>,
  ResReportAttributionReferrers | VibesDiyError
> = {
  hash: "vibes.diy.req-report-attribution-referrers",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportAttributionReferrers(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportAttributionReferrers>>,
        ResReportAttributionReferrers | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "attribution") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "not authorized for attribution report", code: "report-not-authorized" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const reqPathFilter = req.reqPath;
      const cacheKey =
        reqPathFilter !== undefined ? `attribution-referrers:${encodeURIComponent(reqPathFilter)}` : "attribution-referrers";
      const res = await cachedReport(vctx, cacheKey, resReportAttributionReferrers, () =>
        computeAttributionReferrers(vctx, reqPathFilter)
      );
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
