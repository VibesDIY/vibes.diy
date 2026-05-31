// HMAC signer/verifier for short-lived asset-upload grants.
//
// Design — see notes/storage-assets-post.md (§ "Signing key — HKDF-derived")
// and notes/storage-files.md (§ "HKDF derivation note").
//
// Shares deriveHkdfHmacKey with asset-session.ts; the `info` string is
// what distinguishes the two audiences ("vibes.diy.asset-grant.v1" vs.
// "vibes.diy.asset-session.v1") so a token signed for one cannot be
// verified by the other.
import { Result, exception2Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { SignJWT, jwtVerify } from "jose";
import { type AssetGrantClaims } from "@vibes.diy/api-types";
import { deriveHkdfHmacKey } from "./hkdf-key.js";

const HKDF_INFO = "vibes.diy.asset-grant.v1";
const ALG = "HS256";
const ISSUER = "vibes.diy.asset-grant";
const AUDIENCE = "vibes.diy.put-asset";

export interface AssetGrantSigner {
  sign(claims: Omit<AssetGrantClaims, "iat" | "exp">, ttlSec: number): Promise<Result<{ token: string; expiresAt: Date }>>;
  verify(token: string): Promise<Result<AssetGrantClaims>>;
}

export interface CreateAssetGrantSignerParams {
  readonly sthis: SuperThis;
  readonly secret: string;
  readonly info?: string;
}

export async function createAssetGrantSigner(params: CreateAssetGrantSignerParams): Promise<Result<AssetGrantSigner>> {
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
        const token = await new SignJWT({
          userId: claims.userId,
          ownerHandle: claims.ownerHandle,
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
        ownerHandle: payload.ownerHandle as string,
        appSlug: payload.appSlug as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
        ...(typeof payload.mimeType === "string" ? { mimeType: payload.mimeType } : {}),
      };
      return Result.Ok(claims);
    },
  });
}
