import { type } from "arktype";
import { dashAuthType } from "./common.js";

// `_files` upload protocol — see notes/storage-assets-post.md.
//
// Two-step flow:
//   1. WS: ReqAssetUploadGrant → ResAssetUploadGrant (mints a short-lived
//      signed grant for HTTP upload).
//   2. HTTP POST <uploadUrl> with X-Asset-Grant header → ResPutAsset
//      (streams bytes, INSERTs an AssetUploads audit row, returns CID).

export const ReqAssetUploadGrant = type({
  type: "'vibes.diy.req-asset-upload-grant'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  "mimeType?": "string",
});
export type ReqAssetUploadGrant = typeof ReqAssetUploadGrant.infer;
export function isReqAssetUploadGrant(obj: unknown): obj is ReqAssetUploadGrant {
  return !(ReqAssetUploadGrant(obj) instanceof type.errors);
}

export const ResAssetUploadGrant = type({
  type: "'vibes.diy.res-asset-upload-grant'",
  uploadUrl: "string",
  grant: "string",
  expiresAt: "string",
  uploadId: "string",
});
export type ResAssetUploadGrant = typeof ResAssetUploadGrant.infer;
export function isResAssetUploadGrant(obj: unknown): obj is ResAssetUploadGrant {
  return !(ResAssetUploadGrant(obj) instanceof type.errors);
}

export const ResPutAsset = type({
  type: "'vibes.diy.res-put-asset'",
  cid: "string",
  getURL: "string",
  size: "number",
  uploadId: "string",
});
export type ResPutAsset = typeof ResPutAsset.infer;
export function isResPutAsset(obj: unknown): obj is ResPutAsset {
  return !(ResPutAsset(obj) instanceof type.errors);
}

// Claims encoded inside the JWT grant. iat/exp are seconds since epoch
// (jose convention); jti is the uploadId surfaced to the client.
export const AssetGrantClaims = type({
  jti: "string",
  userId: "string",
  userSlug: "string",
  appSlug: "string",
  iat: "number",
  exp: "number",
  "mimeType?": "string",
});
export type AssetGrantClaims = typeof AssetGrantClaims.infer;
export function isAssetGrantClaims(obj: unknown): obj is AssetGrantClaims {
  return !(AssetGrantClaims(obj) instanceof type.errors);
}
