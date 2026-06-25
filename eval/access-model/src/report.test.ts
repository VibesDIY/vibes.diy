import { describe, it, expect } from "vitest";
import { buildResults, renderMetricLine, type ScoredRow } from "./report.js";

const mk = (o: Partial<ScoredRow> & Pick<ScoredRow, "id" | "expect" | "grade">): ScoredRow => ({
  twoFile: true,
  renderable: true,
  formAStrict: false,
  formABroad: false,
  isOwnerWriteGate: false,
  isOwnerToken: false,
  ok: true,
  consentGrade: o.grade, // default: consent mirrors shape unless overridden
  ...o,
});

const scored: readonly ScoredRow[] = [
  mk({ id: "todo", expect: "per-visitor", grade: "PASS" }),
  mk({ id: "habit", expect: "per-visitor", grade: "FAIL", formAStrict: true }),
];

describe("buildResults", () => {
  it("emits rollup with metric + form-A rate and a row per prompt", () => {
    const r = buildResults(scored);
    expect(r.rollup.metric).toBeCloseTo(0.5, 5);
    expect(r.rollup.formAStrictRate).toBeCloseTo(0.5, 5);
    expect(r.rows.map((x) => x.id)).toEqual(["todo", "habit"]);
  });

  it("aggregates reps of the same prompt into one row with PASS/SOFT/FAIL counts", () => {
    const cells: readonly ScoredRow[] = [
      mk({ id: "todo", expect: "per-visitor", grade: "PASS" }),
      mk({ id: "todo", expect: "per-visitor", grade: "SOFT", renderable: false }),
      mk({ id: "todo", expect: "per-visitor", grade: "FAIL", formAStrict: true }),
    ];
    const r = buildResults(cells);
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0];
    if (!row) throw new Error("expected aggregated row");
    expect(row.id).toBe("todo");
    expect(row.pass).toBe(1);
    expect(row.soft_fail).toBe(1);
    expect(row.fail).toBe(1);
    expect(row.formA).toBe(true); // any rep flagged Form-A
  });

  it("computes a side-by-side consent rollup that can diverge from the shape metric (#2631)", () => {
    // A collaborative todo: shape rubric FAILs both reps, consent rubric PASSes both.
    const cells: readonly ScoredRow[] = [
      mk({ id: "todo", expect: "per-visitor", grade: "FAIL", consentGrade: "PASS" }),
      mk({ id: "todo", expect: "per-visitor", grade: "FAIL", consentGrade: "PASS" }),
    ];
    const r = buildResults(cells);
    expect(r.rollup.metric).toBeCloseTo(0, 5); // shape: both FAIL
    expect(r.consentRollup.metric).toBeCloseTo(1, 5); // consent: both PASS
    expect(r.rows[0]?.fail).toBe(2);
    expect(r.rows[0]?.consent_pass).toBe(2);
    expect(r.rows[0]?.consent_grade).toBe("PASS");
  });
});

describe("renderMetricLine", () => {
  it("prints a parseable METRIC= line", () => {
    expect(renderMetricLine(0.625)).toBe("METRIC=0.625");
  });
});
