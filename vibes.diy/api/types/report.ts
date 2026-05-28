import { type } from "arktype";
import { dashAuthType } from "./common.js";

// Memberships Over 30 Days — daily cumulative count of distinct
// (member, owner-slug, app-slug) tuples from approved RequestGrants and
// accepted InviteGrants, deduped across the two grant paths.
export const reqReportGrowthMemberships = type({
  type: "'vibes.diy.req-report-growth-memberships'",
  auth: dashAuthType,
});
export type ReqReportGrowthMemberships = typeof reqReportGrowthMemberships.infer;
export function isReqReportGrowthMemberships(obj: unknown): obj is ReqReportGrowthMemberships {
  return !(reqReportGrowthMemberships(obj) instanceof type.errors);
}

export const resReportGrowthMembershipsDay = type({
  day: "string",
  memberships: "number",
  newMembers: "string[]",
});
export type ResReportGrowthMembershipsDay = typeof resReportGrowthMembershipsDay.infer;

export const resReportGrowthMemberships = type({
  type: "'vibes.diy.res-report-growth-memberships'",
  generatedAt: "string",
  total: "number",
  days: resReportGrowthMembershipsDay.array(),
});
export type ResReportGrowthMemberships = typeof resReportGrowthMemberships.infer;
export function isResReportGrowthMemberships(obj: unknown): obj is ResReportGrowthMemberships {
  return !(resReportGrowthMemberships(obj) instanceof type.errors);
}

// Vibes With Data — daily cumulative count of distinct (userSlug, appSlug)
// pairs in AppSlugBindings (PK already enforces distinctness per row).
export const reqReportGrowthVibesWithData = type({
  type: "'vibes.diy.req-report-growth-vibes-with-data'",
  auth: dashAuthType,
});
export type ReqReportGrowthVibesWithData = typeof reqReportGrowthVibesWithData.infer;
export function isReqReportGrowthVibesWithData(obj: unknown): obj is ReqReportGrowthVibesWithData {
  return !(reqReportGrowthVibesWithData(obj) instanceof type.errors);
}

export const resReportGrowthVibesWithDataDay = type({
  day: "string",
  vibes: "number",
});
export type ResReportGrowthVibesWithDataDay = typeof resReportGrowthVibesWithDataDay.infer;

export const resReportGrowthVibesWithData = type({
  type: "'vibes.diy.res-report-growth-vibes-with-data'",
  generatedAt: "string",
  total: "number",
  days: resReportGrowthVibesWithDataDay.array(),
});
export type ResReportGrowthVibesWithData = typeof resReportGrowthVibesWithData.infer;
export function isResReportGrowthVibesWithData(obj: unknown): obj is ResReportGrowthVibesWithData {
  return !(resReportGrowthVibesWithData(obj) instanceof type.errors);
}

// Active Members — daily non-cumulative count of distinct non-owner members who
// wrote to any vibe that day (based on AppDocuments writes cross-referenced with
// active grants).
export const reqReportActiveMembers = type({
  type: "'vibes.diy.req-report-active-members'",
  auth: dashAuthType,
});
export type ReqReportActiveMembers = typeof reqReportActiveMembers.infer;
export function isReqReportActiveMembers(obj: unknown): obj is ReqReportActiveMembers {
  return !(reqReportActiveMembers(obj) instanceof type.errors);
}

export const resReportActiveMembersDay = type({
  day: "string",
  count: "number",
});
export type ResReportActiveMembersDay = typeof resReportActiveMembersDay.infer;

export const resReportActiveMembers = type({
  type: "'vibes.diy.res-report-active-members'",
  generatedAt: "string",
  days: resReportActiveMembersDay.array(),
});
export type ResReportActiveMembers = typeof resReportActiveMembers.infer;
export function isResReportActiveMembers(obj: unknown): obj is ResReportActiveMembers {
  return !(resReportActiveMembers(obj) instanceof type.errors);
}

// Top Vibes by Members — all-time leaderboard of vibes ranked by distinct member
// count (deduped across RequestGrants and InviteGrants).
export const reqReportTopVibesByMembers = type({
  type: "'vibes.diy.req-report-top-vibes-by-members'",
  auth: dashAuthType,
});
export type ReqReportTopVibesByMembers = typeof reqReportTopVibesByMembers.infer;
export function isReqReportTopVibesByMembers(obj: unknown): obj is ReqReportTopVibesByMembers {
  return !(reqReportTopVibesByMembers(obj) instanceof type.errors);
}

export const resReportTopVibesByMembersRow = type({
  userSlug: "string",
  appSlug: "string",
  memberCount: "number",
});
export type ResReportTopVibesByMembersRow = typeof resReportTopVibesByMembersRow.infer;

export const resReportTopVibesByMembers = type({
  type: "'vibes.diy.res-report-top-vibes-by-members'",
  generatedAt: "string",
  rows: resReportTopVibesByMembersRow.array(),
});
export type ResReportTopVibesByMembers = typeof resReportTopVibesByMembers.infer;
export function isResReportTopVibesByMembers(obj: unknown): obj is ResReportTopVibesByMembers {
  return !(resReportTopVibesByMembers(obj) instanceof type.errors);
}

// Attribution — referrer hostname + path ranked by traffic, with conversion count.
// Populated from RefererEvents written by the logpush-etl cron worker.
export const reqReportAttributionReferrers = type({
  type: "'vibes.diy.req-report-attribution-referrers'",
  auth: dashAuthType,
  "reqPath?": "string",
});
export type ReqReportAttributionReferrers = typeof reqReportAttributionReferrers.infer;
export function isReqReportAttributionReferrers(obj: unknown): obj is ReqReportAttributionReferrers {
  return !(reqReportAttributionReferrers(obj) instanceof type.errors);
}

export const resReportAttributionReferrersRow = type({
  refHost: "string",
  refPath: "string",
  reqPath: "string",
  total: "number",
});
export type ResReportAttributionReferrersRow = typeof resReportAttributionReferrersRow.infer;

export const resReportAttributionReferrersLegacyRow = type({
  reqPath: "string",
  total: "number",
});
export type ResReportAttributionReferrersLegacyRow = typeof resReportAttributionReferrersLegacyRow.infer;

export const resReportAttributionReferrers = type({
  type: "'vibes.diy.res-report-attribution-referrers'",
  generatedAt: "string",
  rows: resReportAttributionReferrersRow.array(),
  legacyVibeRows: resReportAttributionReferrersLegacyRow.array(),
});
export type ResReportAttributionReferrers = typeof resReportAttributionReferrers.infer;
export function isResReportAttributionReferrers(obj: unknown): obj is ResReportAttributionReferrers {
  return !(resReportAttributionReferrers(obj) instanceof type.errors);
}

// Campaign Health — Meta Ads campaign performance and pixel health.
// Data is fetched server-side from the Meta Graph API; the WS handler
// returns structured JSON so the SPA can render with the brand palette.

export const resReportCampaignHealthCampaignRow = type({
  campaign_name: "string",
  campaign_id: "string",
  impressions: "string",
  clicks: "string",
  spend: "string",
  "ctr?": "string",
  "cpc?": "string",
  "reach?": "string",
  "actions?": type({ action_type: "string", value: "string" }).array(),
  // Meta API always returns these date range fields on insight rows
  "date_start?": "string",
  "date_stop?": "string",
  // good.vibes.diy → vibes.diy click-throughs from RefererEvents (date-scoped to report window)
  "ctaClicks?": "number",
  // good.vibes.diy path this campaign links to (extracted from destination URL)
  "landingPath?": "string",
  // Meta effective_status: ACTIVE, PAUSED, DELETED, ARCHIVED, etc.
  "effective_status?": "string",
});
export type ResReportCampaignHealthCampaignRow = typeof resReportCampaignHealthCampaignRow.infer;

export const resReportCampaignHealthPixelSummary = type({
  "lastFired?": "string",
  "counts?": type({ "[string]": "number" }),
  "error?": "string",
});
export type ResReportCampaignHealthPixelSummary = typeof resReportCampaignHealthPixelSummary.infer;

export const resReportCampaignHealthBudgetOutlier = type({
  name: "string",
  spend: "string",
  medianSpend: "string",
});
export type ResReportCampaignHealthBudgetOutlier = typeof resReportCampaignHealthBudgetOutlier.infer;

export const resReportCampaignHealthLowLpvEntry = type({
  name: "string",
  clicks: "number",
  lpvs: "number",
  ratio: "number",
});
export type ResReportCampaignHealthLowLpvEntry = typeof resReportCampaignHealthLowLpvEntry.infer;

export const resReportCampaignHealthAnomalies = type({
  duplicateNames: "string[]",
  budgetOutliers: resReportCampaignHealthBudgetOutlier.array(),
  zeroSpend: "string[]",
  lowLpvRatio: resReportCampaignHealthLowLpvEntry.array(),
  pixel: resReportCampaignHealthPixelSummary.or("null"),
});
export type ResReportCampaignHealthAnomalies = typeof resReportCampaignHealthAnomalies.infer;

export const reqReportCampaignHealth = type({
  type: "'vibes.diy.req-report-campaign-health'",
  auth: dashAuthType,
  "days?": "string",
  "since?": "string",
});
export type ReqReportCampaignHealth = typeof reqReportCampaignHealth.infer;
export function isReqReportCampaignHealth(obj: unknown): obj is ReqReportCampaignHealth {
  return !(reqReportCampaignHealth(obj) instanceof type.errors);
}

export const resReportCampaignHealth = type({
  type: "'vibes.diy.res-report-campaign-health'",
  generatedAt: "string",
  dateLabel: "string",
  ranked: resReportCampaignHealthCampaignRow.array(),
  anomalies: resReportCampaignHealthAnomalies,
});
export type ResReportCampaignHealth = typeof resReportCampaignHealth.infer;
export function isResReportCampaignHealth(obj: unknown): obj is ResReportCampaignHealth {
  const result = resReportCampaignHealth(obj);
  if (result instanceof type.errors) {
    console.log("[isResReportCampaignHealth] validation FAILED:", result.summary);
    return false;
  }
  return true;
}
