export interface ReadinessOpts {
  readonly timeoutMs: number;
  readonly intervalMs: number;
  /** Monotonic clock in ms (injectable for tests). */
  readonly now: () => number;
  /** Returns the HTTP status for a HEAD/GET of the URL. */
  readonly fetchStatus: (url: string) => Promise<{ status: number }>;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly attempts: number;
}

const defaultFetchStatus = async (url: string): Promise<{ status: number }> => {
  const res = await fetch(url, { method: "GET" });
  return { status: res.status };
};

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Poll the screenshot URL until it returns 200 (ready) or the timeout elapses.
 * 404 = not ready yet (capture lags the deploy). The 200 transition is the
 * public projection of the server storing a `screen-shot-ref` in app meta.
 */
export async function waitForScreenshot(
  url: string,
  opts: Partial<ReadinessOpts> & Pick<ReadinessOpts, "timeoutMs">
): Promise<ReadinessResult> {
  const o: ReadinessOpts = {
    intervalMs: 3000,
    now: () => Date.now(),
    fetchStatus: defaultFetchStatus,
    sleep: defaultSleep,
    ...opts,
  };
  const start = o.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const { status } = await o.fetchStatus(url).catch(() => ({ status: 0 }));
    if (status === 200) return { ready: true, attempts };
    if (o.now() - start >= o.timeoutMs) return { ready: false, attempts };
    await o.sleep(o.intervalMs);
  }
}
