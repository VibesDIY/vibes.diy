/**
 * Return true when an error looks like a transient infrastructure failure worth
 * retrying (rate limits, 5xx, network resets/timeouts) — as opposed to a
 * deterministic failure (e.g. a 400 or a parse error) that won't change on retry.
 */
export function isTransientError(e: unknown): boolean {
  const status = (e as { status?: unknown; statusCode?: unknown }) ?? {};
  const code =
    typeof status.status === "number" ? status.status : typeof status.statusCode === "number" ? status.statusCode : undefined;
  if (code !== undefined && (code === 408 || code === 429 || code >= 500)) return true;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /\b(408|429|500|502|503|504)\b|rate.?limit|too many requests|timeout|timed out|econnreset|etimedout|eai_again|fetch failed|socket hang up|network|overloaded|temporarily unavailable|service unavailable/.test(
    msg
  );
}

export interface BackoffOpts {
  /** Max retries after the first attempt (so total attempts = retries + 1). */
  readonly retries: number;
  /** Decide whether a thrown error is worth retrying. */
  readonly isRetryable: (e: unknown) => boolean;
  /** Base delay; attempt N waits baseDelayMs * 2^(N-1). Defaults to 500ms. */
  readonly baseDelayMs?: number;
  /** Injectable sleep for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying on retryable errors with exponential backoff. Non-retryable
 * errors throw immediately; retryable ones throw once `retries` is exhausted.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: BackoffOpts): Promise<T> {
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt > opts.retries || !opts.isRetryable(e)) throw e;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
