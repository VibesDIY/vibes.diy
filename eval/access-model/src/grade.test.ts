import { describe, it, expect } from "vitest";
import { gradeRow } from "./grade.js";
import type { AccessAnalysis } from "./invariants.js";

const clean = (o: Partial<AccessAnalysis>): AccessAnalysis => ({
  isOwnerWriteGate: false,
  isOwnerToken: false,
  requireRoleOwnerWrite: false,
  formAStrict: false,
  formABroad: false,
  perUserChannel: false,
  authorCheckCreate: false,
  authorCheckUpdate: false,
  authorImmutable: false,
  selfGrant: false,
  perVisitorClean: false,
  objectChannel: false,
  memberAuthoredShare: false,
  requireAccessChild: false,
  joinPath: false,
  perObjectRecipe: false,
  authorRosterGrant: false,
  ownerOnlyContent: false,
  ownerPublished: false,
  publicRead: false,
  authorOwned: false,
  ...o,
});

describe("gradeRow", () => {
  it("FAIL on Form-A strict regardless of render", () => {
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ formAStrict: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: null,
    });
    expect(g.grade).toBe("FAIL");
  });
  it("FAIL on isOwner write-gate", () => {
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ perVisitorClean: true, isOwnerWriteGate: true, isOwnerToken: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: null,
    });
    expect(g.grade).toBe("FAIL");
  });
  it("FAIL on a bare isOwner token even without the user.isOwner write-gate form", () => {
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ perVisitorClean: true, isOwnerToken: true }), // e.g. doc.isOwner / an isOwner var
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: { secondVisitorCanAct: true, reason: "" },
    });
    expect(g.grade).toBe("FAIL");
    expect(g.reasons.some((r) => r.includes("isOwner token"))).toBe(true);
  });
  it("SOFT when model correct but App not renderable (orthogonal completeness failure)", () => {
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ perVisitorClean: true }),
      files: { twoFile: true, renderable: false, reasons: ["duplicate import"] },
      judge: { secondVisitorCanAct: true, reason: "" },
    });
    expect(g.grade).toBe("SOFT");
  });
  it("PASS when model correct, renderable, and the second visitor can act", () => {
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ perVisitorClean: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: { secondVisitorCanAct: true, reason: "" },
    });
    expect(g.grade).toBe("PASS");
  });
  it("FAIL when the judge says a second visitor is locked out of a multiplayer app", () => {
    const g = gradeRow({
      expect: "per-object",
      analysis: clean({ perObjectRecipe: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: { secondVisitorCanAct: false, reason: "owner-only" },
    });
    expect(g.grade).toBe("FAIL");
  });
  it("per-object without the full recipe is FAIL on the model axis", () => {
    const g = gradeRow({
      expect: "per-object",
      analysis: clean({ objectChannel: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: { secondVisitorCanAct: true, reason: "" },
    });
    expect(g.grade).toBe("FAIL");
  });
  it("SOFT (not PASS) when a multiplayer model is statically clean but the judge was unavailable", () => {
    // judge === null on a multiplayer dim means the second-visitor check could not run;
    // must not inflate to a clean PASS (Codex/Charlie review #2621).
    const g = gradeRow({
      expect: "per-visitor",
      analysis: clean({ perVisitorClean: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: null,
    });
    expect(g.grade).toBe("SOFT");
    expect(g.reasons.some((r) => r.includes("judge unavailable"))).toBe(true);
  });
  it("PASS for owner-published (single-player) with no judge — judge not required", () => {
    const g = gradeRow({
      expect: "owner-published",
      analysis: clean({ ownerPublished: true, publicRead: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: null,
    });
    expect(g.grade).toBe("PASS");
  });
  it("FAIL for owner-only-content (#2631): requireRole('owner') on the post is the retired dead-end", () => {
    const g = gradeRow({
      expect: "owner-published",
      analysis: clean({ ownerOnlyContent: true, requireRoleOwnerWrite: true, publicRead: true }),
      files: { twoFile: true, renderable: true, reasons: [] },
      judge: null,
    });
    expect(g.grade).toBe("FAIL");
    expect(g.reasons.some((r) => r.includes("owner-only content"))).toBe(true);
  });
});
