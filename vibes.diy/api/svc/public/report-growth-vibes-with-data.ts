import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportGrowthVibesWithData,
  ResReportGrowthVibesWithData,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportGrowthVibesWithData,
  resReportGrowthVibesWithData,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

function last30DaysUTC(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function computeVibesWithData(vctx: VibesApiSQLCtx): Promise<ResReportGrowthVibesWithData> {
  const t = vctx.sql.tables;
  // AppSlugBindings PK is (appSlug, userSlug), so each row is already a
  // distinct vibe. Cumulative count per day = rows where created <= dayEnd.
  const rows = await vctx.sql.db.select({ created: t.appSlugBinding.created }).from(t.appSlugBinding);

  const days = last30DaysUTC();
  const lastDay = days[days.length - 1];
  const dayEnd = `${lastDay}T23:59:59.999Z`;

  const createdSorted = rows
    .map((r) => r.created)
    .filter((c) => c <= dayEnd)
    .sort();

  const result: { day: string; vibes: number }[] = [];
  let idx = 0;
  for (const day of days) {
    const end = `${day}T23:59:59.999Z`;
    while (idx < createdSorted.length && createdSorted[idx] <= end) idx += 1;
    result.push({ day, vibes: idx });
  }

  return {
    type: "vibes.diy.res-report-growth-vibes-with-data",
    generatedAt: new Date().toISOString(),
    total: createdSorted.length,
    days: result,
  };
}

export const reportGrowthVibesWithDataEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportGrowthVibesWithData>,
  ResReportGrowthVibesWithData | VibesDiyError
> = {
  hash: "vibes.diy.req-report-growth-vibes-with-data",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportGrowthVibesWithData(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportGrowthVibesWithData>>,
        ResReportGrowthVibesWithData | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "growth") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "not authorized for growth report", code: "report-not-authorized" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const res = await cachedReport(vctx, "growth-vibes-with-data", resReportGrowthVibesWithData, () =>
        computeVibesWithData(vctx)
      );
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
