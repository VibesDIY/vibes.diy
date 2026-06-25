import type { AccessAnalysis } from "./invariants.js";
import type { FileCheck } from "./renderable.js";
import type { Grade } from "./grade.js";

/**
 * The consent-centric verdict (#2631 rubric refinement). Unlike the shape-rigid
 * second-visitor judge, this asks ONLY about consent — never about which access
 * "shape" the generator picked, because inviting collaborators into an object graph
 * is always legitimate. Two questions:
 *  - hasConsentPath: a different signed-in visitor can EITHER start their own data
 *    immediately OR request to join and be approved by the creator / an existing
 *    member. False only on a true dead-end (no path at all).
 *  - accessLeakedWithoutConsent: the model hands someone access to data they don't
 *    own WITHOUT the owner/creator (or an existing member) consenting.
 */
export interface ConsentVerdict {
  readonly hasConsentPath: boolean;
  readonly accessLeakedWithoutConsent: boolean;
  readonly reason: string;
}

export interface ConsentGrade {
  readonly grade: Grade;
  readonly modelOk: boolean;
  readonly reasons: string[];
}

export interface ConsentGradeInput {
  readonly analysis: AccessAnalysis;
  readonly files: FileCheck;
  readonly consent: ConsentVerdict | null; // null => judge not run (single-writer shape) or unavailable
  readonly judgeRequired: boolean; // was the consent judge meant to run for this dimension?
}

/**
 * Grade a row under the consent-centric rubric. Collaboration is NEVER counted
 * against the row — there is no shape check here. A row fails only on:
 *  1. the retired `isOwner` token (any form),
 *  2. a consent leak (access granted without the creator's/owner's consent), or
 *  3. a true dead-end (a second visitor has no consent-respecting path at all).
 * Otherwise it's model-correct; renderability is the orthogonal SOFT axis, and a
 * required-but-unavailable judge keeps it SOFT (can't confirm) rather than PASS.
 */
export function gradeConsentRow(input: ConsentGradeInput): ConsentGrade {
  const reasons: string[] = [];

  // (1) Hard fail: the retired isOwner token, in any shape.
  if (input.analysis.isOwnerToken) {
    reasons.push("isOwner token (design retired it)");
    return { grade: "FAIL", modelOk: false, reasons };
  }

  // (2)/(3) Consent verdict, when the judge ran.
  if (input.consent) {
    if (input.consent.accessLeakedWithoutConsent) {
      reasons.push(`consent leak — ${input.consent.reason}`);
      return { grade: "FAIL", modelOk: false, reasons };
    }
    if (!input.consent.hasConsentPath) {
      reasons.push(`dead-end: no consent-respecting path — ${input.consent.reason}`);
      return { grade: "FAIL", modelOk: false, reasons };
    }
    reasons.push("consent-respecting (path present, no leak)");
  } else {
    reasons.push(
      input.judgeRequired ? "consent unconfirmed (judge unavailable)" : "consent static-OK (single-writer shape, no token)"
    );
  }

  // Model is consent-correct. Axis b: renderability / completeness.
  if (!input.files.twoFile || !input.files.renderable) {
    reasons.push(...input.files.reasons);
    return { grade: "SOFT", modelOk: true, reasons };
  }

  // Judge was required but unavailable — cannot confirm a clean PASS (mirrors the
  // existing rubric's judge-outage handling so outages don't inflate the metric).
  if (input.judgeRequired && input.consent === null) {
    return { grade: "SOFT", modelOk: true, reasons };
  }

  return { grade: "PASS", modelOk: true, reasons };
}
