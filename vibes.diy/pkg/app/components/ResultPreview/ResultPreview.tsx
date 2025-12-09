import React, { useCallback, useEffect, useMemo } from "react";
import type { RuntimeError } from "@vibes.diy/use-vibes-types";
import { animationStyles } from "./ResultPreviewTemplates.js";
import type { IframeFiles, ResultPreviewProps } from "./ResultPreviewTypes.js";
// import { encodeTitle } from '../SessionSidebar/utils';
// ResultPreview component
import IframeContent from "./IframeContent.js";
import AppSettingsView from "./AppSettingsView.js";
import {
  downloadTextFile,
  generateStandaloneHtml,
} from "../../utils/exportHtml.js";
import { useSession } from "../../hooks/useSession.js";
import { useTheme } from "../../contexts/ThemeContext.js";

function ResultPreview({
  code,
  // dependencies,
  onScreenshotCaptured,
  sessionId,
  title,
  updateTitle,
  isStreaming = false,
  codeReady = false,
  displayView,
  onPreviewLoaded,
  setMobilePreviewShown,
  setIsIframeFetching,
  addError,
  children,
  onCodeSave,
  onCodeChange,
  onSyntaxErrorChange,
}: ResultPreviewProps & { children?: React.ReactNode }) {

  return <></>
  const { isDarkMode } = useTheme();
  const { vibeDoc, updateDependencies, updateDemoDataOverride } =
    useSession(sessionId);
  const showWelcome = !isStreaming && (!code || code.length === 0);

  // Use title from props directly
  const currentTitle = title || "Untitled App";

  // Settings view callbacks handled in AppSettingsView

  // Calculate filesContent directly based on code prop
  const filesContent = useMemo<IframeFiles>(() => {
    // Always return the expected structure, defaulting code to empty string
    return {
      "/App.jsx": {
        code: code && !showWelcome ? code : "", // Use code if available, else empty string
        active: true,
      },
    };
  }, [code, showWelcome, codeReady, isStreaming]); // Include codeReady to ensure updates

  // Theme is now provided by ThemeContext

  // Function to download HTML file
  const handleDownloadHtml = useCallback(async () => {
    try {
      const html = generateStandaloneHtml({ code });
      const name = currentTitle !== "Untitled App" ? currentTitle : "app";
      downloadTextFile(`${name}.html`, html);
    } catch (error) {
      console.error("Failed to download HTML:", error);
      if (addError) {
        addError({
          type: "error",
          message: "Failed to download HTML file",
          source: "download-html",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [code, sessionId, currentTitle, addError]);

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent) => {
      if (data) {
        if (data.type === "preview-ready" || data.type === "preview-loaded") {
          // No API key needed - proxy handles authentication
          setMobilePreviewShown(true);
          onPreviewLoaded();
        } else if (data.type === "streaming" && data.state !== undefined) {
          if (setIsIframeFetching) {
            setIsIframeFetching(data.state);
          }
        } else if (data.type === "screenshot" && data.data) {
          if (onScreenshotCaptured) {
            onScreenshotCaptured(data.data);
          }
        } else if (data.type === "screenshot-error" && data.error) {
          // Still call onScreenshotCaptured with null to signal that the screenshot failed
          if (onScreenshotCaptured) {
            onScreenshotCaptured(null);
          }
        } else if (data.type === "iframe-error" && data.error) {
          const error = data.error as RuntimeError;
          if (addError) {
            addError(error);
          }
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    onScreenshotCaptured,
    onPreviewLoaded,
    setIsIframeFetching,
    setMobilePreviewShown,
    addError,
    sessionId,
    currentTitle,
  ]);

  const previewArea = showWelcome ? (
    <div className="h-full">{/* empty div to prevent layout shift */}</div>
  ) : (
    <>
      <IframeContent
        activeView={displayView}
        filesContent={filesContent}
        isStreaming={!codeReady}
        codeReady={codeReady}
        isDarkMode={isDarkMode}
        sessionId={sessionId}
        onCodeSave={onCodeSave}
        onCodeChange={onCodeChange}
        onSyntaxErrorChange={onSyntaxErrorChange}
      />
      {displayView === "settings" && (
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
            title={currentTitle}
            onUpdateTitle={updateTitle}
            onDownloadHtml={handleDownloadHtml}
            selectedDependencies={vibeDoc?.dependencies}
            dependenciesUserOverride={vibeDoc?.dependenciesUserOverride}
            aiSelectedDependencies={vibeDoc?.aiSelectedDependencies}
            onUpdateDependencies={updateDependencies}
            demoDataOverride={vibeDoc?.demoDataOverride}
            onUpdateDemoDataOverride={updateDemoDataOverride}
          />
        </div>
      )}
    </>
  );

  return (
    <div
      className="h-full"
      style={{ overflow: "hidden", position: "relative" }}
    >
      <style>{animationStyles}</style>
      {previewArea}
      {children}
    </div>
  );
}

export default ResultPreview;
