import { isUserSettingDefaultHandle } from "@vibes.diy/api-types";
import type { VibesDiyApi } from "@vibes.diy/api-impl";

/**
 * Resolve the ownerHandle to use for CLI commands.
 * Priority: explicit flag > defaultHandle setting > first from list.
 */
export async function resolveHandle(api: VibesDiyApi, explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;

  // Try the user's defaultHandle setting
  const rSettings = await api.ensureUserSettings({ settings: [] });
  if (rSettings.isOk()) {
    const defaultSlug = rSettings.Ok().settings.find(isUserSettingDefaultHandle);
    if (defaultSlug) return defaultSlug.ownerHandle;
  }

  // Fall back to first from list
  const rList = await api.listUserSlugAppSlug({});
  if (rList.isOk() && rList.Ok().items.length > 0) {
    return rList.Ok().items[0].ownerHandle;
  }

  return undefined;
}
