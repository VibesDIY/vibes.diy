import { useEffect, useSyncExternalStore } from "react";

// Default "interactive, never wait forever" window. A source that never
// arrives (RPC failure leaving the cid absent) degrades to optimistic after
// this many ms instead of pinning the app in a skeleton.
let GRACE_MS = 4000;

const degraded = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const refcount = new Map<string, number>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function isGraceDegraded(cid: string): boolean {
  return degraded.has(cid);
}

export function subscribeGrace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Arm the shared per-cid timer. Idempotent across instances via refcount;
// the timer is created once and survives until the LAST armer cancels (or it
// fires). Returns a cleanup that decrements the refcount.
export function armGrace(cid: string): () => void {
  refcount.set(cid, (refcount.get(cid) ?? 0) + 1);
  if (!degraded.has(cid) && !timers.has(cid)) {
    timers.set(
      cid,
      setTimeout(() => {
        timers.delete(cid);
        degraded.add(cid);
        notify();
      }, GRACE_MS)
    );
  }
  let released = false;
  return () => {
    if (released) return; // StrictMode double-invoke safety
    released = true;
    const n = (refcount.get(cid) ?? 1) - 1;
    if (n > 0) {
      refcount.set(cid, n);
      return;
    }
    refcount.delete(cid);
    const t = timers.get(cid);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(cid);
    }
  };
}

// React binding: returns whether `cid` is grace-degraded, and arms the shared
// timer only while `pending`. Resets on cid/pending change; cleans up on unmount.
export function useGraceDegraded(cid: string | undefined, pending: boolean): boolean {
  const flag = useSyncExternalStore(
    subscribeGrace,
    () => (cid !== undefined ? isGraceDegraded(cid) : false),
    () => false
  );
  useEffect(() => {
    if (cid === undefined || !pending) return;
    return armGrace(cid);
  }, [cid, pending]);
  return cid !== undefined ? flag : false;
}

// ── test-only helpers ────────────────────────────────────────────────
export function setGraceMsForTest(ms: number): void {
  GRACE_MS = ms;
}
export function __resetGraceForTest(): void {
  for (const t of timers.values()) clearTimeout(t);
  degraded.clear();
  timers.clear();
  refcount.clear();
  listeners.clear();
  GRACE_MS = 4000;
}
