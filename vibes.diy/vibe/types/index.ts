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

export const ResOkVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'ok'",
  dbName: "string",
  appSlug: "string",
  userSlug: "string",
  fsId: "string",
  appId: "string",
  tenant: "string",
  ledger: "string",
}).and(Base);

export type ResOkVibeRegisterFPDb = typeof ResOkVibeRegisterFPDb.infer;

const ResVibeRegisterFPDb = ResErrorVibeRegisterFPDb.or(ResOkVibeRegisterFPDb);

export type ResVibeRegisterFPDb = typeof ResVibeRegisterFPDb.infer;
export function isResVibeRegisterFPDb(x: unknown): x is ResVibeRegisterFPDb {
  return !(ResVibeRegisterFPDb(x) instanceof type.errors);
}
