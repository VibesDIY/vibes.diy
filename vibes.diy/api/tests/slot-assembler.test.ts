import { describe, it, expect } from "vitest";
import {
  renderSlotsWithDedup,
  type SlotEntry,
  pickCanonicalHome,
  assembleSlotMessages,
  type AssembleInputs,
} from "../svc/intern/slot-assembler.js";

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

describe("assembleSlotMessages", () => {
  const v = (s: string) => new Map([["/App.jsx", s]]);

  it("emits synthetic user messages with ORIGINAL, LAST_EDIT, PREVIOUS in order", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      focusPath: "App.jsx",
      config: {},
    };
    const msgs = assembleSlotMessages(inputs);
    const labels = msgs.map((m) => m.label);
    expect(labels).toEqual(["ORIGINAL", "LAST_EDIT", "PREVIOUS"]);
    msgs.forEach((m) => expect(m.role).toBe("user"));
  });

  it("omits ORIGINAL when slots.original=off", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      focusPath: "App.jsx",
      config: { original: "off" },
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels).toEqual(["LAST_EDIT", "PREVIOUS"]);
  });

  it("CLI-drift case: selected.draft becomes canonical home, previous demotes", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      selectedDraft: v("disk-bytes"),
      focusPath: "App.jsx",
      config: {},
    };
    const msgs = assembleSlotMessages(inputs);
    const labels = msgs.map((m) => m.label);
    expect(labels).toEqual(["ORIGINAL", "PREVIOUS", "LAST_EDIT", "SELECTED_DRAFT"]);
    expect(msgs[msgs.length - 1].label).toBe("SELECTED_DRAFT");
  });

  it("push-seeded degenerate: only selected.draft present", () => {
    const inputs: AssembleInputs = {
      selectedDraft: v("disk-bytes"),
      focusPath: "App.jsx",
      config: {},
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels).toEqual(["SELECTED_DRAFT"]);
  });

  it("recovery turn: recovery-partial canonical, previous demoted", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 3 },
      prev2: v("v2"),
      previous: v("v3"),
      recoveryPartial: v("in-flight"),
      focusPath: "App.jsx",
      config: {},
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels[labels.length - 1]).toBe("RECOVERY_PARTIAL");
  });
});
