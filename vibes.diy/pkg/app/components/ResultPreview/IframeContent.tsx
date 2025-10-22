import { Editor, Monaco } from "@monaco-editor/react";
import React, { useEffect, useRef, useState } from "react";
import type { IframeFiles } from "./ResultPreviewTypes.js";
// API key import removed - proxy handles authentication
import { VibesDiyEnv } from "../../config/env.js";
import {
  normalizeComponentExports,
  transformImports,
} from "@vibes.diy/prompts";
import { DatabaseListView } from "./DataView/index.js";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
import { editor } from "monaco-editor";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";

interface IframeContentProps {
  activeView: "preview" | "code" | "data" | "chat" | "settings";
  filesContent: IframeFiles;
  isStreaming: boolean;
  codeReady: boolean;
  isDarkMode: boolean;
  sessionId: string;
  onCodeSave?: (code: string) => void;
  onCodeChange?: (hasChanges: boolean, saveHandler: () => void) => void;
  onSyntaxErrorChange?: (errorCount: number) => void;
}

const IframeContent: React.FC<IframeContentProps> = ({
  activeView,
  filesContent,
  isStreaming,
  codeReady,
  isDarkMode,
  sessionId,
  onCodeSave,
  onCodeChange,
  onSyntaxErrorChange,
}) => {
  // API key no longer needed - proxy handles authentication
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Theme state is now received from parent via props
  const contentLoadedRef = useRef(false);
  const lastContentRef = useRef(""); // Use ref to track last rendered code

  // Reference to store the current Monaco editor instance
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
  // Reference to store the Monaco API instance
  const monacoApiRef = useRef<Monaco>(null);
  // Reference to store the current Shiki highlighter
  const highlighterRef = useRef<HighlighterGeneric<
    BundledLanguage,
    BundledTheme
  > | null>(null);
  // Reference to store disposables for cleanup
  const disposablesRef = useRef<{ dispose: () => void }[]>([]);
  // Flag to track if user has manually scrolled during streaming
  const userScrolledRef = useRef<boolean>(false);

  // Extract the current app code string
  const appCode = filesContent["/App.jsx"]?.code || "";

  // State for edited code
  const [editedCode, setEditedCode] = useState(appCode);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update edited code when app code changes
  useEffect(() => {
    setEditedCode(appCode);
    setHasUnsavedChanges(false);
  }, [appCode]);

  // Handle code changes in the editor
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || "";

    // Also check the editor's current value to be extra sure
    const editorCurrentValue = monacoEditorRef.current?.getValue() || newCode;
    const actualValue =
      editorCurrentValue.length >= newCode.length
        ? editorCurrentValue
        : newCode;

    setEditedCode(actualValue);
    const hasChanges = actualValue !== appCode;
    setHasUnsavedChanges(hasChanges);

    // Notify parent about changes
    if (onCodeChange) {
      onCodeChange(hasChanges, () => handleSave());
    }

    // Note: Syntax error checking is handled by onDidChangeMarkers listener
    // Don't check errors here as markers are updated asynchronously
  };

  // Handle save button click
  const handleSave = async () => {
    // Format the code before saving
    try {
      await monacoEditorRef.current
        ?.getAction("editor.action.formatDocument")
        ?.run();
    } catch (error) {
      console.warn("Could not format document:", error);
    }

    // Get the current value directly from Monaco editor to ensure we capture all keystrokes
    const currentValue = monacoEditorRef.current?.getValue() || editedCode;

    // Update our state with the actual current value
    if (currentValue !== editedCode) {
      setEditedCode(currentValue);
    }

    if (onCodeSave && (hasUnsavedChanges || currentValue !== appCode)) {
      onCodeSave(currentValue);
      setHasUnsavedChanges(false);
      // Notify parent that changes are saved
      if (onCodeChange) {
        onCodeChange(false, () => handleSave());
      }
    }
  };

  // Theme detection is now handled in the parent component

  // Cleanup for disposables
  useEffect(() => {
    return () => {
      // Clean up all disposables when component unmounts
      disposablesRef.current.forEach((disposable) => disposable.dispose());
      disposablesRef.current = [];
    };
  }, []);

  // Update theme when dark mode changes
  useEffect(() => {
    if (monacoApiRef.current) {
      // Update the Shiki theme in Monaco when dark mode changes from parent
      const currentTheme = isDarkMode
        ? "github-dark-default"
        : "github-light-default";
      // Use monaco editor namespace to set theme
      monacoApiRef.current.editor.setTheme(currentTheme);
    }
  }, [isDarkMode]);

  // Reset manual scroll flag when streaming state changes
  useEffect(() => {
    if (isStreaming) {
      // Reset the flag when streaming starts
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  // This effect is now managed at the ResultPreview component level

  // API key management removed - proxy handles authentication

  // Update iframe when code is ready
  useEffect(() => {
    if (codeReady && iframeRef.current) {
      // Skip if content hasn't changed
      if (contentLoadedRef.current && appCode === lastContentRef.current) {
        return;
      }

      contentLoadedRef.current = true;
      lastContentRef.current = appCode; // Update ref

      // Use the extracted function to normalize component export patterns
      const normalizedCode = normalizeComponentExports(appCode);

      // Create a session ID variable for the iframe
      const sessionIdValue = sessionId || "default-session";

      const transformedCode = transformImports(normalizedCode);

      // Use vibesbox.dev subdomain for origin isolation with v_vibes parameter
      const iframeUrl = `https://${sessionIdValue}.vibesbox.dev/?v_vibes=0.14.9-dev-api-token`;
      iframeRef.current.src = iframeUrl;

      // Send code via postMessage after iframe loads
      const handleIframeLoad = () => {
        if (iframeRef.current?.contentWindow) {
          // Get auth token from localStorage for API authentication
          // Check both new and legacy token keys for compatibility
          let authToken: string | undefined;
          try {
            authToken =
              localStorage.getItem("vibes-diy-auth-token") ||
              localStorage.getItem("auth_token") ||
              undefined;
            console.log(
              "🔐 [VIBES.DIY] Reading auth token from localStorage:",
              authToken ? authToken.substring(0, 20) + "..." : "NOT FOUND",
            );
          } catch (e) {
            console.warn("🔐 [VIBES.DIY] Failed to read auth token:", e);
            // Ignore localStorage errors (privacy mode, SSR, etc.)
          }

          const messageData = {
            type: "execute-code",
            code: transformedCode,
            apiKey: "sk-vibes-proxy-managed",
            sessionId: sessionIdValue,
            endpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
            authToken, // Pass auth token to iframe
          };

          console.log(
            "🔐 [VIBES.DIY] Sending message to iframe with authToken:",
            authToken ? "YES" : "NO",
          );
          console.log(
            "🔐 [VIBES.DIY] Message data keys:",
            Object.keys(messageData),
          );
          iframeRef.current.contentWindow.postMessage(messageData, "*");
        }
      };

      iframeRef.current.addEventListener("load", handleIframeLoad);

      // Setup message listener for preview ready signal
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "preview-ready") {
          // bundlingComplete state is removed, no action needed here
        }
      };

      window.addEventListener("message", handleMessage);

      return () => {
        if (iframeRef.current) {
          iframeRef.current.removeEventListener("load", handleIframeLoad);
        }
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [appCode, codeReady]);

  // Determine which view to show based on URL path - gives more stable behavior on refresh
  const getViewFromPath = () => {
    const path = window.location.pathname;
    if (path.endsWith("/code")) return "code";
    if (path.endsWith("/data")) return "data";
    if (path.endsWith("/app")) return "preview";
    if (path.endsWith("/chat")) return "preview"; // Show preview for chat view
    if (path.endsWith("/settings")) return "settings";
    return activeView; // Fall back to state if path doesn't have a suffix
  };

  // Get view from URL path
  const currentView = getViewFromPath();

  return (
    <div data-testid="sandpack-provider" className="h-full">
      <div
        style={{
          visibility: currentView === "preview" ? "visible" : "hidden",
          position: currentView === "preview" ? "static" : "absolute",
          zIndex: currentView === "preview" ? 1 : 0,
          height: "100%",
          width: "100%",
          top: 0,
          left: 0,
        }}
      >
        <iframe
          ref={iframeRef}
          className="h-full w-full border-0"
          title="Preview"
          allow="accelerometer *; bluetooth *; camera *; encrypted-media *; display-capture *; geolocation *; gyroscope *; microphone *; midi *; clipboard-read *; clipboard-write *; web-share *; serial *; xr-spatial-tracking *"
          allowFullScreen={true}
        />
      </div>
      <div
        style={{
          visibility: currentView === "code" ? "visible" : "hidden",
          position: currentView === "code" ? "static" : "absolute",
          zIndex: currentView === "code" ? 1 : 0,
          height: "100%",
          width: "100%",
          top: 0,
          left: 0,
        }}
      >
        <Editor
          height="100%"
          width="100%"
          path="file.jsx"
          defaultLanguage="jsx"
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
          value={editedCode}
          onChange={handleCodeChange}
          options={{
            readOnly: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 16 },
            formatOnType: true,
            formatOnPaste: true,
          }}
          onMount={async (editor, monaco) => {
            await setupMonacoEditor(editor, monaco, {
              isStreaming,
              codeReady,
              isDarkMode,
              userScrolledRef,
              disposablesRef,
              setRefs: (ed, mo) => {
                monacoEditorRef.current = ed;
                monacoApiRef.current = mo;
              },
              setHighlighter: (h) => {
                highlighterRef.current = h as HighlighterGeneric<
                  BundledLanguage,
                  BundledTheme
                >;
              },
            });

            // Set up syntax error monitoring
            const model = editor.getModel();
            if (model) {
              // Holds the timeout id for pending syntax-error checks so we can cancel
              // any previously scheduled run before queuing a new one. This acts as a
              // lightweight, manual debounce without bringing in lodash or a similar
              // utility.
              let syntaxErrorCheckTimeoutId: ReturnType<
                typeof setTimeout
              > | null = null;

              const scheduleSyntaxCheck = (delay: number) => {
                if (syntaxErrorCheckTimeoutId !== null) {
                  clearTimeout(syntaxErrorCheckTimeoutId);
                }
                syntaxErrorCheckTimeoutId = setTimeout(
                  checkSyntaxErrors,
                  delay,
                );
              };

              const checkSyntaxErrors = () => {
                // Get ALL markers for our model from all sources
                const allMarkers = monaco.editor.getModelMarkers({
                  resource: model.uri,
                });

                // Filter for error markers from any language service
                const errorMarkers = allMarkers.filter(
                  (marker) => marker.severity === monaco.MarkerSeverity.Error,
                );

                const errorCount = errorMarkers.length;

                if (onSyntaxErrorChange) {
                  onSyntaxErrorChange(errorCount);
                }
              };

              // Initial check after a short delay to allow language service to initialize
              scheduleSyntaxCheck(100);

              // Listen for marker changes - check every time markers change
              const disposable = monaco.editor.onDidChangeMarkers((uris) => {
                // Check if our model's URI is in the changed URIs
                if (
                  uris.some((uri) => uri.toString() === model.uri.toString())
                ) {
                  // Add a small delay to ensure markers are updated
                  scheduleSyntaxCheck(50);
                }
              });

              // Also listen for model content changes as a backup
              const contentDisposable = editor.onDidChangeModelContent(() => {
                // Queue a syntax check, cancelling any pending one, to avoid stacking
                // up checks during rapid typing.
                scheduleSyntaxCheck(500);
              });

              disposablesRef.current.push(disposable);
              disposablesRef.current.push(contentDisposable);
            }
          }}
        />
      </div>
      <div
        style={{
          visibility: currentView === "data" ? "visible" : "hidden",
          position: currentView === "data" ? "static" : "absolute",
          zIndex: currentView === "data" ? 1 : 0,
          height: "100%",
          width: "100%",
          top: 0,
          left: 0,
          padding: "0px",
          overflowY: "scroll",
          overflowX: "hidden",
        }}
      >
        <div className="data-container">
          <DatabaseListView
            appCode={filesContent["/App.jsx"]?.code || ""}
            sessionId={sessionId || "default-session"}
          />
        </div>
      </div>
      {/**
       * Settings view is rendered by the parent ResultPreview component, not inside
       * the iframe. We intentionally do not render a placeholder slot here to avoid
       * any chance of intercepting pointer events or impacting layout.
       */}
    </div>
  );
};

export default IframeContent;
