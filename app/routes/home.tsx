import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { encodeTitle } from '~/components/SessionSidebar/utils';
import AppLayout from '../components/AppLayout';
import ChatHeaderContent from '../components/ChatHeaderContent';
import ChatInput, { type ChatInputRef } from '../components/ChatInput';
import models from '../data/models.json';
import ChatInterface from '../components/ChatInterface';
import QuickSuggestions from '../components/QuickSuggestions';
import ResultPreview from '../components/ResultPreview/ResultPreview';
import ResultPreviewHeaderContent from '../components/ResultPreview/ResultPreviewHeaderContent';
import SessionSidebar from '../components/SessionSidebar';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useSimpleChat } from '../hooks/useSimpleChat';
import { isMobileViewport, useViewState } from '../utils/ViewState';

export function meta() {
  return [
    { title: 'Vibes DIY - AI App Builder' },
    { name: 'description', content: 'Generate apps in one prompt' },
  ];
}

export default function UnifiedSession() {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const chatState = useSimpleChat(urlSessionId);
  const hasAutoSentMessage = useRef(false);
  const chatInputRef = useRef<ChatInputRef>(null);

  const { setMessageHasBeenSent } = useCookieConsent();

  // Track message submission events
  const [hasSubmittedMessage, setHasSubmittedMessage] = useState(false);

  // Capture URL prompt on first render
  const [capturedPrompt, setCapturedPrompt] = useState<string | null>(null);

  // Capture URL prompt parameter once on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const promptParam = searchParams.get('prompt');
    if (promptParam && promptParam.trim()) {
      setCapturedPrompt(promptParam);
    }
  }, []); // Empty dependency array - runs only on mount

  // Handle captured prompt by setting input and focusing
  useEffect(() => {
    if (capturedPrompt && !hasAutoSentMessage.current) {
      chatState.setInput(capturedPrompt);

      // Focus the input element and place cursor at the end after a short delay
      setTimeout(() => {
        if (chatState.inputRef.current) {
          chatState.inputRef.current.focus();

          // Place cursor at the end of the text
          const inputLength = chatState.inputRef.current.value.length;
          chatState.inputRef.current.setSelectionRange(inputLength, inputLength);
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
  }, [capturedPrompt, chatState.setInput]);

  const [previewReady, setPreviewReady] = useState(false);
  const [mobilePreviewShown, setMobilePreviewShown] = useState(false);
  const [isIframeFetching, setIsIframeFetching] = useState(false);

  // State for code editing
  const [hasCodeChanges, setHasCodeChanges] = useState(false);
  const [codeSaveHandler, setCodeSaveHandler] = useState<(() => void) | null>(null);
  const [syntaxErrorCount, setSyntaxErrorCount] = useState(0);

  // Centralized view state management
  const { displayView, navigateToView, viewControls, showViewControls } = useViewState({
    sessionId: chatState.sessionId || undefined, // Handle null
    title: chatState.title || undefined, // Handle null
    code: chatState.selectedCode?.content || '',
    isStreaming: chatState.isStreaming,
    previewReady: previewReady,
    isIframeFetching: isIframeFetching,
    capturedPrompt: capturedPrompt,
  });

  // Handle code save from the editor
  const handleCodeSave = useCallback(
    async (code: string) => {
      try {
        const newMessageId = await chatState.saveCodeAsAiMessage(code, chatState.docs);

        // Select the newly created message
        chatState.setSelectedResponseId(newMessageId);

        // Navigate to app view to show the result
        navigateToView('preview');
      } catch (error) {
        console.error('Failed to save code:', error);
        chatState.addError({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to save code',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now().toString(),
          errorType: 'Other',
        });
      }
    },
    [chatState, navigateToView]
  );

  // Handle code change notifications from editor
  const handleCodeChange = useCallback((hasChanges: boolean, saveHandler: () => void) => {
    setHasCodeChanges(hasChanges);
    setCodeSaveHandler(() => saveHandler);
  }, []);

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

  useEffect(() => {
    if (chatState.title) {
      // Check if the current path has a tab suffix
      // Add null check for location to prevent errors in tests
      const currentPath = location?.pathname || '';
      let suffix = '';

      // Preserve the tab suffix when updating the URL
      if (currentPath.endsWith('/app')) {
        suffix = '/app';
      } else if (currentPath.endsWith('/code')) {
        suffix = '/code';
      } else if (currentPath.endsWith('/data')) {
        suffix = '/data';
      } else if (currentPath.endsWith('/chat')) {
        suffix = '/chat';
      } else if (currentPath.endsWith('/settings')) {
        suffix = '/settings';
      } else if (currentPath.includes(`/chat/${chatState.sessionId}`)) {
        // If it's the base chat URL without suffix, default to /app
        // Unless there's a captured prompt that hasn't been sent yet
        suffix = capturedPrompt ? '' : '/app';
      }

      const newUrl = `/chat/${chatState.sessionId}/${encodeTitle(chatState.title)}${suffix}`;

      if (location && newUrl !== location.pathname) {
        navigate(newUrl, { replace: true });
      }
    }
  }, [chatState.title, location.pathname, chatState.sessionId, navigate]);

  // We're now passing chatState directly to ChatInput

  // Handle suggestion selection directly
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      chatState.setInput(suggestion);

      // Focus the input and position cursor at the end
      setTimeout(() => {
        if (chatState.inputRef.current) {
          chatState.inputRef.current.focus();
          // Move cursor to end of text
          chatState.inputRef.current.selectionStart = chatState.inputRef.current.selectionEnd =
            suggestion.length;
        }
      }, 0);
    },
    [chatState.setInput, chatState.inputRef]
  );

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
  }, [previewReady, userClickedBack, chatState.isStreaming, chatState.codeReady]);

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

  // Handle initial URL path navigation if no view suffix.
  // useViewState handles subsequent auto-navigation based on state changes (e.g. previewReady).
  useEffect(() => {
    const path = location?.pathname || '';
    const hasTabSuffix =
      path.endsWith('/app') ||
      path.endsWith('/code') ||
      path.endsWith('/data') ||
      path.endsWith('/chat') ||
      path.endsWith('/settings');
    const encodedAppTitle = chatState.title ? encodeTitle(chatState.title) : '';

    // If there's a session and title, but no specific view suffix in the URL, navigate to the 'app' (preview) view.
    // Skip navigation if there's a captured prompt that hasn't been sent yet.
    if (!hasTabSuffix && chatState.sessionId && encodedAppTitle && !capturedPrompt) {
      navigate(`/chat/${chatState.sessionId}/${encodedAppTitle}/app`, {
        replace: true,
      });
    }
  }, [chatState.sessionId, chatState.title, navigate, location.pathname]);

  // Switch to 2-column view immediately when a message is submitted
  const shouldUseFullWidthChat =
    chatState.docs.length === 0 && !urlSessionId && !hasSubmittedMessage;

  return (
    <>
      <AppLayout
        fullWidthChat={shouldUseFullWidthChat}
        headerLeft={
          <ChatHeaderContent
            remixOf={chatState.vibeDoc?.remixOf}
            onOpenSidebar={openSidebar}
            isStreaming={chatState.isStreaming}
            codeReady={chatState.codeReady}
            title={chatState.title || ''}
          />
        }
        headerRight={
          // Only render the header content when we have code content or a completed session
          chatState.selectedCode?.content || urlSessionId ? (
            <ResultPreviewHeaderContent
              displayView={displayView}
              navigateToView={navigateToView}
              viewControls={viewControls}
              showViewControls={!!showViewControls}
              setMobilePreviewShown={setMobilePreviewShown}
              setUserClickedBack={setUserClickedBack} // Keep this for BackButton logic
              isStreaming={chatState.isStreaming}
              // Props needed by usePublish and useSession within ResultPreviewHeaderContent:
              code={chatState.selectedCode?.content || ''}
              sessionId={chatState.sessionId || undefined} // Handle null
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
            navigateToView={navigateToView}
          />
        }
        previewPanel={
          <ResultPreview
            title={chatState.title}
            updateTitle={chatState.updateTitle}
            sessionId={chatState.sessionId || ''}
            code={chatState.selectedCode?.content || ''}
            isStreaming={chatState.isStreaming}
            codeReady={chatState.codeReady}
            onScreenshotCaptured={chatState.addScreenshot}
            displayView={displayView}
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
            currentModel={chatState.effectiveModel}
            onModelChange={async (modelId: string) => {
              if (chatState.updateSelectedModel) {
                await chatState.updateSelectedModel(modelId);
              }
            }}
            models={
              models as Array<{ id: string; name: string; description: string; featured?: boolean }>
            }
            globalModel={chatState.globalModel}
            onSend={() => {
              setMessageHasBeenSent(true);
              setHasSubmittedMessage(true);
            }}
          />
        }
        suggestionsComponent={
          chatState.isEmpty ? (
            <QuickSuggestions onSelectSuggestion={handleSelectSuggestion} />
          ) : undefined
        }
        mobilePreviewShown={displayView === 'chat' ? false : mobilePreviewShown}
      />
      <SessionSidebar
        isVisible={isSidebarVisible}
        onClose={closeSidebar}
        sessionId={chatState.sessionId || ''}
      />
    </>
  );
}
