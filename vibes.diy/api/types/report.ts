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
