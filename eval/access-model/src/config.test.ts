import { describe, it, expect } from "vitest";
import { parseAccessMatrix, parseAccessPrompts } from "./config.js";

describe("parseAccessPrompts", () => {
  it("parses id/prompt/dimension/expect per line and skips blanks", () => {
    const text = `{"id":"todo","prompt":"A todo list app","dimension":"d","expect":"per-visitor"}\n\n`;
    const rows = parseAccessPrompts(text);
    expect(rows).toEqual([{ id: "todo", prompt: "A todo list app", dimension: "d", expect: "per-visitor" }]);
  });
  it("rejects an unknown expect value", () => {
    const text = `{"id":"x","prompt":"p","dimension":"d","expect":"bogus"}`;
    expect(() => parseAccessPrompts(text)).toThrow(/expect/);
  });
});

describe("parseAccessMatrix", () => {
  it("clamps concurrency/reps defaults and keeps the empty model pin", () => {
    const cfg = parseAccessMatrix(`{"apiUrl":"a","handle":"eval","runtimeHostBase":"vibes.diy","model":"","judgeModel":"j"}`);
    expect(cfg.reps).toBe(8);
    expect(cfg.concurrency).toBe(32);
    expect(cfg.model).toBe("");
  });
});
