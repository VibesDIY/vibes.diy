import type { AccessAnalysis } from "./invariants.js";
import type { Dimension } from "./config.js";
import type { FileCheck } from "./renderable.js";

export type Grade = "PASS" | "SOFT" | "FAIL";
export interface JudgeVerdict {
  readonly secondVisitorCanAct: boolean;
  readonly reason: string;
}

export interface RowGradeInput {
  readonly expect: Dimension;
  readonly analysis: AccessAnalysis;
  readonly files: FileCheck;
  readonly judge: JudgeVerdict | null; // null when judge not run (static-decisive) or unavailable
}
export interface RowGrade {
  readonly grade: Grade;
  readonly modelOk: boolean;
  readonly reasons: string[];
}

// Is the access MODEL correct for the expected dimension? (axis a)
function modelCorrect(expect: Dimension, a: AccessAnalysis): { ok: boolean; reason: string } {
  if (a.isOwnerWriteGate) return { ok: false, reason: "isOwner write-gate (design forbids)" };
  switch (expect) {
    case "per-visitor":
      if (a.formAStrict) return { ok: false, reason: "Form-A: requireRole('owner') core write" };
      return a.perVisitorClean ? { ok: true, reason: "per-visitor clean" } : { ok: false, reason: "incomplete per-visitor model" };
    case "per-object":
      if (a.formAStrict) return { ok: false, reason: "Form-A on a collaboration app" };
      if (a.formABroad) return { ok: false, reason: "owner-only membership, no join path" };
      return a.perObjectRecipe
        ? { ok: true, reason: "per-object recipe reached" }
        : { ok: false, reason: "incomplete per-object recipe" };
    case "owner-published":
      return a.ownerPublished && !a.isOwnerWriteGate
        ? { ok: true, reason: "owner-published" }
        : { ok: false, reason: "not owner-published (need requireRole('owner') write + public read)" };
    case "author-owned":
      if (a.formAStrict) return { ok: false, reason: "Form-A on an author-owned app" };
      return a.authorOwned
        ? { ok: true, reason: "author-owned + public read" }
        : { ok: false, reason: "incomplete author-owned model" };
    case "multi-tier":
      // lenient: must merely WORK; judge decides reachability. Static only rejects hard footguns.
      return { ok: true, reason: "multi-tier (judge-decided)" };
  }
}

export function gradeRow(input: RowGradeInput): RowGrade {
  const reasons: string[] = [];
  const mc = modelCorrect(input.expect, input.analysis);
  reasons.push(mc.reason);

  // Judge can veto a model that looks fine statically but locks out a second visitor.
  const multiplayer =
    input.expect === "per-visitor" ||
    input.expect === "per-object" ||
    input.expect === "author-owned" ||
    input.expect === "multi-tier";
  const judgeVeto = multiplayer && input.judge !== null && !input.judge.secondVisitorCanAct;
  if (judgeVeto) reasons.push(`judge: second visitor locked out — ${input.judge!.reason}`);

  const modelOk = mc.ok && !judgeVeto;
  if (!modelOk) return { grade: "FAIL", modelOk, reasons };

  // Model is correct. Axis b: renderability / completeness.
  if (!input.files.twoFile || !input.files.renderable) {
    reasons.push(...input.files.reasons);
    return { grade: "SOFT", modelOk, reasons }; // correct model, app won't render -> SOFT, not PASS
  }
  return { grade: "PASS", modelOk, reasons };
}
