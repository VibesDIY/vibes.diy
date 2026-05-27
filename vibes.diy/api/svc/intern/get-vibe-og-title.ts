import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { isMetaTitle, MetaItem, parseArrayWarning } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export interface VibeSlugPair {
  readonly userSlug: string;
  readonly appSlug: string;
}

// Pure pathname parser — no I/O, safe to call before any async work.
// Extracts the (userSlug, appSlug) pair from /vibe/:userSlug/:appSlug[/...].
export function parseVibePathname(pathname: string): VibeSlugPair | undefined {
  const parts = pathname.split("/");
  // split("/vibe/user/app") → ["", "vibe", "user", "app", ...]
  const userSlug = parts[2];
  const appSlug = parts[3];
  if (parts[1] !== "vibe" || userSlug === undefined || userSlug === "" || appSlug === undefined || appSlug === "") {
    return undefined;
  }
  return { userSlug, appSlug };
}

// Looks up the human-readable app title for OG/Twitter meta tags.
// Returns undefined (not an error) when the app has no title or doesn't exist —
// callers fall back to appSlug in that case.
export async function getVibeOgTitle(ctx: VibesApiSQLCtx, slugs: VibeSlugPair): Promise<Result<string | undefined>> {
  return exception2Result(async (): Promise<Result<string | undefined>> => {
    const row = await ctx.sql.db
      .select({ meta: ctx.sql.tables.apps.meta })
      .from(ctx.sql.tables.apps)
      .where(
        and(
          eq(ctx.sql.tables.apps.userSlug, slugs.userSlug),
          eq(ctx.sql.tables.apps.appSlug, slugs.appSlug),
          eq(ctx.sql.tables.apps.mode, "production")
        )
      )
      .orderBy(desc(ctx.sql.tables.apps.releaseSeq))
      .limit(1)
      .then((r) => r[0]);

    if (row === undefined) return Result.Ok(undefined);

    const { filtered: metaItems, warning } = parseArrayWarning(row.meta, MetaItem);
    if (warning.length > 0) {
      ensureLogger(ctx.sthis, "getVibeOgTitle").Warn().Any({ parseErrors: warning }).Msg("skip");
    }

    const titleItem = metaItems.find(isMetaTitle);
    return Result.Ok(titleItem === undefined ? undefined : titleItem.title);
  });
}
