import { describe, it, expect } from "vitest";
import { extractCost } from "./cost.js";

describe("extractCost", () => {
  it("prefers top-level totalCost", () => {
    expect(extractCost({ totalCost: 0.012, usage: { totalTokens: 900, cost: 0.011 } })).toEqual({ costUsd: 0.012, tokens: 900 });
  });
  it("falls back to usage.cost", () => {
    expect(extractCost({ usage: { totalTokens: 500, cost: 0.004 } })).toEqual({ costUsd: 0.004, tokens: 500 });
  });
  it("defaults to zero when absent", () => {
    expect(extractCost({})).toEqual({ costUsd: 0, tokens: 0 });
  });
});
