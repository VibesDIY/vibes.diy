import { describe, it, expect } from "vitest";
import { promptHash, buildGenerateArgs, runWithRetries, summarizeReason, type AttemptResult } from "./generate.js";

const fail = (): AttemptResult => ({
  status: 1,
  appSlug: undefined,
  directory: "",
  latencyMs: 10,
  stderrTail: "Error: Lint failed: no `export default`",
});
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

  it("retries a failure then succeeds, logging the failed attempt's reason", () => {
    const seq = [fail(), ok("b")];
    let i = 0;
    const out = runWithRetries(() => seq[i++]);
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(2);
    expect(out.appSlug).toBe("b");
    expect(out.attemptLog).toHaveLength(2);
    expect(out.attemptLog[0]).toMatchObject({ attempt: 1, ok: false });
    expect(out.attemptLog[0].reason).toContain("Lint failed");
    expect(out.attemptLog[1]).toMatchObject({ attempt: 2, ok: true, reason: "ok" });
  });

  it("gives up as a model failure after failing more than twice, logging each reason", () => {
    let calls = 0;
    const out = runWithRetries(() => {
      calls++;
      return fail();
    });
    expect(out.ok).toBe(false);
    expect(out.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(out.attemptLog).toHaveLength(3);
    expect(out.attemptLog.every((a) => !a.ok && a.reason.includes("export default"))).toBe(true);
  });
});

describe("summarizeReason", () => {
  it("prefers a line with an error/disconnect signature", () => {
    expect(summarizeReason("setup ok\nStream ended before the turn completed\ntrailing")).toBe(
      "Stream ended before the turn completed"
    );
  });
  it("falls back to the last non-empty line", () => {
    expect(summarizeReason("first\nsecond\n\n")).toBe("second");
  });
  it("handles empty stderr", () => {
    expect(summarizeReason("")).toMatch(/no stderr/);
  });
});
