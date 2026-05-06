import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";

export async function bumpAppRecency(
  vctx: VibesApiSQLCtx,
  args: { userSlug: string; appSlug: string; ts?: string }
): Promise<Result<void>> {
  return exception2Result(async () => {
    const ts = args.ts ?? new Date().toISOString();
    await vctx.sql.db
      .update(vctx.sql.tables.appSlugBinding)
      .set({ updated: ts })
      .where(
        and(
          eq(vctx.sql.tables.appSlugBinding.userSlug, args.userSlug),
          eq(vctx.sql.tables.appSlugBinding.appSlug, args.appSlug)
        )
      );
  });
}
