import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import * as Babel from "@babel/standalone";
import { IdService } from "@adviser/cement";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { transformImports } from "../../../../hosting/base/utils/codeTransform.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";

// Singleton ID generator using cement's IdService (UUID mode by default)
const idService = new IdService();

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

// Helper to mount vibe code directly using its own React instance
async function mountVibeCode(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
): Promise<void> {
  try {
    // Step 1: Transform imports (rewrite unknown bare imports to esm.sh)
    const codeWithTransformedImports = transformImports(code);

    // Step 2: Transform JSX to JavaScript (preserve ES modules)
    const transformed = Babel.transform(codeWithTransformedImports, {
      presets: ["react"], // Only transform JSX, keep imports as-is
    });

    // Step 3: Inject mounting code that uses the module's own React/ReactDOM
    // This ensures the component uses the same React instance it imported
    const moduleCode = `
      import { mountVibesApp } from "use-vibes";

      ${transformed.code}

      // Wrap mounting logic in try/catch to emit error events
      try {
        const container = document.getElementById("${containerId}");
        if (!container) {
          throw new Error("Container element not found: ${containerId}");
        }
        if (typeof App === 'undefined') {
          throw new Error("App component is not defined - check your default export");
        }

        const mountResult = mountVibesApp({
          container: container,
          appComponent: App,
          showVibesSwitch: true,
          vibeMetadata: {
            titleId: "${titleId}",
            installId: "${installId}",
          },
        });

        // Dispatch success event with unmount callback
        document.dispatchEvent(new CustomEvent('vibes-mount-ready', {
          detail: {
            unmount: mountResult.unmount,
            containerId: "${containerId}"
          }
        }));
      } catch (error) {
        // Dispatch error event for mount failures
        document.dispatchEvent(new CustomEvent('vibes-mount-error', {
          detail: {
            error: error instanceof Error ? error.message : String(error),
            containerId: "${containerId}"
          }
        }));
      }
    `;

    // Step 4: Create and execute module script
    const scriptElement = document.createElement("script");
    scriptElement.type = "module";
    scriptElement.textContent = moduleCode;
    scriptElement.id = `vibe-script-${containerId}`;

    // Add script to DOM
    document.head.appendChild(scriptElement);

    // Note: The unmount callback will be captured via the vibes-mount-ready event
    // No return value needed here - event listener handles it
  } catch (err) {
    console.error("Failed to mount vibe code:", err);
    throw err;
  }
}

// Type definition for vibes-mount-ready event detail
interface VibesMountReadyDetail {
  unmount: () => void;
  containerId: string;
}

// Type definition for vibes-mount-error event detail
interface VibesMountErrorDetail {
  error: string;
  containerId: string;
}

// Helper to assert CustomEvent type
function isVibesMountReadyEvent(
  event: Event,
): event is CustomEvent<VibesMountReadyDetail> {
  return event.type === "vibes-mount-ready";
}

// Helper to assert vibes-mount-error event type
function isVibesMountErrorEvent(
  event: Event,
): event is CustomEvent<VibesMountErrorDetail> {
  return event.type === "vibes-mount-error";
}

// Helper to mount vibe code and return cleanup function
// Uses three-tier approach: success event, error event, timeout fallback
async function mountVibeWithCleanup(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
): Promise<() => void> {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Cleanup function to remove all listeners and timers
    const cleanup = () => {
      document.removeEventListener("vibes-mount-ready", handleMountReady);
      document.removeEventListener("vibes-mount-error", handleMountError);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Single resolution function to prevent multiple resolutions
    const resolveOnce = (unmount: () => void) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(unmount);
    };

    // Tier 1: Success event handler
    const handleMountReady = (event: Event) => {
      if (!isVibesMountReadyEvent(event)) return;

      const { unmount, containerId: eventContainerId } = event.detail;
      if (eventContainerId === containerId) {
        console.log(`[Vibe Lifecycle] Mount succeeded: ${titleId}/${installId}`);
        resolveOnce(unmount);
      }
    };

    // Tier 2: Error event handler
    const handleMountError = (event: Event) => {
      if (!isVibesMountErrorEvent(event)) return;

      const { error, containerId: eventContainerId } = event.detail;
      if (eventContainerId === containerId) {
        console.error(`[Vibe Lifecycle] Mount failed: ${error}`);
        resolveOnce(() => {
          // No-op cleanup - mount never succeeded
        });
      }
    };

    // Tier 3: Timeout fallback (5 seconds)
    timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn(
          `[Vibe Lifecycle] Mount timeout after 5s: ${containerId}. ` +
            `Neither success nor error event received.`,
        );
        resolveOnce(() => {
          // No-op cleanup - unknown state
        });
      }
    }, 5000);

    // Register event listeners
    document.addEventListener("vibes-mount-ready", handleMountReady);
    document.addEventListener("vibes-mount-error", handleMountError);

    // Mount the vibe
    mountVibeCode(code, containerId, titleId, installId).catch((err) => {
      // Babel/transform errors - caught before module execution
      console.error("[Vibe Lifecycle] Pre-execution error:", err);
      resolveOnce(() => {
        // No-op cleanup
      });
    });
  });
}

function VibeInstanceViewerContent() {
  const { titleId, installId } = useParams<{
    titleId: string;
    installId: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  // Generate unique container ID using cement's IdService
  // Regenerate on each navigation to make debugging easier
  const [containerId, setContainerId] = useState(
    () => `vibe-container-${idService.NextId()}`,
  );

  // Lazy instance creation: ensure instance exists in database
  const { instances, createInstance } = useVibeInstances(titleId || "");
  const [creationAttempted, setCreationAttempted] = useState(false);

  useEffect(() => {
    if (!titleId || !installId || creationAttempted) return;

    // Check if instance exists
    const fullId = `${titleId}-${installId}`;
    const instanceExists = instances.some((inst) => inst._id === fullId);

    // Create instance if it doesn't exist (lazy creation for Fresh Data)
    // Pass the installId explicitly to ensure correct _id is created
    if (!instanceExists && instances.length >= 0) {
      setCreationAttempted(true);
      createInstance("Fresh Data", {}, installId).catch((err) => {
        console.error("Failed to lazy-create instance:", err);
        setCreationAttempted(false); // Allow retry on error
      });
    }
  }, [titleId, installId, instances, createInstance, creationAttempted]);

  useEffect(() => {
    if (!titleId || !installId) return;

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
