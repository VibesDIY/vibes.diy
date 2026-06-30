// Slice B4 (#2856): pure arm/backoff policy for the BackendDO timer lane.

import { describe, expect, it } from "vitest";
import {
  armDecision,
  nextTickDecision,
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  MAX_ATTEMPTS,
} from "@vibes.diy/api-svc/intern/backend-alarm-policy.js";

describe("armDecision (#2856 B4)", () => {
  it("clears when there's no schedule and an alarm/state exists", () => {
    expect(armDecision(900_000, true, null)).toEqual({ action: "clear" });
    expect(armDecision(900_000, false, null)).toEqual({ action: "clear" });
  });

  it("is a no-op when already clear and asked to clear", () => {
    expect(armDecision(null, false, null)).toEqual({ action: "noop" });
  });

  it("is a no-op when the interval is unchanged and an alarm is set (don't reset the clock)", () => {
    expect(armDecision(900_000, true, 900_000)).toEqual({ action: "noop" });
  });

  it("sets when the interval changes", () => {
    expect(armDecision(900_000, true, 300_000)).toEqual({ action: "set", intervalMs: 300_000 });
  });

  it("sets when there's a schedule but no alarm yet (first arm, or unchanged-but-unset)", () => {
    expect(armDecision(null, false, 300_000)).toEqual({ action: "set", intervalMs: 300_000 });
    expect(armDecision(900_000, false, 900_000)).toEqual({ action: "set", intervalMs: 900_000 });
  });
});

describe("nextTickDecision (#2856 B4)", () => {
  const interval = 3_600_000; // 1h, large enough that backoff < interval

  it("re-arms at the interval and resets attempt on success", () => {
    expect(nextTickDecision(interval, 0, true)).toEqual({ delayMs: interval, attempt: 0 });
    expect(nextTickDecision(interval, 3, true)).toEqual({ delayMs: interval, attempt: 0 });
  });

  it("backs off exponentially from the base on failure", () => {
    expect(nextTickDecision(interval, 0, false)).toEqual({ delayMs: BACKOFF_BASE_MS, attempt: 1 });
    expect(nextTickDecision(interval, 1, false)).toEqual({ delayMs: BACKOFF_BASE_MS * 2, attempt: 2 });
    expect(nextTickDecision(interval, 2, false)).toEqual({ delayMs: BACKOFF_BASE_MS * 4, attempt: 3 });
  });

  it("never backs off longer than the interval", () => {
    // A 10s interval: backoff is clamped to the interval, not BASE (5s) * 2^attempt.
    expect(nextTickDecision(10_000, 2, false).delayMs).toBe(10_000);
  });

  it("never backs off past the cap, across every reachable attempt (defensive bound)", () => {
    // With BASE=5s and MAX_ATTEMPTS=5 the largest reachable backoff is BASE·2^3=40s,
    // below the 5min cap — so the cap is a defensive ceiling. Assert the bound holds
    // for every genuine-backoff attempt rather than that it's exactly reached.
    // (At a = MAX_ATTEMPTS-1 it's the cap-and-resume case, which returns the
    // interval — covered by the cap-and-resume test, not bounded by the cap.)
    for (let a = 0; a < MAX_ATTEMPTS - 1; a++) {
      expect(nextTickDecision(BACKOFF_CAP_MS * 100, a, false).delayMs).toBeLessThanOrEqual(BACKOFF_CAP_MS);
    }
  });

  it("caps-and-resumes at MAX_ATTEMPTS: resume the interval, reset attempt", () => {
    // The failure that takes attempt to MAX_ATTEMPTS resumes the normal cadence.
    expect(nextTickDecision(interval, MAX_ATTEMPTS - 1, false)).toEqual({ delayMs: interval, attempt: 0 });
  });
});
