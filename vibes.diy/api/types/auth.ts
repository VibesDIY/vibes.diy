import { DashAuthType, VerifiedAuthResult } from "@fireproof/core-types-protocols-dashboard";

export type ReqWithVerifiedAuth<REQ extends { type: string; auth: DashAuthType }> = REQ & {
  readonly _auth: VerifiedAuthResult;
};

export type ReqWithOptionalAuth<REQ extends { type: string; auth?: DashAuthType }> = REQ & {
  readonly _auth?: VerifiedAuthResult;
};
