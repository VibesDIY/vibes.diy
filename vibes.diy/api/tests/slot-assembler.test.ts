import { describe, it, expect } from "vitest";
import { renderSlotsWithDedup, type SlotEntry, pickCanonicalHome } from "../svc/intern/slot-assembler.js";

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

describe("pickCanonicalHome", () => {
  it("returns 'recovery' when a recovery-partial slot is present", () => {
    expect(pickCanonicalHome({ recoveryPartial: m({}), previous: m({}) })).toBe("recovery");
  });

  it("returns 'selected-draft' when CLI draft present and no recovery", () => {
    expect(pickCanonicalHome({ selectedDraft: m({}), previous: m({}) })).toBe("selected-draft");
  });

  it("returns 'previous' otherwise", () => {
    expect(pickCanonicalHome({ previous: m({}) })).toBe("previous");
  });

  it("returns 'selected-draft' even when previous absent (push-seeded case)", () => {
    expect(pickCanonicalHome({ selectedDraft: m({}) })).toBe("selected-draft");
  });

  it("returns 'none' when nothing is present", () => {
    expect(pickCanonicalHome({})).toBe("none");
  });
});
