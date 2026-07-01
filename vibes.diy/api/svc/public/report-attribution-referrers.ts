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
import { sql, desc, eq, notInArray, and, like, notLike, not, gte, type SQL, type AnyColumn } from "drizzle-orm";
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

// Legacy vibe paths are the owner-only `/vibe/<segment>` form (no app slug),
// i.e. the POSIX-regex `^/vibe/[^/]+$`. Expressed with portable LIKE operators
// so it runs on both Postgres (prod) and the SQLite test DB — Postgres `~`/`!~`
// are not valid on SQLite. `/vibe/_%` requires at least one char after the
// slash; `NOT LIKE /vibe/%/%` rejects any further path segment.
function legacyVibePath(reqPath: AnyColumn): SQL {
  // both operands are always present, so `and` never returns undefined here
  return and(like(reqPath, "/vibe/_%"), notLike(reqPath, "/vibe/%/%")) as SQL;
}

// "7d" aggregates only events from the last seven days; "all" (default) is
// all-time. `ts` is stored as an ISO-8601 UTC string (`Date.toISOString()`),
// so a lexicographic `>=` against a cutoff ISO string is a correct range
// filter — no cast needed, and it runs on both Postgres and the SQLite test DB.
function windowStartFilter(tsColumn: AnyColumn, window: "all" | "7d"): SQL | undefined {
  if (window !== "7d") return undefined;
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return gte(tsColumn, new Date(cutoffMs).toISOString());
}

async function computeAttributionReferrers(
  vctx: VibesApiSQLCtx,
  reqPathFilter?: string,
  window: "all" | "7d" = "all"
): Promise<ResReportAttributionReferrers> {
  const t = vctx.sql.tables;

  const ownedFilter = notInArray(t.refererEvents.refHost, OWNED_HOSTS);
  const notLegacyVibeFilter = not(legacyVibePath(t.refererEvents.reqPath));
  const windowFilter = windowStartFilter(t.refererEvents.ts, window);

  const baseQuery = vctx.sql.db
    .select({
      refHost: t.refererEvents.refHost,
      refPath: t.refererEvents.refPath,
      reqPath: t.refererEvents.reqPath,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(t.refererEvents)
    .$dynamic();

  // `and` ignores undefined operands, so an "all"-time query simply omits the
  // window filter.
  const filtered =
    reqPathFilter !== undefined
      ? baseQuery.where(and(ownedFilter, notLegacyVibeFilter, windowFilter, eq(t.refererEvents.reqPath, reqPathFilter)))
      : baseQuery.where(and(ownedFilter, notLegacyVibeFilter, windowFilter));

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
          .where(and(legacyVibePath(t.refererEvents.reqPath), windowFilter))
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
      const window = req.window ?? "all";
      const cacheKeyBase =
        reqPathFilter !== undefined ? `attribution-referrers:${encodeURIComponent(reqPathFilter)}` : "attribution-referrers";
      // Fold the window into the cache key so "all" and "7d" don't collide.
      const cacheKey = `${cacheKeyBase}:${window}`;
      const res = await cachedReport(vctx, cacheKey, resReportAttributionReferrers, () =>
        computeAttributionReferrers(vctx, reqPathFilter, window)
      );
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
