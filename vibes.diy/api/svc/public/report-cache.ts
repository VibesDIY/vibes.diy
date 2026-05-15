import { VibesApiSQLCtx } from "../types.js";

// 10-minute CF Cache API wrapper for the report handlers. Returns the
// cached payload when present, else computes fresh, stores, and returns.
// Per-colo cache (each CF PoP keeps its own copy) — fine for the report
// audience (a handful of investors / staff), and the worst case is one
// fresh query per colo per 10 minutes.
//
// generatedAt sticks to the *compute* time, not the read time, so callers
// see when the snapshot was taken — not when the cache returned it.
//
// Cache key is a synthetic https:// URL (CF Cache API only accepts URL-shaped
// keys) on a host we never deploy to; collisions with real traffic are
// impossible.
const CACHE_TTL_SECONDS = 600;
const CACHE_HOST = "reports-cache.internal";

export async function cachedReport<T>(vctx: VibesApiSQLCtx, key: string, compute: () => Promise<T>): Promise<T> {
  const url = `https://${CACHE_HOST}/${encodeURIComponent(key)}`;
  const hit = await vctx.cache.match(url);
  if (hit !== undefined) {
    return (await hit.json()) as T;
  }
  const data = await compute();
  await vctx.cache.put(
    url,
    new Response(JSON.stringify(data), {
      headers: {
        "Cache-Control": `max-age=${CACHE_TTL_SECONDS}`,
        "Content-Type": "application/json",
      },
    })
  );
  return data;
}
