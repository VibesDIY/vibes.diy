import { Result, exception2Result } from "@adviser/cement";
import { eq, and } from "drizzle-orm/sql/expressions";
import { sqlUserSlugBinding, sqlAppSlugBinding } from "../sql/vibes-diy-api-schema.js";
import { VibesApiSQLCtx } from "../types.js";
import { AppSlugBinding } from "./ensure-slug-binding.js";

export interface GetSlugBinding {
  userSlug: string;
  appSlug: string;
}

export async function getSlugBinding(ctx: VibesApiSQLCtx, binding: GetSlugBinding): Promise<Result<AppSlugBinding>> {
  const r = await exception2Result(() =>
    ctx.db
      .select()
      .from(sqlUserSlugBinding)
      .innerJoin(sqlAppSlugBinding, eq(sqlAppSlugBinding.userSlug, sqlUserSlugBinding.userSlug))
      .where(and(eq(sqlUserSlugBinding.userSlug, binding.userSlug), eq(sqlAppSlugBinding.appSlug, binding.appSlug)))
      .get()
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
