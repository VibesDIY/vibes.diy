import React, { useEffect, useState, useRef } from "react";
import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { mountVibeWithCleanup } from "use-vibes";
import { setupDevShims, transformImportsDev } from "../../utils/dev-shims.js";
import { useAuth } from "@clerk/clerk-react";

const sthis = Lazy(() => ensureSuperThis());

interface InlinePreviewProps {
  code: string;
  sessionId: string;
  codeReady: boolean;
}

export function InlinePreview({
  code,
  sessionId,
  codeReady,
}: InlinePreviewProps) {
  const { getToken } = useAuth();
  const [containerId] = useState(
    () => `preview-container-${sthis().nextId().str}`,
  );
  const [error, setError] = useState<string | null>(null);
  const unmountVibeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!codeReady || !code) return;

    // Expose libraries to window for development shim
    setupDevShims();

    let active = true;

    const loadAndMountVibe = async () => {
      try {
        // Clean up previous mount if exists
        if (unmountVibeRef.current) {
          unmountVibeRef.current();
          unmountVibeRef.current = null;
        }

        // Get Clerk token for API authentication
        const clerkToken = await getToken();

        // Mount the vibe code and capture the unmount callback via event
        const unmount = await mountVibeWithCleanup(
          code,
          containerId,
          sessionId, // Use session ID as titleId
          "preview", // Use "preview" as installId for result preview context
          transformImportsDev,
          false, // Hide vibes switch in result preview mode
          clerkToken || undefined, // Pass Clerk token as apiKey
        );

        if (active) {
          unmountVibeRef.current = unmount;
          setError(null);
        } else {
          // Component was unmounted while mounting, clean up immediately
          unmount();
        }
      } catch (err) {
        console.error("Error mounting inline preview:", err);
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    // Reset error state when code changes
    setError(null);

    loadAndMountVibe();

    // Cleanup function
    return () => {
      active = false;

      // Call the unmount callback to properly cleanup the React root
      if (unmountVibeRef.current) {
        unmountVibeRef.current();
        unmountVibeRef.current = null;
      }

      // Clean up the script tag
      const script = document.getElementById(`vibe-script-${containerId}`);
      if (script) {
        script.remove();
      }
    };
  }, [code, codeReady, containerId, sessionId]);

  return (
    <div
      className="relative w-full h-full bg-gray-900 overflow-hidden"
      style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
    >
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center max-w-md">
            <p className="text-red-400 text-lg mb-4">Error loading preview:</p>
            <p className="text-white mb-4">{error}</p>
          </div>
        </div>
      )}

      {/* Container for vibe module to mount into */}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}
