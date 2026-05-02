import { FPCloudClaim } from "@vibes.diy/api-types";
import { type } from "arktype";

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

// Parent → iframe acknowledgement of `vibe.evt.runtime.ready`. The iframe
// posts runtime.ready repeatedly until it sees this ack, to defeat the race
// where a cached-assets iframe boots faster than the parent's React provider
// attaches its message listener. Idempotent; first ack wins.
export const EvtRuntimeAck = type({
  type: "'vibe.evt.runtime.ack'",
});
export type EvtRuntimeAck = typeof EvtRuntimeAck.infer;

export function isEvtRuntimeAck(x: unknown): x is EvtRuntimeAck {
  return !(EvtRuntimeAck(x) instanceof type.errors);
}

// Parent → iframe live-preview hot-swap. Fire-and-forget (no response).
// Carries the resolved App.jsx source after each block.code.end so the iframe
// can sucrase-transform + remount in place, avoiding an iframe reload.
export const EvtVibeSetSource = type({
  type: "'vibe.evt.set-source'",
  source: "string",
});
export type EvtVibeSetSource = typeof EvtVibeSetSource.infer;

export function isEvtVibeSetSource(x: unknown): x is EvtVibeSetSource {
  return !(EvtVibeSetSource(x) instanceof type.errors);
}

// Iframe → parent hot-swap failure signal. Fires when sucrase transform,
// dynamic import, or mountVibe reject the source from a vibe.evt.set-source
// envelope. The iframe keeps its previous DOM (mountVibe reuses the React
// root); the parent surfaces a toast so the user knows that a streamed edit
// didn't paint even though subsequent edits keep flowing.
export const EvtVibeHotSwapError = type({
  type: "'vibe.evt.hot-swap-error'",
  message: "string",
});
export type EvtVibeHotSwapError = typeof EvtVibeHotSwapError.infer;

export function isEvtVibeHotSwapError(x: unknown): x is EvtVibeHotSwapError {
  return !(EvtVibeHotSwapError(x) instanceof type.errors);
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
  "model?": "string",
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
// Same vibes.diy.* type strings as the API boundary (api-types/app-documents.ts).
// Request types here are the iframe (postMessage) variants — they have tid, no auth.
// Response types and events are shared — re-exported from api-types.

// Response types + events: shared across boundaries (no auth, no tid)
export {
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type ResListDbNames,
  type EvtDocChanged,
  isResPutDoc,
  isResGetDoc,
  isResGetDocNotFound,
  isResQueryDocs,
  isResDeleteDoc,
  isResSubscribeDocs,
  isResListDbNames,
  isEvtDocChanged,
} from "@vibes.diy/api-types";

// Request types: iframe boundary (postMessage) — has tid, no auth.
// Same vibes.diy.* type strings as api-types, but different shape.

export const ReqPutDoc = type({
  type: "'vibes.diy.req-put-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  doc: "Record<string, unknown>",
  "docId?": "string",
}).and(Base);

export type ReqPutDoc = typeof ReqPutDoc.infer;

export function isReqPutDoc(x: unknown): x is ReqPutDoc {
  return !(ReqPutDoc(x) instanceof type.errors);
}

export const ReqGetDoc = type({
  type: "'vibes.diy.req-get-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
}).and(Base);

export type ReqGetDoc = typeof ReqGetDoc.infer;

export function isReqGetDoc(x: unknown): x is ReqGetDoc {
  return !(ReqGetDoc(x) instanceof type.errors);
}

export const ReqQueryDocs = type({
  type: "'vibes.diy.req-query-docs'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
}).and(Base);

export type ReqQueryDocs = typeof ReqQueryDocs.infer;

export function isReqQueryDocs(x: unknown): x is ReqQueryDocs {
  return !(ReqQueryDocs(x) instanceof type.errors);
}

export const ReqDeleteDoc = type({
  type: "'vibes.diy.req-delete-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
}).and(Base);

export type ReqDeleteDoc = typeof ReqDeleteDoc.infer;

export function isReqDeleteDoc(x: unknown): x is ReqDeleteDoc {
  return !(ReqDeleteDoc(x) instanceof type.errors);
}

export const ReqSubscribeDocs = type({
  type: "'vibes.diy.req-subscribe-docs'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
}).and(Base);

export type ReqSubscribeDocs = typeof ReqSubscribeDocs.infer;

export function isReqSubscribeDocs(x: unknown): x is ReqSubscribeDocs {
  return !(ReqSubscribeDocs(x) instanceof type.errors);
}

export const ReqListDbNames = type({
  type: "'vibes.diy.req-list-db-names'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqListDbNames = typeof ReqListDbNames.infer;

export function isReqListDbNames(x: unknown): x is ReqListDbNames {
  return !(ReqListDbNames(x) instanceof type.errors);
}
