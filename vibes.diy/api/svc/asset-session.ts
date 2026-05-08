// HMAC signer/verifier for the asset-host session cookie.
//
// Mirrors asset-grant.ts: HKDF-derives an HMAC-SHA-256 signing key from
// the same root secret (CLOUD_SESSION_TOKEN_SECRET) but with a distinct
// `info` string ("vibes.diy.asset-session.v1") so the derived key is
// cryptographically separated from the asset-grant key. A token signed
// for one audience cannot be verified by the other — defense against
// cross-domain confusion if either signer is ever leaked or rolled.
//
// Audience is the asset host itself (`assets.<env>.vibesdiy.net`); the
// cookie carries the verified Clerk userId only. Per-db ACL still gates
// `(userSlug, appSlug, dbName)` at read time — identity goes via cookie,
// authorization goes via the existing ACL machinery.
import { Result, exception2Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { SignJWT, jwtVerify } from "jose";

const HKDF_INFO = "vibes.diy.asset-session.v1";
const ALG = "HS256";
const ISSUER = "vibes.diy.asset-session";
const AUDIENCE = "vibes.diy.asset-host";

export interface AssetSessionClaims {
  readonly userId: string;
  readonly iat: number;
  readonly exp: number;
}

export interface AssetSessionSigner {
  sign(claims: { readonly userId: string }, ttlSec: number): Promise<Result<{ token: string; expiresAt: Date }>>;
  verify(token: string): Promise<Result<AssetSessionClaims>>;
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

async function deriveSessionKey(sthis: SuperThis, secretEnv: string, info: string): Promise<CryptoKey> {
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

export interface CreateAssetSessionSignerParams {
  readonly sthis: SuperThis;
  readonly secret: string;
  readonly info?: string;
}

export async function createAssetSessionSigner(params: CreateAssetSessionSignerParams): Promise<Result<AssetSessionSigner>> {
  const rKey = await exception2Result(() => deriveSessionKey(params.sthis, params.secret, params.info ?? HKDF_INFO));
  if (rKey.isErr()) return Result.Err(rKey);
  const key = rKey.Ok();
  return Result.Ok({
    async sign(claims, ttlSec) {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + ttlSec;
      return exception2Result(async () => {
        const token = await new SignJWT({ userId: claims.userId })
          .setProtectedHeader({ alg: ALG })
          .setIssuer(ISSUER)
          .setAudience(AUDIENCE)
          .setIssuedAt(now)
          .setExpirationTime(exp)
          .sign(key);
        return { token, expiresAt: new Date(exp * 1000) };
      });
    },
    async verify(token) {
      const rRes = await exception2Result(() => jwtVerify(token, key, { algorithms: [ALG], issuer: ISSUER, audience: AUDIENCE }));
      if (rRes.isErr()) return Result.Err(rRes);
      const payload = rRes.Ok().payload;
      return Result.Ok({
        userId: payload.userId as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
      });
    },
  });
}
