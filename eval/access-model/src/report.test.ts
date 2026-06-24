import { describe, it, expect } from "vitest";
import { buildResults, renderMetricLine, type ScoredRow } from "./report.js";

const scored: readonly ScoredRow[] = [
  {
    id: "todo",
    expect: "per-visitor",
    grade: "PASS",
    twoFile: true,
    renderable: true,
    formAStrict: false,
    formABroad: false,
    isOwnerWriteGate: false,
    ok: true,
  },
  {
    id: "habit",
    expect: "per-visitor",
    grade: "FAIL",
    twoFile: true,
    renderable: true,
    formAStrict: true,
    formABroad: false,
    isOwnerWriteGate: false,
    ok: true,
  },
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
      {
        id: "todo",
        expect: "per-visitor",
        grade: "PASS",
        twoFile: true,
        renderable: true,
        formAStrict: false,
        formABroad: false,
        isOwnerWriteGate: false,
        ok: true,
      },
      {
        id: "todo",
        expect: "per-visitor",
        grade: "SOFT",
        twoFile: true,
        renderable: false,
        formAStrict: false,
        formABroad: false,
        isOwnerWriteGate: false,
        ok: true,
      },
      {
        id: "todo",
        expect: "per-visitor",
        grade: "FAIL",
        twoFile: true,
        renderable: true,
        formAStrict: true,
        formABroad: false,
        isOwnerWriteGate: false,
        ok: true,
      },
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
});

describe("renderMetricLine", () => {
  it("prints a parseable METRIC= line", () => {
    expect(renderMetricLine(0.625)).toBe("METRIC=0.625");
  });
});
