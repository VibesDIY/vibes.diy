import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./pool.js";

describe("mapWithConcurrency", () => {
  it("runs every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([10, 20, 30, 40], 2, async (n) => {
      seen.push(n);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
  });

  it("never exceeds the concurrency limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // actually parallelized
  });

  it("handles an empty list", async () => {
    let calls = 0;
    await mapWithConcurrency([], 4, async () => {
      calls++;
    });
    expect(calls).toBe(0);
  });

  it("clamps concurrency to at least 1", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2], 0, async (n) => {
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2]);
  });
});
