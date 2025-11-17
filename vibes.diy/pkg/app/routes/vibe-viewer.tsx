import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import * as Babel from "@babel/standalone";
import { mountVibesApp, useFireproof } from "use-vibes";
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

// Helper to evaluate JSX code and extract the component
async function evaluateVibeCode(
  code: string,
): Promise<React.ComponentType | null> {
  try {
    // Transform JSX to regular JavaScript using imported Babel
    const transformed = Babel.transform(code, {
      presets: [
        "react",
        ["env", {
          modules: false,           // Keep ES modules, don't transform to CommonJS
          targets: { esmodules: true }  // Target modern browsers (ES2022+)
        }]
      ]
    });

    // Strip import statements since we're injecting dependencies directly
    const codeWithoutImports = transformed.code
      .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
      .replace(/export\s+default\s+/g, 'exports.default = ')
      .replace(/export\s+{([^}]+)}/g, 'Object.assign(exports, {$1})');

    // Create a function that evaluates the transformed code
    const evalFunc = new Function(
      "React",
      "useState",
      "useEffect",
      "useRef",
      "useCallback",
      "useMemo",
      "useFireproof",
      `
      let exports = {};
      ${codeWithoutImports}
      return exports.default || exports.App;
      `,
    );

    // Import necessary dependencies
    const { useState, useEffect: useEffectHook, useRef: useRefHook, useCallback, useMemo } = React;

    // Execute and get the component with imported dependencies
    const component = evalFunc(
      React,
      useState,
      useEffectHook,
      useRefHook,
      useCallback,
      useMemo,
      useFireproof,
    );

    return component as React.ComponentType;
  } catch (err) {
    console.error("Failed to evaluate vibe code:", err);
    return null;
  }
}

export default function VibeInstanceViewer() {
  const { titleId, uuid } = useParams<{ titleId: string; uuid: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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
    if (!titleId || !uuid || !containerRef.current || mounted) return;

    const loadAndMount = async () => {
      try {
        // Fetch the published vibe code from hosting
        const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
        const vibeUrl = `https://${titleId}.${hostname}/App.jsx`;

        const response = await fetch(vibeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch vibe code: ${response.statusText}`);
        }

        const vibeCode = await response.text();

        // Evaluate the JSX code to get the component
        const AppComponent = await evaluateVibeCode(vibeCode);

        if (!AppComponent) {
          throw new Error("Failed to extract component from vibe code");
        }

        // Mount the vibe app inline with proper metadata for ledger naming
        if (!containerRef.current) {
          throw new Error("Container ref is null");
        }

        const result = mountVibesApp({
          container: containerRef.current,
          appComponent: AppComponent,
          title: titleId,
          imageUrl: `/screenshot.png`,
          showVibesSwitch: true,
          vibeMetadata: {
            titleId,
            installId: uuid,
          },
        });

        setMounted(true);

        // Cleanup on unmount
        return () => {
          result.unmount();
        };
      } catch (err) {
        console.error("Error loading vibe:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    loadAndMount();
  }, [titleId, uuid, mounted]);

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

      {/* Inline Vibe Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
