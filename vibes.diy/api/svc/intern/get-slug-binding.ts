import { Result, exception2Result } from "@adviser/cement";
import { eq, and } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { AppSlugBinding } from "./ensure-slug-binding.js";

export interface GetSlugBinding {
  userSlug: string;
  appSlug: string;
}

export async function getSlugBinding(ctx: VibesApiSQLCtx, binding: GetSlugBinding): Promise<Result<AppSlugBinding>> {
  const r = await exception2Result(() =>
    ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSlugBinding)
      .innerJoin(ctx.sql.tables.appSlugBinding, eq(ctx.sql.tables.appSlugBinding.userSlug, ctx.sql.tables.userSlugBinding.userSlug))
      .where(
        and(
          eq(ctx.sql.tables.userSlugBinding.userSlug, binding.userSlug),
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
    return Result.Err(`appSlug/userSlug not found ${binding.appSlug}:${binding.userSlug} not found`);
  }
  return Result.Ok({
    ...binding,
    tenant: sql.UserSlugBindings.tenant,
    ledger: sql.AppSlugBindings.ledger,
    userId: sql.UserSlugBindings.userId,
  });
}
