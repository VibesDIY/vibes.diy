import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { loadDeviceIdGetToken } from "../base/firefly-defaults.node.js";

function inMemorySthis() {
  // Use an in-memory keybag so the test never touches real ~/.fireproof/.
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `memory://test-${sthis.nextId().str}`);
  return sthis;
}

describe("loadDeviceIdGetToken", () => {
  it("throws a helpful error when the keybag has no device-id cert", async () => {
    const sthis = inMemorySthis();
    await expect(loadDeviceIdGetToken(sthis)).rejects.toThrow(/vibes-diy login/);
  });
});
