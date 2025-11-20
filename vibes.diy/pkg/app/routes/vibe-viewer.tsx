import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";
import { mountVibeWithCleanup } from "use-vibes";
import { setupDevShims, transformImportsDev } from "../utils/dev-shims.js";

export function meta({
  params,
}: {
  params: { titleId: string; installId: string };
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

function VibeInstanceViewerContent() {
  const { titleId, installId } = useParams<{
    titleId: string;
    installId: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  // Generate unique container ID using crypto.randomUUID
  // Regenerate on each navigation to make debugging easier
  const [containerId, setContainerId] = useState(
    () => `vibe-container-${crypto.randomUUID()}`,
  );

  // Lazy instance creation: ensure instance exists in database
  const { instances, createInstance, isCreating } = useVibeInstances(
    titleId || "",
  );

  useEffect(() => {
    if (!titleId || !installId || isCreating) return;

    // Check if instance exists
    const fullId = `${titleId}-${installId}`;
    const instanceExists = instances.some((inst) => inst._id === fullId);

    // Create instance if it doesn't exist (lazy creation for Fresh Data)
    // Pass the installId explicitly to ensure correct _id is created
    if (!instanceExists) {
      // Let error throw - no catch handler
      createInstance("Fresh Data", {}, installId);
    }
  }, [titleId, installId, instances, createInstance, isCreating]);

  useEffect(() => {
    if (!titleId || !installId) return;

    // Expose libraries to window for development shim
    setupDevShims();

    // DIAGNOSTIC: Verify window globals are set
    if (import.meta.env.DEV) {
      console.log('[vibe-viewer] Window globals check:', {
        hasUseVibes: !!(window as any).__VIBE_USE_VIBES__,
        hasUseFireproof: !!((window as any).__VIBE_USE_VIBES__ as any)?.useFireproof,
        useFireproofType: typeof ((window as any).__VIBE_USE_VIBES__ as any)?.useFireproof,
      });
    }

    // Generate new container ID for this navigation
    const newContainerId = `vibe-container-${crypto.randomUUID()}`;
    setContainerId(newContainerId);

    let active = true;
    let unmountVibe: (() => void) | null = null;

    const loadAndMountVibe = async () => {
      try {
        // Fetch the published vibe code from hosting
        const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
        const vibeUrl = `https://${titleId}.${hostname}/App.jsx`;

        const response = await fetch(vibeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch vibe code: ${response.statusText}`);
        }

        const vibeCode = await response.text();

        if (!active) return;

        // DIAGNOSTIC: Log mounting parameters
        console.log("[vibe-viewer] Mounting vibe with metadata:", {
          titleId,
          installId,
          containerId: newContainerId,
        });

        // Mount the vibe code and capture the unmount callback via event
        unmountVibe = await mountVibeWithCleanup(
          vibeCode,
          newContainerId,
          titleId,
          installId,
          transformImportsDev,
        );
      } catch (err) {
        console.error("Error loading vibe:", err);
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    // Reset error state when navigating to a new vibe
    setError(null);

    loadAndMountVibe();

    // Cleanup function
    return () => {
      active = false;

      // Call the unmount callback to properly cleanup the React root
      if (unmountVibe) {
        unmountVibe();
      }

      // Clean up the script tag
      const script = document.getElementById(`vibe-script-${newContainerId}`);
      if (script) {
        script.remove();
      }
    };
  }, [titleId, installId]);

  if (!titleId || !installId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Missing title ID or install ID</p>
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

      {/* Container for vibe module to mount into */}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}

// Auth wrapper component - only renders content when authenticated
export default function VibeInstanceViewer() {
  const { isAuthenticated, isLoading } = useAuth();
  const { initiateLogin, isPolling } = useAuthPopup();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-lg">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 gap-6">
        <div className="text-white text-xl font-medium">
          Please log in to access this vibe
        </div>
        <button
          onClick={initiateLogin}
          disabled={isPolling}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPolling ? "Logging in..." : "Log In with Fireproof"}
        </button>
      </div>
    );
  }

  // Only render the actual component (which calls useFireproof) when authenticated
  return <VibeInstanceViewerContent />;
}
