import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  ReqReportCampaignHealth,
  ResReportCampaignHealth,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportCampaignHealth,
  resReportCampaignHealth,
  ResReportCampaignHealthCampaignRow,
  ResReportCampaignHealthAnomalies,
  ResReportCampaignHealthPixelSummary,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq, gte, sql } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

const META_BASE = "https://graph.facebook.com/v19.0";

interface MetaInsightRow {
  readonly campaign_name: string;
  readonly campaign_id: string;
  readonly impressions: string;
  readonly clicks: string;
  readonly spend: string;
  readonly ctr: string;
  readonly cpc: string;
  readonly reach: string;
  readonly actions?: readonly { readonly action_type: string; readonly value: string }[];
}

async function metaGet<T>(path: string, token: string): Promise<Result<T>> {
  const sep = path.includes("?") ? "&" : "?";
  const rRes = await exception2Result(() =>
    fetch(`${META_BASE}${path}${sep}access_token=${token}`, { signal: AbortSignal.timeout(15_000) })
  );
  if (rRes.isErr()) return Result.Err(rRes.Err());
  const rJson = await exception2Result(() => rRes.Ok().json() as Promise<T & { error?: { message: string } }>);
  if (rJson.isErr()) return Result.Err(rJson.Err());
  const json = rJson.Ok();
  if (json.error !== undefined) return Result.Err(new Error(`Meta API: ${json.error.message}`));
  return Result.Ok(json as T);
}

function lpv(row: MetaInsightRow): number {
  return Number(row.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
}

function costPerLpv(row: MetaInsightRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

async function fetchGoodVibesClickThroughs(vctx: VibesApiSQLCtx, sinceIso: string): Promise<Record<string, number>> {
  const t = vctx.sql.tables;
  const rows = await vctx.sql.db
    .select({ refPath: t.refererEvents.refPath, total: sql<number>`cast(count(*) as int)` })
    .from(t.refererEvents)
    .where(and(eq(t.refererEvents.refHost, "good.vibes.diy"), gte(t.refererEvents.ts, sinceIso)))
    .groupBy(t.refererEvents.refPath);
  const byPath: Record<string, number> = {};
  for (const r of rows) byPath[r.refPath] = r.total;
  return byPath;
}

async function fetchCampaignDestinationUrls(token: string, account: string): Promise<Record<string, string>> {
  const rPage = await metaGet<{ data?: readonly { id: string; website_url?: string }[] }>(
    `/${account}/campaigns?fields=id,website_url&limit=200`,
    token
  );
  if (rPage.isErr()) return {};
  const byId: Record<string, string> = {};
  for (const c of rPage.Ok().data ?? []) {
    if (c.website_url !== undefined) byId[c.id] = c.website_url;
  }
  return byId;
}

async function fetchCampaignHealth(
  token: string,
  account: string,
  pixelId: string,
  days: string,
  since: string | undefined,
  vctx: VibesApiSQLCtx
): Promise<Result<ResReportCampaignHealth>> {
  console.log("fetch-campaign-health: start");
  const today = new Date().toISOString().slice(0, 10);
  const sinceIso = since ?? new Date(Date.now() - Number(days) * 86_400_000).toISOString().slice(0, 10);
  const dateParam = since
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since, until: today }))}`
    : `&date_preset=last_${days}d`;
  const dateLabel = since ? `since ${since}` : `last ${days} days`;

  // Fetch campaign destination URLs and referrer click-throughs in parallel with insights
  const [destUrlsResult, clicksByPath] = await Promise.all([
    fetchCampaignDestinationUrls(token, account),
    fetchGoodVibesClickThroughs(vctx, sinceIso),
  ]);
  console.log(
    "fetch-campaign-health: dest urls count:",
    Object.keys(destUrlsResult).length,
    "referrer paths:",
    Object.keys(clicksByPath).length
  );

  const fields = "campaign_name,campaign_id,impressions,clicks,spend,ctr,cpc,reach,actions";
  const rows: MetaInsightRow[] = [];
  let after: string | undefined = undefined;
  for (;;) {
    const cursor: string = after !== undefined ? `&after=${encodeURIComponent(after)}` : "";
    const rPage = await metaGet<{
      data?: MetaInsightRow[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`/${account}/insights?fields=${fields}&level=campaign&limit=100${dateParam}${cursor}`, token);
    if (rPage.isErr()) return Result.Err(rPage.Err());
    const page = rPage.Ok();
    rows.push(...(page.data ?? []));
    if (page.paging?.next === undefined) break;
    after = page.paging.cursors?.after;
    if (after === undefined) break;
  }
  console.log("fetch-campaign-health: campaigns done, count:", rows.length);

  const rPx = await metaGet<{
    last_fired_time?: string;
    stats?: { data?: readonly { data?: readonly { value: string; count: string }[] }[] };
  }>(`/${pixelId}?fields=name,last_fired_time,stats`, token);
  const pixel: ResReportCampaignHealthPixelSummary = rPx.isErr()
    ? { error: String(rPx.Err()) }
    : (() => {
        const px = rPx.Ok();
        const events = px.stats?.data?.flatMap((h) => h.data ?? []) ?? [];
        const sum: Record<string, number> = {};
        for (const e of events) {
          sum[e.value] = (sum[e.value] ?? 0) + Number(e.count);
        }
        return { lastFired: px.last_fired_time, counts: sum };
      })();

  const nameCounts: Record<string, number> = {};
  for (const r of rows) nameCounts[r.campaign_name] = (nameCounts[r.campaign_name] ?? 0) + 1;
  const duplicateNames = Object.entries(nameCounts)
    .filter(([, n]) => n > 1)
    .map(([name]) => name);

  const spends = rows.map((r) => Number(r.spend)).sort((a, b) => a - b);
  const medianSpend = spends[Math.floor(spends.length / 2)] ?? 0;

  const zeroSpend = rows.filter((r) => Number(r.spend) === 0).map((r) => r.campaign_name);
  const budgetOutliers = rows
    .filter((r) => Number(r.spend) > 0 && Number(r.spend) < medianSpend * 0.4)
    .map((r) => ({ name: r.campaign_name, spend: Number(r.spend).toFixed(2), medianSpend: medianSpend.toFixed(2) }));

  const lowLpvRatio = rows
    .filter((r) => Number(r.clicks) >= 5)
    .map((r) => ({ name: r.campaign_name, clicks: Number(r.clicks), lpvs: lpv(r), ratio: lpv(r) / Number(r.clicks) }))
    .filter((r) => r.ratio < 0.6 && r.clicks > 0);

  const ranked: ResReportCampaignHealthCampaignRow[] = [...rows]
    .sort((a, b) => costPerLpv(a) - costPerLpv(b))
    .map((r) => {
      const websiteUrl = destUrlsResult[r.campaign_id];
      let landingPath: string | undefined;
      if (websiteUrl !== undefined) {
        try {
          const u = new URL(websiteUrl);
          if (u.hostname === "good.vibes.diy") {
            landingPath = u.pathname.replace(/\/$/, "") || "/";
          }
        } catch {
          // malformed URL — skip
        }
      }
      const ctaClicks = landingPath !== undefined ? (clicksByPath[landingPath] ?? 0) : undefined;
      return { ...r, actions: r.actions?.map((a) => ({ ...a })), landingPath, ctaClicks };
    });

  console.log("fetch-campaign-health: pixel done");
  const anomalies: ResReportCampaignHealthAnomalies = { duplicateNames, budgetOutliers, zeroSpend, lowLpvRatio, pixel };

  return Result.Ok({
    type: "vibes.diy.res-report-campaign-health",
    generatedAt: new Date().toISOString(),
    dateLabel,
    ranked,
    anomalies,
  } satisfies ResReportCampaignHealth);
}

export const reportCampaignHealthEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportCampaignHealth>,
  ResReportCampaignHealth | VibesDiyError
> = {
  hash: "vibes.diy.req-report-campaign-health",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportCampaignHealth(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportCampaignHealth>>,
        ResReportCampaignHealth | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      console.log("campaign-health: handler entered");
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "campaign-health") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "not authorized for campaign-health report", code: "report-not-authorized" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      console.log("campaign-health: auth ok");
      const token = vctx.metaAccessToken;
      const account = vctx.metaAdAccountId;
      const pixelId = vctx.metaPixelId;

      if (token === undefined || account === undefined || pixelId === undefined) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: {
            message: "Meta API credentials not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PIXEL_ID)",
            code: "meta-creds-missing",
          },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const days = req.days ?? "7";
      const since = req.since;
      const cacheKey = since ? `campaign-health:since:${since}` : `campaign-health:days:${days}`;

      console.log("campaign-health: creds ok, calling cachedReport");
      const rRes = await exception2Result(() =>
        cachedReport(vctx, cacheKey, resReportCampaignHealth, async () => {
          const r = await fetchCampaignHealth(token, account, pixelId, days, since, vctx);
          if (r.isErr()) throw r.Err();
          return r.Ok();
        })
      );
      console.log("campaign-health: cachedReport returned", rRes.isErr() ? "err" : "ok");
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Meta API error: ${String(rRes.Err())}`, code: "meta-api-error" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      console.log("campaign-health: calling send");
      await ctx.send.send(ctx, rRes.Ok());
      console.log("campaign-health: send complete");
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
