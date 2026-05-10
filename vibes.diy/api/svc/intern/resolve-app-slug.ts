import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";

interface ResolveCanonicalAppSlugParams {
  userSlug: string;
  appSlug: string;
}

const MAX_ALIAS_HOPS = 8;

export async function resolveCanonicalAppSlug(ctx: VibesApiSQLCtx, params: ResolveCanonicalAppSlugParams): Promise<Result<string>> {
  const seen = new Set<string>();
  let current = params.appSlug;

  for (let hop = 0; hop < MAX_ALIAS_HOPS; hop++) {
    if (seen.has(current)) break;
    seen.add(current);

    const rDirect = await exception2Result(() =>
      ctx.sql.db
        .select({ appSlug: ctx.sql.tables.appSlugBinding.appSlug })
        .from(ctx.sql.tables.appSlugBinding)
        .where(and(eq(ctx.sql.tables.appSlugBinding.userSlug, params.userSlug), eq(ctx.sql.tables.appSlugBinding.appSlug, current)))
        .limit(1)
        .then((r) => r[0])
    );
    if (rDirect.isErr()) return Result.Err(rDirect.Err());
    if (rDirect.Ok()) return Result.Ok(current);

    const rAlias = await exception2Result(() =>
      ctx.sql.db
        .select({ appSlug: ctx.sql.tables.appSlugAlias.appSlug })
        .from(ctx.sql.tables.appSlugAlias)
        .where(and(eq(ctx.sql.tables.appSlugAlias.userSlug, params.userSlug), eq(ctx.sql.tables.appSlugAlias.aliasSlug, current)))
        .limit(1)
        .then((r) => r[0])
    );
    if (rAlias.isErr()) return Result.Err(rAlias.Err());
    if (!rAlias.Ok()) return Result.Ok(current);

    current = rAlias.Ok().appSlug;
  }

  return Result.Ok(current);
}
