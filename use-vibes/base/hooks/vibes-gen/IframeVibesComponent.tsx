import React, { useEffect, useRef, useState } from 'react';
import { transformImports, normalizeComponentExports } from '@vibes.diy/prompts';

interface IframeVibesComponentProps {
  code: string;
  sessionId?: string;
  baseUrl?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const IframeVibesComponent: React.FC<IframeVibesComponentProps> = ({
  code,
  sessionId,
  baseUrl,
  onReady,
  onError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Generate session ID if not provided
  const effectiveSessionId = sessionId || `vibes-${Date.now()}`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !code) return;

    // Set up message listener for iframe communication
    const handleMessage = (event: MessageEvent) => {
      // Get expected origin from baseUrl or default to vibesbox.dev
      const expectedOrigin = baseUrl
        ? baseUrl.includes('://')
          ? new URL(baseUrl).hostname
          : baseUrl
        : 'vibesbox.dev';

      // Only accept messages from expected domains (or allow null for about:blank)
      if (expectedOrigin !== 'about:blank' && !event.origin.includes(expectedOrigin)) {
        return;
      }

      const { data } = event;

      if (data?.type === 'preview-ready') {
        setIsReady(true);
        onReady?.();
      } else if (data?.type === 'error') {
        const error = new Error(data.error || 'Component error');
        onError?.(error);
      }
    };

    window.addEventListener('message', handleMessage);

    // Set iframe source
    const iframeUrl = baseUrl || `https://${effectiveSessionId}.vibesbox.dev/`;
    iframe.src = iframeUrl;

    // Handle iframe load
    const handleIframeLoad = () => {
      if (!iframe.contentWindow) return;

      // Normalize and transform the code
      const normalizedCode = normalizeComponentExports(code);
      const transformedCode = transformImports(normalizedCode);

      // Get auth token from localStorage for API authentication
      let authToken: string | undefined;
      try {
        authToken = localStorage.getItem('vibes-diy-auth-token') || undefined;
      } catch {
        // Ignore localStorage errors (privacy mode, SSR, etc.)
      }

      // Send code to iframe
      const messageData = {
        type: 'execute-code',
        code: transformedCode,
        apiKey: 'sk-vibes-proxy-managed',
        sessionId: effectiveSessionId,
        authToken, // Pass auth token to iframe
      };

      iframe.contentWindow.postMessage(messageData, '*');
    };

    iframe.addEventListener('load', handleIframeLoad);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [code, effectiveSessionId, onReady, onError]);

  return (
    <div data-testid="placeholder">
      <iframe ref={iframeRef} title="Vibes Component Preview" />
      {!isReady && <div>Loading component...</div>}
    </div>
  );
};

export default IframeVibesComponent;
