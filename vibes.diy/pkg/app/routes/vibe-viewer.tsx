import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { transformImports } from "../../../../hosting/base/utils/codeTransform.js";
import { mountVibeWithCleanup } from "use-vibes";

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
  const [error, setError] = useState<string | null>(null);
  // Generate unique container ID using crypto.randomUUID
  // Regenerate on each navigation to make debugging easier
  const [containerId, setContainerId] = useState(
    () => `vibe-container-${crypto.randomUUID()}`,
  );

  // Lazy instance creation: ensure instance exists in database
  const { instances, createInstance } = useVibeInstances(titleId || "");
  const [creationAttempted, setCreationAttempted] = useState(false);

  useEffect(() => {
    if (!titleId || !uuid || creationAttempted) return;

    // Check if instance exists
    const fullId = `${titleId}-${uuid}`;
    const instanceExists = instances.some((inst) => inst._id === fullId);

    // Create instance if it doesn't exist (lazy creation for Fresh Data)
    // Pass the UUID explicitly to ensure correct _id is created
    if (!instanceExists && instances.length >= 0) {
      setCreationAttempted(true);
      createInstance("Fresh Data", {}, uuid).catch((err) => {
        console.error("Failed to lazy-create instance:", err);
        setCreationAttempted(false); // Allow retry on error
      });
    }
  }, [titleId, uuid, instances, createInstance, creationAttempted]);

  useEffect(() => {
    if (!titleId || !uuid) return;

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

        // Mount the vibe code and capture the unmount callback via event
        unmountVibe = await mountVibeWithCleanup(
          vibeCode,
          newContainerId,
          titleId,
          uuid,
          transformImports,
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

      {/* Container for vibe module to mount into */}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}
