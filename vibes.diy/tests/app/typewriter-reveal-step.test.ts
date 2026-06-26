import { describe, expect, it } from "vitest";
import { stepReveal, type RevealState } from "../../pkg/app/hooks/useTypewriterReveal.js";

describe("stepReveal (object args)", () => {
  it("advances revealed count while streaming and caps at total", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 10, isStreaming: true, nowMs: 1000 });
    expect(s1.revealedFloat).toBeGreaterThanOrEqual(s0.revealedFloat);
    expect(s1.revealedFloat).toBeLessThanOrEqual(10);
  });

  it("does not advance past total", () => {
    const s0: RevealState = { revealedFloat: 9, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 10, isStreaming: true, nowMs: 5000 });
    expect(s1.revealedFloat).toBeLessThanOrEqual(10);
  });

  it("returns total immediately when already caught up", () => {
    const s0: RevealState = { revealedFloat: 10, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 10, isStreaming: true, nowMs: 1000 });
    expect(s1.revealedFloat).toBe(10);
  });

  it("drains remaining backlog quickly when not streaming", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 10, isStreaming: false, nowMs: 2000 });
    // With isStreaming === false and 2s elapsed, the drain rate should reveal all 10 lines
    expect(s1.revealedFloat).toBe(10);
  });
});
