import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import type { ViewType } from "@vibes.diy/prompts";
import IframeContent from "../components/ResultPreview/IframeContent.js";
import type { IframeFiles } from "../components/ResultPreview/ResultPreviewTypes.js";
import ResultPreviewHeaderContent from "../components/ResultPreview/ResultPreviewHeaderContent.js";

export function meta() {
  return [
    { title: "Preview - Vibes DIY" },
    { name: "description", content: "Preview your generated app" },
  ];
}

interface LocationState {
  code?: string;
  sessionId?: string;
}

export default function CreatePreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  // Get code and sessionId from navigation state
  const code = state.code || "// No code available";
  const sessionId = state.sessionId || "preview-session";

  // View switching state
  const [currentView, setCurrentView] = useState<ViewType>("preview");

  // Detect dark mode from system preferences
  const isDarkMode = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }, []);

  // Format code into IframeFiles structure
  const filesContent: IframeFiles = useMemo(
    () => ({
      "/App.jsx": {
        code,
        active: true,
      },
    }),
    [code],
  );

  // View controls configuration
  const viewControls = {
    preview: {
      enabled: true,
      icon: "preview",
      label: "App",
      loading: false,
    },
    code: {
      enabled: true,
      icon: "code",
      label: "Code",
      loading: false,
    },
    data: {
      enabled: true,
      icon: "data",
      label: "Data",
      loading: false,
    },
    settings: {
      enabled: false,
      icon: "settings",
      label: "Settings",
      loading: false,
    },
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      {/* Header with back button, view controls, and share button */}
      <div className="border-b border-light-decorative-01 bg-light-background-01 dark:border-dark-decorative-01 dark:bg-dark-background-01">
        <ResultPreviewHeaderContent
          displayView={currentView}
          navigateToView={setCurrentView}
          viewControls={viewControls}
          showViewControls={true}
          previewReady={true}
          setMobilePreviewShown={() => navigate("/create")}
          code={code}
          isStreaming={false}
          sessionId={sessionId}
          title={undefined}
        />
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-hidden">
        <IframeContent
          activeView={currentView}
          filesContent={filesContent}
          isStreaming={false}
          codeReady={true}
          isDarkMode={isDarkMode}
          sessionId={sessionId}
        />
      </div>
    </div>
  );
}
