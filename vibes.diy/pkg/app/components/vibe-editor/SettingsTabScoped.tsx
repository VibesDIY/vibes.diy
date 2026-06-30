import React from "react";
import { Link } from "react-router";
import { SettingsTab } from "../mine/settings-tab/index.js";
import { MANAGE_IN_MINE, type SettingKey } from "./settings-subset.js";

/**
 * Settings tab for the in-page vibe editor (#2518 Phase 1 / #2850 subset).
 *
 * Reuses the full `SettingsTab` but hides the model-selection cards (those are
 * managed in My Apps), surfacing a link there instead. The structural-theme
 * picker also moves out of Settings — it lives in the Edit card composer (the
 * ThemeControls cluster) now — so we hide the "theme" card here too. Everything
 * else (title, icon, env) stays editable in-place.
 */
export function SettingsTabScoped({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) {
  return (
    <div className="space-y-4">
      <SettingsTab ownerHandle={ownerHandle} appSlug={appSlug} hide={new Set<SettingKey>([...MANAGE_IN_MINE, "theme"])} />
      <Link
        to={`/vibes/mine/${ownerHandle}/${appSlug}`}
        className="inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        Manage model settings in My Apps →
      </Link>
    </div>
  );
}
