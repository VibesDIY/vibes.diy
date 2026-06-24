import { describe, it, expect } from "vitest";
import { evaluateGates } from "./gates.js";

const base = { twoFileRate: 0.8, renderableRate: 0.9, metric: 0.5 };

describe("evaluateGates", () => {
  it("passes when check+guardrail green and rates >= baseline and holdout not regressed", () => {
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.6 },
      baseline: base,
      holdoutCurrent: { metric: 0.55 },
      holdoutBaseline: { metric: 0.5 },
    });
    expect(r.pass).toBe(true);
    expect(r.failed).toEqual([]);
  });
  it("fails on a two-file emission regression (the 9cf43ea-class catch)", () => {
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.5, renderableRate: 0.92, metric: 0.7 },
      baseline: base,
      holdoutCurrent: { metric: 0.55 },
      holdoutBaseline: { metric: 0.5 },
    });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("two-file-emission");
  });
  it("fails on holdout regression beyond the noise band", () => {
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.7 },
      baseline: base,
      holdoutCurrent: { metric: 0.3 },
      holdoutBaseline: { metric: 0.5 },
    });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("holdout-regression");
  });
  it("tolerates a holdout dip within the calibrated band (no false-positive discard, #2637)", () => {
    // iter1/iter2-class case: baseline ~0.40, candidate ~0.30 — a 0.10 dip, inside the
    // measured ~0.17 holdout jitter. The old 0.05 band wrongly discarded this as a regression.
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 1, renderableRate: 1, metric: 0.6 },
      baseline: { twoFileRate: 1, renderableRate: 1, metric: 0.56 },
      holdoutCurrent: { metric: 0.3 },
      holdoutBaseline: { metric: 0.4 },
    });
    expect(r.pass).toBe(true);
    expect(r.failed).not.toContain("holdout-regression");
  });
  it("still catches a holdout regression beyond the calibrated band", () => {
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 1, renderableRate: 1, metric: 0.6 },
      baseline: { twoFileRate: 1, renderableRate: 1, metric: 0.56 },
      holdoutCurrent: { metric: 0.2 }, // 0.20 drop > 0.17 band
      holdoutBaseline: { metric: 0.4 },
    });
    expect(r.failed).toContain("holdout-regression");
  });
  it("honors an explicit holdoutBand override (tight band re-flags the dip)", () => {
    const r = evaluateGates({
      checkGreen: true,
      guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 1, renderableRate: 1, metric: 0.6 },
      baseline: { twoFileRate: 1, renderableRate: 1, metric: 0.56 },
      holdoutCurrent: { metric: 0.3 },
      holdoutBaseline: { metric: 0.4 },
      holdoutBand: 0.05,
    });
    expect(r.failed).toContain("holdout-regression");
  });
  it("fails when pnpm check is red or guardrail trips", () => {
    expect(
      evaluateGates({
        checkGreen: false,
        guardrail: { ok: true, hits: [] },
        current: base,
        baseline: base,
        holdoutCurrent: { metric: 0.5 },
        holdoutBaseline: { metric: 0.5 },
      }).failed
    ).toContain("check");
    expect(
      evaluateGates({
        checkGreen: true,
        guardrail: { ok: false, hits: ["x"] },
        current: base,
        baseline: base,
        holdoutCurrent: { metric: 0.5 },
        holdoutBaseline: { metric: 0.5 },
      }).failed
    ).toContain("guardrail");
  });
});
