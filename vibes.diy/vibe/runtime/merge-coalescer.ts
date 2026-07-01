// Per-_id coalescer for ephemeral merge broadcasts (#1756). Collapses a burst
// (e.g. 60Hz cursor moves) to one send per frame, keeping the latest snapshot
// per _id. Uses setTimeout(delayMs) rather than rAF so it works in the iframe,
// Node, and tests (fake timers). Distinct _ids flush independently on the same
// tick but are never merged together.
export function createEphemeralCoalescer(
  flush: (docId: string, doc: Record<string, unknown>) => void,
  delayMs = 16
): { push: (docId: string, doc: Record<string, unknown>) => void; cancel: () => void } {
  const pending = new Map<string, Record<string, unknown>>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    timer = undefined;
    const batch = [...pending.entries()];
    pending.clear();
    for (const [id, doc] of batch) flush(id, doc);
  };
  return {
    push(docId, doc) {
      pending.set(docId, doc); // latest wins per _id
      if (timer === undefined) timer = setTimeout(run, delayMs);
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
    },
  };
}
