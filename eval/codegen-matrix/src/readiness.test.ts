import { describe, it, expect } from "vitest";
import { waitForScreenshot } from "./readiness.js";

function statusFetcher(statuses: number[]): (url: string) => Promise<{ status: number }> {
  let i = 0;
  return async () => ({ status: statuses[Math.min(i++, statuses.length - 1)] });
}

const noSleep = (): Promise<void> => Promise.resolve();

describe("waitForScreenshot", () => {
  it("resolves ready once a 200 is seen", async () => {
    const r = await waitForScreenshot("http://x/screenshot.jpg", {
      timeoutMs: 10_000,
      intervalMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 1000);
      })(),
      fetchStatus: statusFetcher([404, 404, 200]),
      sleep: noSleep,
    });
    expect(r.ready).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it("gives up after the timeout when only 404s are seen", async () => {
    const r = await waitForScreenshot("http://x/screenshot.jpg", {
      timeoutMs: 3000,
      intervalMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 1000);
      })(),
      fetchStatus: statusFetcher([404]),
      sleep: noSleep,
    });
    expect(r.ready).toBe(false);
  });
});
