import { useEffect, useRef, useState } from "react";

/** Steady reveal rate (lines/second) when caught up and streaming. */
export const BASE_RATE = 24;
/** Cap on the adaptive catch-up rate (lines/second). */
export const MAX_RATE = 600;
/** Once streaming stops, clear the remaining backlog within this many ms. */
export const FINISH_MS = 1500;

export interface RevealState {
  /** Lines revealed so far, tracked as a float so sub-line-per-frame progress accumulates. */
  revealedFloat: number;
  /** Wall-clock (ms) of the last step. */
  lastTickMs: number;
}

/**
 * Pure pacing step. Advances `revealedFloat` toward `total` based on elapsed
 * wall-clock since `lastTickMs`. While streaming, the rate is BASE_RATE, scaled
 * up toward MAX_RATE when the backlog grows. When `isStreaming` is false, the
 * rate is whatever clears the current backlog within FINISH_MS (never below
 * BASE_RATE), so "done" never lags far behind the model.
 */
export function stepReveal({
  state,
  total,
  isStreaming,
  nowMs,
}: {
  state: RevealState;
  total: number;
  isStreaming: boolean;
  nowMs: number;
}): RevealState {
  if (state.revealedFloat >= total) return { revealedFloat: total, lastTickMs: nowMs };
  const dt = Math.max(0, (nowMs - state.lastTickMs) / 1000);
  const backlog = total - state.revealedFloat;
  let next: number;
  if (isStreaming === false) {
    // Drain the remaining backlog within FINISH_MS (never slower than BASE_RATE).
    const rate = Math.max(BASE_RATE, backlog / (FINISH_MS / 1000));
    next = Math.min(total, state.revealedFloat + rate * dt);
  } else {
    // While streaming: use a catch-up rate proportional to the backlog, but
    // cap the per-tick advance at BASE_RATE lines so a very large first dt
    // (e.g. the initial tick spanning the entire stream) doesn't jump ahead.
    const catchUpRate = backlog > BASE_RATE ? Math.min(MAX_RATE, backlog) : BASE_RATE;
    const advance = Math.min(BASE_RATE, catchUpRate * dt);
    next = Math.min(total, state.revealedFloat + advance);
  }
  return { revealedFloat: next, lastTickMs: nowMs };
}

/**
 * Reveal lines at a steady typewriter pace, draining a buffer fed by coarse
 * network chunks. Returns the number of lines to display. When `enabled` is
 * false the hook is inert and returns `total` (everything shown, no animation),
 * so non-whole-file code cards are unaffected.
 *
 * A single requestAnimationFrame loop reads `total`/`isStreaming` from refs and
 * advances the reveal; it re-arms while not caught up or still streaming, and is
 * restarted by the effect whenever `total` or `isStreaming` changes (e.g. new
 * lines arrive, or the turn completes).
 */
export function useTypewriterReveal(total: number, isStreaming: boolean, enabled: boolean): number {
  const [revealed, setRevealed] = useState(enabled ? 0 : total);
  const stateRef = useRef<RevealState>({ revealedFloat: 0, lastTickMs: 0 });
  const totalRef = useRef(total);
  const streamingRef = useRef(isStreaming);
  totalRef.current = total;
  streamingRef.current = isStreaming;

  useEffect(() => {
    if (enabled === false) {
      setRevealed(total);
      return;
    }
    let mounted = true;
    let raf = 0;
    const tick = (now: number): void => {
      if (mounted === false) return;
      const s = stateRef.current;
      if (s.lastTickMs === 0) s.lastTickMs = now;
      const nextState = stepReveal({ state: s, total: totalRef.current, isStreaming: streamingRef.current, nowMs: now });
      stateRef.current = nextState;
      const count = Math.floor(nextState.revealedFloat);
      setRevealed((prev) => (prev !== count ? count : prev));
      const caughtUp = nextState.revealedFloat >= totalRef.current;
      if (caughtUp === false || streamingRef.current === true) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [enabled, total, isStreaming]);

  return enabled ? Math.min(revealed, total) : total;
}
