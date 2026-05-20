import React, { Suspense, lazy } from "react";
import { useParams } from "react-router";
import { useFreshFirstCodegen } from "../../utils/freshFirstCodegen.js";
import { animationStyles } from "./ResultPreviewTemplates.js";
import type { ResultPreviewProps } from "../../types/ResultPreviewTypes.js";
import ClientOnly from "../ClientOnly.js";
import { PreviewApp } from "./PreviewApp.js";
import { DataView } from "./DataView.js";
import { SettingsTab } from "../mine/settings-tab/index.js";
import { SharingTab } from "../mine/sharing-tab/SharingTab.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { EditorState } from "../../types/code-editor.js";
// import { useTheme } from "../../contexts/ThemeContext.js";

const CodeEditor = lazy(() => import("./CodeEditor.js"));

type SettingsSubTab = "settings" | "sharing";

function AppSettingsPanel({ userSlug, appSlug }: { userSlug: string; appSlug: string }) {
  const [sub, setSub] = React.useState<SettingsSubTab>("settings");
  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        {(["settings", "sharing"] as SettingsSubTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSub(tab)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${sub === tab ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            {tab === "settings" ? "Settings" : "Sharing"}
          </button>
        ))}
      </div>
      {sub === "settings" ? (
        <SettingsTab userSlug={userSlug} appSlug={appSlug} />
      ) : (
        <SharingTab userSlug={userSlug} appSlug={appSlug} />
      )}
    </div>
  );
}

function CodeEditorWrapper({
  promptState,
  onCode,
}: {
  promptState: PromptState;
  onCode: (event: EditorState) => void;
  currentView: string;
}) {
  return (
    <ClientOnly>
      <Suspense>
        <CodeEditor promptState={promptState} onCode={onCode} />
      </Suspense>
    </ClientOnly>
  );
}

// const MemoCodeEditor = memo(CodeEditorWrapper, (prevProps, nextProps) => {
//   // console.log("xxxx", nextProps.promptState.running)
//   if (
//     nextProps.promptState.running &&
//     nextProps.currentView === "code" &&
//     prevProps.currentView === "code" &&
//     prevProps.promptState.blocks.length === nextProps.promptState.blocks.length
//   ) {
//     // console.log(`Memo check for CodeEditor:`, { prevView: prevProps.currentView, nextView: nextProps.currentView });
//     return false; // re-render if still in code view to reflect changes in promptState.blocks
//   }

//   return nextProps.currentView === "code";
// });

function ResultPreview({ promptState, currentView, children, onCode }: ResultPreviewProps & { children?: React.ReactNode }) {
  const { fsId } = useParams<{ fsId?: string }>();

  // Fresh-chat first-codegen experience. The preview area should:
  //   1. stay empty until the first code-begin streams in
  //   2. show the streaming code editor while the first code block is live
  //   3. flip to the live app preview (with PreviewApp's blur ramp) as soon as
  //      the first code-end fires
  // The PreviewApp slot stays mounted (hidden behind the code editor) so the
  // iframe pre-loads its pending shell — the flip on first code-end is instant
  // instead of paying a cold-iframe load right after the user sees the code.
  const freshFirstCodegen = useFreshFirstCodegen(promptState, fsId);
  const overrideView = currentView === "preview" && freshFirstCodegen;

  const showWelcome = !fsId && !promptState.running && !promptState.hasCode;

  const codeEditor = <CodeEditorWrapper promptState={promptState} onCode={onCode} currentView={currentView} />;

  // PreviewApp slot is mounted whenever the active view is "preview", whether
  // visible or pre-warming. Visibility flips off during the override window.
  const previewSlotVisible = currentView === "preview" && !overrideView;

  let foreground: React.ReactNode = null;
  if (overrideView) {
    if (promptState.hasCode) foreground = codeEditor;
  } else if (!showWelcome) {
    if (currentView === "code") {
      foreground = codeEditor;
    } else if (currentView === "data") {
      foreground = <DataView promptState={promptState} />;
    } else if (currentView === "settings") {
      foreground = (
        <div className="h-full overflow-y-auto p-6">
          <AppSettingsPanel userSlug={promptState.chat.userSlug} appSlug={promptState.chat.appSlug} />
        </div>
      );
    }
  }

  return (
    <div className="h-[calc(100%-24px)]" style={{ overflow: "hidden", position: "relative", margin: "12px", borderRadius: "12px" }}>
      <style>{animationStyles}</style>
      {currentView === "preview" && (
        <div
          className="absolute inset-0"
          style={{
            visibility: previewSlotVisible ? "visible" : "hidden",
            pointerEvents: previewSlotVisible ? "auto" : "none",
          }}
        >
          <PreviewApp promptState={promptState} />
        </div>
      )}
      {foreground !== null && <div className="absolute inset-0 h-full">{foreground}</div>}
      {children}
    </div>
  );
}

export default ResultPreview;
