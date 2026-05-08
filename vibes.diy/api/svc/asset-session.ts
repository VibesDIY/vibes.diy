// HMAC signer/verifier for the asset-host session cookie.
//
// Mirrors asset-grant.ts: shares the HKDF derivation helper but discriminates
// audience via a distinct `info` string ("vibes.diy.asset-session.v1") so
// the derived key is cryptographically separated from asset-grant's key.
// A token signed for one audience cannot be verified by the other.
//
// Audience is the asset host itself (`assets.<env>.vibesdiy.net`); the
// cookie carries the verified Clerk userId only. Per-db ACL still gates
// `(userSlug, appSlug, dbName)` at read time — identity goes via cookie,
// authorization goes via the existing ACL machinery.
import { Result, exception2Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { SignJWT, jwtVerify } from "jose";
import { deriveHkdfHmacKey } from "./hkdf-key.js";

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

export interface CreateAssetSessionSignerParams {
  readonly sthis: SuperThis;
  readonly secret: string;
  readonly info?: string;
}

export async function createAssetSessionSigner(params: CreateAssetSessionSignerParams): Promise<Result<AssetSessionSigner>> {
  const rKey = await exception2Result(() =>
    deriveHkdfHmacKey({ sthis: params.sthis, secret: params.secret, info: params.info ?? HKDF_INFO })
  );
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
