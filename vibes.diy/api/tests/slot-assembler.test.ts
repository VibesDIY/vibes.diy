import { describe, it, expect } from "vitest";
import { renderSlotsWithDedup, type SlotEntry } from "../svc/intern/slot-assembler.js";

const m = (e: Record<string, string>) => new Map<string, string>(Object.entries(e));

describe("renderSlotsWithDedup", () => {
  it("renders one slot in full when only one is present", () => {
    const slots: SlotEntry[] = [
      { label: "PREVIOUS", caption: "anchor SEARCH here", vfs: m({ "/App.jsx": "hi" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("PREVIOUS");
    expect(out[0].text).toContain("hi");
  });

  it("emits pointer in older slot when file is identical to canonical", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "same", "/Other.jsx": "unique" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "same" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    expect(out[0].text).toContain("unique");
    expect(out[0].text).toContain("identical to PREVIOUS");
  });

  it("renders full bytes when file differs across slots", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "v1" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "v2" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    expect(out[0].text).toContain("v1");
    expect(out[1].text).toContain("v2");
  });

  it("auto-collapses ORIGINAL when content-equal to PREVIOUS across all files", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "x" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "x" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    const labels = out.map((b) => b.label);
    expect(labels).toEqual(["PREVIOUS"]);
  });
});
