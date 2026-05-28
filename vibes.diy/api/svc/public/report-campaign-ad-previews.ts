import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  ReqReportCampaignAdPreviews,
  ResReportCampaignAdPreviews,
  ResReportCampaignAdPreviewsAd,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportCampaignAdPreviews,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { hasReport } from "./report-cache.js";

const META_BASE = "https://graph.facebook.com/v19.0";
const DEFAULT_FORMAT = "MOBILE_FEED_STANDARD";

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

async function fetchAdPreviews(token: string, campaignId: string, format: string): Promise<ResReportCampaignAdPreviews> {
  const rAds = await metaGet<{ data?: readonly { id: string; name: string; effective_status: string }[] }>(
    `/${campaignId}/ads?fields=id,name,effective_status&limit=50`,
    token
  );

  if (rAds.isErr()) {
    return { type: "vibes.diy.res-report-campaign-ad-previews", campaign_id: campaignId, ads: [] };
  }

  const adList = rAds.Ok().data ?? [];

  const ads: ResReportCampaignAdPreviewsAd[] = await Promise.all(
    adList.map(async (ad) => {
      const rPreview = await metaGet<{ data?: readonly { body?: string }[] }>(`/${ad.id}/previews?ad_format=${format}`, token);
      if (rPreview.isErr()) {
        return { id: ad.id, name: ad.name, effective_status: ad.effective_status, error: rPreview.Err().message };
      }
      const iframe = rPreview.Ok().data?.[0]?.body;
      const srcMatch = iframe?.match(/src="([^"]+)"/);
      const previewSrc = srcMatch ? srcMatch[1].replace(/&amp;/g, "&") : undefined;
      return { id: ad.id, name: ad.name, effective_status: ad.effective_status, previewSrc };
    })
  );

  return { type: "vibes.diy.res-report-campaign-ad-previews", campaign_id: campaignId, ads };
}

export const reportCampaignAdPreviewsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportCampaignAdPreviews>,
  ResReportCampaignAdPreviews | VibesDiyError
> = {
  hash: "vibes.diy.req-report-campaign-ad-previews",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportCampaignAdPreviews(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportCampaignAdPreviews>>,
        ResReportCampaignAdPreviews | VibesDiyError
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

      if (token === undefined || account === undefined) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Meta API credentials not configured", code: "meta-creds-missing" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const format = req.format ?? DEFAULT_FORMAT;
      const rRes = await exception2Result(() => fetchAdPreviews(token, req.campaign_id, format));

      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Meta API error: ${String(rRes.Err())}`, code: "meta-api-error" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, rRes.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
