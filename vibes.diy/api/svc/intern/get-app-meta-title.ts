import { eq, and, desc } from "drizzle-orm/sql/expressions";
import { isMetaTitle, MetaItem } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export async function getAppMetaTitle(vctx: VibesApiSQLCtx, userSlug: string, appSlug: string): Promise<string | undefined> {
  const app = await vctx.sql.db
    .select({ meta: vctx.sql.tables.apps.meta })
    .from(vctx.sql.tables.apps)
    .where(
      and(
        eq(vctx.sql.tables.apps.userSlug, userSlug),
        eq(vctx.sql.tables.apps.appSlug, appSlug),
        eq(vctx.sql.tables.apps.mode, "production")
      )
    )
    .orderBy(desc(vctx.sql.tables.apps.releaseSeq))
    .limit(1)
    .then((r) => r[0]);

  if (!app) return undefined;
  const metaItems = (app.meta as MetaItem[]) || [];
  const titleItem = metaItems.find(isMetaTitle);
  return titleItem?.title;
}
