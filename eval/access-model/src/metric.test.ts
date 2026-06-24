import { describe, it, expect } from "vitest";
import { compositeMetric, rollup, type MetricCell } from "./metric.js";

const cells: readonly MetricCell[] = [
  { grade: "PASS", twoFile: true, renderable: true, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: true },
  { grade: "SOFT", twoFile: true, renderable: false, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: true },
  { grade: "FAIL", twoFile: true, renderable: true, formAStrict: true, formABroad: false, isOwnerWriteGate: false, ok: true },
  {
    grade: "GENERATE_FAILED",
    twoFile: false,
    renderable: false,
    formAStrict: false,
    formABroad: false,
    isOwnerWriteGate: false,
    ok: false,
  },
];

describe("compositeMetric", () => {
  it("averages PASS=1/SOFT=.5/FAIL=0 over scored cells only (platform failures excluded)", () => {
    // (1 + 0.5 + 0) / 3 = 0.5
    expect(compositeMetric(cells)).toBeCloseTo(0.5, 5);
  });
});

describe("rollup", () => {
  it("computes form-A and two-file rates over scored cells", () => {
    const r = rollup(cells);
    expect(r.scored).toBe(3);
    expect(r.platformFailed).toBe(1);
    expect(r.formAStrictRate).toBeCloseTo(1 / 3, 5);
    expect(r.twoFileRate).toBeCloseTo(1, 5); // 3/3 scored cells emitted two files
    expect(r.renderableRate).toBeCloseTo(2 / 3, 5);
  });
});
