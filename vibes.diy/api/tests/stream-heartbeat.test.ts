import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withHeartbeat } from "../svc/public/stream-heartbeat.js";

describe("withHeartbeat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("beats at the interval while work is pending, and stops once it resolves", async () => {
    let beats = 0;
    let resolveWork!: (v: string) => void;
    const p = withHeartbeat(() => new Promise<string>((r) => (resolveWork = r)), {
      intervalMs: 1000,
      beat: () => {
        beats++;
      },
    });
    await vi.advanceTimersByTimeAsync(3500);
    expect(beats).toBe(3); // 1000, 2000, 3000

    resolveWork("done");
    await expect(p).resolves.toBe("done");

    const beatsAtSettle = beats;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(beats).toBe(beatsAtSettle); // no more beats after the work settled
  });

  it("never beats when work settles before the first interval", async () => {
    let beats = 0;
    const p = withHeartbeat(() => Promise.resolve(42), { intervalMs: 1000, beat: () => beats++ });
    await expect(p).resolves.toBe(42);
    await vi.advanceTimersByTimeAsync(5000);
    expect(beats).toBe(0);
  });

  it("propagates rejection and stops beating", async () => {
    let beats = 0;
    let rejectWork!: (e: Error) => void;
    const p = withHeartbeat(() => new Promise<never>((_, rj) => (rejectWork = rj)), {
      intervalMs: 1000,
      beat: () => beats++,
    });
    await vi.advanceTimersByTimeAsync(2500);
    expect(beats).toBe(2);

    rejectWork(new Error("boom"));
    await expect(p).rejects.toThrow("boom");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(beats).toBe(2); // timer cleared on settle, even on rejection
  });

  it("a throwing beat never breaks the protected work", async () => {
    let resolveWork!: (v: string) => void;
    const p = withHeartbeat(() => new Promise<string>((r) => (resolveWork = r)), {
      intervalMs: 1000,
      beat: () => {
        throw new Error("beat blew up");
      },
    });
    await vi.advanceTimersByTimeAsync(2500); // two beats throw, swallowed
    resolveWork("ok");
    await expect(p).resolves.toBe("ok");
  });
});
