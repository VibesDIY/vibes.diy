import { describe, it, expect } from "vitest";
import { shouldAcceptPrompt } from "~/vibes.diy/app/utils/submit-guard.js";

describe("shouldAcceptPrompt", () => {
  it("accepts a non-empty prompt when idle", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: false, running: false })).toBe(true);
  });

  it("rejects when a submit is already in flight (submitting)", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: true, running: false })).toBe(false);
  });

  it("rejects when a turn is already streaming (running)", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: false, running: true })).toBe(false);
  });

  it("rejects empty / whitespace-only text", () => {
    expect(shouldAcceptPrompt({ text: "", submitting: false, running: false })).toBe(false);
    expect(shouldAcceptPrompt({ text: "   ", submitting: false, running: false })).toBe(false);
  });
});
