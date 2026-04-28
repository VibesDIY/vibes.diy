import { type } from "arktype";
import { dashAuthType } from "./common.js";

// ── Per-(userSlug, appSlug, dbName) access policy ──────────────────

export const dbPolicyReadMode = type("'writers' | 'any-reader'");
export type DbPolicyReadMode = typeof dbPolicyReadMode.infer;

export const dbPolicyWriteMode = type("'writers' | 'any-reader'");
export type DbPolicyWriteMode = typeof dbPolicyWriteMode.infer;

export const dbPolicyDeleteMode = type("'writers' | 'author-or-writer'");
export type DbPolicyDeleteMode = typeof dbPolicyDeleteMode.infer;

export const dbPolicyStampField = type("'authorUserId' | 'authorDisplay' | 'createdAt'");
export type DbPolicyStampField = typeof dbPolicyStampField.infer;

export const dbPolicy = type({
  read: dbPolicyReadMode,
  write: dbPolicyWriteMode,
  delete: dbPolicyDeleteMode,
  "stamp?": dbPolicyStampField.array(),
});
export type DbPolicy = typeof dbPolicy.infer;
export function isDbPolicy(obj: unknown): obj is DbPolicy {
  return !(dbPolicy(obj) instanceof type.errors);
}

export const DEFAULT_DB_POLICY: DbPolicy = {
  read: "writers",
  write: "writers",
  delete: "writers",
};

export const COMMENTS_DB_NAME = "comments";

export const COMMENTS_DEFAULT_POLICY: DbPolicy = {
  read: "writers",
  write: "any-reader",
  delete: "author-or-writer",
  stamp: ["authorUserId", "authorDisplay", "createdAt"],
};

export const dbPolicyEntry = type({
  dbName: "string",
  policy: dbPolicy,
});
export type DbPolicyEntry = typeof dbPolicyEntry.infer;

// ── setDbPolicy (owner-gated) ──────────────────────────────────────

export const reqSetDbPolicy = type({
  type: "'vibes.diy.req-set-db-policy'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  policy: dbPolicy,
});
export type ReqSetDbPolicy = typeof reqSetDbPolicy.infer;
export function isReqSetDbPolicy(obj: unknown): obj is ReqSetDbPolicy {
  return !(reqSetDbPolicy(obj) instanceof type.errors);
}

export const resSetDbPolicy = type({
  type: "'vibes.diy.res-set-db-policy'",
  status: "'ok'",
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  policy: dbPolicy,
});
export type ResSetDbPolicy = typeof resSetDbPolicy.infer;
export function isResSetDbPolicy(obj: unknown): obj is ResSetDbPolicy {
  return !(resSetDbPolicy(obj) instanceof type.errors);
}

// ── getDbPolicy (owner-gated) ──────────────────────────────────────

export const reqGetDbPolicy = type({
  type: "'vibes.diy.req-get-db-policy'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
});
export type ReqGetDbPolicy = typeof reqGetDbPolicy.infer;
export function isReqGetDbPolicy(obj: unknown): obj is ReqGetDbPolicy {
  return !(reqGetDbPolicy(obj) instanceof type.errors);
}

export const resGetDbPolicy = type({
  type: "'vibes.diy.res-get-db-policy'",
  status: "'ok'",
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  policy: dbPolicy,
});
export type ResGetDbPolicy = typeof resGetDbPolicy.infer;
export function isResGetDbPolicy(obj: unknown): obj is ResGetDbPolicy {
  return !(resGetDbPolicy(obj) instanceof type.errors);
}
