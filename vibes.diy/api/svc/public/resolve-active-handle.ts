import { and, eq } from "drizzle-orm";
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
 * The returned handle is ALWAYS one bound to `userId`. `ensureUserSettings`
 * validates the defaultHandle setting's shape but not its ownership, so an
 * unowned value is only honored after confirming the binding exists — otherwise
 * a caller could set another user's handle as their default and impersonate it
 * in access-fn author/grant checks. An unowned default falls back to a bound
 * handle (mirrors `getDefaultUserSlug`, which rejects an unowned default).
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
  const t_hb = vctx.sql.tables.handleBinding;
  let defaultHandle: string | undefined;
  for (const item of items) {
    if (isUserSettingDefaultHandle(item)) {
      defaultHandle = item.ownerHandle;
      break;
    }
  }
  // Honor the defaultHandle only if it is actually bound to this userId.
  if (defaultHandle !== undefined) {
    const owned = await vctx.sql.db
      .select({ handle: t_hb.handle })
      .from(t_hb)
      .where(and(eq(t_hb.userId, userId), eq(t_hb.handle, defaultHandle)))
      .limit(1)
      .then((r) => r[0]);
    if (owned?.handle) return owned.handle;
  }
  // No default, or an unowned one → fall back to any handle bound to this user.
  const binding = await vctx.sql.db
    .select({ handle: t_hb.handle })
    .from(t_hb)
    .where(eq(t_hb.userId, userId))
    .limit(1)
    .then((r) => r[0]);
  return binding?.handle;
}
