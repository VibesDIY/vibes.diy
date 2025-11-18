import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import * as Babel from "@babel/standalone";
import { VibesDiyEnv } from "../config/env.js";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { transformImports } from "../../../../hosting/base/utils/codeTransform.js";

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

      // Mount the component using its own React instance from esm.sh
      const container = document.getElementById("${containerId}");
      if (container && App) {
        mountVibesApp({
          container: container,
          appComponent: App,
          showVibesSwitch: true,
          vibeMetadata: {
            titleId: "${titleId}",
            installId: "${installId}",
          },
        });
      }
    `;

    // Step 4: Create and execute module script
    const scriptElement = document.createElement("script");
    scriptElement.type = "module";
    scriptElement.textContent = moduleCode;
    scriptElement.id = `vibe-script-${containerId}`;

    // Add script to DOM
    document.head.appendChild(scriptElement);

    // Wait for module to execute and mount
    await new Promise((resolve) => setTimeout(resolve, 200));
  } catch (err) {
    console.error("Failed to mount vibe code:", err);
    throw err;
  }
}

export default function VibeInstanceViewer() {
  const { titleId, uuid } = useParams<{ titleId: string; uuid: string }>();
  const [error, setError] = useState<string | null>(null);
  const containerIdRef = useRef(`vibe-container-${Date.now()}`);

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

    let active = true;

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

        // Mount the vibe code using its own React instance from the import map
        await mountVibeCode(vibeCode, containerIdRef.current, titleId, uuid);
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
      // Clean up the script tag
      const script = document.getElementById(
        `vibe-script-${containerIdRef.current}`,
      );
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
      <div id={containerIdRef.current} className="w-full h-full" />
    </div>
  );
}
