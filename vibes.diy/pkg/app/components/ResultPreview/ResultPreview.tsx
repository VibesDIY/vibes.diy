import React from "react";
import { animationStyles } from "./ResultPreviewTemplates.js";
import type { ResultPreviewProps } from "./ResultPreviewTypes.js";
import AppSettingsView from "./AppSettingsView.js";
import CodeEditor from "./CodeEditor.js";
import { PreviewApp } from "./PreviewApp.js";
// import { useTheme } from "../../contexts/ThemeContext.js";

function ResultPreview({
  promptState,
  currentView,
  children,
}: ResultPreviewProps & { children?: React.ReactNode }) {
  const showWelcome = !promptState.running && !promptState.hasCode;

  let previewArea: React.ReactElement;
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
    case currentView === "chat":
    case currentView === "data":
    case currentView === "settings":
    default:
      previewArea = (
        <div
          style={{
            position: "absolute",
            zIndex: 1,
            height: "100%",
            width: "100%",
            top: 0,
            left: 0,
          }}
        >
          <AppSettingsView
            title={`${promptState.chat.userSlug} -- ${promptState.chat.appSlug}`}
          />
        </div>
      );
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
