import { type } from "arktype";
import { dashAuthType } from "./common.js";

// ── putDoc ──────────────────────────────────────────────────────────

export const reqPutDoc = type({
  type: "'vibes.diy.req-put-doc'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  doc: "Record<string, unknown>",
  "docId?": "string",
});
export type ReqPutDoc = typeof reqPutDoc.infer;
export function isReqPutDoc(obj: unknown): obj is ReqPutDoc {
  return !(reqPutDoc(obj) instanceof type.errors);
}

export const resPutDoc = type({
  type: "'vibes.diy.res-put-doc'",
  status: "'ok'",
  id: "string",
});
export type ResPutDoc = typeof resPutDoc.infer;
export function isResPutDoc(obj: unknown): obj is ResPutDoc {
  return !(resPutDoc(obj) instanceof type.errors);
}

// ── getDoc ──────────────────────────────────────────────────────────

export const reqGetDoc = type({
  type: "'vibes.diy.req-get-doc'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
});
export type ReqGetDoc = typeof reqGetDoc.infer;
export function isReqGetDoc(obj: unknown): obj is ReqGetDoc {
  return !(reqGetDoc(obj) instanceof type.errors);
}

export const resGetDoc = type({
  type: "'vibes.diy.res-get-doc'",
  status: "'ok'",
  id: "string",
  doc: "Record<string, unknown>",
});
export type ResGetDoc = typeof resGetDoc.infer;
export function isResGetDoc(obj: unknown): obj is ResGetDoc {
  return !(resGetDoc(obj) instanceof type.errors);
}

export const resGetDocNotFound = type({
  type: "'vibes.diy.res-get-doc'",
  status: "'not-found'",
  id: "string",
});
export type ResGetDocNotFound = typeof resGetDocNotFound.infer;
export function isResGetDocNotFound(obj: unknown): obj is ResGetDocNotFound {
  return !(resGetDocNotFound(obj) instanceof type.errors);
}

// ── queryDocs ───────────────────────────────────────────────────────

export const reqQueryDocs = type({
  type: "'vibes.diy.req-query-docs'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
});
export type ReqQueryDocs = typeof reqQueryDocs.infer;
export function isReqQueryDocs(obj: unknown): obj is ReqQueryDocs {
  return !(reqQueryDocs(obj) instanceof type.errors);
}

export const resQueryDocs = type({
  type: "'vibes.diy.res-query-docs'",
  status: "'ok'",
  docs: type({ _id: "string" }).and(type("Record<string, unknown>")).array(),
});
export type ResQueryDocs = typeof resQueryDocs.infer;
export function isResQueryDocs(obj: unknown): obj is ResQueryDocs {
  return !(resQueryDocs(obj) instanceof type.errors);
}

// ── deleteDoc ───────────────────────────────────────────────────────

export const reqDeleteDoc = type({
  type: "'vibes.diy.req-delete-doc'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
});
export type ReqDeleteDoc = typeof reqDeleteDoc.infer;
export function isReqDeleteDoc(obj: unknown): obj is ReqDeleteDoc {
  return !(reqDeleteDoc(obj) instanceof type.errors);
}

export const resDeleteDoc = type({
  type: "'vibes.diy.res-delete-doc'",
  status: "'ok'",
  id: "string",
});
export type ResDeleteDoc = typeof resDeleteDoc.infer;
export function isResDeleteDoc(obj: unknown): obj is ResDeleteDoc {
  return !(resDeleteDoc(obj) instanceof type.errors);
}

// ── subscribeDocs ───────────────────────────────────────────────────

export const reqSubscribeDocs = type({
  type: "'vibes.diy.req-subscribe-docs'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
});
export type ReqSubscribeDocs = typeof reqSubscribeDocs.infer;
export function isReqSubscribeDocs(obj: unknown): obj is ReqSubscribeDocs {
  return !(reqSubscribeDocs(obj) instanceof type.errors);
}

export const resSubscribeDocs = type({
  type: "'vibes.diy.res-subscribe-docs'",
  status: "'ok'",
});
export type ResSubscribeDocs = typeof resSubscribeDocs.infer;
export function isResSubscribeDocs(obj: unknown): obj is ResSubscribeDocs {
  return !(resSubscribeDocs(obj) instanceof type.errors);
}

// ── docChanged event (server → client push) ─────────────────────────

export const evtDocChanged = type({
  type: "'vibes.diy.evt-doc-changed'",
  userSlug: "string",
  appSlug: "string",
  docId: "string",
});
export type EvtDocChanged = typeof evtDocChanged.infer;
export function isEvtDocChanged(obj: unknown): obj is EvtDocChanged {
  return !(evtDocChanged(obj) instanceof type.errors);
}
