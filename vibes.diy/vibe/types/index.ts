import { type } from "arktype";

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
  fsId: "string",
  appId: "string",
  tenant: "string",
  ledger: "string",
})

export type FPDbData = typeof FPDbData.infer;

export const ResOkVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'ok'",
  data: FPDbData, 
}).and(Base);

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
  data: FPDbData
}).and(Base);

export type ReqFetchCloudToken = typeof ReqFetchCloudToken.infer;

export function isReqFetchCloudToken(x: unknown): x is ReqFetchCloudToken {
  return !(ReqFetchCloudToken(x) instanceof type.errors);
}

export const ResFetchCloudToken = type({
  type: "'vibe.res.fetchCloudToken'",
  data: FPDbData,
  token: {
    token: "string",
    claims: "string",
    expiresAfter: "number",
  }
}).and(Base);

export type ResFetchCloudToken = typeof ResFetchCloudToken.infer;

export function isResFetchCloudToken(x: unknown): x is ResFetchCloudToken {
  return !(ResFetchCloudToken(x) instanceof type.errors);
}