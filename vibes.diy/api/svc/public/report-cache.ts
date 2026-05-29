import { type, Type } from "arktype";
import { VibesApiSQLCtx } from "../types.js";

// Shared helpers for the growth-report handlers: the Clerk publicMetadata
// gate and the CF Cache API wrapper.

// publicMetadata.reports is an array of report keys (or ["*"] for all).
// We arktype-validate so a malformed claim (e.g. publicMeta as a string
// sentinel from the shipped createTestUser) just fails closed instead of
// throwing on a runtime cast.
const reportsClaim = type({ "reports?": "(string)[]" });

export function hasReport(claims: { params?: { email?: string; public_meta?: unknown } }, name: string): boolean {
  if (claims.params?.email?.endsWith("@vibes.diy")) return true;
  const parsed = reportsClaim(claims.params?.public_meta);
  if (parsed instanceof type.errors) return false;
  const list = parsed.reports;
  if (list === undefined) return false;
  return list.includes("*") || list.includes(name);
}

// 10-minute CF Cache API wrapper for the report handlers. Returns the
// cached payload when present, else computes fresh, stores, and returns.
// Per-colo cache (each CF PoP keeps its own copy) — fine for the report
// audience (a handful of investors / staff), and the worst case is one
// fresh query per colo per 10 minutes.
//
// generatedAt sticks to the *compute* time, not the read time, so callers
// see when the snapshot was taken — not when the cache returned it.
//
// schema validates on read: cache is a trust boundary, and a poisoned or
// stale-shape entry falls through to recompute rather than handing the
// caller a lying payload.
const CACHE_TTL_SECONDS = 600;
const CACHE_HOST = "reports-cache.internal";

export async function cachedReport<S extends Type<unknown>>(
  vctx: VibesApiSQLCtx,
  key: string,
  schema: S,
  compute: () => Promise<S["infer"]>
): Promise<S["infer"]> {
  const url = `https://${CACHE_HOST}/${encodeURIComponent(key)}`;
  console.info("report-cache: match start", key);
  const hit = await vctx.cache.match(url);
  console.info("report-cache: match done, hit:", hit !== undefined);
  if (hit !== undefined) {
    const raw: unknown = await hit.json();
    const parsed = schema(raw);
    if (parsed instanceof type.errors) {
      // Cache poisoned / shape changed — fall through to recompute.
    } else {
      return parsed;
    }
  }
  console.info("report-cache: computing");
  const data = await compute();
  console.info("report-cache: compute done");
  // Fire-and-forget: do not await cache.put — in DO context the await can hang
  // indefinitely on first write. The response is already computed; background
  // the write so subsequent requests on this colo hit the cache.
  void vctx.cache
    .put(
      url,
      new Response(JSON.stringify(data), {
        headers: {
          "Cache-Control": `max-age=${CACHE_TTL_SECONDS}`,
          "Content-Type": "application/json",
        },
      })
    )
    .catch((e: unknown) => console.error("report-cache: put failed", e));
  console.info("report-cache: put queued");
  return data;
}
