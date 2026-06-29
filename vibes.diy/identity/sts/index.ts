// Lifted verbatim from @fireproof/core-runtime@0.24.19 `sts-service/index.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19), adjusting only imports and
// adding types. The JWK/JWT crypto the identity package re-exports as `sts`:
//   - importJWK / jwk2env / env2jwk — JWK <-> env material (CLOUD_SESSION_TOKEN_*)
//   - verifyToken (+ fetchWellKnownJwks, coerceJWK*) — token verification
// Verify/sign logic kept byte-identical (same `jose` calls, same JWK/JWT layout);
// schemas are sourced from the in-repo `../types/wire.js` (the owned parity
// artifacts) and `ensureSuperThis` stays on core-runtime until T4. The unused
// `SessionTokenService` (sign path) is intentionally NOT lifted — no live path
// reaches it through the `sts` facade (repo-wide usage is env2jwk/importJWK/
// jwk2env/verifyToken only). Gated by auth-token-verify-golden + identity-wire-compat.
import { BuildURI, KeyedResolvOnce, Option, Result, exception2Result, timeouted } from "@adviser/cement";
import { exportJWK, importJWK as joseImportJWK, jwtVerify, importSPKI } from "jose";
import type { JWK } from "jose";
import { base58btc } from "multiformats/bases/base58";
import { z } from "zod";
import { ensureSuperThis } from "../runtime/superthis.js";
import type { SuperThis, JWKPublic, JWKPrivate } from "@fireproof/core-types-base";
import { JWKPrivateSchema, JWKPublicSchema, toJwksAlg } from "../types/wire.js";
import { mimeBlockParser, filterOk } from "./text-blocks.js";

type JoseKey = Awaited<ReturnType<typeof joseImportJWK>>;

export const envKeyDefaults = {
  SECRET: "CLOUD_SESSION_TOKEN_SECRET",
  PUBLIC: "CLOUD_SESSION_TOKEN_PUBLIC",
};

export async function importJWK(
  jwk: JWK,
  alg?: string,
  options?: { extractable?: boolean }
): Promise<Result<{ key: JoseKey; alg: string }>> {
  let algorithm;
  if (alg) {
    algorithm = alg;
  } else {
    const rAlg = toJwksAlg(jwk);
    if (rAlg.isErr()) {
      return Result.Err(rAlg);
    }
    algorithm = rAlg.Ok();
  }
  const rKey = await exception2Result(() => joseImportJWK(jwk, algorithm, options));
  if (rKey.isErr()) {
    return Result.Err(rKey);
  }
  return Result.Ok({ key: rKey.Ok(), alg: algorithm });
}

export async function jwk2env(jwk: CryptoKey | JWK, sthis: SuperThis = ensureSuperThis()): Promise<string> {
  // Upstream passes either an exportable key (normal path) or an already-plain
  // JWK (fallback when export throws). exportJWK's typed signature only accepts a
  // key, so cast — exception2Result catches the throw and falls back, verbatim.
  const rJwk = await exception2Result(() => exportJWK(jwk as Parameters<typeof exportJWK>[0]));
  const inPubKey = rJwk.isOk() ? rJwk.Ok() : jwk;
  return base58btc.encode(sthis.txt.encode(JSON.stringify(inPubKey)));
}

export async function env2jwk(env: string, alg?: string, sthis: SuperThis = ensureSuperThis()): Promise<JoseKey[]> {
  const jwks = await coerceJWK(sthis, env);
  if (jwks.length === 0) {
    throw new Error("No valid JWK found in env");
  }
  const keys: JoseKey[] = [];
  for (const jwk of jwks) {
    const rKey = await importJWK(jwk as JWK, alg, { extractable: true });
    if (rKey.isErr()) {
      throw rKey.Err();
    }
    keys.push(rKey.Ok().key);
  }
  return keys;
}

function coercesJWKplainOrkeysObject(keyOrkeys: unknown, validator: z.ZodTypeAny): Result<unknown>[] {
  const keys: unknown[] = [];
  const isKeys = z.object({ keys: z.array(z.any()) }).safeParse(keyOrkeys);
  if (isKeys.success) {
    keys.push(...isKeys.data.keys);
  } else {
    keys.push(keyOrkeys);
  }
  return keys.map((key) => {
    const parsed = validator.safeParse(key);
    if (parsed.success) {
      return Result.Ok(parsed.data);
    } else {
      return Result.Err(parsed.error);
    }
  });
}

export async function coerceJWKWithSchema(
  sthis: SuperThis,
  validator: z.ZodTypeAny,
  ...inputs: unknown[]
): Promise<Result<unknown>[]> {
  return Promise.all(
    inputs.flat().map(async (keys) => {
      if (typeof keys === "string") {
        const jwkKeys: Result<unknown>[] = [];
        for (const { content, begin, end } of mimeBlockParser(keys)) {
          if (begin && end) {
            const pem = `${begin}\n${content}\n${end}\n`;
            const rKey = await exception2Result(() => importSPKI(pem, "RS256"));
            if (rKey.isErr()) {
              jwkKeys.push(Result.Err(rKey.Err()));
              continue;
            }
            const key = rKey.Ok();
            const jwk = await exportJWK(key);
            const parsed = validator.safeParse({ ...jwk, alg: "RS256" });
            if (parsed.success) {
              jwkKeys.push(Result.Ok(parsed.data));
            } else {
              jwkKeys.push(Result.Err(parsed.error));
            }
            continue;
          }
          let encodingFailed = Option.Some(Result.Err("Failed to decode JWK string with any known encoding"));
          for (const decodeFn of [
            (a: string) => a,
            (a: string) => sthis.txt.base64.decode(a),
            (a: string) => sthis.txt.base58.decode(a),
          ]) {
            const res = exception2Result(() => decodeFn(content));
            if (res.isErr()) {
              continue;
            }
            const resStr = res.Ok();
            const keyOrkeys = exception2Result(() => JSON.parse(resStr));
            if (keyOrkeys.isErr()) {
              continue;
            }
            encodingFailed = Option.None();
            for (const rKey of coercesJWKplainOrkeysObject(keyOrkeys.Ok(), validator)) {
              jwkKeys.push(rKey);
            }
          }
          if (encodingFailed.IsSome()) {
            jwkKeys.push(encodingFailed.Unwrap());
          }
        }
        return jwkKeys;
      } else {
        return coercesJWKplainOrkeysObject(keys, validator);
      }
    })
  ).then((a) => a.flat());
}

export async function coerceJWK(sthis: SuperThis, ...i: unknown[]): Promise<unknown[]> {
  const priv = await coerceJWKWithSchema(sthis, JWKPrivateSchema, ...i);
  const pub = await coerceJWKWithSchema(sthis, JWKPublicSchema, ...i);
  if (priv.length !== pub.length) {
    throw new Error("Mismatched number of private and public keys");
  }
  const ret: Result<unknown>[] = [];
  for (let idx = 0; idx < priv.length; idx++) {
    const rPriv = priv[idx];
    const rPub = pub[idx];
    if (rPriv.isOk()) {
      ret.push(rPriv);
    } else if (rPub.isOk()) {
      ret.push(rPub);
    } else {
      if (rPriv.Err()) {
        ret.push(Result.Err(rPriv.Err()));
      } else {
        ret.push(Result.Err(rPub.Err()));
      }
    }
  }
  return filterOk(ret);
}

export async function coerceJWKPublic(sthis: SuperThis, ...i: unknown[]): Promise<JWKPublic[]> {
  return filterOk(await coerceJWKWithSchema(sthis, JWKPublicSchema, ...i)) as JWKPublic[];
}

export async function coerceJWKPrivate(sthis: SuperThis, ...i: unknown[]): Promise<JWKPrivate[]> {
  return filterOk(await coerceJWKWithSchema(sthis, JWKPrivateSchema, ...i)) as JWKPrivate[];
}

interface VerifyTokenOptions {
  fetchTimeoutMs: number;
  parseSchema: (payload: unknown) => Result<unknown>;
  fetch: typeof globalThis.fetch;
  verifyToken: (token: string, pubKey: JWK) => Promise<Result<{ payload: unknown }>>;
  sthis: SuperThis;
}

export async function verifyToken(
  token: string,
  presetPubKey: readonly (JWK | string)[],
  wellKnownUrls: readonly string[],
  iopts: Partial<VerifyTokenOptions> = {}
): Promise<Result<unknown>> {
  const opts: VerifyTokenOptions = {
    fetchTimeoutMs: 1000,
    parseSchema: (payload: unknown) => {
      return Result.Ok(payload);
    },
    fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),
    verifyToken: async (token: string, pubKey: JWK) => {
      const rKey = await importJWK(pubKey);
      if (rKey.isErr()) {
        return Result.Err(rKey);
      }
      const rRes = await exception2Result(() => jwtVerify(token, rKey.Ok().key));
      if (rRes.isErr()) {
        return Result.Err(rRes);
      }
      const res = rRes.Ok();
      if (!res) {
        return Result.Err("JWT verification failed");
      }
      return Result.Ok(res);
    },
    ...iopts,
    sthis: iopts.sthis ?? ensureSuperThis(),
  };
  for (const pubKey of presetPubKey) {
    const coercedKeys = await coerceJWKPublic(opts.sthis, pubKey);
    for (const key of coercedKeys) {
      const rVerify = await internVerifyToken(token, key as unknown as JWK, opts);
      if (rVerify.isOk()) {
        return rVerify;
      }
    }
  }
  const errors: unknown[] = [];
  for (const url of wellKnownUrls) {
    const rPubKeys = await fetchWellKnownJwks([url], opts);
    for (const pubKey of rPubKeys) {
      switch (true) {
        case isFetchWellKnownJwksResultErr(pubKey):
        case isFetchWellKnownJwksResultTimeout(pubKey):
          errors.push(pubKey);
          continue;
        case isFetchWellKnownJwksResultOk(pubKey):
          {
            for (const key of pubKey.keys) {
              const rVerify = await internVerifyToken(token, key as unknown as JWK, opts);
              if (rVerify.isOk()) {
                return rVerify;
              } else {
                errors.push({
                  type: "error",
                  error: rVerify.Err(),
                  url: pubKey.url,
                });
              }
            }
          }
          break;
        default:
          throw new Error("unreachable");
      }
    }
  }
  return Result.Err(`No well-known JWKS URL could verify the token:\n${JSON.stringify(errors, null, 2)}`);
}

async function internVerifyToken(token: string, presetPubKey: JWK, opts: VerifyTokenOptions): Promise<Result<unknown>> {
  const rVerify = await opts.verifyToken(token, presetPubKey);
  if (rVerify.isErr()) {
    return Result.Err(rVerify);
  }
  return opts.parseSchema((rVerify.Ok() as { payload: unknown }).payload);
}

interface FetchWellKnownJwksResultOk {
  readonly type: "ok";
  readonly keys: JWKPublic[];
  readonly url: string;
}
interface FetchWellKnownJwksResultErr {
  readonly type: "error";
  readonly error: unknown;
  readonly url: string;
}
interface FetchWellKnownJwksResultTimeout {
  readonly type: "timeout";
  readonly url: string;
}
type FetchWellKnownJwksResult = FetchWellKnownJwksResultOk | FetchWellKnownJwksResultErr | FetchWellKnownJwksResultTimeout;

export function isFetchWellKnownJwksResultOk(r: FetchWellKnownJwksResult): r is FetchWellKnownJwksResultOk {
  return r.type === "ok";
}
export function isFetchWellKnownJwksResultErr(r: FetchWellKnownJwksResult): r is FetchWellKnownJwksResultErr {
  return r.type === "error";
}
export function isFetchWellKnownJwksResultTimeout(r: FetchWellKnownJwksResult): r is FetchWellKnownJwksResultTimeout {
  return r.type === "timeout";
}

const keysFromWellKnownJwksCache = new KeyedResolvOnce<FetchWellKnownJwksResult>({
  resetAfter: 30 * 60 * 1000,
});

export async function fetchWellKnownJwks(
  urls: string | (string | undefined)[],
  iopts: Partial<Pick<VerifyTokenOptions, "fetchTimeoutMs" | "fetch">> = {}
): Promise<FetchWellKnownJwksResult[]> {
  const opts = {
    fetchTimeoutMs: 1000,
    fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),
    ...iopts,
  };
  return Promise.all(
    (Array.isArray(urls) ? urls : [urls])
      .flat()
      .map((u) => {
        if (!u) {
          return undefined;
        }
        const buri = BuildURI.from(u);
        const url = buri.URI();
        if (url.pathname === "" || url.pathname === "/") {
          buri.pathname("/.well-known/jwks.json");
        }
        return buri.toString();
      })
      .filter((u): u is string => !!u)
      .map(async (url) => {
        const onceFn = keysFromWellKnownJwksCache.get(url);
        return onceFn.once(async () => {
          const timeout = await timeouted(
            opts
              .fetch(url, {
                method: "GET",
              })
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`Failed to fetch well-known JWKS from ${url}: ${res.status} ${res.statusText}`);
                }
                return res.json();
              }),
            {
              timeout: opts.fetchTimeoutMs || 1000,
            }
          );
          switch (timeout.state) {
            case "timeout":
              onceFn.reset();
              return {
                type: "timeout",
                url,
              } as FetchWellKnownJwksResult;
            case "error":
              onceFn.reset();
              return {
                type: "error",
                error: timeout.error,
                url,
              } as FetchWellKnownJwksResult;
            case "success": {
              const parsed = z.object({ keys: JWKPublicSchema.array() }).safeParse(timeout.value);
              if (!parsed.success) {
                return {
                  type: "error",
                  error: new Error(`Invalid JWKS format from ${url}: ${parsed.error.message}`),
                  url,
                } as FetchWellKnownJwksResult;
              }
              return {
                type: "ok",
                keys: parsed.data.keys,
                url,
              } as FetchWellKnownJwksResult;
            }
            default:
              throw new Error("unreachable");
          }
        });
      })
  );
}
