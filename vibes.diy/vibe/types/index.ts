import { FPCloudClaim } from "@vibes.diy/api-types";
import { type } from "arktype";
// import { FPCloudClaimSchema } from "@fireproof/core-types-protocols-cloud";

export * from "./img-gen.js";

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
