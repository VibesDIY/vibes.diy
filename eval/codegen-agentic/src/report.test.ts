import { describe, it, expect } from "vitest";
import { isAcceptable, aggregate, type ReportRow } from "./report.js";

const base: ReportRow = {
  model: "m",
  mode: "oneshot",
  openWeight: true,
  promptId: "p",
  needsAccess: false,
  buildPass: true,
  feature: 4,
  costUsd: 0.01,
  hasAccessJs: false,
};

describe("isAcceptable", () => {
  it("true when build passes and feature meets the bar (no access needed)", () => {
    expect(isAcceptable(base, 3)).toBe(true);
  });
  it("false when feature below bar", () => {
    expect(isAcceptable({ ...base, feature: 2 }, 3)).toBe(false);
  });
  it("false when needsAccess but no access.js", () => {
    expect(isAcceptable({ ...base, needsAccess: true, hasAccessJs: false }, 3)).toBe(false);
  });
  it("true when needsAccess and access.js present", () => {
    expect(isAcceptable({ ...base, needsAccess: true, hasAccessJs: true }, 3)).toBe(true);
  });
});

describe("aggregate", () => {
  it("computes per-model×mode build-pass rate, mean feature, and $/acceptable", () => {
    const rows: ReportRow[] = [
      { ...base, buildPass: true, feature: 4, costUsd: 0.02 },
      { ...base, buildPass: false, feature: 1, costUsd: 0.01 },
    ];
    const [s] = aggregate(rows, 3);
    expect(s.model).toBe("m");
    expect(s.buildPassRate).toBeCloseTo(0.5);
    expect(s.meanFeature).toBeCloseTo(2.5);
    expect(s.acceptable).toBe(1);
    expect(s.costPerAcceptable).toBeCloseTo(0.03); // total $0.03 / 1 acceptable
  });
});
