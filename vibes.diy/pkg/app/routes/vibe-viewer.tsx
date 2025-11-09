import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";

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
  const [error, setError] = useState<string | null>(null);

  // Lazy instance creation: ensure instance exists in database
  const { instances, createInstance } = useVibeInstances(titleId || "");

  useEffect(() => {
    if (!titleId || !uuid) return;

    // Check if instance exists
    const fullId = `${titleId}-${uuid}`;
    const instanceExists = instances.some((inst) => inst._id === fullId);

    // Create instance if it doesn't exist (lazy creation for Fresh Data)
    if (!instanceExists && instances.length >= 0) {
      createInstance("Fresh Data").catch((err) => {
        console.error("Failed to lazy-create instance:", err);
      });
    }
  }, [titleId, uuid, instances, createInstance]);

  useEffect(() => {
    if (!titleId || !uuid || !iframeRef.current) return;

    // Reconstruct full vibeUUID: if uuid doesn't include titleId, prepend it
    const vibeUUID = uuid.includes("-")
      ? uuid.startsWith(`${titleId}-`)
        ? uuid // Already full format
        : `${titleId}-${uuid}` // Short format, reconstruct
      : `${titleId}-${uuid}`; // Legacy or short format

    // Fetch the published vibe code from hosting
    const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
    const vibeUrl = `https://${titleId}.${hostname}/App.jsx`;

    // Set up iframe using configured Vibesbox worker wrapper route
    const base = VibesDiyEnv.VIBESBOX_BASE_URL().replace(/\/$/, "");

    // Forward v_vibes parameter if present in current URL
    const currentUrl = new URL(window.location.href);
    const vVibes = currentUrl.searchParams.get("v_vibes");
    const iframeUrl = vVibes
      ? `${base}/vibe/${titleId}/${encodeURIComponent(uuid)}?v_vibes=${encodeURIComponent(vVibes)}`
      : `${base}/vibe/${titleId}/${encodeURIComponent(uuid)}`;
    const handleIframeLoad = async () => {
      try {
        // Fetch the vibe code from the /App.jsx endpoint
        const response = await fetch(vibeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch vibe code: ${response.statusText}`);
        }

        // /App.jsx endpoint returns raw JavaScript directly
        const vibeCode = await response.text();

        // Get auth token from localStorage (do not place in URL)
        let authToken: string | undefined;
        try {
          authToken =
            localStorage.getItem("vibes-diy-auth-token") ||
            localStorage.getItem("auth_token") ||
            undefined;
        } catch {
          // ignore storage errors
        }

        // Send code via postMessage like the editor does
        if (iframeRef.current?.contentWindow) {
          const messageData = {
            type: "execute-code",
            code: vibeCode,
            apiKey: "sk-vibes-proxy-managed",
            sessionId: vibeUUID,
            endpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
            authToken,
            titleId,
            vibeUUID: vibeUUID,
            hostingDomain: hostname, // Pass the hosting domain for screenshot URLs
          };

          // Use a specific target origin for safety
          const targetOrigin = new URL(iframeUrl).origin;
          iframeRef.current.contentWindow.postMessage(
            messageData,
            targetOrigin,
          );
        }
      } catch (err) {
        console.error("Error loading vibe:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    // Register load handler BEFORE setting src to avoid race conditions
    iframeRef.current.addEventListener("load", handleIframeLoad, {
      once: true,
    } as AddEventListenerOptions);
    iframeRef.current.src = iframeUrl;

    return () => {
      iframeRef.current?.removeEventListener("load", handleIframeLoad);
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
        allow="clipboard-read; clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        allowFullScreen
      />
    </div>
  );
}
