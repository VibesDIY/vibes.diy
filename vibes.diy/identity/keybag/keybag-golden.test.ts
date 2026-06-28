// Golden keybag harness (de-fireproof Task 6.1 — the proof gate, harness-FIRST).
//
// This pins the device-id keybag's on-disk WRITE/READ contract against the
// CURRENT `@fireproof/core-keybag` impl, BEFORE that impl is lifted in-repo
// (#2716). It deliberately imports `getKeyBag` through the `@vibes.diy/identity`
// `./node` facade (`../node.js`) — the exact swap point — so when the lift
// repoints that re-export at an in-repo keybag, this same harness re-runs against
// the lifted code and fails loudly on any contract drift. It is the
// characterization gate; do not weaken an assertion to make a lift pass — fix the
// lift.
//
// Locked contract (captured empirically from the current impl):
//   path     : $HOME/.fireproof/keybag/  (default, node)
//   filename : z3QkefAC57rcrs.json  (= base58btc(hashStringSync("FIREProof:deviceId")), fixed)
//   envelope : { id: "z3QkefAC57rcrs", clazz: "DeviceIdKeyBagItem",
//                item: { deviceId: <JWKPrivate>, cert?: { certificateJWT, certificatePayload } } }
//   two-phase: enroll writes key-only first (no `cert`), then key+cert after the
//              CA callback — so the `cert` key is ABSENT in the key-only state.
//   read      : the on-disk item is STRICT-parsed (full CertificatePayloadSchema);
//               a malformed/partial cert is rejected, not silently accepted.
//
// `keybag-golden.fixture.json` is a REAL device-id keybag file (genuine ES256 key
// + a full CA-issued cert), generated once via the api/tests CA helper and frozen
// here. The keybag read is purely structural (no expiry check), so the fixture
// stays valid indefinitely.
//
// The VIBES_DEVICE_ID headless-seed compatibility gate (Charlie's gate #3) is
// covered by `vibes-diy/cli/device-id-env.test.ts`, which exercises
// `seedDeviceIdFromEnv` through this same facade. The node-only bundle boundary
// (gate #4) is enforced at lift time by `scripts/check-browser-imports.mjs`.
import { describe, it, expect } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureSuperThis } from "../index.js";
import { getKeyBag } from "../node.js";
import type { JWKPrivate, DeviceIdKeyBagItem, SuperThis } from "../index.js";

// base58btc(hashStringSync("FIREProof:deviceId")) — the deterministic, fixed
// on-disk filename for the single device-id slot. Part of the contract.
const DEVICE_ID_FILENAME = "z3QkefAC57rcrs.json";
const DEVICE_ID = "z3QkefAC57rcrs";

// The frozen real keybag file (genuine key + full CA-issued cert).
const FIXTURE = JSON.parse(readFileSync(new URL("./keybag-golden.fixture.json", import.meta.url), "utf8")) as {
  readonly id: string;
  readonly clazz: string;
  readonly item: { readonly deviceId: JWKPrivate; readonly cert: NonNullable<DeviceIdKeyBagItem["cert"]> };
};
const deviceId = FIXTURE.item.deviceId;
const cert = FIXTURE.item.cert;

// A fresh, isolated file-backed keybag per call (unique dir => cold module cache,
// so reads actually hit disk rather than a per-url in-memory cache).
function tmpKeybag(): { dir: string; sthis: SuperThis } {
  const dir = mkdtempSync(join(tmpdir(), "kb-golden-"));
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `file://${dir}`);
  return { dir, sthis };
}

describe("keybag golden — on-disk WRITE contract (two-phase enroll)", () => {
  it("setDeviceId(jwk) persists a key-only envelope (no cert key)", async () => {
    const { dir, sthis } = tmpKeybag();
    await (await getKeyBag(sthis)).setDeviceId(deviceId);

    expect(readdirSync(dir)).toEqual([DEVICE_ID_FILENAME]); // filename + location lock
    const onDisk = JSON.parse(readFileSync(join(dir, DEVICE_ID_FILENAME), "utf8"));
    expect(onDisk).toEqual({ id: DEVICE_ID, clazz: "DeviceIdKeyBagItem", item: { deviceId } });
    // The key-only (pre-CA-callback) state must NOT carry a cert key.
    expect("cert" in onDisk.item).toBe(false);
  });

  it("setDeviceId(jwk, cert) writes the full envelope byte-for-byte equal to the golden file", async () => {
    const { dir, sthis } = tmpKeybag();
    const kb = await getKeyBag(sthis);
    await kb.setDeviceId(deviceId); // phase 1
    await kb.setDeviceId(deviceId, cert); // phase 2 (post-CA-callback)

    const onDisk = JSON.parse(readFileSync(join(dir, DEVICE_ID_FILENAME), "utf8"));
    expect(onDisk).toEqual({ id: DEVICE_ID, clazz: "DeviceIdKeyBagItem", item: { deviceId, cert } });
    expect(onDisk).toEqual(FIXTURE);
  });
});

describe("keybag golden — on-disk READ contract (pre-existing file parses)", () => {
  it("a pre-existing key+cert file reads back to the same key and cert", async () => {
    const { dir, sthis } = tmpKeybag();
    writeFileSync(join(dir, DEVICE_ID_FILENAME), JSON.stringify(FIXTURE));

    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(devid.error).toBeUndefined();
    expect(devid.deviceId.IsSome()).toBe(true);
    expect(devid.deviceId.Unwrap()).toEqual(deviceId);
    expect(devid.cert.IsSome()).toBe(true);
    expect(devid.cert.Unwrap()).toEqual(cert);
  });

  it("a pre-existing key-only file yields deviceId present, cert absent", async () => {
    const { dir, sthis } = tmpKeybag();
    const keyOnly = { id: DEVICE_ID, clazz: "DeviceIdKeyBagItem", item: { deviceId } };
    writeFileSync(join(dir, DEVICE_ID_FILENAME), JSON.stringify(keyOnly));

    const devid = await (await getKeyBag(sthis)).getDeviceId();
    expect(devid.deviceId.IsSome()).toBe(true);
    expect(devid.cert.IsNone()).toBe(true);
  });

  it("rejects a file with a malformed cert (strict cert-payload parse, not silent accept)", async () => {
    const { dir, sthis } = tmpKeybag();
    const malformed = {
      id: DEVICE_ID,
      clazz: "DeviceIdKeyBagItem",
      item: { deviceId, cert: { certificateJWT: "a.b.c", certificatePayload: { sub: "x", certificate: { commonName: "x" } } } },
    };
    writeFileSync(join(dir, DEVICE_ID_FILENAME), JSON.stringify(malformed));

    const devid = await (await getKeyBag(sthis)).getDeviceId();
    // A partial cert fails the strict schema, so the whole item fails to parse.
    expect(devid.error).toBeDefined();
    expect(devid.deviceId.IsNone()).toBe(true);
    expect(devid.cert.IsNone()).toBe(true);
  });
});

describe("keybag golden — contract locks", () => {
  it("default node keybag path is $HOME/.fireproof/keybag/<id>.json", async () => {
    const home = mkdtempSync(join(tmpdir(), "kb-home-"));
    const sthis = ensureSuperThis();
    sthis.env.delete("FP_KEYBAG_URL"); // force default-path derivation
    sthis.env.set("HOME", home);

    await (await getKeyBag(sthis)).setDeviceId(deviceId);
    expect(existsSync(join(home, ".fireproof", "keybag", DEVICE_ID_FILENAME))).toBe(true);
  });
});
