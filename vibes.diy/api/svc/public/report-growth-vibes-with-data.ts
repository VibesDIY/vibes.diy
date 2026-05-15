import { EventoHandler, ValidateTriggerCtx, Result, HandleTriggerCtx, EventoResultType, Option, URI } from "@adviser/cement";
import { HttpResponseJsonType } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { authReport, extractBearer, last30DaysUTC, reportStop } from "./report-helpers.js";

interface ReportValidated {
  readonly bearer: string;
}

const REPORT_PATH = "/reports/growth/vibes-with-data";

async function handleReport(vctx: VibesApiSQLCtx): Promise<{
  generatedAt: string;
  total: number;
  days: { day: string; vibes: number }[];
}> {
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
    generatedAt: new Date().toISOString(),
    total: createdSorted.length,
    days: result,
  };
}

export const reportGrowthVibesWithData: EventoHandler<Request, ReportValidated, unknown> = {
  hash: "report-growth-vibes-with-data",
  validate: (ctx: ValidateTriggerCtx<Request, ReportValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "GET") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== REPORT_PATH) return Promise.resolve(Result.Ok(Option.None()));
    return Promise.resolve(Result.Ok(Option.Some({ bearer: extractBearer(req) ?? "" })));
  },
  handle: async (ctx: HandleTriggerCtx<Request, ReportValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const verified = await authReport(ctx, vctx, ctx.validated.bearer, "growth");
    if (!verified) return reportStop();

    const data = await handleReport(vctx);
    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 200,
      json: { type: "vibes.diy.res-report-growth-vibes-with-data", ...data },
    } satisfies HttpResponseJsonType);
    return reportStop();
  },
};
