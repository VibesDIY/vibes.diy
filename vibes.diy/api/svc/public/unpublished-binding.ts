import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";

// Read the soft-tombstone state of a slug (#2688). Returns the unpublishedAt
// value from AppSlugBindings — "" when published (or the binding is missing),
// an ISO timestamp when the owner has unpublished it.
//
// This is the single point every no-fsId, slug-keyed public resolver consults
// to decide whether a non-owner may resolve a bare ownerHandle/appSlug. The
// gate is keyed on this tombstone, NOT on the resolved Apps row's mode, so a
// slug with only dev rows (where selectLatestAppPerSlug falls back to a dev
// row) is still hidden. Owners are never gated by callers of this helper —
// they keep full access so restore and history work.
export async function getUnpublishedAt(
  vctx: VibesApiSQLCtx,
  req: { readonly ownerHandle: string; readonly appSlug: string }
): Promise<string> {
  const asb = vctx.sql.tables.appSlugBinding;
  const row = await vctx.sql.db
    .select({ unpublishedAt: asb.unpublishedAt })
    .from(asb)
    .where(and(eq(asb.ownerHandle, req.ownerHandle), eq(asb.appSlug, req.appSlug)))
    .limit(1)
    .then((r) => r[0]);
  return row?.unpublishedAt ?? "";
}

// True when the slug is tombstoned AND the caller is not its owner. Owners
// (callerUserId === ownerUserId) always see through the tombstone.
export async function isHiddenForCaller(
  vctx: VibesApiSQLCtx,
  req: { readonly ownerHandle: string; readonly appSlug: string; readonly ownerUserId: string; readonly callerUserId?: string }
): Promise<boolean> {
  if (req.callerUserId !== undefined && req.callerUserId === req.ownerUserId) return false;
  const unpublishedAt = await getUnpublishedAt(vctx, req);
  return unpublishedAt.length > 0;
}
