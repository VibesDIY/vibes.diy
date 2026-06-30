// Pure scheduling/retry policy for the BackendDO timer lane (#2856 B4). Kept
// separate from the DO so the arm/backoff decisions are unit-testable without a
// Durable Object harness — the DO just applies these decisions to its storage +
// `setAlarm`/`deleteAlarm`.

/** Backoff floor — the first retry after a failure waits this long. */
export const BACKOFF_BASE_MS = 5_000;
/** Backoff ceiling — a single retry never waits longer than this. */
export const BACKOFF_CAP_MS = 5 * 60_000;
/** Consecutive failures before giving up the backoff and resuming the interval. */
export const MAX_ATTEMPTS = 5;

export type ArmDecision =
  | { readonly action: "clear" }
  | { readonly action: "set"; readonly intervalMs: number }
  | { readonly action: "noop" };

/**
 * Decide what `arm()` should do given the currently-armed interval (from DO
 * storage), whether an alarm is actually set, and the schedule freshly resolved
 * from the selected release.
 *
 * - no schedule now ⇒ `clear` (unless already clear ⇒ `noop`);
 * - schedule unchanged AND an alarm is set ⇒ `noop` (don't reset the running clock);
 * - otherwise ⇒ `set` to the new interval.
 */
export function armDecision(currentIntervalMs: number | null, hasAlarm: boolean, newIntervalMs: number | null): ArmDecision {
  if (newIntervalMs === null) {
    return currentIntervalMs === null && !hasAlarm ? { action: "noop" } : { action: "clear" };
  }
  if (currentIntervalMs === newIntervalMs && hasAlarm) {
    return { action: "noop" };
  }
  return { action: "set", intervalMs: newIntervalMs };
}

export interface TickDecision {
  /** Delay (ms from now) for the next alarm. */
  readonly delayMs: number;
  /** New consecutive-failure count to persist (0 ⇒ healthy / resumed). */
  readonly attempt: number;
}

/**
 * Decide the next alarm after a `scheduled` tick, given the armed interval and the
 * current consecutive-failure count.
 *
 * - success ⇒ re-arm at `intervalMs`, reset `attempt` to 0;
 * - failure ⇒ exponential backoff `min(intervalMs, cap, base·2^attempt)`, `attempt++`;
 * - at `MAX_ATTEMPTS` consecutive failures ⇒ **cap-and-resume**: stop backing off,
 *   reset `attempt` to 0, and resume the normal interval (configured cadence stays
 *   the source of truth; a permanently-broken handler degrades to "fail once per
 *   interval, wait" rather than hammering the backoff cap).
 */
export function nextTickDecision(intervalMs: number, attempt: number, ran: boolean): TickDecision {
  if (ran) {
    return { delayMs: intervalMs, attempt: 0 };
  }
  const newAttempt = attempt + 1;
  if (newAttempt >= MAX_ATTEMPTS) {
    return { delayMs: intervalMs, attempt: 0 };
  }
  const backoff = Math.min(intervalMs, BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return { delayMs: backoff, attempt: newAttempt };
}
