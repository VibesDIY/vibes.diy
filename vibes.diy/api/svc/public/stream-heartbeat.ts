/**
 * Run an async `work` unit, invoking `beat()` every `intervalMs` while it is
 * still pending, and always stopping once `work` settles (resolve OR reject).
 *
 * Purpose: keep a streaming client connection's idle timer alive during the
 * model's silent "think-gaps" — stretches where the LLM produces no tokens, so
 * no bytes cross the wire. A quiet stretch longer than a proxy/CDN idle timeout
 * (commonly ~60s) otherwise severs the turn before `turn-end`, and the client
 * has to recover a partial result from snapshots. A periodic no-op heartbeat
 * envelope keeps a byte flowing so the connection survives the gap.
 *
 * `beat` is fire-and-forget: it is never awaited, and a throw from it is
 * swallowed — a heartbeat must never break the stream it is protecting. During
 * active streaming `work` (a single `reader.read()`) settles in well under
 * `intervalMs`, so the timer is armed and cleared without ever firing; beats
 * only happen during real gaps.
 */
export interface WithHeartbeatOpts {
  /** Heartbeat cadence in ms. Keep comfortably below the smallest idle timeout in the path (~60s). */
  readonly intervalMs: number;
  /** Emit one heartbeat. Fire-and-forget; throws are swallowed. */
  readonly beat: () => void;
}

export async function withHeartbeat<T>(work: () => Promise<T>, opts: WithHeartbeatOpts): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const arm = (): void => {
    handle = setTimeout(() => {
      if (stopped) return;
      try {
        opts.beat();
      } catch {
        // A heartbeat must never break the stream it is protecting.
      }
      arm();
    }, opts.intervalMs);
  };
  arm();
  try {
    return await work();
  } finally {
    stopped = true;
    if (handle !== undefined) clearTimeout(handle);
  }
}
