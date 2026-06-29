import React, { Suspense, lazy, useState } from "react";
import type { PromptState } from "../../routes/chat/prompt-state.js";
import type { SaveState } from "../../hooks/save-state.js";
import { EDITOR_TABS, type EditorTab } from "./editor-tab-state.js";
import { resolveCodeView } from "./code-from-chat.js";
import { CodeViewPanel } from "./CodeViewPanel.js";
import { SettingsTabScoped } from "./SettingsTabScoped.js";
import { DataView } from "../ResultPreview/DataView.js";
import ChatInterface from "../ChatInterface.js";

// Monaco edit surface is lazy so the heavy editor chunk loads only when an owner
// toggles into edit mode — never on /vibe first paint. (#2518 Phase 2)
const CodeEditPanel = lazy(() => import("./CodeEditPanel.js"));

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
 *
 * Phase 1 limitation: the Code tab hydrates from the persisted file system, but
 * the Chat tab's message history is NOT replayed here (that needs the heavier
 * chat-session replay, deferred to #2677). When `blocks` is empty we say the
 * history is "not loaded" — it exists, it just isn't hydrated into this view —
 * rather than implying there is none. The `💬` shortcut that opens straight to
 * this tab also lands with #2677 (no such affordance exists on /vibe yet).
 */
export function VibeEditorPanel({
  tab,
  onTab,
  ownerHandle,
  appSlug,
  fsId,
  promptState,
  canEdit = false,
  saveCode,
  saveState = "idle",
  isSaving = false,
}: {
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  ownerHandle: string;
  appSlug: string;
  /** The resolved effective fsId (route fsId ?? owner draft ?? served fsId), so
   *  the Data tab works on the unversioned `/vibe/:owner/:app` URL. (#2518) */
  fsId?: string;
  promptState: PromptState;
  onActivateChat?: () => void;
  /** Owner on the unversioned view: gates the Monaco Edit affordance. (#2518 Phase 2) */
  canEdit?: boolean;
  saveCode?: (args: { buffer: string; filePath: string; lang: string }) => void;
  saveState?: SaveState;
  isSaving?: boolean;
}) {
  // Whether the owner has toggled the Code tab into Monaco edit mode.
  const [codeEditing, setCodeEditing] = useState(false);

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
        {tab === "code" && (
          <div className="flex h-full min-h-0 flex-col">
            {canEdit && saveCode && (
              <div className="flex flex-shrink-0 justify-end border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  aria-pressed={codeEditing}
                  onClick={() => setCodeEditing((v) => !v)}
                  className="rounded px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40"
                >
                  {codeEditing ? "Done" : "Edit"}
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1">
              {canEdit && saveCode && codeEditing ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">
                      Loading editor…
                    </div>
                  }
                >
                  <CodeEditPanel model={resolveCodeView(promptState)} saveState={saveState} isSaving={isSaving} onSave={saveCode} />
                </Suspense>
              ) : (
                <CodeViewPanel model={resolveCodeView(promptState)} />
              )}
            </div>
          </div>
        )}
        {tab === "data" && <DataView promptState={promptState} fsId={fsId} />}
        {tab === "chat" &&
          (promptState.blocks.length > 0 ? (
            <ChatInterface promptState={promptState} onClick={() => undefined} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Chat history isn’t loaded here yet.
            </div>
          ))}
        {tab === "settings" && <SettingsTabScoped ownerHandle={ownerHandle} appSlug={appSlug} />}
      </div>
    </div>
  );
}
