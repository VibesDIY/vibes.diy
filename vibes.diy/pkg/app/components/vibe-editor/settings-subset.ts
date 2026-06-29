export type SettingKey = "title" | "theme" | "icon" | "env" | "model" | "account";

export const IN_VIBE_SETTINGS: readonly SettingKey[] = ["title", "theme", "icon", "env"] as const;

export const MANAGE_IN_MINE: readonly SettingKey[] = ["model"] as const;

export function isInVibeSetting(k: SettingKey): boolean {
  return (IN_VIBE_SETTINGS as readonly string[]).includes(k);
}
