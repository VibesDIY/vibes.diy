// Vibes-owned auth wire-types + JWK schemas (Bucket B / Task 4).
//
// The auth wire-format is the contract between the CLI/client and the cloud, so
// vibes owns it here rather than re-exporting it from `@fireproof/core-types-*`.
// The erasable interfaces are reproduced from the installed
// `@fireproof/core-types-protocols-dashboard` / `core-types-base` .d.ts; the JWK
// zod schemas are lifted from `core-types-base`'s `jwk-private.zod` /
// `jwk-public.zod` (the runtime parity artifacts, alongside ClerkClaimSchema).
//
// NOTE (scope): the larger-closure types (VerifiedResult/VerifiedAuthUserResult →
// User, DeviceIdCAIf → cert closure) and the bulk of `core-types-base`'s crypto
// schemas (CertificatePayloadSchema, FPDeviceIDCSRPayloadSchema) are NOT owned
// here — they pull a large upstream graph and the lifted crypto still needs them,
// so `core-types-base` stays a dependency until the later dep-removal tasks.
import { Result } from "@adviser/cement";
import { z } from "zod";
import type { ClerkClaim } from "../clerk-claim.js";
// JWKPublic TYPE stays upstream-sourced to preserve type-identity across the
// codebase; only the zod schema VALUES are owned here (the parity artifacts).
import type { JWKPublic } from "@fireproof/core-types-base";

// --- JWK zod schemas (lifted verbatim from core-types-base @ 0.24.19) ---

const JWKCommon = z.object({
  kty: z.enum(["RSA", "EC", "oct", "OKP"]),
  use: z.enum(["sig", "enc"]).optional(),
  key_ops: z.array(z.enum(["sign", "verify", "encrypt", "decrypt", "wrapKey", "unwrapKey", "deriveKey", "deriveBits"])).optional(),
  alg: z.string().optional(),
  kid: z.string().optional(),
  x5u: z.string().url().optional(),
  x5c: z.array(z.string()).optional(),
  x5t: z.string().optional(),
  "x5t#S256": z.string().optional(),
});

export const JWKPrivateSchema = JWKCommon.and(
  z.discriminatedUnion("kty", [
    z.object({
      kty: z.literal("RSA"),
      n: z.string(),
      e: z.string(),
      d: z.string(),
      p: z.string(),
      q: z.string(),
      dp: z.string(),
      dq: z.string(),
      qi: z.string(),
    }),
    z.object({
      kty: z.literal("EC"),
      crv: z.enum(["P-256", "P-384", "P-521", "secp256k1"]),
      x: z.string(),
      y: z.string(),
      d: z.string(),
    }),
    z.object({ kty: z.literal("oct"), k: z.string() }),
    z.object({ kty: z.literal("OKP"), crv: z.enum(["Ed25519", "Ed448", "X25519", "X448"]), x: z.string(), d: z.string() }),
  ])
);

export const JWKPublicSchema = JWKCommon.and(
  z.discriminatedUnion("kty", [
    z.object({ kty: z.literal("RSA"), n: z.string(), e: z.string() }),
    z.object({ kty: z.literal("EC"), crv: z.enum(["P-256", "P-384", "P-521", "secp256k1"]), x: z.string(), y: z.string() }),
    z.object({ kty: z.literal("oct"), k: z.string() }),
    z.object({ kty: z.literal("OKP"), crv: z.enum(["Ed25519", "Ed448", "X25519", "X448"]), x: z.string() }),
  ])
);

// --- JWK alg helper (lifted verbatim from core-types-base `jwk-public.zod`) ---
// Maps a JWK to its JWS `alg`. Owned in-repo so `dash-api/token.ts`'s
// cloud-pubkey loader no longer imports a VALUE from `@fireproof/core-types-base`.
export function toJwksAlg(jwk: { kty?: string; crv?: string; alg?: string }): Result<string> {
  if (jwk.alg) {
    return Result.Ok(jwk.alg);
  }
  switch (jwk.kty) {
    case "EC": {
      switch (jwk.crv) {
        case "P-256":
          return Result.Ok("ES256");
        case "P-384":
          return Result.Ok("ES384");
        case "P-521":
          return Result.Ok("ES512");
        case "secp256k1":
          return Result.Ok("ES256K");
        default:
          return Result.Err(`Unsupported EC curve: ${jwk.crv}`);
      }
    }
    case "RSA": {
      return Result.Ok("RS256");
    }
    case "OKP": {
      switch (jwk.crv) {
        case "Ed25519":
          return Result.Ok("EdDSA");
        case "Ed448":
          return Result.Ok("EdDSA");
        default:
          return Result.Err(`Unsupported OKP curve: ${jwk.crv}`);
      }
    }
    case "oct": {
      return Result.Ok("HS256");
    }
    default:
      return Result.Err(`Unsupported key type: ${jwk.kty}`);
  }
}

// --- Auth wire-types (erasable; reproduced from the installed .d.ts) ---

export interface DashAuthType {
  readonly type: "ucan" | "clerk" | "device-id";
  readonly token: string;
}

export interface WithAuth {
  readonly auth: DashAuthType;
}

export interface ReqCertFromCsr {
  readonly type: "reqCertFromCsr";
  readonly auth: DashAuthType;
  readonly csr: string;
}

export interface ResCertFromCsr {
  readonly type: "resCertFromCsr";
  readonly certificate: string;
}

export interface VerifiedClaimsResult {
  readonly type: DashAuthType["type"];
  readonly token: string;
  readonly claims: unknown;
}

export interface ClerkVerifiedAuth {
  readonly type: "clerk";
  readonly claims: ClerkClaim;
}

export interface VerifiedAuthResult {
  readonly type: "VerifiedAuthResult";
  readonly inDashAuth: DashAuthType;
  readonly verifiedAuth: ClerkVerifiedAuth;
}

export interface FPApiToken {
  verify(token: string): Promise<import("@adviser/cement").Result<VerifiedClaimsResult>>;
  decode(token: string): Promise<import("@adviser/cement").Result<VerifiedClaimsResult>>;
}

export interface FPApiParameters {
  cloudPublicKeys: JWKPublic[];
  clerkPublishableKey: string;
  maxTenants: number;
  maxAdminUsers: number;
  maxMemberUsers: number;
  maxInvites: number;
  maxLedgers: number;
  maxAppIdBindings: number;
}
