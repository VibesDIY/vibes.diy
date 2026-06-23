import { describe, it, expect } from "vitest";
import { parseMatrixConfig, parsePromptsJsonl } from "./config.js";

const goodMatrix = {
  cliCommand: "npx vibes-diy@latest",
  apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
  runtimeHostBase: "vibes.diy",
  handle: "eval",
  judgeModel: "anthropic/claude-opus-4.5",
  reps: 3,
  screenshotTimeoutMs: 120000,
  models: [{ id: "anthropic/claude-sonnet-4.6", class: "anthropic", tier: "cheap" }],
};

describe("parseMatrixConfig", () => {
  it("accepts a valid config", () => {
    const cfg = parseMatrixConfig(JSON.stringify(goodMatrix));
    expect(cfg.reps).toBe(3);
    expect(cfg.models[0].tier).toBe("cheap");
    expect(cfg.runtimeHostBase).toBe("vibes.diy");
  });

  it("defaults concurrency to 8 and scoreConcurrency to 4 when omitted", () => {
    const cfg = parseMatrixConfig(JSON.stringify(goodMatrix));
    expect(cfg.concurrency).toBe(8);
    expect(cfg.scoreConcurrency).toBe(4);
  });

  it("accepts explicit concurrency and scoreConcurrency", () => {
    const cfg = parseMatrixConfig(JSON.stringify({ ...goodMatrix, concurrency: 16, scoreConcurrency: 6 }));
    expect(cfg.concurrency).toBe(16);
    expect(cfg.scoreConcurrency).toBe(6);
  });

  it("rejects a non-positive concurrency", () => {
    expect(() => parseMatrixConfig(JSON.stringify({ ...goodMatrix, concurrency: 0 }))).toThrow(/concurrency/i);
  });

  it("rejects a missing runtimeHostBase", () => {
    const { runtimeHostBase: _omit, ...rest } = goodMatrix;
    expect(() => parseMatrixConfig(JSON.stringify(rest))).toThrow(/runtimeHostBase/i);
  });

  it("rejects an empty models array", () => {
    expect(() => parseMatrixConfig(JSON.stringify({ ...goodMatrix, models: [] }))).toThrow(/at least one model/i);
  });

  it("rejects a bad tier", () => {
    const bad = { ...goodMatrix, models: [{ id: "x", class: "y", tier: "medium" }] };
    expect(() => parseMatrixConfig(JSON.stringify(bad))).toThrow(/tier/i);
  });

  it("rejects reps <= 0", () => {
    expect(() => parseMatrixConfig(JSON.stringify({ ...goodMatrix, reps: 0 }))).toThrow(/reps/i);
  });
});

describe("parsePromptsJsonl", () => {
  it("parses one entry per non-empty line", () => {
    const jsonl = `{"id":"a","prompt":"build a"}\n\n{"id":"b","prompt":"build b"}\n`;
    const entries = parsePromptsJsonl(jsonl);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("rejects an entry with an empty prompt", () => {
    expect(() => parsePromptsJsonl(`{"id":"a","prompt":""}`)).toThrow(/prompt/i);
  });
});
