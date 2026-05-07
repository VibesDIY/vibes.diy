// HMAC signer/verifier for short-lived asset-upload grants.
//
// Design — see notes/storage-assets-post.md (§ "Signing key — HKDF-derived")
// and notes/storage-files.md (§ "HKDF derivation note").
//
// `CLOUD_SESSION_TOKEN_SECRET` is base58btc-encoded JSON containing a P-256
// ES256 JWK private key — its `d` parameter is the EC scalar, 32 bytes of
// high-entropy private material base64url-encoded inside the JWK. We treat
// that scalar as opaque IKM and HKDF-derive a separate HMAC-SHA-256 signing
// key for asset grants.
//
// HKDF over an EC scalar is cryptographically sound — HKDF treats the IKM as
// opaque entropic input, and the derived HMAC key is one-way separated from
// the EC signing key (a leak of the derived HMAC key never reveals the
// scalar). The `info` string discriminates audiences: a future
// "vibes.diy.asset-grant.v2" rotates the derived key without touching env;
// other signed-token use cases get their own info string with no key
// material in common.
import { Result, exception2Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { SignJWT, jwtVerify } from "jose";
import { type AssetGrantClaims } from "@vibes.diy/api-types";

const HKDF_INFO = "vibes.diy.asset-grant.v1";
const ALG = "HS256";
const ISSUER = "vibes.diy.asset-grant";
const AUDIENCE = "vibes.diy.put-asset";

export interface AssetGrantSigner {
  sign(claims: Omit<AssetGrantClaims, "iat" | "exp">, ttlSec: number): Promise<Result<{ token: string; expiresAt: Date }>>;
  verify(token: string): Promise<Result<AssetGrantClaims>>;
}

interface ParsedJwk {
  readonly d?: string;
}

function base64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4;
  const padded = pad === 0 ? input : input + "=".repeat(4 - pad);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveGrantKey(sthis: SuperThis, secretEnv: string, info: string): Promise<CryptoKey> {
  // base58btc-encoded JSON → JWK → 32-byte EC scalar IKM.
  const jwkJson = sthis.txt.base58.decode(secretEnv);
  const jwk = JSON.parse(jwkJson) as ParsedJwk;
  if (!jwk.d) {
    throw new Error("CLOUD_SESSION_TOKEN_SECRET JWK missing private scalar 'd'");
  }
  const ikm = base64urlDecode(jwk.d);
  const ikmKey = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    ikmKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface CreateAssetGrantSignerParams {
  readonly sthis: SuperThis;
  readonly secret: string;
  readonly info?: string;
}

export async function createAssetGrantSigner(params: CreateAssetGrantSignerParams): Promise<Result<AssetGrantSigner>> {
  const rKey = await exception2Result(() => deriveGrantKey(params.sthis, params.secret, params.info ?? HKDF_INFO));
  if (rKey.isErr()) return Result.Err(rKey);
  const key = rKey.Ok();
  return Result.Ok({
    async sign(claims, ttlSec) {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + ttlSec;
      return exception2Result(async () => {
        const token = await new SignJWT({
          userId: claims.userId,
          userSlug: claims.userSlug,
          appSlug: claims.appSlug,
          ...(claims.mimeType !== undefined ? { mimeType: claims.mimeType } : {}),
        })
          .setProtectedHeader({ alg: ALG })
          .setIssuer(ISSUER)
          .setAudience(AUDIENCE)
          .setIssuedAt(now)
          .setExpirationTime(exp)
          .setJti(claims.jti)
          .sign(key);
        return { token, expiresAt: new Date(exp * 1000) };
      });
    },
    async verify(token) {
      const rRes = await exception2Result(() => jwtVerify(token, key, { algorithms: [ALG], issuer: ISSUER, audience: AUDIENCE }));
      if (rRes.isErr()) return Result.Err(rRes);
      const payload = rRes.Ok().payload;
      const claims: AssetGrantClaims = {
        jti: payload.jti as string,
        userId: payload.userId as string,
        userSlug: payload.userSlug as string,
        appSlug: payload.appSlug as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
        ...(typeof payload.mimeType === "string" ? { mimeType: payload.mimeType } : {}),
      };
      return Result.Ok(claims);
    },
  });
}
