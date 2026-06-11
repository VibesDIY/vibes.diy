import { eq } from "drizzle-orm";
import { isUserSettingDefaultHandle } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

/**
 * Resolve which handle a userId is currently acting as.
 *
 * A user may have several handles bound to one userId. The "active" one is the
 * user's `defaultHandle` setting; absent that we fall back to any bound handle.
 * This is the SINGLE source of truth shared by the viewer payload (who-am-i)
 * and the document write path, so the handle a client publishes as always
 * matches the handle the access function validates against. Diverging here
 * (e.g. a bare unordered `handleBinding ... limit(1)`) caused spurious
 * "not author" rejections for multi-handle users — see VibesDIY/vibes.diy#2275.
 *
 * @param settingsItems optional pre-loaded userSettings items, to avoid a
 *   redundant read when the caller already has them (who-am-i loads them for
 *   the profile/displayName lookup).
 */
export async function resolveActiveHandle(
  vctx: VibesApiSQLCtx,
  userId: string,
  settingsItems?: unknown[]
): Promise<string | undefined> {
  let items = settingsItems;
  if (items === undefined) {
    const row = await vctx.sql.db
      .select({ settings: vctx.sql.tables.userSettings.settings })
      .from(vctx.sql.tables.userSettings)
      .where(eq(vctx.sql.tables.userSettings.userId, userId))
      .limit(1)
      .then((r) => r[0]);
    items = (row?.settings as unknown[]) ?? [];
  }
  for (const item of items) {
    if (isUserSettingDefaultHandle(item)) return item.ownerHandle;
  }
  const binding = await vctx.sql.db
    .select({ handle: vctx.sql.tables.handleBinding.handle })
    .from(vctx.sql.tables.handleBinding)
    .where(eq(vctx.sql.tables.handleBinding.userId, userId))
    .limit(1)
    .then((r) => r[0]);
  return binding?.handle;
}
