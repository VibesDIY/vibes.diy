import { Editor } from "@monaco-editor/react";
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { CodeViewModel } from "./code-from-chat.js";
import type { SaveState } from "../../hooks/save-state.js";

/**
 * Editable Code tab for the in-page vibe editor (#2518 Phase 2).
 *
 * Owner-only Monaco edit surface. This module is the ONLY place the heavy
 * `@monaco-editor/react` stack is imported, and it is mounted via `React.lazy`
 * from VibeEditorPanel — so the monaco chunk is fetched only when an owner
 * actually toggles into edit mode, never on /vibe first paint (parity with the
 * read-only CodeViewPanel keeping shiki lazy).
 *
 * It is seeded from the resolved `CodeViewModel` (which already reads the
 * hydrated file system, so it works on the unversioned `/vibe/:owner/:app` URL
 * where the route `fsId` param is absent — unlike the /chat CodeEditor, which
 * gates on `useParams().fsId`). On save it hands the raw buffer to `onSave`;
 * the host's `useInVibeGeneration.saveCode` persists it (promptFS) and re-pins
 * the running app to the saved version — the URL never changes.
 */
export interface CodeEditPanelProps {
  readonly model: CodeViewModel;
  readonly saveState: SaveState;
  readonly isSaving: boolean;
  readonly onSave: (args: { buffer: string; filePath: string; lang: string }) => void;
}

export function CodeEditPanel({ model, saveState, isSaving, onSave }: CodeEditPanelProps) {
  const { isDarkMode } = useTheme();
  const [pickedFileName, setPickedFileName] = useState<string | undefined>(undefined);

  const activeFile = model.files.find((f) => f.fileName === pickedFileName) ?? model.activeFile;
  const fileName = activeFile?.fileName ?? "/App.jsx";
  const baseCode = activeFile ? activeFile.code.join("\n") : model.activeCode;
  const lang = activeFile ? activeFile.lang || model.language : model.language;

  // The working buffer. Reseed when the selected file (or its persisted source,
  // e.g. after a save re-pins to a new fsId) changes.
  const [buffer, setBuffer] = useState(baseCode);
  useEffect(() => {
    setBuffer(baseCode);
  }, [fileName, baseCode]);

  const dirty = buffer !== baseCode;
  const canSave = dirty && !isSaving;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ buffer, filePath: fileName, lang });
  };

  const status = useMemo(() => describeSaveStatus(saveState, dirty), [saveState, dirty]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
        {model.files.length > 0 && (
          <div role="tablist" aria-label="Source files" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {model.files.map((file) => {
              const selected = file.fileName === fileName;
              return (
                <button
                  key={file.fileName}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setPickedFileName(file.fileName)}
                  className={
                    "rounded px-2 py-1 font-mono text-xs whitespace-nowrap " +
                    (selected
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200")
                  }
                >
                  {file.fileName}
                </button>
              );
            })}
          </div>
        )}
        <span
          aria-live="polite"
          className={
            "ml-auto text-xs " + (saveState === "error" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400")
          }
        >
          {status}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={
            "rounded px-3 py-1 text-xs font-medium " +
            (canSave
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500")
          }
        >
          {saveState === "error" ? "Retry" : "Save"}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          width="100%"
          path={fileName}
          language={lang}
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
          value={buffer}
          onChange={(next) => setBuffer(next ?? "")}
          options={{
            readOnly: isSaving,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
}

/** The inline save-status label, driven by the save-state machine. */
function describeSaveStatus(saveState: SaveState, dirty: boolean): string {
  switch (saveState) {
    case "queued":
      return "Queued…";
    case "saving":
      return "Saving…";
    case "rebuilt":
      return dirty ? "" : "Saved";
    case "error":
      return "Save failed";
    case "idle":
      return dirty ? "Unsaved changes" : "";
  }
}

export default CodeEditPanel;
