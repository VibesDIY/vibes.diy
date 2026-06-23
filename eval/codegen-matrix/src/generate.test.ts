import { describe, it, expect } from "vitest";
import { promptHash, buildGenerateArgs, runWithRetries, type AttemptResult } from "./generate.js";

const fail = (): AttemptResult => ({ status: 1, appSlug: undefined, directory: "", latencyMs: 10, stderrTail: "boom" });
const ok = (slug: string): AttemptResult => ({ status: 0, appSlug: slug, directory: `/d/${slug}`, latencyMs: 20, stderrTail: "" });

describe("promptHash", () => {
  it("is stable and hex", () => {
    expect(promptHash("build a todo")).toMatch(/^[0-9a-f]{64}$/);
    expect(promptHash("build a todo")).toBe(promptHash("build a todo"));
  });
});

describe("buildGenerateArgs", () => {
  it("assembles generate flags", () => {
    const args = buildGenerateArgs({
      model: "anthropic/claude-sonnet-4.6",
      handle: "eval",
      apiUrl: "https://vibes.diy/api",
      prompt: "build a todo",
    });
    expect(args).toEqual([
      "generate",
      "--model",
      "anthropic/claude-sonnet-4.6",
      "--handle",
      "eval",
      "--api-url",
      "https://vibes.diy/api",
      "build a todo",
    ]);
  });
});

describe("runWithRetries", () => {
  it("returns on first success without extra attempts", () => {
    let calls = 0;
    const out = runWithRetries(() => {
      calls++;
      return ok("a");
    });
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(1);
    expect(calls).toBe(1);
    expect(out.appSlug).toBe("a");
  });

  it("retries a failure then succeeds", () => {
    const seq = [fail(), ok("b")];
    let i = 0;
    const out = runWithRetries(() => seq[i++]);
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(2);
    expect(out.appSlug).toBe("b");
  });

  it("gives up as a model failure after failing more than twice", () => {
    let calls = 0;
    const out = runWithRetries(() => {
      calls++;
      return fail();
    });
    expect(out.ok).toBe(false);
    expect(out.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(out.stderrTail).toBe("boom");
  });
});
