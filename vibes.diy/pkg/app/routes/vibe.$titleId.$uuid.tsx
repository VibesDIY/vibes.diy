import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";

export function meta({
  params,
}: {
  params: { titleId: string; uuid: string };
}) {
  return [
    { title: `${params.titleId} | Vibes DIY` },
    { name: "description", content: `Running instance of ${params.titleId}` },
  ];
}

function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "vibesdiy.app";
  }
}

export default function VibeInstanceViewer() {
  const { titleId, uuid } = useParams<{ titleId: string; uuid: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!titleId || !uuid || !iframeRef.current) return;

    // Fetch the published vibe code from hosting
    const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
    const vibeUrl = `https://${titleId}.${hostname}/`;

    // Set up iframe with UUID subdomain for storage isolation
    const iframeUrl = `https://${uuid}.vibesbox.dev/`;
    iframeRef.current.src = iframeUrl;

    const handleIframeLoad = async () => {
      try {
        // Fetch the vibe code from the published subdomain
        const response = await fetch(vibeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch vibe: ${response.statusText}`);
        }

        const html = await response.text();

        // Extract the app code from the published HTML
        // Look for the script tag with the app code
        const codeMatch = html.match(
          /\/\/ prettier-ignore\s*\n([\s\S]*?)\n\s*\/\/ prettier-ignore-end/,
        );

        if (!codeMatch) {
          throw new Error("Could not extract vibe code from published app");
        }

        const vibeCode = codeMatch[1].trim();

        // Get auth token from localStorage
        let authToken: string | undefined;
        try {
          authToken =
            localStorage.getItem("vibes-diy-auth-token") ||
            localStorage.getItem("auth_token") ||
            undefined;
        } catch (e) {
          console.warn("Failed to read auth token:", e);
        }

        // Send code via postMessage like the editor does
        if (iframeRef.current?.contentWindow) {
          const messageData = {
            type: "execute-code",
            code: vibeCode,
            apiKey: "sk-vibes-proxy-managed",
            sessionId: uuid,
            endpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
            authToken,
          };

          iframeRef.current.contentWindow.postMessage(messageData, "*");
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error loading vibe:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    };

    iframeRef.current.addEventListener("load", handleIframeLoad);

    return () => {
      if (iframeRef.current) {
        iframeRef.current.removeEventListener("load", handleIframeLoad);
      }
    };
  }, [titleId, uuid]);

  if (!titleId || !uuid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Missing title ID or UUID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white text-lg">Loading {titleId}...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center max-w-md">
            <p className="text-red-400 text-lg mb-4">Error loading vibe:</p>
            <p className="text-white mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Vibesbox Iframe */}
      <iframe
        ref={iframeRef}
        title={`${titleId} - ${uuid}`}
        className="w-full h-full border-none"
        allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; usb; web-share; xr-spatial-tracking"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock allow-downloads allow-top-navigation"
        allowFullScreen
      />
    </div>
  );
}
