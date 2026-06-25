import { describe, it, expect } from "vitest";
import { gradeConsentRow, type ConsentVerdict } from "./grade-consent.js";
import type { AccessAnalysis } from "./invariants.js";

// gradeConsentRow only reads analysis.isOwnerToken; the rest is irrelevant by design
// (collaboration / shape is never penalized under the consent rubric).
const analysis = (isOwnerToken = false): AccessAnalysis =>
  ({
    isOwnerWriteGate: isOwnerToken,
    isOwnerToken,
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
  }) satisfies AccessAnalysis;

const render = { twoFile: true, renderable: true, reasons: [] as string[] };
const consent = (o: Partial<ConsentVerdict> = {}): ConsentVerdict => ({
  hasConsentPath: true,
  accessLeakedWithoutConsent: false,
  reason: "",
  ...o,
});

describe("gradeConsentRow", () => {
  it("FAILs on the isOwner token regardless of everything else", () => {
    const g = gradeConsentRow({ analysis: analysis(true), files: render, consent: consent(), judgeRequired: true });
    expect(g.grade).toBe("FAIL");
    expect(g.reasons.some((r) => r.includes("isOwner token"))).toBe(true);
  });

  it("FAILs on a consent leak (access granted without consent)", () => {
    const g = gradeConsentRow({
      analysis: analysis(),
      files: render,
      consent: consent({ accessLeakedWithoutConsent: true, reason: "auto-grants strangers" }),
      judgeRequired: true,
    });
    expect(g.grade).toBe("FAIL");
    expect(g.reasons.some((r) => r.includes("consent leak"))).toBe(true);
  });

  it("FAILs on a true dead-end (no consent-respecting path)", () => {
    const g = gradeConsentRow({
      analysis: analysis(),
      files: render,
      consent: consent({ hasConsentPath: false, reason: "locked out, cannot start own nor request" }),
      judgeRequired: true,
    });
    expect(g.grade).toBe("FAIL");
    expect(g.reasons.some((r) => r.includes("dead-end"))).toBe(true);
  });

  it("PASSes a consent-respecting collaborative app (path present, no leak) — shape never checked", () => {
    const g = gradeConsentRow({ analysis: analysis(), files: render, consent: consent(), judgeRequired: true });
    expect(g.grade).toBe("PASS");
  });

  it("SOFT when consent-correct but not renderable", () => {
    const g = gradeConsentRow({
      analysis: analysis(),
      files: { twoFile: true, renderable: false, reasons: ["duplicate import"] },
      consent: consent(),
      judgeRequired: true,
    });
    expect(g.grade).toBe("SOFT");
  });

  it("SOFT when the consent judge was required but unavailable (cannot confirm)", () => {
    const g = gradeConsentRow({ analysis: analysis(), files: render, consent: null, judgeRequired: true });
    expect(g.grade).toBe("SOFT");
  });

  it("PASSes a single-writer dim (judge not required) when there is no token and it renders", () => {
    const g = gradeConsentRow({ analysis: analysis(), files: render, consent: null, judgeRequired: false });
    expect(g.grade).toBe("PASS");
    expect(g.reasons.some((r) => r.includes("static-OK"))).toBe(true);
  });
});
