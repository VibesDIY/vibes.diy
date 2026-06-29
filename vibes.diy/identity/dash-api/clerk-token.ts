// Lifted verbatim from @fireproof/core-protocols-dashboard@0.24.19 `token.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19): the `ClerkApiToken`
// Clerk-claim decoder/verifier. Split into its own module (separate from the
// device-id verifiers in `token.ts`) because it is BROWSER-safe — it has zero
// device-id-crypto dependencies — and is linked into the browser bundle via
// `@vibes.diy/identity` (`index.ts`) for `VibesDiyApi.getTokenClaims()`. Keeping
// it here means the browser surface never drags `DeviceIdCA`/`DeviceIdVerifyMsg`
// into its module graph.
//
// Wired to the owned lenient `ClerkClaimSchema` / `FPClerkClaimSchema`
// (clerk-claim.ts), so real Clerk JWTs that omit `first`/`image_url`/`last`/
// `name` still decode now that the upstream `core-types-base` patch is gone.
// Only imports were adjusted; the decode/verify logic is byte-for-byte the same,
// gated by auth-token-verify-golden.test.ts through the identity facade.
import { Lazy, Result, param, exception2Result } from "@adviser/cement";
import * as sts from "../sts/index.js";
import { decodeJwt, jwtVerify, type JWK } from "jose";
import { ClerkClaimSchema, FPClerkClaimSchema } from "../clerk-claim.js";
import type { SuperThis } from "@fireproof/core-types-base";
import type { FPApiToken, VerifiedClaimsResult } from "../types/wire.js";

export class ClerkApiToken implements FPApiToken {
  readonly sthis: SuperThis;
  constructor(sthis: SuperThis) {
    this.sthis = sthis;
  }

  readonly keysAndUrls = Lazy((): Result<{ keys: string[]; urls: string[] }> => {
    const keys: string[] = [];
    const urls: string[] = [];
    for (let idx = 0; ; idx++) {
      const suffix = !idx ? "" : `_${idx}`;
      const key = `CLERK_PUB_JWT_KEY${suffix}`;
      const url = `CLERK_PUB_JWT_URL${suffix}`;
      const rEnvVal = this.sthis.env.gets({ [key]: param.OPTIONAL, [url]: param.OPTIONAL });
      if (rEnvVal.isErr()) {
        return Result.Err(rEnvVal.Err());
      }
      const { [key]: keyVal, [url]: urlVal } = rEnvVal.Ok();
      if (!keyVal && !urlVal) {
        break;
      }
      if (keyVal) {
        keys.push(keyVal);
      }
      if (urlVal) {
        urls.push(
          ...urlVal
            .split(",")
            .map((u) => u.trim())
            .filter((u) => u)
        );
      }
    }
    return Result.Ok({ keys, urls });
  });

  async decode(token: string): Promise<Result<VerifiedClaimsResult>> {
    const claims = await exception2Result(() => decodeJwt(token));
    if (claims.isErr()) {
      return Result.Err(claims);
    }
    const r = ClerkClaimSchema.safeParse(claims.Ok());
    if (!r.success) {
      return Result.Err(r.error);
    }
    return Result.Ok({ type: "clerk", token, claims: r.data });
  }

  async verify(token: string): Promise<Result<VerifiedClaimsResult>> {
    const rKaUs = this.keysAndUrls();
    if (rKaUs.isErr()) {
      return Result.Err(rKaUs);
    }
    const { keys, urls } = rKaUs.Ok();
    const rt = await sts.verifyToken(token, keys, urls, {
      parseSchema: (payload: unknown) => {
        const r = FPClerkClaimSchema.safeParse(payload);
        if (r.success) {
          return Result.Ok(r.data);
        } else {
          console.log("FPClerkClaimSchema parse error", payload, r.error);
          return Result.Err(r.error);
        }
      },
      verifyToken: async (tok: string, key: JWK) => {
        const rPublicKey = await sts.importJWK(key, "RS256");
        if (rPublicKey.isErr()) {
          return Result.Err(rPublicKey);
        }
        const r = await exception2Result(() => jwtVerify(tok, rPublicKey.Ok().key));
        if (r.isErr()) {
          return Result.Err(r);
        }
        if (!r.Ok()) {
          return Result.Err("ClerkVerifyToken: failed");
        }
        return Result.Ok({ payload: r.Ok() });
      },
    } as never);
    if (rt.isErr()) {
      return Result.Err(rt.Err());
    }
    const t = rt.Ok() as { payload: unknown };
    return Result.Ok({ type: "clerk", token, claims: t.payload });
  }
}
