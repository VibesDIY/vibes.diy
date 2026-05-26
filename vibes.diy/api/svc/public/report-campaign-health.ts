import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
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

async function metaGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${META_BASE}${path}${sep}access_token=${token}`);
  const json = (await res.json()) as T & { error?: { message: string } };
  if (json.error) {
    throw new Error(`Meta API: ${json.error.message}`);
  }
  return json;
}

function lpv(row: MetaInsightRow): number {
  return Number(row.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
}

function costPerLpv(row: MetaInsightRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

async function fetchCampaignHealth(
  token: string,
  account: string,
  pixelId: string,
  days: string,
  since: string | undefined
): Promise<ResReportCampaignHealth> {
  const dateParam = since
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since, until: new Date().toISOString().slice(0, 10) }))}`
    : `&date_preset=last_${days}d`;
  const dateLabel = since ? `since ${since}` : `last ${days} days`;

  const fields = "campaign_name,campaign_id,impressions,clicks,spend,ctr,cpc,reach,actions";
  const rows: MetaInsightRow[] = [];
  let after: string | undefined = undefined;
  for (;;) {
    const cursor = after !== undefined ? `&after=${encodeURIComponent(after)}` : "";
    const page = await metaGet<{
      data?: MetaInsightRow[];
      paging?: { cursors?: { after?: string }; next?: string };
      error?: { message: string };
    }>(`/${account}/insights?fields=${fields}&level=campaign&limit=100${dateParam}${cursor}`, token);
    rows.push(...(page.data ?? []));
    if (page.paging?.next === undefined) break;
    after = page.paging.cursors?.after;
    if (after === undefined) break;
  }

  const pixel: ResReportCampaignHealthPixelSummary = await (async () => {
    try {
      const px = await metaGet<{
        last_fired_time?: string;
        stats?: { data?: readonly { data?: readonly { value: string; count: string }[] }[] };
        error?: { message: string };
      }>(`/${pixelId}?fields=name,last_fired_time,stats`, token);
      const events = px.stats?.data?.flatMap((h) => h.data ?? []) ?? [];
      const sum: Record<string, number> = {};
      for (const e of events) {
        sum[e.value] = (sum[e.value] ?? 0) + Number(e.count);
      }
      return { lastFired: px.last_fired_time, counts: sum };
    } catch (e) {
      return { error: (e as Error).message };
    }
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
    .map((r) => ({ ...r, actions: r.actions?.map((a) => ({ ...a })) }));

  const anomalies: ResReportCampaignHealthAnomalies = { duplicateNames, budgetOutliers, zeroSpend, lowLpvRatio, pixel };

  return {
    type: "vibes.diy.res-report-campaign-health",
    generatedAt: new Date().toISOString(),
    dateLabel,
    ranked,
    anomalies,
  } satisfies ResReportCampaignHealth;
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
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "campaign-health") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "not authorized for campaign-health report", code: "report-not-authorized" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const token = vctx.metaAccessToken;
      const account = vctx.metaAdAccountId;
      const pixelId = vctx.metaPixelId;

      if (!token || !account || !pixelId) {
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

      let res: ResReportCampaignHealth;
      try {
        res = await cachedReport(vctx, cacheKey, resReportCampaignHealth, () =>
          fetchCampaignHealth(token, account, pixelId, days, since)
        );
      } catch (e) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Meta API error: ${(e as Error).message}`, code: "meta-api-error" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
