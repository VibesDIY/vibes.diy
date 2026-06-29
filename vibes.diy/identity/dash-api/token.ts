// Lifted verbatim from @fireproof/core-protocols-dashboard@0.24.19 `token.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). The server-side token
// verifiers behind `tokenApi` — Clerk RS256 verify + device-id cert verify — plus
// the CA-from-env loader and cloud-pubkey loader. Wired to the in-repo
// DeviceIdCA/DeviceIdVerifyMsg (Tasks 2-3) and the owned ClerkClaimSchema /
// FPClerkClaimSchema (clerk-claim.ts), so the upstream `core-types-base` patch is
// no longer on any runtime path and is dropped. Only imports were adjusted; the
// verify logic is byte-for-byte the same, gated by auth-token-verify-golden.test.ts
// through the @vibes.diy/identity/server facade.
import { Lazy, Result, param, exception2Result, isArrayBuffer, isUint8Array } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import * as sts from "../sts/index.js";
import { decodeProtectedHeader, exportJWK } from "jose";
import { ClerkClaimSchema } from "../clerk-claim.js";
import { JWKPublicSchema, toJwksAlg } from "../types/wire.js";
import { FPDeviceIDSessionSchema } from "../types/device-id-payload.js";
import type { SuperThis, JWKPublic } from "@fireproof/core-types-base";
import type { VerifyWithCertificateOptions } from "@fireproof/core-types-device-id";
import { DeviceIdCA } from "../device-id/ca.js";
import { DeviceIdVerifyMsg } from "../device-id/verify.js";
import { ClerkApiToken } from "./clerk-token.js";
import type { FPApiToken, VerifiedClaimsResult } from "../types/wire.js";

// `ClerkApiToken` lives in the browser-safe `./clerk-token.js` (no device-id
// crypto) and is re-exported here so existing `dash-api/token.js` importers and
// `tokenApi` below are unchanged.
export { ClerkApiToken } from "./clerk-token.js";

export class DeviceIdApiToken implements FPApiToken {
  readonly sthis: SuperThis;
  readonly opts: VerifyWithCertificateOptions;
  constructor(sthis: SuperThis, opts: VerifyWithCertificateOptions) {
    this.sthis = sthis;
    this.opts = opts;
  }

  async decode(token: string): Promise<Result<VerifiedClaimsResult>> {
    const rHeader = await exception2Result(() => decodeProtectedHeader(token));
    if (rHeader.isErr()) {
      return Result.Err(rHeader);
    }
    const x5c = rHeader.Ok().x5c;
    if (!x5c || !x5c[0]) {
      return Result.Err("DeviceIdApiToken-decode: missing x5c in header");
    }
    const jsStr = this.sthis.txt.base64.decode(x5c[0] ?? "");
    const rJs = await exception2Result(() => JSON.parse(jsStr));
    if (rJs.isErr()) {
      return Result.Err(rJs);
    }
    const rClaims = ClerkClaimSchema.safeParse((rJs.Ok() as { creatingUser?: { claims?: unknown } }).creatingUser?.claims);
    if (!rClaims.success) {
      return Result.Err(rClaims.error);
    }
    return Result.Ok({ type: "device-id", token, claims: rClaims.data });
  }

  async verify(token: string): Promise<Result<VerifiedClaimsResult>> {
    const rCa = await this.opts.deviceIdCA.caCertificate();
    if (rCa.isErr()) {
      return Result.Err(rCa);
    }
    // #2671: when DEVICE_ID_REQUIRE_CA_SIGNATURE is enabled, reject device tokens
    // that don't carry a CA-signature-verifiable cert chain (the `x5c#jwt` header).
    // Default-off so older published CLIs keep authenticating during rollout; flip
    // to "true" in the worker env once the CA-signing CLI is published & adopted.
    // (A present-but-invalid chain signature is ALWAYS rejected, flag or not.)
    const requireCASignature = this.sthis.env.get("DEVICE_ID_REQUIRE_CA_SIGNATURE") === "true";
    const verify = new DeviceIdVerifyMsg(this.sthis.txt.base64, [rCa.Ok()], { maxAge: 3600, requireCASignature, ...this.opts });
    const res = await verify.verifyWithCertificate(token, FPDeviceIDSessionSchema);
    if (res.valid) {
      const creatingUser = (res.certificate.certificate.asCert() as { creatingUser?: { type?: string; claims?: unknown } })
        .creatingUser;
      if (!creatingUser || creatingUser.type !== "clerk") {
        return Result.Err(`DeviceIdApiToken-verify: unsupported creatingUser type: ${creatingUser}`);
      }
      return Result.Ok({ type: "device-id", token, claims: creatingUser.claims });
    }
    return Result.Err(res.error);
  }
}

export const deviceIdCAFromEnv = Lazy((sthis: SuperThis): Promise<Result<DeviceIdCA>> => {
  const rEnv = sthis.env.gets({ DEVICE_ID_CA_PRIV_KEY: param.REQUIRED, DEVICE_ID_CA_CERT: param.REQUIRED });
  if (rEnv.isErr()) {
    throw rEnv.Err();
  }
  const envVals = rEnv.Ok();
  return DeviceIdCA.from(
    sthis,
    { privateKey: envVals.DEVICE_ID_CA_PRIV_KEY, signedCert: envVals.DEVICE_ID_CA_CERT },
    { generateSerialNumber: async () => sthis.nextId(32).str }
  );
});

export async function getCloudPubkeyFromEnv(
  cloudToken?: string,
  sthis: SuperThis = ensureSuperThis()
): Promise<Result<{ keys: JWKPublic[] }>> {
  const cstPub = cloudToken ?? sthis.env.get("CLOUD_SESSION_TOKEN_PUBLIC");
  if (!cstPub) {
    return Result.Err("no public key: env:CLOUD_SESSION_TOKEN_PUBLIC");
  }
  const cryptoKeys = await sts.env2jwk(cstPub, undefined, sthis);
  const keys: JWKPublic[] = [];
  for (const key of cryptoKeys) {
    const jwKey = await exportJWK(key);
    if (isUint8Array(jwKey) || isArrayBuffer(jwKey)) {
      return Result.Err("invalid key: jwk is ArrayBuffer or Uint8Array");
    }
    const rAlg = toJwksAlg(jwKey);
    if (rAlg.isErr()) {
      return Result.Err(rAlg);
    }
    const rJwtPublicKey = JWKPublicSchema.safeParse({
      use: "sig",
      ...jwKey,
      alg: rAlg.Ok(),
      ext: undefined,
      key_ops: undefined,
      kid: undefined,
    });
    if (!rJwtPublicKey.success) {
      return Result.Err(rJwtPublicKey.error);
    }
    keys.push(rJwtPublicKey.data as JWKPublic);
  }
  return Result.Ok({ keys });
}

export const tokenApi = Lazy(async (sthis: SuperThis, opts: VerifyWithCertificateOptions) => {
  return {
    "device-id": new DeviceIdApiToken(sthis, opts),
    clerk: new ClerkApiToken(sthis),
  };
});
