import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CALLAI_API_KEY } from '../../config/env';
import { animationStyles } from './ResultPreviewTemplates';
import type { ResultPreviewProps, IframeFiles } from './ResultPreviewTypes';
import type { RuntimeError } from '../../hooks/useRuntimeErrors';
import { encodeTitle } from '../SessionSidebar/utils';
// ResultPreview component
import IframeContent from './IframeContent';

function ResultPreview({
  code,
  dependencies = {},
  onScreenshotCaptured,
  sessionId,
  isStreaming = false,
  codeReady = false,
  displayView, // Changed from activeView
  // setActiveView, // Removed
  onPreviewLoaded,
  setMobilePreviewShown,
  setIsIframeFetching,
  addError,
  children,
  title,
}: ResultPreviewProps & { children?: React.ReactNode }) {
  // Add theme detection at the parent level
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Default to dark mode
  const isStreamingRef = useRef(isStreaming);
  const hasGeneratedStreamingKeyRef = useRef(false);

  const showWelcome = !isStreaming && (!code || code.length === 0);

  // Calculate filesContent directly based on code prop
  const filesContent = useMemo<IframeFiles>(() => {
    // Always return the expected structure, defaulting code to empty string
    return {
      '/App.jsx': {
        code: code && !showWelcome ? code : '', // Use code if available, else empty string
        active: true,
      },
    };
  }, [code, showWelcome, codeReady, isStreaming]); // Include codeReady to ensure updates

  // Track streaming state changes to reset key generation only when streaming starts/stops
  useEffect(() => {
    if (isStreaming !== isStreamingRef.current) {
      isStreamingRef.current = isStreaming;

      // Reset streaming key when streaming stops
      if (!isStreaming) {
        hasGeneratedStreamingKeyRef.current = false;
      }
    }
  }, [isStreaming]);

  useEffect(() => {
    // Effect to set initial view to 'code' was here.
    // This logic is now handled by useViewState in home.tsx based on initialLoad and other factors.
  }, [code]); // Kept code dependency for potential future use, or can be removed if truly no-op.

  // Theme detection effect
  useEffect(() => {
    // Add a small delay to ensure the app's theme detection in root.tsx has run first
    const timeoutId = setTimeout(() => {
      // Check if document has the dark class
      const hasDarkClass = document.documentElement.classList.contains('dark');

      // Set the theme state
      setIsDarkMode(hasDarkClass);

      // Set up observer to watch for class changes on document.documentElement
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            // Directly check for dark class
            const hasDarkClass = document.documentElement.classList.contains('dark');

            setIsDarkMode(hasDarkClass);
          }
        });
      });

      // Start observing
      observer.observe(document.documentElement, { attributes: true });

      return () => observer.disconnect();
    }, 100); // Slightly shorter delay than before

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent) => {
      if (data) {
        if (data.type === 'preview-ready' || data.type === 'preview-loaded') {
          // respond with the API key
          // Use CALLAI_API_KEY if available (dev mode), otherwise check localStorage
          let apiKey = CALLAI_API_KEY;

          // Only check localStorage if no dev key is set
          if (!apiKey) {
            const storedKey = localStorage.getItem('vibes-openrouter-key');
            if (storedKey) {
              try {
                const keyData = JSON.parse(storedKey);
                apiKey = keyData.key;
              } catch (e) {}
            }
          } else {
          }

          const iframe = document.querySelector('iframe') as HTMLIFrameElement;
          iframe?.contentWindow?.postMessage({ type: 'callai-api-key', key: apiKey }, '*');

          setMobilePreviewShown(true);

          // View switching to 'preview' is now handled by useViewState in home.tsx via the previewReady prop.
          // setActiveView('preview'); // Removed

          // Also navigate to the /app URL suffix if not already there.
          const path = window.location.pathname;
          // Add null check for title and encode it
          const encodedTitle = title ? encodeTitle(title) : '';
          if (!path.endsWith('/app') && sessionId && encodedTitle) {
            // Navigation is handled by the parent component (home.tsx) based on activeView state
            // We only set the state here.
            // navigate(`/chat/${sessionId}/${encodedTitle}/app`, { replace: true });
          }

          // Notify parent component that preview is loaded
          onPreviewLoaded();
        } else if (data.type === 'streaming' && data.state !== undefined) {
          if (setIsIframeFetching) {
            setIsIframeFetching(data.state);
          }
        } else if (data.type === 'screenshot' && data.data) {
          if (onScreenshotCaptured) {
            onScreenshotCaptured(data.data);
          }
        } else if (data.type === 'screenshot-error' && data.error) {
          // Still call onScreenshotCaptured with null to signal that the screenshot failed
          if (onScreenshotCaptured) {
            onScreenshotCaptured(null);
          }
        } else if (data.type === 'iframe-error' && data.error) {
          // Process the error and forward it to the error handler
          const error = data.error as RuntimeError;

          // Send to error handler if available
          if (addError) {
            addError(error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    onScreenshotCaptured,
    // setActiveView, // Removed
    onPreviewLoaded,
    setIsIframeFetching,
    setMobilePreviewShown,
    addError,
    sessionId,
    title,
  ]);

  const previewArea = showWelcome ? (
    <div className="h-full">{/* empty div to prevent layout shift */}</div>
  ) : (
    <IframeContent
      activeView={displayView} // Changed from activeView
      filesContent={filesContent} // Pass the derived filesContent
      isStreaming={!codeReady} // Pass the derived prop
      codeReady={codeReady}
      // setActiveView={setActiveView} // Removed from IframeContent props (will need to update IframeContent too)
      /* dependencies prop removed */
      isDarkMode={isDarkMode} // Pass down the theme state
      sessionId={sessionId} // Pass the sessionId to IframeContent
    />
  );

  return (
    <div className="h-full" style={{ overflow: 'hidden' }}>
      <style>{animationStyles}</style>
      {previewArea}
      {children}
    </div>
  );
}

export default ResultPreview;
