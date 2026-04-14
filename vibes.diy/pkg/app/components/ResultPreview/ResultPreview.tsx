import React, { Suspense, lazy } from "react";
import { useParams } from "react-router";
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
  const showWelcome = !fsId && !promptState.running && !promptState.hasCode;

  const codeEditor = <CodeEditorWrapper promptState={promptState} onCode={onCode} currentView={currentView} />;
  let previewArea: React.ReactNode;
  // console.log(`ResultPreview:`, currentView, promptState.searchParams.toString())
  switch (true) {
    case showWelcome:
      previewArea = <div className="h-full">{/* empty div to prevent layout shift */}</div>;
      break;
    case currentView === "code":
      previewArea = codeEditor;
      // console.log(`ToRender:code`);
      break;
    case currentView === "preview":
      // console.log(`PreviewApp`, currentView, promptState);
      previewArea = <PreviewApp promptState={promptState} />;
      break;
    case currentView === "data":
      previewArea = <DataView promptState={promptState} />;
      break;
    case currentView === "settings":
      previewArea = (
        <div className="h-full overflow-y-auto p-6">
          <AppSettingsPanel userSlug={promptState.chat.userSlug} appSlug={promptState.chat.appSlug} />
        </div>
      );
      break;
    case currentView === "chat":
    default:
      previewArea = <div className="h-full" />;
      break;
  }

  return (
    <div className="h-full" style={{ overflow: "hidden", position: "relative" }}>
      <style>{animationStyles}</style>
      {previewArea}
      {children}
    </div>
  );
}

export default ResultPreview;
