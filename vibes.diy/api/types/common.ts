// Should be compatible with FP Dashboard's auth types
import { Result } from "@adviser/cement";
import { type } from "arktype";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { CoercedDate } from "@vibes.diy/call-ai-v2";

export const ClerkClaimParams = type({
  "nick?": "string",
  email: "string",
  email_verified: "boolean",
  "external_id?": "string | null",
  first: "string",
  image_url: "string",
  last: "string",
  name: "string | null",
  public_meta: "unknown",
});

export type ClerkClaimParams = typeof ClerkClaimParams.infer;

export const ClerkClaim = type({
  "azp?": "string",
  "exp?": "number",
  "iat?": "number",
  "iss?": "string",
  "jti?": "string",
  "nbf?": "number",
  params: ClerkClaimParams,
  role: "string",
  sub: "string",
  userId: "string",
  "aud?": "string | string[]",
  "app_metadata?": "unknown",
});
export type ClerkClaim = typeof ClerkClaim.infer;

export const FPCloudClaim = type({
  "azp?": "string",
  "iss?": "string",
  "sub?": "string",
  "aud?": "string | string[]",
  "exp?": "number",
  "nbf?": "number",
  "iat?": "number",
  "jti?": "string",
  userId: "string",
  email: "string.email",
  "nickname?": "string",
  "provider?": "'github' | 'google'",
  created: CoercedDate,
  tenants: type({
    id: "string",
    role: "'admin' | 'member' | 'owner'",
  }).array(),
  ledgers: type({
    id: "string",
    role: "'admin' | 'member' | 'owner'",
    right: "'read' | 'write'",
  }).array(),
  selected: {
    "appId?": "string",
    tenant: "string",
    ledger: "string",
  },
});
export type FPCloudClaim = typeof FPCloudClaim.infer;

// Runtime validator — must stay compatible with DashAuthType from @fireproof/core-types-protocols-dashboard
export const dashAuthType = type({
  type: "'clerk'|'device-id'|'ucan'",
  token: "string",
}) satisfies { infer: DashAuthType };

export const vibeUserEnv = type("Record<string, string>");

// Base file properties - used for composition
const baseFileProps = type({
  // including path within the filesystem - absolute from root, no .. or .
  // must start with / and not contain .. or relative path segments
  filename: type("string").narrow((s) => {
    // Must start with /
    if (!s.startsWith("/")) return false;
    // Must not contain //
    if (s.includes("//")) return false;
    // Must not contain ..
    if (s.includes("/../")) return false;
    // Must not contain /./
    if (s.includes("/./")) return false;
    return true;
  }),
  "entryPoint?": "boolean" as const, // last wins should only set once per filesystem
  "mimetype?": "string" as const, // derived from filename if not set
});

// Code types
export const VibeCodeBlock = type({
  type: "'code-block'",
  // currently supported languages
  lang: "string", // "'jsx'|'js'",
  // the actual code content
  content: "string",
}).and(baseFileProps);

export type VibeCodeBlock = typeof VibeCodeBlock.infer;

export function isVibeCodeBlock(obj: unknown): obj is VibeCodeBlock {
  return !(VibeCodeBlock(obj) instanceof type.errors);
}

export const VibeCodeRef = type({
  type: "'code-ref'",
  // reference id to code stored elsewhere
  // if call-ai will store the result somewhere
  refId: "string",
}).and(baseFileProps);

// Asset types - string content
export const VibeStrAssetBlock = type({
  type: "'str-asset-block'",
  // the actual asset content as string
  content: "string",
}).and(baseFileProps);

export const VibeStrAssetRef = type({
  type: "'str-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
}).and(baseFileProps);

// Asset types - binary content
export const VibeUint8AssetBlock = type({
  type: "'uint8-asset-block'",
  // the actual asset content as binary
  content: type.instanceOf(Uint8Array),
}).and(baseFileProps);

export const VibeUint8AssetRef = type({
  type: "'uint8-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
}).and(baseFileProps);

// Union of all file types
export const vibeFile = type(
  VibeCodeBlock.or(VibeCodeRef).or(VibeStrAssetBlock).or(VibeStrAssetRef).or(VibeUint8AssetBlock).or(VibeUint8AssetRef)
);

export type VibeFile = typeof vibeFile.infer;

// Error types
export const resError = type({
  type: "'vibes.diy.error'|'vibes.diy.res-error'",
  "message?": "string",
  "code?": "string",
  "stack?": "string[]",
  "error?": type({ message: "string", "code?": "string" }),
});

export type ResError = typeof resError.infer;

export function isResError(obj: unknown): obj is ResError {
  return !(resError(obj) instanceof type.errors);
}

// ID types
export type CodeID = string;
export type EnvID = string;

export const FSMode = type("'production'|'dev'");

export const AppSlugUserSlug = type({
  appSlug: "string", // desired app slug
  userSlug: "string", // desired user slug
});
export type AppSlugUserSlug = typeof AppSlugUserSlug.infer;

export const OptAppSlugUserSlug = type({
  "appSlug?": "string", // desired app slug
  userSlug: "string", // desired user slug
});
export type OptAppSlugUserSlug = typeof OptAppSlugUserSlug.infer;

export const AppSlugOptUserSlug = type({
  appSlug: "string", // desired app slug
  "userSlug?": "string", // desired user slug
});
export type AppSlugOptUserSlug = typeof AppSlugOptUserSlug.infer;

export const OptAppSlugOptUserSlug = type({
  "appSlug?": "string", // desired app slug
  "userSlug?": "string", // desired user slug
});
export type OptAppSlugOptUserSlug = typeof OptAppSlugOptUserSlug.infer;

export const NeedOneAppSlugUserSlug = AppSlugUserSlug.or(OptAppSlugUserSlug).or(AppSlugOptUserSlug).or(OptAppSlugOptUserSlug);

export type NeedOneAppSlugUserSlug = typeof NeedOneAppSlugUserSlug.infer;

export const msgBase = type({
  tid: "string",
  src: "string",
  dst: "string",
  ttl: "number",
  payload: "unknown",
});

export type msgBaseType = typeof msgBase.infer;

export function isMsgBase(obj: unknown): obj is msgBaseType {
  return !(msgBase(obj) instanceof type.errors);
}

export interface MsgBase<T = unknown> extends Omit<msgBaseType, "payload"> {
  payload: T;
}

export interface InMsgBase<T> {
  readonly tid: string;
  readonly src?: string;
  readonly dst?: string;
  readonly ttl?: number;
  readonly payload: T;
}

export interface MsgBox<T = unknown> extends Omit<MsgBase, "payload"> {
  payload: T;
}

export type MsgBaseCfg = Pick<MsgBase, "src" | "dst" | "ttl">;
export type MsgBaseParam = Partial<MsgBaseCfg>;

export type VibesDiyError = ResError & Error;

export type ResultVibesDiy<T> = Result<T, VibesDiyError>;

export const w3cMessageEventBox = type({
  type: "'MessageEvent'",
  event: type({
    data: "unknown",
    origin: "string|null",
    lastEventId: "string",
    source: "unknown",
    ports: "unknown",
  }).partial(),
});

export const w3cCloseEventBox = type({
  type: "'CloseEvent'",
  event: type({
    wasClean: "boolean",
    code: "number",
    reason: "string",
  }),
});

export const w3cErrorEventBox = type({
  type: "'ErrorEvent'",
  event: type({
    message: "string",
    filename: "string",
    lineno: "number",
    colno: "number",
    error: "unknown",
  }).partial(),
});

export const w3CWebSocketEvent = w3cMessageEventBox.or(w3cCloseEventBox).or(w3cErrorEventBox);
export type W3CWebSocketEvent = typeof w3CWebSocketEvent.infer;
export type W3CWebSocketErrorEvent = typeof w3cErrorEventBox.infer;
export type W3CWebSocketMessageEvent = typeof w3cMessageEventBox.infer;
export type W3CWebSocketCloseEvent = typeof w3cCloseEventBox.infer;

export const Pager = type({
  "limit?": "number",
  "cursor?": "string", // ISO timestamp cursor for next page (exclusive)
});
export type Pager = typeof Pager.infer;

export const ForeignInfo = type({ "givenEmail?": "string", "claims?": ClerkClaim });
export type ForeignInfo = typeof ForeignInfo.infer;
/** @deprecated use ForeignInfo */
export const InviteForeignInfo = ForeignInfo;
export type InviteForeignInfo = ForeignInfo;

// shared identity for all key-grant messages (used by invite-flow and request-access)
export const GrantListBase = type({
  appSlug: "string",
  userSlug: "string",
  auth: dashAuthType,
  pager: Pager,
});

export const Role = type("'editor' | 'viewer' | 'submitter'");
export type Role = typeof Role.infer;

/**
 * Run each item through a validator, returning one Result per item.
 * Valid items become Result.Ok(T), invalid items become Result.Err(string).
 */
export function parseArrayResult<T extends type>(items: unknown, match: T): Result<T["infer"]>[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const r = match(item);
    if (r instanceof type.errors) return Result.Err(r.summary);
    return Result.Ok(r);
  });
}

export interface ParseArrayWarningResult<T> {
  filtered: T[];
  warning: { idx: number; txt: string }[];
}

/**
 * Run each item through a validator, collecting valid items and warnings for invalid ones.
 */
export function parseArrayWarning<T extends type>(items: unknown, match: T): ParseArrayWarningResult<T["infer"]> {
  return parseArrayResult<T>(items, match).reduce(
    (acc, r, idx) => {
      if (r.isErr()) {
        acc.warning.push({ idx, txt: r.Err().message });
      } else {
        acc.filtered.push(r.Ok() as never);
      }
      return acc;
    },
    { filtered: [], warning: [] } as ParseArrayWarningResult<T["infer"]>
  );
}

/**
 * Run each item in the array through an isXxx guard, returning only the valid ones.
 */
export function parseArray<T extends type>(items: unknown, match: T): T["infer"][] {
  return parseArrayWarning(items, match).filtered;
}

/**
 * Heartbeat / progress message any handler can emit during long-running work.
 * Receiving this on the client doesn't resolve the request's waitForResponse
 * (it's not an isResXxx match), but it does trigger onMessage which keeps the
 * client's idle timeout alive. Handlers that take >5s should emit one every
 * few seconds.
 *
 * `stage` is free-form (e.g. "uploading-part", "asset-stored", "rename-part").
 * `bytes` is bytes durably stored so far for the current asset, when known.
 * `partNumber` is set on multipart paths.
 */
export const resProgress = type({
  type: "'vibes.diy.res-progress'",
  "stage?": "string",
  "bytes?": "number",
  "partNumber?": "number",
});
export type ResProgress = typeof resProgress.infer;
export function isResProgress(obj: unknown): obj is ResProgress {
  return !(resProgress(obj) instanceof type.errors);
}
