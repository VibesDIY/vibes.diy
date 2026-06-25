import { describe, it, expect } from "vitest";
import { parseMatrix, parsePrompts } from "./config.js";

describe("parseMatrix", () => {
  it("parses a valid matrix", () => {
    const m = parseMatrix(
      JSON.stringify({
        judgeModel: "j",
        reps: 2,
        modes: ["oneshot", "agentic"],
        concurrency: 4,
        maxSteps: 4,
        maxCostUsd: 0.5,
        budgetUsdTotal: 50,
        featureAcceptBar: 3,
        models: [{ id: "a/b", openWeight: true }],
      })
    );
    expect(m.models[0].id).toBe("a/b");
    expect(m.modes).toEqual(["oneshot", "agentic"]);
  });
  it("rejects an empty model list", () => {
    expect(() =>
      parseMatrix(
        JSON.stringify({
          judgeModel: "j",
          reps: 1,
          modes: ["oneshot"],
          concurrency: 1,
          maxSteps: 1,
          maxCostUsd: 1,
          budgetUsdTotal: 1,
          featureAcceptBar: 3,
          models: [],
        })
      )
    ).toThrow();
  });
});

describe("parsePrompts", () => {
  it("parses jsonl with needsAccess", () => {
    const p = parsePrompts(`{"id":"x","needsAccess":true,"prompt":"p"}\n\n{"id":"y","needsAccess":false,"prompt":"q"}`);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ id: "x", needsAccess: true, prompt: "p" });
  });
});
