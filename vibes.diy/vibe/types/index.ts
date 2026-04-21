import { FPCloudClaim } from "@vibes.diy/api-types";
import { type } from "arktype";
// import { FPCloudClaimSchema } from "@fireproof/core-types-protocols-cloud";

export * from "./img-vibes.js";

const Base = type({
  tid: "string",
});

export const ReqVibeRegisterFPDb = type({
  type: "'vibe.req.register.fpdb'",
  dbName: "string",
  appSlug: "string",
  userSlug: "string",
  fsId: "string",
}).and(Base);

export type ReqVibeRegisterFPDb = typeof ReqVibeRegisterFPDb.infer;

export function isReqVibeRegisterFPDb(x: unknown): x is ReqVibeRegisterFPDb {
  return !(ReqVibeRegisterFPDb(x) instanceof type.errors);
}

export const ResErrorVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorVibeRegisterFPDb = typeof ResErrorVibeRegisterFPDb.infer;

export const FPDbData = type({
  dbName: "string",
  appSlug: "string",
  userSlug: "string",
  // fsId: "string",
  // appId: "string",
  // tenant: "string",
  // ledger: "string",
});

export type FPDbData = typeof FPDbData.infer;

export const FBDbDataWithUrl = FPDbData.and(type({ fpcloudUrl: "string" }));

export const ResOkVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'ok'",
  data: FPDbData,
}).and(Base);

export const EvtRuntimeReady = type({
  type: "'vibe.evt.runtime.ready'",
  deps: "string[]",
});
export type EvtRuntimeReady = typeof EvtRuntimeReady.infer;

export function isEvtRuntimeReady(x: unknown): x is EvtRuntimeReady {
  return !(EvtRuntimeReady(x) instanceof type.errors);
}

export const EvtVibeAttachStatusFPDb = type({
  type: "'vibe.evt.attach.status.fpdb'",
  data: FBDbDataWithUrl,
  status: "'error' | 'attached' | 'loading' | 'loaded' | 'detached' | 'syncing' | 'idle'",
});

export type EvtVibeAttachStatusFPDb = typeof EvtVibeAttachStatusFPDb.infer;

export const EvtAttachFPDb = type({
  type: "'vibe.evt.attach.fpdb'",
  data: FBDbDataWithUrl,
});
export function isEvtAttachFPDb(x: unknown): x is typeof EvtAttachFPDb.infer {
  return !(EvtAttachFPDb(x) instanceof type.errors);
}

export type EvtAttachFPDb = typeof EvtAttachFPDb.infer;

export type ResOkVibeRegisterFPDb = typeof ResOkVibeRegisterFPDb.infer;

const ResVibeRegisterFPDb = ResErrorVibeRegisterFPDb.or(ResOkVibeRegisterFPDb);

export function isResVibeRegisterFPDb(x: unknown): x is ResVibeRegisterFPDb {
  return !(ResVibeRegisterFPDb(x) instanceof type.errors);
}

export type ResVibeRegisterFPDb = typeof ResVibeRegisterFPDb.infer;
export function isResOkVibeRegisterFPDb(x: unknown): x is ResOkVibeRegisterFPDb {
  return !(ResOkVibeRegisterFPDb(x) instanceof type.errors);
}
export function isResErrorVibeRegisterFPDb(x: unknown): x is ResErrorVibeRegisterFPDb {
  return !(ResErrorVibeRegisterFPDb(x) instanceof type.errors);
}

export const ReqFetchCloudToken = type({
  type: "'vibe.req.fetchCloudToken'",
  data: FPDbData,
}).and(Base);

export type ReqFetchCloudToken = typeof ReqFetchCloudToken.infer;

export function isReqFetchCloudToken(x: unknown): x is ReqFetchCloudToken {
  return !(ReqFetchCloudToken(x) instanceof type.errors);
}

export const ResFetchCloudToken = type({
  type: "'vibe.res.fetchCloudToken'",
  data: FPDbData,
  token: {
    cloudToken: "string",
    claims: FPCloudClaim,
    expiresInSec: "number",
  },
}).and(Base);

export type ResFetchCloudToken = typeof ResFetchCloudToken.infer;

export function isResFetchCloudToken(x: unknown): x is ResFetchCloudToken {
  return !(ResFetchCloudToken(x) instanceof type.errors);
}

// JSONSchema — recursive fields use unknown to avoid arktype cyclic-type constraints
export const JSONSchema = type({
  "type?": "string | string[]",
  "title?": "string",
  "description?": "string",
  "default?": "unknown",
  "examples?": "unknown[]",
  "enum?": "unknown[]",
  "const?": "unknown",
  // String
  "minLength?": "number",
  "maxLength?": "number",
  "pattern?": "string",
  "format?": "string",
  // Number / integer
  "minimum?": "number",
  "maximum?": "number",
  "exclusiveMinimum?": "number",
  "exclusiveMaximum?": "number",
  "multipleOf?": "number",
  // Array
  "items?": "unknown",
  "minItems?": "number",
  "maxItems?": "number",
  "uniqueItems?": "boolean",
  // Object
  "properties?": "Record<string, unknown>",
  "required?": "string[]",
  "additionalProperties?": "boolean | Record<string, unknown>",
  "minProperties?": "number",
  "maxProperties?": "number",
  // Composition
  "allOf?": "unknown[]",
  "anyOf?": "unknown[]",
  "oneOf?": "unknown[]",
  "not?": "unknown",
  // References
  "$ref?": "string",
  "$defs?": "Record<string, unknown>",
});

export type JSONSchema = typeof JSONSchema.infer;

export function isJSONSchema(x: unknown): x is JSONSchema {
  return !(JSONSchema(x) instanceof type.errors);
}

export const ReqCallAI = type({
  type: "'vibe.req.callAI'",
  userSlug: "string",
  appSlug: "string",
  prompt: "string",
  schema: JSONSchema,
}).and(Base);

export type ReqCallAI = typeof ReqCallAI.infer;

export function isReqCallAI(x: unknown): x is ReqCallAI {
  return !(ReqCallAI(x) instanceof type.errors);
}

export const ResOkCallAI = type({
  type: "'vibe.res.callAI'",
  status: "'ok'",
  promptId: "string",
  result: "string",
}).and(Base);

export type ResOkCallAI = typeof ResOkCallAI.infer;

export const ResErrorCallAI = type({
  type: "'vibe.res.callAI'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorCallAI = typeof ResErrorCallAI.infer;

const ResCallAI = ResOkCallAI.or(ResErrorCallAI);

export type ResCallAI = typeof ResCallAI.infer;

export function isResCallAI(x: unknown): x is ResCallAI {
  return !(ResCallAI(x) instanceof type.errors);
}

export function isResOkCallAI(x: unknown): x is ResOkCallAI {
  return !(ResOkCallAI(x) instanceof type.errors);
}

export function isResErrorCallAI(x: unknown): x is ResErrorCallAI {
  return !(ResErrorCallAI(x) instanceof type.errors);
}

// Image generation request/response types
export const ReqImgVibes = type({
  type: "'vibe.req.imgVibes'",
  userSlug: "string",
  appSlug: "string",
  prompt: "string",
  "inputImageBase64?": "string",
}).and(Base);

export type ReqImgVibes = typeof ReqImgVibes.infer;

export function isReqImgVibes(x: unknown): x is ReqImgVibes {
  return !(ReqImgVibes(x) instanceof type.errors);
}

export const ResOkImgVibes = type({
  type: "'vibe.res.imgVibes'",
  status: "'ok'",
  imageUrls: "string[]",
}).and(Base);

export type ResOkImgVibes = typeof ResOkImgVibes.infer;

export const ResErrorImgVibes = type({
  type: "'vibe.res.imgVibes'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorImgVibes = typeof ResErrorImgVibes.infer;

const ResImgVibes = ResOkImgVibes.or(ResErrorImgVibes);

export type ResImgVibes = typeof ResImgVibes.infer;

export function isResImgVibes(x: unknown): x is ResImgVibes {
  return !(ResImgVibes(x) instanceof type.errors);
}

export function isResOkImgVibes(x: unknown): x is ResOkImgVibes {
  return !(ResOkImgVibes(x) instanceof type.errors);
}

export function isResErrorImgVibes(x: unknown): x is ResErrorImgVibes {
  return !(ResErrorImgVibes(x) instanceof type.errors);
}

// ── Firefly document operations ──────────────────────────────────────

// putDoc
export const ReqPutDoc = type({
  type: "'vibe.req.putDoc'",
  appSlug: "string",
  userSlug: "string",
  doc: "Record<string, unknown>",
  "docId?": "string",
}).and(Base);

export type ReqPutDoc = typeof ReqPutDoc.infer;

export function isReqPutDoc(x: unknown): x is ReqPutDoc {
  return !(ReqPutDoc(x) instanceof type.errors);
}

export const ResOkPutDoc = type({
  type: "'vibe.res.putDoc'",
  status: "'ok'",
  id: "string",
}).and(Base);

export type ResOkPutDoc = typeof ResOkPutDoc.infer;

export function isResOkPutDoc(x: unknown): x is ResOkPutDoc {
  return !(ResOkPutDoc(x) instanceof type.errors);
}

export const ResErrorPutDoc = type({
  type: "'vibe.res.putDoc'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorPutDoc = typeof ResErrorPutDoc.infer;

export function isResErrorPutDoc(x: unknown): x is ResErrorPutDoc {
  return !(ResErrorPutDoc(x) instanceof type.errors);
}

const ResPutDoc = ResOkPutDoc.or(ResErrorPutDoc);
export type ResPutDoc = typeof ResPutDoc.infer;

export function isResPutDoc(x: unknown): x is ResPutDoc {
  return !(ResPutDoc(x) instanceof type.errors);
}

// getDoc
export const ReqGetDoc = type({
  type: "'vibe.req.getDoc'",
  appSlug: "string",
  userSlug: "string",
  docId: "string",
}).and(Base);

export type ReqGetDoc = typeof ReqGetDoc.infer;

export function isReqGetDoc(x: unknown): x is ReqGetDoc {
  return !(ReqGetDoc(x) instanceof type.errors);
}

export const ResOkGetDoc = type({
  type: "'vibe.res.getDoc'",
  status: "'ok'",
  id: "string",
  doc: "Record<string, unknown>",
}).and(Base);

export type ResOkGetDoc = typeof ResOkGetDoc.infer;

export function isResOkGetDoc(x: unknown): x is ResOkGetDoc {
  return !(ResOkGetDoc(x) instanceof type.errors);
}

export const ResErrorGetDoc = type({
  type: "'vibe.res.getDoc'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorGetDoc = typeof ResErrorGetDoc.infer;

export function isResErrorGetDoc(x: unknown): x is ResErrorGetDoc {
  return !(ResErrorGetDoc(x) instanceof type.errors);
}

const ResGetDoc = ResOkGetDoc.or(ResErrorGetDoc);
export type ResGetDoc = typeof ResGetDoc.infer;

export function isResGetDoc(x: unknown): x is ResGetDoc {
  return !(ResGetDoc(x) instanceof type.errors);
}

// queryDocs
export const ReqQueryDocs = type({
  type: "'vibe.req.queryDocs'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqQueryDocs = typeof ReqQueryDocs.infer;

export function isReqQueryDocs(x: unknown): x is ReqQueryDocs {
  return !(ReqQueryDocs(x) instanceof type.errors);
}

export const ResOkQueryDocs = type({
  type: "'vibe.res.queryDocs'",
  status: "'ok'",
  docs: type({ _id: "string" }).and(type("Record<string, unknown>")).array(),
}).and(Base);

export type ResOkQueryDocs = typeof ResOkQueryDocs.infer;

export function isResOkQueryDocs(x: unknown): x is ResOkQueryDocs {
  return !(ResOkQueryDocs(x) instanceof type.errors);
}

export const ResErrorQueryDocs = type({
  type: "'vibe.res.queryDocs'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorQueryDocs = typeof ResErrorQueryDocs.infer;

const ResQueryDocs = ResOkQueryDocs.or(ResErrorQueryDocs);
export type ResQueryDocs = typeof ResQueryDocs.infer;

export function isResQueryDocs(x: unknown): x is ResQueryDocs {
  return !(ResQueryDocs(x) instanceof type.errors);
}

// deleteDoc
export const ReqDeleteDoc = type({
  type: "'vibe.req.deleteDoc'",
  appSlug: "string",
  userSlug: "string",
  docId: "string",
}).and(Base);

export type ReqDeleteDoc = typeof ReqDeleteDoc.infer;

export function isReqDeleteDoc(x: unknown): x is ReqDeleteDoc {
  return !(ReqDeleteDoc(x) instanceof type.errors);
}

export const ResOkDeleteDoc = type({
  type: "'vibe.res.deleteDoc'",
  status: "'ok'",
  id: "string",
}).and(Base);

export type ResOkDeleteDoc = typeof ResOkDeleteDoc.infer;

export function isResOkDeleteDoc(x: unknown): x is ResOkDeleteDoc {
  return !(ResOkDeleteDoc(x) instanceof type.errors);
}

export const ResErrorDeleteDoc = type({
  type: "'vibe.res.deleteDoc'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorDeleteDoc = typeof ResErrorDeleteDoc.infer;

const ResDeleteDoc = ResOkDeleteDoc.or(ResErrorDeleteDoc);
export type ResDeleteDoc = typeof ResDeleteDoc.infer;

export function isResDeleteDoc(x: unknown): x is ResDeleteDoc {
  return !(ResDeleteDoc(x) instanceof type.errors);
}

// subscribeDocs
export const ReqSubscribeDocs = type({
  type: "'vibe.req.subscribeDocs'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqSubscribeDocs = typeof ReqSubscribeDocs.infer;

export function isReqSubscribeDocs(x: unknown): x is ReqSubscribeDocs {
  return !(ReqSubscribeDocs(x) instanceof type.errors);
}

export const ResOkSubscribeDocs = type({
  type: "'vibe.res.subscribeDocs'",
  status: "'ok'",
}).and(Base);

export type ResOkSubscribeDocs = typeof ResOkSubscribeDocs.infer;

export function isResSubscribeDocs(x: unknown): x is ResOkSubscribeDocs {
  return !(ResOkSubscribeDocs(x) instanceof type.errors);
}

// docChanged event (pushed from parent to iframe on remote writes)
export const EvtDocChanged = type({
  type: "'vibe.evt.docChanged'",
  appSlug: "string",
  docId: "string",
});

export type EvtDocChanged = typeof EvtDocChanged.infer;

export function isEvtDocChanged(x: unknown): x is EvtDocChanged {
  return !(EvtDocChanged(x) instanceof type.errors);
}
