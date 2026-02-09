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
  // code,
  // // dependencies,
  // onScreenshotCaptured,
  // chat,
  // // sessionId,
  // title,
  // setTitle,
  // promptProcessing = false,
  // codeReady = false,
  // displayView,
  // onPreviewLoaded,
  // setMobilePreviewShown,
  // setIsIframeFetching,
  // addError,
  // children,
  // onCodeSave,
  // onCodeChange,
  // onSyntaxErrorChange,
  children,
}: ResultPreviewProps & { children?: React.ReactNode }) {
  // if (!chat) {
  //   return <> </>;
  // }
  // const { vibeDoc, updateDependencies, updateDemoDataOverride } = useSession(chat.chatId);
  const showWelcome = !promptState.running && !promptState.hasCode;

  // // Use title from props directly
  // // const currentTitle = title || "Untitled App";

  // // Settings view callbacks handled in AppSettingsView

  // // Calculate filesContent directly based on code prop
  // const filesContent = useMemo<IframeFiles>(() => {
  //   // Always return the expected structure, defaulting code to empty string
  //   return {
  //     "/App.jsx": {
  //       code: code && !showWelcome ? code : "", // Use code if available, else empty string
  //       active: true,
  //     },
  //   };
  // }, [code, showWelcome, codeReady, promptProcessing]); // Include codeReady to ensure updates

  // // Theme is now provided by ThemeContext

  // // Function to download HTML file
  // const handleDownloadHtml = useCallback(async () => {
  //   try {
  //     const html = generateStandaloneHtml({ code });
  //     const name = title.title;
  //     downloadTextFile(`${name}.html`, html);
  //   } catch (error) {
  //     console.error("Failed to download HTML:", error);
  //     if (addError) {
  //       addError({
  //         type: "error",
  //         message: "Failed to download HTML file",
  //         source: "download-html",
  //         timestamp: new Date().toISOString(),
  //       });
  //     }
  //   }
  // }, [code, chat.chatId, title.title, addError]);

  // useEffect(() => {
  //   const handleMessage = ({ data }: MessageEvent) => {
  //     if (data) {
  //       if (data.type === "preview-ready" || data.type === "preview-loaded") {
  //         // No API key needed - proxy handles authentication
  //         setMobilePreviewShown(true);
  //         onPreviewLoaded();
  //       } else if (data.type === "streaming" && data.state !== undefined) {
  //         if (setIsIframeFetching) {
  //           setIsIframeFetching(data.state);
  //         }
  //       } else if (data.type === "screenshot" && data.data) {
  //         if (onScreenshotCaptured) {
  //           onScreenshotCaptured(data.data);
  //         }
  //       } else if (data.type === "screenshot-error" && data.error) {
  //         // Still call onScreenshotCaptured with null to signal that the screenshot failed
  //         if (onScreenshotCaptured) {
  //           onScreenshotCaptured(null);
  //         }
  //       } else if (data.type === "iframe-error" && data.error) {
  //         const error = data.error as RuntimeError;
  //         if (addError) {
  //           addError(error);
  //         }
  //       }
  //     }
  //   };
  //   window.addEventListener("message", handleMessage);
  //   return () => {
  //     window.removeEventListener("message", handleMessage);
  //   };
  // }, [onScreenshotCaptured, onPreviewLoaded, setIsIframeFetching, setMobilePreviewShown, addError, chat.chatId, title.title]);

  // console.log(`ResultPreview:`, currentView, showWelcome)
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
      console.log(`PreviewApp`, promptState);
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
            // onUpdateTitle={setTitle}
            // onDownloadHtml={handleDownloadHtml}
            // selectedDependencies={vibeDoc?.dependencies}
            // dependenciesUserOverride={vibeDoc?.dependenciesUserOverride}
            // aiSelectedDependencies={vibeDoc?.aiSelectedDependencies}
            // onUpdateDependencies={updateDependencies}
            // demoDataOverride={vibeDoc?.demoDataOverride}
            // onUpdateDemoDataOverride={updateDemoDataOverride}
          />
        </div>
      );
      break;
  }

  // <>
  //   <IframeContent
  //     activeView={displayView}
  //     filesContent={filesContent}
  //     promptProcessing={!codeReady}
  //     codeReady={codeReady}
  //     isDarkMode={isDarkMode}
  //     sessionId={chat.chatId}
  //     onCodeSave={onCodeSave}
  //     onCodeChange={onCodeChange}
  //     onSyntaxErrorChange={onSyntaxErrorChange}
  //   />
  //   {displayView === "settings" && (

  //   )}
  // </>
  // );

  return (
    <div className="h-full" style={{ overflow: "hidden", position: "relative" }}>
      <style>{animationStyles}</style>
      {previewArea}
      {children}
    </div>
  );
}

export default ResultPreview;
