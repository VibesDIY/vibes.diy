import {
  EventoHandler,
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  EventoResultType,
  Option,
  EventoResult,
  URI,
} from "@adviser/cement";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { verifyAuth } from "../check-auth.js";
import { hasReport } from "../public/report-cache.js";
import { renderCampaignHealthReport, CampaignRow, CampaignAnomalies, PixelSummary } from "./campaign-health-template.jsx";

const META_BASE = "https://graph.facebook.com/v19.0";

interface MetaInsightRow {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  reach: string;
  actions?: { action_type: string; value: string }[];
}

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  error?: { message: string };
}

interface MetaPixelResponse {
  name?: string;
  last_fired_time?: string;
  stats?: { data?: { data?: { value: string; count: string }[] }[] };
  error?: { message: string };
}

async function metaGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${META_BASE}${path}${sep}access_token=${token}`);
  const json = (await res.json()) as T & { error?: { message: string } };
  if ((json as { error?: { message: string } }).error) {
    throw new Error(`Meta API: ${(json as { error: { message: string } }).error.message}`);
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
  since?: string
): Promise<{ ranked: CampaignRow[]; anomalies: CampaignAnomalies; dateLabel: string }> {
  const dateParam = since
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since, until: new Date().toISOString().slice(0, 10) }))}`
    : `&date_preset=last_${days}d`;
  const dateLabel = since ? `since ${since}` : `last ${days} days`;

  const fields = "campaign_name,campaign_id,impressions,clicks,spend,ctr,cpc,reach,actions";
  const insights = await metaGet<MetaInsightsResponse>(
    `/${account}/insights?fields=${fields}&level=campaign&limit=100${dateParam}`,
    token
  );
  const rows: MetaInsightRow[] = insights.data ?? [];

  // Pixel stats
  let pixel: PixelSummary | null;
  try {
    const px = await metaGet<MetaPixelResponse>(`/${pixelId}?fields=name,last_fired_time,stats`, token);
    const events = px.stats?.data?.flatMap((h) => h.data ?? []) ?? [];
    const sum: Record<string, number> = {};
    for (const e of events) {
      sum[e.value] = (sum[e.value] ?? 0) + Number(e.count);
    }
    pixel = { lastFired: px.last_fired_time, counts: sum };
  } catch (e) {
    pixel = { error: (e as Error).message };
  }

  // Anomaly detection
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
    .map((r) => ({
      name: r.campaign_name,
      spend: Number(r.spend).toFixed(2),
      medianSpend: medianSpend.toFixed(2),
    }));

  const lowLpvRatio = rows
    .filter((r) => Number(r.clicks) >= 5)
    .map((r) => ({
      name: r.campaign_name,
      clicks: Number(r.clicks),
      lpvs: lpv(r),
      ratio: lpv(r) / Number(r.clicks),
    }))
    .filter((r) => r.ratio < 0.6 && r.clicks > 0);

  const ranked = [...rows].sort((a, b) => costPerLpv(a) - costPerLpv(b)) as CampaignRow[];

  return {
    ranked,
    anomalies: { duplicateNames, budgetOutliers, zeroSpend, lowLpvRatio, pixel },
    dateLabel,
  };
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1].trim();
}

interface ValidatedCampaignHealth {
  readonly bearer: string;
  readonly days: string;
  readonly since: string | undefined;
}

export const campaignHealthReport: EventoHandler<Request, ValidatedCampaignHealth, unknown> = {
  hash: "campaign-health-report",
  validate: (ctx: ValidateTriggerCtx<Request, ValidatedCampaignHealth, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "GET") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== "/reports/campaign-health") return Promise.resolve(Result.Ok(Option.None()));
    const bearer = extractBearer(req) ?? "";
    const days = url.getParam("days") ?? "7";
    const since = url.getParam("since") ?? undefined;
    return Promise.resolve(Result.Ok(Option.Some({ bearer, days, since })));
  },
  handle: async (ctx: HandleTriggerCtx<Request, ValidatedCampaignHealth, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { bearer, days, since } = ctx.validated;

    if (!bearer) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 401,
        json: { type: "error", message: "Authorization: Bearer <token> required" },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    // Verify bearer token against all registered tokenApi types
    let verifiedClaims: { params?: { email?: string; public_meta?: unknown } } | undefined;
    for (const authType of Object.keys(vctx.tokenApi)) {
      const rAuth = await verifyAuth(vctx, { auth: { type: authType, token: bearer } as DashAuthType });
      if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
        verifiedClaims = rAuth.Ok().verifiedAuth.claims as { params?: { email?: string; public_meta?: unknown } };
        break;
      }
    }

    if (!verifiedClaims) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 401,
        json: { type: "error", message: "Invalid or expired bearer token" },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    if (!hasReport(verifiedClaims, "campaign-health")) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 403,
        json: { type: "error", message: "Not authorized for campaign-health report" },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    const token = vctx.metaAccessToken;
    const account = vctx.metaAdAccountId;
    const pixelId = vctx.metaPixelId;

    if (!token || !account || !pixelId) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 503,
        json: {
          type: "error",
          message: "Meta API credentials not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PIXEL_ID)",
        },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    let reportData: Awaited<ReturnType<typeof fetchCampaignHealth>>;
    try {
      reportData = await fetchCampaignHealth(token, account, pixelId, days, since);
    } catch (e) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 502,
        json: { type: "error", message: `Meta API error: ${(e as Error).message}` },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    const html = renderCampaignHealthReport({
      generatedAt: new Date().toISOString(),
      dateLabel: reportData.dateLabel,
      ranked: reportData.ranked,
      anomalies: reportData.anomalies,
    });

    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      body: html,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};
