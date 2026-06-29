// Frozen byte-compat fixtures for the identity crypto lift (Bucket E).
//
// These are the EXACT outputs of `@fireproof/core-runtime@0.24.19` for fixed
// inputs, captured once (T5) before the live dependency was dropped. The
// extracted in-repo implementations (hashing / sts / superthis) were proven
// byte-identical to fireproof via live extracted⇄fireproof cross-checks in T2–T4
// (gated in CI). T5 freezes those reference values here so the byte-compat gate
// survives without importing `@fireproof/core-runtime` — a drift in any lifted
// function now fails against the frozen contract. To re-capture (e.g. a managed
// upstream bump), restore the temporary probe against the installed package.
//
// Provenance: `@fireproof/core-runtime@0.24.19` (utils.js hashing/codecs/
// timeOrderedNextId; sts-service/index.js jwk2env), upstream tag v0.24.19.

export const HASH_STRING_SYNC: Record<string, string> = {
  "": "z43efqZHuytwif",
  "FIREProof:deviceId": "z3QkefAC57rcrs",
  "https://vibes.diy/api/app?vibe=a--b": "z2PL9ymkgoSpsh",
  "héllo-✓": "zoEJJySkpnGNB",
};

export const HASH_STRING_ASYNC: Record<string, string> = {
  "": "bagaaierackxdfsy6yawqd3ndlanre7a75y5q3rjvolwwxlzds4q2apmc4eta",
  "FIREProof:deviceId": "bagaaiera6g7gl4xwyvyxznewklj5ss2mnnpetf2chkbkbs7qvk4jmvwbx4yq",
  "https://vibes.diy/api/app?vibe=a--b": "bagaaierabgur5owufsrtvimcga3qjnbqrpasa5kgqltryrillk4xfulk6xqq",
  "héllo-✓": "bagaaiera6myk2lo7rvhb6gbpugplkgentg3utiuqfnrfjumyft2dcd4bablq",
};

// hashObjectAsync for [{a:1,b:"x"}, {z:[1,2,3],a:true}, {nested:{k:"v"}}]
export const HASH_OBJECT_ASYNC: readonly string[] = [
  "bagaaierape4rk3cjwycpcc6l2o64r6ml37w6hvovcehaidea4ds56fo4f2xq",
  "bagaaieravgzhkf2ppqvr4tp2yubyhyyo4nk6ar7jddlwes2sdw7wvns3672q",
  "bagaaierax3ocu5ygtfgnql3nik236m4el7fpxhtwucnkvr6eqypgbyndgaqa",
];

export const TXT_BASE64: Record<string, string> = {
  "": "",
  "FIREProof:deviceId": "RklSRVByb29mOmRldmljZUlk",
  "https://vibes.diy/api/app?vibe=a--b": "aHR0cHM6Ly92aWJlcy5kaXkvYXBpL2FwcD92aWJlPWEtLWI=",
  "héllo-✓": "aMOpbGxvLeKckw==",
};

// Raw UTF-8 bytes of `txt.encode(...)` — a direct encoding contract so a raw
// encoding regression can't hide behind a base64/base58 round-trip (Charlie #2858).
export const TXT_ENCODE_UTF8: Record<string, readonly number[]> = {
  "héllo-✓": [104, 195, 169, 108, 108, 111, 45, 226, 156, 147],
};

export const TXT_BASE58: Record<string, string> = {
  "": "z",
  "FIREProof:deviceId": "z3v5yMu4QcJsG8d2fQFEiDBJSf",
  "https://vibes.diy/api/app?vibe=a--b": "zBRWJ2YmdUFp2iRGdyqPAr5pLNAXk5MDoswWJ77qyJTKchyHs",
  "héllo-✓": "z6tNzjhdu5dn9WS",
};

// timeOrderedNextId(1_700_000_000_000).str.slice(0, 13) — the deterministic
// time-derived prefix (the rest of the id is random).
export const TIME_ORDERED_PREFIX = "018bcfe5-6800";

// A frozen ES256 (P-256) keypair + the exact `jwk2env(publicKey)` output, for
// the sts byte-compat gate (no random keygen, so the env encoding is pinnable).
export const ES256_PUB_JWK = {
  kty: "EC",
  x: "803wK5CZLo7EjH92zSB-3fLch18WHD_WNRatmQWzExA",
  y: "tzsaGlAEZHQy4UR5jVSIypA32Z1pRarGqBZ_ia4pwRo",
  crv: "P-256",
} as const;

export const ES256_PRIV_JWK = {
  kty: "EC",
  x: "803wK5CZLo7EjH92zSB-3fLch18WHD_WNRatmQWzExA",
  y: "tzsaGlAEZHQy4UR5jVSIypA32Z1pRarGqBZ_ia4pwRo",
  crv: "P-256",
  d: "4VRVt4lZwRbSZcz3-daj0kXErKJQrqP73UDBCwQ7HAE",
} as const;

export const JWK2ENV_PUB =
  "zeWndr5LEoaySgKSo2aZniYqUqxa1yJRVUx1QKEWwvhPhB7yAWHaDeeHTTeA1BtAMVW1BUB9WGwjjved8sSLg1mmssJGreZpBZwxqz7jijTFkJUFFjWMPx1RK44sMbHDEGaaoYHyRD1uipjtxsnMWZyz4tMvP6LcE2HyLmHLv3a2Y";
