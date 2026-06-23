/**
 * Run `worker` over every item with at most `concurrency` in flight at once.
 * Preserves no ordering guarantees on execution; resolves when all complete.
 * A worker rejection propagates (fails fast). Concurrency is clamped to
 * [1, items.length].
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  let next = 0;
  const runners = Array.from({ length: limit }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
