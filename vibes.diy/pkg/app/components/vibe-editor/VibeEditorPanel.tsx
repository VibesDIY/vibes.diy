import React, { useState } from "react";
import type { PromptState } from "../../routes/chat/prompt-state.js";
import { EDITOR_TABS, type EditorTab } from "./editor-tab-state.js";
import { resolveCodeView } from "./code-from-chat.js";
import { CodeViewPanel } from "./CodeViewPanel.js";
import { SettingsTabScoped } from "./SettingsTabScoped.js";
import { DataView } from "../ResultPreview/DataView.js";
import ChatInterface from "../ChatInterface.js";

const TAB_LABELS: Record<EditorTab, string> = {
  code: "Code",
  data: "Data",
  chat: "Chat",
  settings: "Settings",
};

/**
 * The in-page tabbed editor surface for the /vibe route (#2518 Phase 1).
 *
 * A thin composition: a tab row over four existing bodies (Code/Data/Chat/
 * Settings). It does not navigate — Chat's `onClick` is a no-op by design — and
 * does not re-implement any of the underlying panels.
 */
export function VibeEditorPanel({
  tab,
  onTab,
  ownerHandle,
  appSlug,
  promptState,
}: {
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  ownerHandle: string;
  appSlug: string;
  promptState: PromptState;
  onActivateChat?: () => void;
}) {
  // Local selection for the Code tab's file row. Phase 1 only needs to track
  // which file was clicked; resolveCodeView already defaults the selection.
  const [, setPickedFile] = useState<string | undefined>(undefined);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Vibe editor"
        className="flex flex-shrink-0 gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
      >
        {EDITOR_TABS.map((t) => {
          const selected = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={TAB_LABELS[t]}
              onClick={() => onTab(t)}
              className={
                "rounded px-3 py-1 text-sm font-medium " +
                (selected
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200")
              }
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "code" && <CodeViewPanel model={resolveCodeView(promptState)} onPickFile={setPickedFile} />}
        {tab === "data" && <DataView promptState={promptState} />}
        {tab === "chat" && <ChatInterface promptState={promptState} onClick={() => undefined} />}
        {tab === "settings" && <SettingsTabScoped ownerHandle={ownerHandle} appSlug={appSlug} />}
      </div>
    </div>
  );
}
