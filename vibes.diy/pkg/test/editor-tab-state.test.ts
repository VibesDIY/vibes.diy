import { describe, it, expect } from "vitest";
import { EDITOR_TABS, isEditorTab, chatShortcutTab, type EditorTab } from "../app/components/vibe-editor/editor-tab-state.js";
describe("editor-tab-state", () => {
  it("lists the four Phase 1 tabs in order", () => {
    expect(EDITOR_TABS).toEqual(["code", "data", "chat", "settings"] satisfies EditorTab[]);
  });
  it("recognises editor tabs and rejects the bottom-nav values", () => {
    expect(isEditorTab("code")).toBe(true);
    expect(isEditorTab("chat")).toBe(true);
    expect(isEditorTab("share")).toBe(false);
    expect(isEditorTab(null)).toBe(false);
  });
  it("the chat shortcut opens the Chat tab", () => {
    expect(chatShortcutTab()).toBe("chat");
  });
});
