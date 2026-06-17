import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { getKeyBag } from "@fireproof/core-keybag";
import type { SuperThis } from "@fireproof/core";
import type { JWKPrivate, DeviceIdKeyBagItem, DeviceIdResult } from "@fireproof/core-types-base";
import { Buffer } from "node:buffer";
import { seedDeviceIdFromEnv, VIBES_DEVICE_ID_ENV } from "./device-id-env.js";

// JWKPrivate is a discriminated union; in these tests we only read the EC `x`.
function deviceX(devid: DeviceIdResult): string {
  return (devid.deviceId.Unwrap() as { x: string }).x;
}

function inMemorySthis(): SuperThis {
  // In-memory keybag so the test never touches the real ~/.fireproof/.
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `memory://test-${sthis.nextId().str}`);
  return sthis;
}

// A syntactically valid device-id keybag item. The JWK is checked strictly by
// the seeder, so it must satisfy JWKPrivateSchema; the cert is opaque, so a
// minimal certificateJWT + certificatePayload is enough.
function fakeDeviceIdItem(xField = "device-key-x") {
  return {
    id: "z3QkefAC57rcrs",
    clazz: "DeviceIdKeyBagItem",
    item: {
      deviceId: { kty: "EC", crv: "P-256", x: xField, y: "device-key-y", d: "device-key-d" },
      cert: {
        certificateJWT: "header.payload.sig",
        certificatePayload: { sub: "zuafXh9a", certificate: { commonName: "zuafXh9a" } },
      },
    },
  };
}

describe("seedDeviceIdFromEnv", () => {
  it("is a no-op and returns false when the env var is unset", async () => {
    const sthis = inMemorySthis();
    expect(await seedDeviceIdFromEnv(sthis)).toBe(false);
    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(devid.cert.IsNone()).toBe(true);
  });

  it("seeds the keybag from raw JSON", async () => {
    const sthis = inMemorySthis();
    sthis.env.set(VIBES_DEVICE_ID_ENV, JSON.stringify(fakeDeviceIdItem()));
    expect(await seedDeviceIdFromEnv(sthis)).toBe(true);
    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(devid.cert.IsSome()).toBe(true);
    expect(deviceX(devid)).toBe("device-key-x");
  });

  it("seeds the keybag from base64-encoded JSON", async () => {
    const sthis = inMemorySthis();
    const b64 = Buffer.from(JSON.stringify(fakeDeviceIdItem("b64-x")), "utf8").toString("base64");
    sthis.env.set(VIBES_DEVICE_ID_ENV, b64);
    expect(await seedDeviceIdFromEnv(sthis)).toBe(true);
    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(deviceX(devid)).toBe("b64-x");
  });

  it("accepts the bare item shape ({ deviceId, cert })", async () => {
    const sthis = inMemorySthis();
    sthis.env.set(VIBES_DEVICE_ID_ENV, JSON.stringify(fakeDeviceIdItem("bare-x").item));
    expect(await seedDeviceIdFromEnv(sthis)).toBe(true);
    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(deviceX(devid)).toBe("bare-x");
  });

  it("never clobbers an existing device-id certificate", async () => {
    const sthis = inMemorySthis();
    const kb = await getKeyBag(sthis);
    const original = fakeDeviceIdItem("original-x");
    await kb.setDeviceId(original.item.deviceId as JWKPrivate, original.item.cert as unknown as DeviceIdKeyBagItem["cert"]);
    sthis.env.set(VIBES_DEVICE_ID_ENV, JSON.stringify(fakeDeviceIdItem("replacement-x")));
    expect(await seedDeviceIdFromEnv(sthis)).toBe(false);
    const devid = await kb.getDeviceId();
    expect(deviceX(devid)).toBe("original-x");
  });

  it("throws a clear error when the value is neither JSON nor base64 JSON", async () => {
    const sthis = inMemorySthis();
    sthis.env.set(VIBES_DEVICE_ID_ENV, "%%% not json or base64 %%%");
    await expect(seedDeviceIdFromEnv(sthis)).rejects.toThrow(new RegExp(VIBES_DEVICE_ID_ENV));
  });

  it("throws when the device private key is invalid", async () => {
    const sthis = inMemorySthis();
    const item = fakeDeviceIdItem();
    delete (item.item.deviceId as Record<string, unknown>).d; // EC key without the private scalar
    sthis.env.set(VIBES_DEVICE_ID_ENV, JSON.stringify(item));
    await expect(seedDeviceIdFromEnv(sthis)).rejects.toThrow(/invalid device private key/);
  });

  it("throws when the signed certificate is missing", async () => {
    const sthis = inMemorySthis();
    const item = fakeDeviceIdItem();
    delete (item.item as Record<string, unknown>).cert;
    sthis.env.set(VIBES_DEVICE_ID_ENV, JSON.stringify(item));
    await expect(seedDeviceIdFromEnv(sthis)).rejects.toThrow(/missing the signed certificate/);
  });
});
