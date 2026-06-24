import { describe, it, expect } from "vitest";
import { evaluateGates } from "./gates.js";

const base = { twoFileRate: 0.8, renderableRate: 0.9, metric: 0.5 };

describe("evaluateGates", () => {
  it("passes when check+guardrail green and rates >= baseline and holdout not regressed", () => {
    const r = evaluateGates({
      checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.6 },
      baseline: base, holdoutCurrent: { metric: 0.55 }, holdoutBaseline: { metric: 0.5 },
    });
    expect(r.pass).toBe(true);
    expect(r.failed).toEqual([]);
  });
  it("fails on a two-file emission regression (the 9cf43ea-class catch)", () => {
    const r = evaluateGates({ checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.5, renderableRate: 0.92, metric: 0.7 }, baseline: base,
      holdoutCurrent: { metric: 0.55 }, holdoutBaseline: { metric: 0.5 } });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("two-file-emission");
  });
  it("fails on holdout regression beyond the noise band", () => {
    const r = evaluateGates({ checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.7 }, baseline: base,
      holdoutCurrent: { metric: 0.3 }, holdoutBaseline: { metric: 0.5 } });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("holdout-regression");
  });
  it("fails when pnpm check is red or guardrail trips", () => {
    expect(evaluateGates({ checkGreen: false, guardrail: { ok: true, hits: [] }, current: base, baseline: base, holdoutCurrent: { metric: 0.5 }, holdoutBaseline: { metric: 0.5 } }).failed).toContain("check");
    expect(evaluateGates({ checkGreen: true, guardrail: { ok: false, hits: ["x"] }, current: base, baseline: base, holdoutCurrent: { metric: 0.5 }, holdoutBaseline: { metric: 0.5 } }).failed).toContain("guardrail");
  });
});
