import { describe, it, expect } from "vitest";
import { resolveSlotConfig } from "../svc/intern/slot-assembler.js";

describe("resolveSlotConfig", () => {
  it("request config overrides env defaults", () => {
    const cfg = resolveSlotConfig({ original: "off" }, { SLOTS_ORIGINAL: "on", SLOTS_LAST_EDIT: "off" });
    expect(cfg.original).toBe("off"); // request wins
    expect(cfg.last_edit).toBe("off"); // env applies
  });

  it("missing env values default to 'on'", () => {
    const cfg = resolveSlotConfig({}, {});
    expect(cfg.original).toBe("on");
    expect(cfg.last_edit).toBe("on");
    expect(cfg.previous).toBe("on");
    expect(cfg.selected).toBe("on");
    expect(cfg.compaction).toBe("on");
  });
});
