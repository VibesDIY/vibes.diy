import React, { useEffect, useState } from "react";
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

function getVibesboxBaseUrl(): string {
  // Get Vibesbox URL from environment or use default
  return VibesDiyEnv.VIBESBOX_BASE_URL() || "https://vibesbox.workers.dev";
}

export default function VibeInstanceViewer() {
  const { titleId, uuid } = useParams<{ titleId: string; uuid: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Vibesbox origin
      const vibesboxUrl = new URL(getVibesboxBaseUrl());
      if (event.origin !== vibesboxUrl.origin) {
        return;
      }

      // Handle different message types
      if (event.data?.type === "preview-ready") {
        setIsLoading(false);
      } else if (event.data?.type === "iframe-error") {
        setError(event.data.error?.message || "An error occurred");
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!titleId || !uuid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Missing title ID or UUID</p>
        </div>
      </div>
    );
  }

  const vibesboxUrl = `${getVibesboxBaseUrl()}/vibe/${titleId}/${uuid}`;

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
        src={vibesboxUrl}
        title={`${titleId} - ${uuid}`}
        className="w-full h-full border-none"
        allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; usb; web-share; xr-spatial-tracking"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock allow-downloads allow-top-navigation"
        allowFullScreen
      />
    </div>
  );
}
