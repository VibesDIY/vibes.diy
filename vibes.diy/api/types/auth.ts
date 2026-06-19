import { DashAuthType, VerifiedAuthResult } from "@vibes.diy/identity";

export type ReqWithVerifiedAuth<REQ extends { type: string; auth: DashAuthType }> = REQ & {
  readonly _auth: VerifiedAuthResult;
};

export type ReqWithOptionalAuth<REQ extends { type: string; auth?: DashAuthType }> = REQ & {
  readonly _auth?: VerifiedAuthResult;
};
