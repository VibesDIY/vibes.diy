import { describe, it, expect } from "vitest";
import { isTransientError, retryWithBackoff } from "./backoff.js";

const noSleep = (): Promise<void> => Promise.resolve();

describe("isTransientError", () => {
  it("flags rate limits, 5xx, and network errors", () => {
    expect(isTransientError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isTransientError(new Error("Service Unavailable (503)"))).toBe(true);
    expect(isTransientError(new Error("fetch failed: ECONNRESET"))).toBe(true);
    expect(isTransientError({ status: 502 })).toBe(true);
    expect(isTransientError({ status: 429 })).toBe(true);
  });

  it("does not flag deterministic failures", () => {
    expect(isTransientError(new Error("400 Bad Request: invalid schema"))).toBe(false);
    expect(isTransientError(new Error("judge returned unparseable output"))).toBe(false);
    expect(isTransientError({ status: 400 })).toBe(false);
  });
});

describe("retryWithBackoff", () => {
  it("returns on first success without retrying", async () => {
    let calls = 0;
    const out = await retryWithBackoff(
      async () => {
        calls++;
        return "ok";
      },
      { retries: 3, isRetryable: () => true, sleep: noSleep }
    );
    expect(out).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries a transient error then succeeds", async () => {
    let calls = 0;
    const out = await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("429 rate limit");
        return "ok";
      },
      { retries: 3, isRetryable: isTransientError, sleep: noSleep }
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  it("rethrows immediately on a non-retryable error", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("400 bad request");
        },
        { retries: 3, isRetryable: isTransientError, sleep: noSleep }
      )
    ).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it("gives up after exhausting retries on a persistent transient error", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("503 service unavailable");
        },
        { retries: 2, isRetryable: isTransientError, sleep: noSleep }
      )
    ).rejects.toThrow(/503/);
    expect(calls).toBe(3); // 1 initial + 2 retries
  });
});
