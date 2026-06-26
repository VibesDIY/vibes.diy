import { describe, it, expect } from "vitest";
import { stepReveal, BASE_RATE, FINISH_MS, type RevealState } from "../app/hooks/useTypewriterReveal.js";

describe("stepReveal", () => {
  it("advances at the steady base rate while streaming and not backlogged", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 1000, isStreaming: true, nowMs: 1000 }); // 1 second elapsed
    expect(Math.floor(s1.revealedFloat)).toBe(BASE_RATE);
    expect(s1.lastTickMs).toBe(1000);
  });

  it("never reveals past the total", () => {
    const s0: RevealState = { revealedFloat: 5, lastTickMs: 0 };
    const s1 = stepReveal({ state: s0, total: 6, isStreaming: true, nowMs: 10_000 }); // huge elapsed
    expect(s1.revealedFloat).toBe(6);
  });

  it("accelerates to clear the backlog within FINISH_MS once streaming stops", () => {
    const backlog = 600;
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    // After FINISH_MS with isStreaming=false, the whole backlog is revealed.
    const s1 = stepReveal({ state: s0, total: backlog, isStreaming: false, nowMs: FINISH_MS });
    expect(s1.revealedFloat).toBe(backlog);
  });

  it("scales the rate up when backlogged while still streaming", () => {
    const s0: RevealState = { revealedFloat: 0, lastTickMs: 0 };
    const steady = stepReveal({ state: { ...s0 }, total: BASE_RATE + 1, isStreaming: true, nowMs: 100 }).revealedFloat;
    const backlogged = stepReveal({ state: { ...s0 }, total: 500, isStreaming: true, nowMs: 100 }).revealedFloat;
    expect(backlogged).toBeGreaterThan(steady); // catch-up advances faster
  });
});
