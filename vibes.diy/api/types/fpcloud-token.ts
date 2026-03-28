import { type } from "arktype";
import { dashAuthType, FPCloudClaim } from "./common.js";

export const ReqFPCloudToken = type({
  type: "'vibes.diy.req-fpcloud-token'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
});

export type ReqFPCloudToken = typeof ReqFPCloudToken.infer;

export function isReqFPCloudToken(obj: unknown): obj is ReqFPCloudToken {
  return !(ReqFPCloudToken(obj) instanceof type.errors);
}

export const ResFPCloudTokenNoGrant = type({
  type: "'vibes.diy.res-fpcloud-token'",
  grant: "'no-grant'",
});

export type ResFPCloudTokenNoGrant = typeof ResFPCloudTokenNoGrant.infer;

export function isResFPCloudTokenNoGrant(obj: unknown): obj is ResFPCloudTokenNoGrant {
  return !(ResFPCloudTokenNoGrant(obj) instanceof type.errors);
}

export const Token = type({
  expiresInSec: "number",
  token: "string",
  claims: FPCloudClaim,
});
export type Token = typeof Token.infer;

export const ResFPCloudTokenGrant = type({
  type: "'vibes.diy.res-fpcloud-token'",
  grant: "'public' | 'owner' | 'request-editor' | 'request-viewer' | 'invite-editor' | 'invite-viewer'",
  token: Token,
  fpCloudUrl: "string",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  ledger: "string",
  tenant: "string",
});
export type ResFPCloudTokenGrant = typeof ResFPCloudTokenGrant.infer;

export function isResFPCloudTokenGrant(obj: unknown): obj is ResFPCloudTokenGrant {
  return !(ResFPCloudTokenGrant(obj) instanceof type.errors);
}

export const ResFPCloudToken = ResFPCloudTokenGrant.or(ResFPCloudTokenNoGrant);

export type ResFPCloudToken = typeof ResFPCloudToken.infer;

export function isResFPCloudToken(obj: unknown): obj is ResFPCloudToken {
  return !(ResFPCloudToken(obj) instanceof type.errors);
}
