import React from "react";
import { animationStyles } from "./ResultPreviewTemplates.js";
import type { ResultPreviewProps } from "./ResultPreviewTypes.js";
import CodeEditor from "./CodeEditor.js";
import { PreviewApp } from "./PreviewApp.js";
import { DataView } from "./DataView.js";
import { SettingsTab } from "../mine/settings-tab/index.js";
import { SharingTab } from "../mine/sharing-tab/SharingTab.js";
// import { useTheme } from "../../contexts/ThemeContext.js";

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

function ResultPreview({ promptState, currentView, children }: ResultPreviewProps & { children?: React.ReactNode }) {
  const showWelcome = !promptState.running && !promptState.hasCode;

  let previewArea: React.ReactElement;
  // console.log(`ResultPreview:`, currentView, promptState.searchParams.toString())
  switch (true) {
    case showWelcome:
      previewArea = <div className="h-full">{/* empty div to prevent layout shift */}</div>;
      break;
    case currentView === "code":
      previewArea = <CodeEditor promptState={promptState} />;
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
          <AppSettingsPanel
            userSlug={promptState.chat.userSlug}
            appSlug={promptState.chat.appSlug}
          />
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
