import React, { useState, useCallback, useEffect, useRef } from "react";
import { encodeTitle } from "./SessionSidebar/utils.js";
import AppLayout from "./AppLayout.js";
import ChatHeaderContent from "./ChatHeaderContent.js";
import ChatInput, { ChatInputRef } from "./ChatInput.js";
import models from "../data/models.json" with { type: "json" };
import ChatInterface from "./ChatInterface.js";
import ResultPreview from "./ResultPreview/ResultPreview.js";
import ResultPreviewHeaderContent from "./ResultPreview/ResultPreviewHeaderContent.js";
import SessionSidebar from "./SessionSidebar.js";
import { useCookieConsent } from "../contexts/CookieConsentContext.js";
import { useSimpleChat } from "../hooks/useSimpleChat.js";
import { isMobileViewport, useViewState } from "../utils/ViewState.js";
import { ViewType, ViewControlsType } from "@vibes.diy/prompts";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";
import { trackAuthClick, trackEvent } from "../utils/analytics.js";
import { VibesSwitch } from "use-vibes";

// Vibe switch button component with animation
function VibesLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="vibes-login-button">
      Login
    </button>
  );
}

interface SessionViewProps {
  sessionId: string;
  pathname: string;
  search: string;
  locationState: unknown;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  urlPrompt: string | null;
  urlModel: string | null;
}

export default function SessionView({
  sessionId,
  pathname,
  search: _search,
  locationState,
  navigate,
  urlPrompt,
  urlModel,
}: SessionViewProps) {
  // Check authentication before allowing access to the chat interface
  const { isAuthenticated, isLoading } = useAuth();
  const { initiateLogin } = useAuthPopup();

  // Track unauthenticated view render once
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      trackEvent("unauthenticated_session_view");
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-light-background-00 dark:bg-dark-background-00">
        <div className="text-center">
          <div className="text-light-primary dark:text-dark-primary mb-4 text-xl">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    const handleLogin = async () => {
      trackAuthClick({
        label: "Session View Login",
        isUserAuthenticated: false,
      });
      await initiateLogin();
    };

    return (
      <div className="grid-background flex h-screen w-screen items-center justify-center relative">
        {/* Center content */}
        <div className="text-center max-w-md px-4 w-full">
          <h1 className="mb-4 text-3xl font-bold" style={{ color: "#1a1a1a" }}>
            Welcome to Vibes DIY
          </h1>
          <p className="mb-6 text-lg" style={{ color: "#1a1a1a" }}>
            You can just code things.
          </p>
          <VibesLoginButton onClick={handleLogin} />
        </div>

        {/* Vibe switch in lower right corner */}
        <button
          type="button"
          onClick={handleLogin}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleLogin();
            }
          }}
          className="cursor-pointer fixed"
          style={{
            bottom: "1.5rem",
            right: "6rem",
            width: "80px",
            zIndex: 50,
            background: "none",
            border: "none",
            padding: 0,
          }}
          aria-label="Login to Vibes DIY"
        >
          <VibesSwitch size={80} />
        </button>
      </div>
    );
  }

  return (
    <AuthenticatedSessionView
      sessionId={sessionId}
      pathname={pathname}
      search={_search}
      locationState={locationState}
      navigate={navigate}
      urlPrompt={urlPrompt}
      urlModel={urlModel}
    />
  );
}

// Separate component for authenticated session to avoid hook ordering issues
function AuthenticatedSessionView({
  sessionId,
  pathname,
  search: _search,
  locationState,
  navigate,
  urlPrompt,
  urlModel,
}: SessionViewProps) {
  const chatState = useSimpleChat(sessionId);
  const hasAutoSentMessage = useRef(false);
  const chatInputRef = useRef<ChatInputRef>(null);

  const { setMessageHasBeenSent } = useCookieConsent();

  // URL is source of truth - use urlModel directly to override chatState.effectiveModel
  const effectiveModel = urlModel || chatState.effectiveModel;

  // Update vibeDoc with URL model on mount (for persistence after URL is cleared)
  useEffect(() => {
    if (urlModel && chatState.updateSelectedModel) {
      chatState.updateSelectedModel(urlModel);
    }
  }, [urlModel, chatState.updateSelectedModel]);

  // Handle URL prompt for auto-send
  const [capturedPrompt, setCapturedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (urlPrompt && urlPrompt.trim()) {
      setCapturedPrompt(urlPrompt);
    }

    // Check for pending message from new session creation
    const navigationState = locationState as {
      pendingMessage?: string;
    } | null;
    if (
      navigationState?.pendingMessage &&
      navigationState.pendingMessage.trim()
    ) {
      setCapturedPrompt(navigationState.pendingMessage);
    }
  }, [urlPrompt, locationState]);

  // Handle captured prompt by setting input and focusing
  useEffect(() => {
    // Don't auto-send until model has propagated if we have a urlModel
    const modelReady = !urlModel || chatState.effectiveModel === urlModel;

    if (capturedPrompt && !hasAutoSentMessage.current && modelReady) {
      chatState.setInput(capturedPrompt);

      // Focus the input element and place cursor at the end after a short delay
      setTimeout(() => {
        if (chatState.inputRef.current) {
          chatState.inputRef.current.focus();

          // Place cursor at the end of the text
          const inputLength = chatState.inputRef.current.value.length;
          chatState.inputRef.current.setSelectionRange(
            inputLength,
            inputLength,
          );
        }
      }, 10);

      hasAutoSentMessage.current = true;

      // Click submit button after 2 seconds
      setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.clickSubmit();
          // Clear the captured prompt to allow normal navigation behavior
          setCapturedPrompt(null);
        }
      }, 1000);
    }
  }, [capturedPrompt, chatState.setInput, urlModel, chatState.effectiveModel]);

  const [previewReady, setPreviewReady] = useState(false);
  const [mobilePreviewShown, setMobilePreviewShown] = useState(false);
  const [isIframeFetching, setIsIframeFetching] = useState(false);

  // State for code editing
  const [hasCodeChanges, setHasCodeChanges] = useState(false);
  const [codeSaveHandler, setCodeSaveHandler] = useState<(() => void) | null>(
    null,
  );
  const [syntaxErrorCount, setSyntaxErrorCount] = useState(0);

  // Add dependency tracking for useViewState props
  const viewStateProps = {
    sessionId: chatState.sessionId, // sessionId is guaranteed non-null from interface
    title: chatState.title || undefined, // Handle null
    code: chatState.selectedCode?.content || "",
    isStreaming: chatState.isStreaming,
    previewReady: previewReady,
    isIframeFetching: isIframeFetching,
    capturedPrompt: capturedPrompt,
  };

  const { displayView, navigateToView, viewControls, showViewControls } =
    useViewState(viewStateProps, pathname, navigate);

  // Temporary fallback values for testing
  // const displayView = "chat";
  // const navigateToView = () => {};
  // const viewControls = {};
  // const showViewControls = false;

  // Handle code save from the editor
  const handleCodeSave = useCallback(
    async (code: string) => {
      try {
        const newMessageId = await chatState.saveCodeAsAiMessage(
          code,
          chatState.docs,
        );

        // Select the newly created message
        chatState.setSelectedResponseId(newMessageId);

        // Navigate to app view to show the result
        navigateToView?.("preview");
      } catch (error) {
        chatState.addError({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to save code",
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now().toString(),
          errorType: "Other",
        });
      }
    },
    [chatState, navigateToView],
  );

  // Handle code change notifications from editor
  const handleCodeChange = useCallback(
    (hasChanges: boolean, saveHandler: () => void) => {
      setHasCodeChanges(hasChanges);
      setCodeSaveHandler(() => saveHandler);
    },
    [],
  );

  // Handle syntax error changes from editor
  const handleSyntaxErrorChange = useCallback((errorCount: number) => {
    setSyntaxErrorCount(errorCount);
  }, []);

  // Add a ref to track whether streaming was active previously
  const wasStreamingRef = useRef(false);

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Directly create an openSidebar function
  const openSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  // Add closeSidebar function
  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  // Reset previewReady state when streaming starts
  useEffect(() => {
    if (chatState.isStreaming) {
      setPreviewReady(false);
    }
  }, [chatState.isStreaming]);

  // Handle preview loaded event
  const handlePreviewLoaded = useCallback(() => {
    setPreviewReady(true);

    // Always show preview on mobile devices when it's ready, regardless of streaming status
    if (isMobileViewport()) {
      setMobilePreviewShown(true);
    }

    // setActiveView('preview'); // This is now handled by useViewState when previewReady changes
  }, []); // chatState.isStreaming, chatState.codeReady removed as setActiveView is gone and useViewState handles this logic

  // URL update effect
  useEffect(() => {
    if (chatState.title) {
      // Don't update URL while we still have urlModel that needs processing
      // This prevents stripping the model parameter before initialization completes
      if (urlModel && capturedPrompt) {
        // Initialization is still in progress, wait
        return;
      }

      // Check if the current path has a tab suffix
      // Add null check for location to prevent errors in tests
      const currentPath = location?.pathname || "";
      let suffix = "";

      // Preserve the tab suffix when updating the URL
      if (currentPath.endsWith("/app")) {
        suffix = "/app";
      } else if (currentPath.endsWith("/code")) {
        suffix = "/code";
      } else if (currentPath.endsWith("/data")) {
        suffix = "/data";
      } else if (currentPath.endsWith("/chat")) {
        suffix = "/chat";
      } else if (currentPath.endsWith("/settings")) {
        suffix = "/settings";
      } else if (currentPath.includes(`/chat/${chatState.sessionId}`)) {
        // If it's the base chat URL without suffix, default to /app
        // Unless there's a captured prompt that hasn't been sent yet
        suffix = capturedPrompt ? "/chat" : "/app";
      }

      const newUrl = `/chat/${chatState.sessionId}/${encodeTitle(chatState.title)}${suffix}`;

      if (location && newUrl !== location.pathname) {
        navigate(newUrl, { replace: true });
      }
    }
  }, [
    chatState.title,
    location.pathname,
    chatState.sessionId,
    navigate,
    capturedPrompt,
    urlModel,
  ]);

  // We're now passing chatState directly to ChatInput

  // Track if user manually clicked back to chat during streaming
  const [userClickedBack, setUserClickedBack] = useState(false);

  // Handle the case when preview becomes ready
  useEffect(() => {
    // Switch to preview view as soon as preview becomes ready, regardless of streaming status
    if (previewReady) {
      // Reset user preference so future code content will auto-show preview
      setUserClickedBack(false);

      // Only auto-show preview if the user hasn't explicitly clicked back to chat
      if (!userClickedBack) {
        setMobilePreviewShown(true);
      }
    }
  }, [
    previewReady,
    userClickedBack,
    chatState.isStreaming,
    chatState.codeReady,
  ]);

  // Update mobilePreviewShown when selectedCode changes
  useEffect(() => {
    // If we're on a mobile device and there's code content
    if (chatState.selectedCode?.content) {
      // Only show preview when:
      // 1. Streaming has finished (!chatState.isStreaming)
      // 2. Preview is ready (previewReady)
      // 3. We're on mobile (isMobileViewport())
      if (!chatState.isStreaming && previewReady && isMobileViewport()) {
        setMobilePreviewShown(true);
      }
    }

    // Update wasStreaming ref to track state changes
    wasStreamingRef.current = chatState.isStreaming;
  }, [chatState.selectedCode, chatState.isStreaming, previewReady]);

  // Initial URL navigation effect
  useEffect(() => {
    const path = location?.pathname || "";
    const hasTabSuffix =
      path.endsWith("/app") ||
      path.endsWith("/code") ||
      path.endsWith("/data") ||
      path.endsWith("/chat") ||
      path.endsWith("/settings");
    const encodedAppTitle = chatState.title ? encodeTitle(chatState.title) : "";

    // If there's a session and title, but no specific view suffix in the URL, navigate to the 'app' (preview) view.
    // Skip navigation if there's a captured prompt that hasn't been sent yet.
    const targetUrl = `/chat/${chatState.sessionId}/${encodedAppTitle}/app`;
    const shouldNavigate =
      !hasTabSuffix &&
      chatState.sessionId &&
      encodedAppTitle &&
      !capturedPrompt;

    if (shouldNavigate) {
      navigate(targetUrl, {
        replace: true,
      });
    }
  }, [chatState.sessionId, chatState.title, navigate, location.pathname]);

  return (
    <>
      <AppLayout
        fullWidthChat={false}
        headerLeft={
          <ChatHeaderContent
            remixOf={chatState.vibeDoc?.remixOf}
            onOpenSidebar={openSidebar}
            isStreaming={chatState.isStreaming}
            codeReady={chatState.codeReady}
            title={chatState.title || ""}
          />
        }
        headerRight={
          // Only render the header content when we have code content or a completed session
          chatState.selectedCode?.content || sessionId ? (
            <ResultPreviewHeaderContent
              displayView={displayView as ViewType}
              navigateToView={navigateToView as (view: ViewType) => void}
              viewControls={viewControls as ViewControlsType}
              showViewControls={!!showViewControls}
              setMobilePreviewShown={setMobilePreviewShown}
              setUserClickedBack={setUserClickedBack} // Keep this for BackButton logic
              isStreaming={chatState.isStreaming}
              // Props needed by usePublish and useSession within ResultPreviewHeaderContent:
              code={chatState.selectedCode?.content || ""}
              sessionId={chatState.sessionId} // sessionId is guaranteed non-null from interface
              title={chatState.title || undefined} // Handle null
              previewReady={previewReady} // needed for publish button visibility logic
              // Props for code editing
              hasCodeChanges={hasCodeChanges}
              onCodeSave={codeSaveHandler || undefined}
              syntaxErrorCount={syntaxErrorCount}
            />
          ) : null
        }
        chatPanel={
          <ChatInterface
            {...chatState}
            setMobilePreviewShown={setMobilePreviewShown}
            navigateToView={navigateToView as (view: ViewType) => void}
          />
        }
        previewPanel={
          <ResultPreview
            title={chatState.title}
            updateTitle={chatState.updateTitle}
            sessionId={chatState.sessionId} // sessionId is guaranteed non-null from interface
            code={chatState.selectedCode?.content || ""}
            isStreaming={chatState.isStreaming}
            codeReady={chatState.codeReady}
            onScreenshotCaptured={chatState.addScreenshot}
            displayView={displayView as ViewType}
            onPreviewLoaded={handlePreviewLoaded}
            setMobilePreviewShown={setMobilePreviewShown}
            setIsIframeFetching={setIsIframeFetching}
            addError={(error) => chatState.addError(error)}
            onCodeSave={handleCodeSave}
            onCodeChange={handleCodeChange}
            onSyntaxErrorChange={handleSyntaxErrorChange}
          />
        }
        chatInput={
          <ChatInput
            ref={chatInputRef}
            chatState={chatState}
            showModelPickerInChat={chatState.showModelPickerInChat}
            currentModel={effectiveModel}
            onModelChange={async (modelId: string) => {
              if (chatState.updateSelectedModel) {
                await chatState.updateSelectedModel(modelId);
              }
            }}
            models={
              models as {
                id: string;
                name: string;
                description: string;
                featured?: boolean;
              }[]
            }
            globalModel={chatState.globalModel}
            onSend={() => {
              setMessageHasBeenSent(true);
            }}
          />
        }
        suggestionsComponent={undefined}
        mobilePreviewShown={displayView === "chat" ? false : mobilePreviewShown}
      />
      <SessionSidebar
        isVisible={isSidebarVisible}
        onClose={closeSidebar}
        sessionId={chatState.sessionId} // sessionId is guaranteed non-null from interface
      />
    </>
  );
}
