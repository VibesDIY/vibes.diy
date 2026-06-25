import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt.js";

describe("buildPrompt", () => {
  it("one-shot instructs filename-fenced whole-file output", () => {
    const r = buildPrompt("oneshot", "RULES", "make a counter");
    expect(r.instructions).toContain("RULES");
    expect(r.instructions).toMatch(/filename on its own line/i);
    expect(r.instructions).not.toMatch(/write_file/i);
    expect(r.input).toBe("make a counter");
  });
  it("agentic instructs use of the write_file tool", () => {
    const r = buildPrompt("agentic", "RULES", "make a counter");
    expect(r.instructions).toContain("RULES");
    expect(r.instructions).toMatch(/write_file/i);
    expect(r.instructions).not.toMatch(/fenced/i);
  });
});
