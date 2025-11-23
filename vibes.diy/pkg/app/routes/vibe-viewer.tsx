import React, { useEffect, useState } from "react";
import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { mountVibeWithCleanup } from "use-vibes";
import { setupDevShims, transformImportsDev } from "../utils/dev-shims.js";
import LoggedOutView from "../components/LoggedOutView.js";

const sthis = Lazy(() => ensureSuperThis());

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
  const { getToken } = useAuth();
  const { titleId, installId } = useParams<{
    titleId: string;
    installId: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  // Generate unique container ID using crypto.randomUUID
  // Regenerate on each navigation to make debugging easier
  const [containerId, setContainerId] = useState(
    () => `vibe-container-${sthis().nextId().str}`,
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

  // Keep window.CALLAI_API_KEY fresh by periodically refreshing the Clerk token
  useEffect(() => {
    const refreshToken = async () => {
      const freshToken = await getToken();
      if (freshToken && typeof window !== "undefined") {
        window.CALLAI_API_KEY = freshToken;
      }
    };

    // Refresh token every 30 seconds (half of Clerk's 60-second token lifetime)
    const interval = setInterval(refreshToken, 30000);

    return () => clearInterval(interval);
  }, [getToken]);

  useEffect(() => {
    if (!titleId || !installId) return;

    // Expose libraries to window for development shim
    setupDevShims();

    // Generate new container ID for this navigation
    const newContainerId = `vibe-container-${sthis().nextId().str}`;
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

        // Get Clerk token for API authentication
        const clerkToken = await getToken();

        // Get configured API endpoint (respects preview mode via env)
        const callaiEndpoint = VibesDiyEnv.CALLAI_ENDPOINT();

        // Mount the vibe code and capture the unmount callback via event
        unmountVibe = await mountVibeWithCleanup(
          vibeCode,
          newContainerId,
          titleId,
          installId,
          transformImportsDev,
          true, // showVibesSwitch
          clerkToken || undefined, // Pass Clerk token as apiKey
          callaiEndpoint, // Pass chat API endpoint so vibe uses same endpoint as host
          callaiEndpoint, // Pass image API endpoint (same as chat endpoint)
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
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-lg">Checking authentication...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <LoggedOutView
        onLogin={async () => {
          await clerk.redirectToSignIn({
            redirectUrl: window.location.href,
          });
        }}
      />
    );
  }

  // Only render the actual component (which calls useFireproof) when authenticated
  return <VibeInstanceViewerContent />;
}
