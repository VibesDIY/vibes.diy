import { describe, it, expect } from "vitest";
import { decideVerify, gate1Commands, summaryFromResults } from "./verify.js";

describe("decideVerify", () => {
  it("exit 0 and prints metric when all gates pass", () => {
    const r = decideVerify({ metric: 0.62, gates: { pass: true, failed: [] } });
    expect(r.exitCode).toBe(0);
    expect(r.lines).toContain("METRIC=0.62");
    expect(r.lines.some((l) => l.startsWith("GATES: pass"))).toBe(true);
  });
  it("exit 1 and reports failed gates (discard) even if metric improved", () => {
    const r = decideVerify({ metric: 0.9, gates: { pass: false, failed: ["two-file-emission"] } });
    expect(r.exitCode).toBe(1);
    expect(r.lines.some((l) => l.includes("two-file-emission"))).toBe(true);
  });
});

describe("gate1Commands", () => {
  it("includes the prompts build+test steps AND the codegen-matrix rubric drift-guard", () => {
    const cmds = gate1Commands();
    // prompts build + test, scoped to both prompts workspaces
    expect(cmds).toContainEqual(["run", "--filter", "@vibes.diy/prompts", "--filter", "@vibes.diy/prompts-test", "build"]);
    expect(cmds).toContainEqual(["run", "--filter", "@vibes.diy/prompts", "--filter", "@vibes.diy/prompts-test", "test"]);
    // the promptAnchor rubric drift-guard lives in codegen-matrix, not the prompts pkgs
    expect(cmds).toContainEqual(["--filter", "@vibes.diy/eval-codegen-matrix", "exec", "vitest", "--run", "src/rubric.test.ts"]);
  });
});

describe("summaryFromResults", () => {
  it("maps the results.json rollup into the eval RateSummary + holdout metric", () => {
    const r = summaryFromResults({ rollup: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.6 } });
    expect(r.rate).toEqual({ twoFileRate: 0.85, renderableRate: 0.92, metric: 0.6 });
    expect(r.holdout).toEqual({ metric: 0.6 });
  });
});
