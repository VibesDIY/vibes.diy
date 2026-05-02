import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";
import type { VibesDiyApi } from "@vibes.diy/api-impl";

/**
 * Resolve the userSlug to use for CLI commands.
 * Priority: explicit flag > defaultUserSlug setting > first from list.
 */
export async function resolveUserSlug(api: VibesDiyApi, explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;

  // Try the user's defaultUserSlug setting
  const rSettings = await api.ensureUserSettings({ settings: [] });
  if (rSettings.isOk()) {
    const defaultSlug = rSettings.Ok().settings.find(isUserSettingDefaultUserSlug);
    if (defaultSlug) return defaultSlug.userSlug;
  }

  // Fall back to first from list
  const rList = await api.listUserSlugAppSlug({});
  if (rList.isOk() && rList.Ok().items.length > 0) {
    return rList.Ok().items[0].userSlug;
  }

  return undefined;
}
