// SPIKE (device-id browser-login spec). Proves the core unknown: a device token
// can be minted with the browser-safe, isomorphic path (no fs / getKeyBag), is a
// valid ES256 JWT carrying the cert chain, and the user identity (Seam 3) is
// recoverable client-side from the cert. Driven by the real VIBES_DEVICE_ID(_PREVIEW)
// keybag in the env — skips if absent. Not a permanent test; delete or fold into a
// real suite when the seam lands.
import { describe, it, expect } from "vitest";
import { decodeProtectedHeader, jwtVerify, importJWK } from "jose";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createDeviceIdGetTokenFromItem, type DeviceIdItem } from "./browser-token.js";
import { Certor } from "./certor.js";

const sthis = ensureSuperThis();
const RAW = process.env.VIBES_DEVICE_ID_PREVIEW ?? process.env.VIBES_DEVICE_ID;

// Browser-safe parse: try JSON, else base64-decode-then-JSON (no Node Buffer).
function parseItem(raw: string): DeviceIdItem {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    parsed = JSON.parse(sthis.txt.base64.decode(raw.trim()));
  }
  const top = parsed as Record<string, unknown>;
  const item = (top.item ?? top) as DeviceIdItem;
  return item;
}

describe.skipIf(!RAW)("device-id browser-token minter (spike)", () => {
  it("mints a server-shaped, signature-valid token and recovers the userId from the cert", async () => {
    const item = parseItem(RAW as string);
    expect(item.deviceId).toBeTruthy();
    expect(item.cert?.certificatePayload).toBeTruthy();

    // 1. Mint via the browser-safe path (the proposed Seam 1 implementation).
    const getToken = await createDeviceIdGetTokenFromItem(sthis, item, { iss: "use-vibes/qa-pr-spike" });
    const rAuth = await getToken();
    expect(rAuth.isOk()).toBe(true);
    const { type, token } = rAuth.Ok();
    expect(type).toBe("device-id");

    // 2. Header carries the cert chain the server verifies against.
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe("ES256");
    expect(Array.isArray(header.x5c) && header.x5c.length > 0).toBe(true);
    expect(header.x5t).toBeTruthy();
    expect(header["x5t#S256"]).toBeTruthy();

    // 3. Signature is valid against the cert's embedded public key (what the
    //    server imports from subjectPublicKeyInfo).
    const cert = Certor.fromString(sthis.txt.base64, (header.x5c as string[])[0]).asCert();
    const pubKey = await importJWK(cert.certificate.subjectPublicKeyInfo, "ES256");
    const { payload } = await jwtVerify(token, pubKey);
    expect(payload.sub).toBe("device-id");
    expect(payload.iss).toBe("use-vibes/qa-pr-spike");
    expect(typeof payload.deviceId).toBe("string");

    // 4. Seam 3: the Clerk userId is recoverable client-side from the cert,
    //    without ClerkApiToken.decode() (which would fail on a device-id token).
    const userId = cert.creatingUser?.claims?.userId;
    expect(typeof userId).toBe("string");
    expect((userId as string).length).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(`[spike] minted device-id token; recovered userId=${userId} deviceId=${payload.deviceId}`);
  });
});
