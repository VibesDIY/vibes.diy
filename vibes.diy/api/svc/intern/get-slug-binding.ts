import { Result, exception2Result } from "@adviser/cement";
import { eq, and } from "drizzle-orm/sql/expressions";
import { AppHandleBinding, VibesApiSQLCtx } from "../types.js";

export interface GetSlugBinding {
  ownerHandle: string;
  appSlug: string;
}

export async function getSlugBinding(ctx: VibesApiSQLCtx, binding: GetSlugBinding): Promise<Result<AppHandleBinding>> {
  const r = await exception2Result(() =>
    ctx.sql.db
      .select()
      .from(ctx.sql.tables.handleBinding)
      .innerJoin(ctx.sql.tables.appSlugBinding, eq(ctx.sql.tables.appSlugBinding.ownerHandle, ctx.sql.tables.handleBinding.handle))
      .where(
        and(
          eq(ctx.sql.tables.handleBinding.handle, binding.ownerHandle),
          eq(ctx.sql.tables.appSlugBinding.appSlug, binding.appSlug)
        )
      )
      .limit(1)
      .then((r) => r[0])
  );
  if (r.isErr()) {
    return Result.Err(r);
  }
  const sql = r.Ok();
  if (!sql) {
    return Result.Err(`appSlug/ownerHandle not found ${binding.appSlug}:${binding.ownerHandle} not found`);
  }
  return Result.Ok({
    type: "vibes.diy-app-user-slug-binding",
    ownerHandle: {
      type: "vibes.diy-user-slug-binding",
      userId: sql.UserSlugBindings.userId,
      ownerHandle: sql.UserSlugBindings.handle,
      tenant: sql.UserSlugBindings.tenant,
    },
    appSlug: {
      type: "vibes.diy-app-slug-binding",
      userId: sql.UserSlugBindings.userId,
      appSlug: sql.AppSlugBindings.appSlug,
      ledger: sql.AppSlugBindings.ledger,
    },
    // ...binding,
    // tenant: sql.UserSlugBindings.tenant,
    // ledger: sql.AppSlugBindings.ledger,
    // userId: sql.UserSlugBindings.userId,
  });
}
