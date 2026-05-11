import { option, string } from "cmd-ts";
import { basename } from "node:path";
import type { CliCtx } from "../../cli-ctx.js";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { Result } from "@adviser/cement";
import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";

export function dbCommonArgs(ctx: CliCtx) {
  return {
    appSlug: option({
      long: "app-slug",
      description: "App slug; defaults to env VIBES_APP_SLUG or basename(cwd)",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_APP_SLUG") ?? basename(process.cwd()),
      defaultValueIsSerializable: true,
    }),
    userSlug: option({
      long: "user-slug",
      description: "User slug; defaults to defaultUserSlug from user settings",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    dbName: option({
      long: "db",
      description: "Database name",
      type: string,
      defaultValue: () => "default",
      defaultValueIsSerializable: true,
    }),
  };
}

// Resolve userSlug: explicit override -> defaultUserSlug from user settings.
export async function resolveUserSlug(api: VibesDiyApi, explicit: string): Promise<Result<string>> {
  if (explicit !== "") return Result.Ok(explicit);
  const r = await api.ensureUserSettings({ settings: [] });
  if (r.isErr()) return Result.Err(r.Err());
  const def = r.Ok().settings.find(isUserSettingDefaultUserSlug);
  if (def === undefined) {
    return Result.Err("No defaultUserSlug — pass --user-slug or run 'vibes-diy login' first");
  }
  return Result.Ok(def.userSlug);
}
