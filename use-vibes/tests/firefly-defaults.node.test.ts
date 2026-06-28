import { describe, it, expect } from "vitest";
import { ensureSuperThis, hashStringSync } from "@fireproof/core-runtime";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDeviceIdGetToken } from "../base/firefly-defaults.node.js";

const DEVICE_ID_FILENAME = `${hashStringSync("FIREProof:deviceId")}.json`;

function inMemorySthis() {
  // Use an in-memory keybag so the test never touches real ~/.fireproof/.
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `memory://test-${sthis.nextId().str}`);
  return sthis;
}

function fileKeybagSthis(rawKeybagFile: string) {
  const dir = mkdtempSync(join(tmpdir(), "load-device-id-get-token-"));
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `file://${dir}`);
  writeFileSync(join(dir, DEVICE_ID_FILENAME), rawKeybagFile);
  return sthis;
}

describe("loadDeviceIdGetToken", () => {
  it("throws a helpful error when the keybag has no device-id cert", async () => {
    const sthis = inMemorySthis();
    await expect(loadDeviceIdGetToken(sthis)).rejects.toThrow(/vibes-diy login/);
  });

  it("throws clean re-enroll guidance when keybag bytes are unreadable/corrupt", async () => {
    const sthis = fileKeybagSthis('{"id":"z3QkefAC57rcrs","clazz":"DeviceIdK');

    const err = await loadDeviceIdGetToken(sthis)
      .then(() => null)
      .catch((e) => e);

    const message = err instanceof Error ? err.message : String(err);
    expect(message).toMatch(/login --force/);
    expect(message).not.toMatch(/read bag failed/i);
  });
});
