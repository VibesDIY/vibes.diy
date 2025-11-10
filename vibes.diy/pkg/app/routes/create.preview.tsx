import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import IframeContent from "../components/ResultPreview/IframeContent.js";
import type { IframeFiles } from "../components/ResultPreview/ResultPreviewTypes.js";

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

  return (
    <div className="flex h-screen w-screen flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-4 border-b border-light-decorative-01 bg-light-background-01 p-4 dark:border-dark-decorative-01 dark:bg-dark-background-01">
        <button
          onClick={() => navigate("/create")}
          className="flex items-center gap-2 rounded-sm bg-light-background-02 px-4 py-2 font-medium text-light-primary transition-colors hover:bg-light-decorative-00 dark:bg-dark-background-02 dark:text-dark-primary dark:hover:bg-dark-decorative-00"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-lg font-bold">App Preview</h1>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-hidden">
        <IframeContent
          activeView="preview"
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
