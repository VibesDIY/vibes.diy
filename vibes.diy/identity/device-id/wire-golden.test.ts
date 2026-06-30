// Permanent device-id wire byte-parity gate (#2937).
//
// The in-repo device-id signer/Certor must reproduce the EXACT JWT header bytes
// the upstream @fireproof/core-device-id@0.24.19 produced — that header carries
// the x5c cert (Certor's canonical sorted-key JSON) and the x5t / x5t#S256
// thumbprints, which are the load-bearing wire contract the server verifier
// checks. `device-id-wire-golden.fixture.json` froze those bytes from upstream
// (cross-checked byte-identical against this signer at capture time, see
// `gen-wire-golden` in the #2937 PR) so the parity is pinned WITHOUT a live
// `@fireproof/*` dependency. If this fails, the lifted crypto drifted from the
// dropped upstream path — investigate before shipping.
//
// Only the key/cert-derived header is frozen: the JWT signature is randomized
// (ES256) and `iat`/`exp` are wall-clock (jose `setIssuedAt`/`setExpirationTime`),
// so those are intentionally NOT asserted here.
import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "../index.js";
import type { JWKPrivate } from "../index.js";
import type { CertificatePayload } from "../types/cert-payload.js";
import { DeviceIdKey } from "./key.js";
import { DeviceIdSignMsg } from "./sign.js";

const KEYBAG = (await import("../keybag/keybag-golden.fixture.json", { with: { type: "json" } })).default as {
  readonly item: { readonly deviceId: JWKPrivate; readonly cert: { readonly certificatePayload: CertificatePayload } };
};
const GOLDEN = (await import("./device-id-wire-golden.fixture.json", { with: { type: "json" } })).default as {
  readonly fixedClaims: { iss: string; sub: string; seq: number; exp: number; nbf: number; iat: number; jti: string };
  readonly headerSegment: string;
  readonly header: Record<string, unknown>;
};

describe("device-id wire byte-parity (owned signer vs frozen upstream header)", () => {
  it("reproduces the frozen JWT header byte-for-byte for the golden key+cert", async () => {
    const sthis = ensureSuperThis();
    const key = (await DeviceIdKey.createFromJWK(KEYBAG.item.deviceId)).Ok();
    const token = await new DeviceIdSignMsg(sthis.txt.base64, key, KEYBAG.item.cert.certificatePayload).sign(
      { ...GOLDEN.fixedClaims, deviceId: await key.fingerPrint() },
      "ES256"
    );
    const headerSeg = token.split(".")[0];
    // Byte-for-byte: the encoded header segment must equal the frozen upstream one.
    expect(headerSeg).toBe(GOLDEN.headerSegment);
    // And the decoded shape, as a human-readable guard on what those bytes mean.
    const header = JSON.parse(Buffer.from(headerSeg, "base64url").toString("utf8"));
    expect(header).toEqual(GOLDEN.header);
    expect(header.x5t).toBe(GOLDEN.header["x5t"]);
    expect(header["x5t#S256"]).toBe(GOLDEN.header["x5t#S256"]);
  });
});
