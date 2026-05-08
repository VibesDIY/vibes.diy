// Shared HKDF-HMAC key derivation for HS256 token signers.
//
// Asset-grant (put-asset write tokens) and asset-session (cookie-bridge
// read tokens) both derive their HMAC key from the same root secret
// (`CLOUD_SESSION_TOKEN_SECRET` — base58btc-encoded JSON containing a
// P-256 ES256 JWK). The `info` string discriminates audiences, so a token
// minted for one signer cannot verify against the other.
//
// HKDF over an EC scalar is cryptographically sound: HKDF treats the IKM
// as opaque entropic input, and the derived HMAC key is one-way separated
// from the EC signing key. The `info` string also versions: rotating to
// `vibes.diy.foo.v2` produces an unrelated derived key without touching
// the env secret.

import { SuperThis } from "@fireproof/core-types-base";
import { base64url } from "jose";

interface ParsedJwk {
  readonly d?: string;
}

export interface DeriveHkdfKeyParams {
  readonly sthis: SuperThis;
  readonly secret: string;
  readonly info: string;
}

export async function deriveHkdfHmacKey(params: DeriveHkdfKeyParams): Promise<CryptoKey> {
  const { sthis, secret, info } = params;
  const jwkJson = sthis.txt.base58.decode(secret);
  const jwk = JSON.parse(jwkJson) as ParsedJwk;
  if (!jwk.d) {
    throw new Error("CLOUD_SESSION_TOKEN_SECRET JWK missing private scalar 'd'");
  }
  // Wrap library outputs in fresh Uint8Arrays so the underlying buffer is
  // typed as ArrayBuffer rather than ArrayBufferLike — jose / sthis.txt
  // return the looser shape and Web Crypto wants the strict one.
  const ikm = new Uint8Array(base64url.decode(jwk.d));
  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: new Uint8Array(sthis.txt.encode(info)),
    },
    ikmKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
