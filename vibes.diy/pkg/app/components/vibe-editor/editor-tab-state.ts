export type EditorTab = "code" | "data" | "chat" | "settings";

export const EDITOR_TABS: readonly EditorTab[] = ["code", "data", "chat", "settings"] as const;

export function isEditorTab(v: unknown): v is EditorTab {
  return typeof v === "string" && (EDITOR_TABS as readonly string[]).includes(v);
}

/** The tab the persistent `💬` shortcut opens. */
export function chatShortcutTab(): EditorTab {
  return "chat";
}
