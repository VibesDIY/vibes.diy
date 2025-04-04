import React, { useEffect, useRef, useState } from 'react';
import { CALLAI_API_KEY } from '../../config/env';
import { animationStyles } from './ResultPreviewTemplates';
import type { ResultPreviewProps, IframeFiles } from './ResultPreviewTypes';
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
  activeView,
  setActiveView,
  onPreviewLoaded,
  setMobilePreviewShown,
  setIsIframeFetching,
  children,
  title,
}: ResultPreviewProps & { children?: React.ReactNode }) {
  // Add theme detection at the parent level
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Default to dark mode
  const isStreamingRef = useRef(isStreaming);
  const hasGeneratedStreamingKeyRef = useRef(false);

  const filesRef = useRef<IframeFiles>({});
  const showWelcome = !isStreaming && (!code || code.length === 0);

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
    if (isStreaming) {
      // Reset to code view when streaming starts
      setActiveView('code');
    } else if (codeReady) {
      // Check URL path before switching to preview
      const path = window.location.pathname;

      // Only switch to preview if we're not on a specific route
      if (!path.endsWith('/code') && !path.endsWith('/data')) {
        setActiveView('preview');
      }
    }
  }, [isStreaming, setActiveView, codeReady]);

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
          const iframe = document.querySelector('iframe') as HTMLIFrameElement;
          iframe?.contentWindow?.postMessage({ type: 'callai-api-key', key: CALLAI_API_KEY }, '*');

          setMobilePreviewShown(true);

          // Always switch to preview view when the iframe signals it's ready.
          setActiveView('preview');

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
          // Handle the iframe fetching state from the iframe
          console.log('Iframe fetching state:', data.state);
          if (setIsIframeFetching) {
            setIsIframeFetching(data.state);
          }
        } else if (data.type === 'screenshot' && data.data) {
          if (onScreenshotCaptured) {
            onScreenshotCaptured(data.data);
          }
        } else if (data.type === 'screenshot-error' && data.error) {
          console.warn('Screenshot capture error:', data.error);
          // Still call onScreenshotCaptured with null to signal that the screenshot failed
          if (onScreenshotCaptured) {
            onScreenshotCaptured(null);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onScreenshotCaptured, setActiveView, onPreviewLoaded, setIsIframeFetching, setMobilePreviewShown, sessionId, title]);

  // Create refs outside useEffect to track timeout state
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!showWelcome) {
      const processedCode = code;
      filesRef.current = {
        ...filesRef.current,
        '/App.jsx': {
          code: processedCode,
          active: true,
        },
      };
    }

    // Clean up timeout on unmount
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [code, showWelcome, codeReady]);

  const previewArea = showWelcome ? (
    <div className="h-full">{/* empty div to prevent layout shift */}</div>
  ) : (
    (() => {
      // Initialize files content here, right before SandpackContent is rendered
      filesRef.current = {
        '/App.jsx': {
          code: code,
          active: true,
        },
      };

      return (
        <IframeContent
          activeView={activeView}
          filesContent={filesRef.current}
          isStreaming={!codeReady}
          codeReady={codeReady}
          setActiveView={setActiveView}
          dependencies={dependencies}
          isDarkMode={isDarkMode} // Pass down the theme state
        />
      );
    })()
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
