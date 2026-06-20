import { and, eq } from "drizzle-orm/sql/expressions";
import { max } from "drizzle-orm/sql";
import { VibesApiSQLCtx } from "../types.js";

// Resolve the latest app row for (ownerHandle, appSlug), preferring production.
//
// Picks the max-created row per mode, then orderBy(mode) sorts "dev" <
// "production" so the LAST row wins (production beats a newer dev row).
// Returns undefined when no app matches. Shared by get-app-by-fsid and
// fork-app so the "which app version did the viewer see" selection stays
// identical across both paths.
export async function selectLatestAppPerSlug(vctx: VibesApiSQLCtx, req: { readonly ownerHandle: string; readonly appSlug: string }) {
  const maxCreatedSub = vctx.sql.db
    .select({ mode: vctx.sql.tables.apps.mode, maxCreated: max(vctx.sql.tables.apps.created).as("max_created") })
    .from(vctx.sql.tables.apps)
    .where(and(eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle), eq(vctx.sql.tables.apps.appSlug, req.appSlug)))
    .groupBy(vctx.sql.tables.apps.mode)
    .as("mc");
  const rows = await vctx.sql.db
    .select({
      appSlug: vctx.sql.tables.apps.appSlug,
      userId: vctx.sql.tables.apps.userId,
      ownerHandle: vctx.sql.tables.apps.ownerHandle,
      releaseSeq: vctx.sql.tables.apps.releaseSeq,
      fsId: vctx.sql.tables.apps.fsId,
      env: vctx.sql.tables.apps.env,
      fileSystem: vctx.sql.tables.apps.fileSystem,
      meta: vctx.sql.tables.apps.meta,
      mode: vctx.sql.tables.apps.mode,
      created: vctx.sql.tables.apps.created,
    })
    .from(vctx.sql.tables.apps)
    .innerJoin(
      maxCreatedSub,
      and(
        eq(vctx.sql.tables.apps.mode, maxCreatedSub.mode),
        eq(vctx.sql.tables.apps.created, maxCreatedSub.maxCreated),
        eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle),
        eq(vctx.sql.tables.apps.appSlug, req.appSlug)
      )
    )
    .orderBy(vctx.sql.tables.apps.mode); // "dev" < "production" → last = production wins
  return rows[rows.length - 1];
}
