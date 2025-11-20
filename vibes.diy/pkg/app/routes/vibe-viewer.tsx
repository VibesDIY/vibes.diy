import React, { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as UseFireproof from "use-fireproof";
import * as UseVibes from "use-vibes";
import * as CallAI from "call-ai";
import { useParams } from "react-router";
import { transformImports } from "@vibes.diy/hosting-base";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";
import { mountVibeWithCleanup } from "use-vibes";

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
    if (import.meta.env.DEV) {
      (window as any).__VIBE_REACT__ = React;
      (window as any).__VIBE_REACT_DOM__ = ReactDOM;
      (window as any).__VIBE_REACT_DOM_CLIENT__ = ReactDOMClient;
      (window as any).__VIBE_USE_FIREPROOF__ = UseFireproof;
      (window as any).__VIBE_USE_VIBES__ = UseVibes;
      (window as any).__VIBE_CALL_AI__ = CallAI;
    }

    // Custom transform for development to use shared instances
    const transformImportsDev = (code: string) => {
      let res = transformImports(code);
      if (import.meta.env.DEV) {
        const replacements: Record<string, string> = {
          react: "__VIBE_REACT__",
          "react-dom": "__VIBE_REACT_DOM__",
          "react-dom/client": "__VIBE_REACT_DOM_CLIENT__",
          "use-fireproof": "__VIBE_USE_FIREPROOF__",
          "use-vibes": "__VIBE_USE_VIBES__",
          "call-ai": "__VIBE_CALL_AI__",
        };

        for (const [pkg, varName] of Object.entries(replacements)) {
          // Handle: import * as X from "pkg"
          res = res.replace(
            new RegExp(
              `import\\s+\\*\\s+as\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${pkg}['"];?`,
              "g",
            ),
            `const $1 = window.${varName};`,
          );

          // Handle: import X from "pkg"
          // Use default if available, fallback to module object (for React which might be synthetic default)
          res = res.replace(
            new RegExp(
              `import\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${pkg}['"];?`,
              "g",
            ),
            `const $1 = window.${varName}.default || window.${varName};`,
          );

          // Handle: import { X, Y } from "pkg"
          res = res.replace(
            new RegExp(
              `import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${pkg}['"];?`,
              "g",
            ),
            `const {$1} = window.${varName};`,
          );

          // Handle: import X, { Y } from "pkg"
          res = res.replace(
            new RegExp(
              `import\\s+([a-zA-Z0-9_]+)\\s*,\\s*\\{([^}]+)\\}\\s+from\\s+['"]${pkg}['"];?`,
              "g",
            ),
            `const $1 = window.${varName}.default || window.${varName}; const {$2} = window.${varName};`,
          );
        }
      }
      return res;
    };

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
