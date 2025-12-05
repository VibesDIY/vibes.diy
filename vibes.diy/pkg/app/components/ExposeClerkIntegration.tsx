import { useEffect } from "react";
import { VibeClerkIntegration } from "./VibeClerkIntegration.js";
import { useDashboardApi } from "../contexts/DashboardApiContext.js";

// Extend Window interface to include our exposed components
declare global {
  interface Window {
    VibeClerkIntegration?: typeof VibeClerkIntegration;
    useVibeDashboardApi?: typeof useDashboardApi;
  }
}

/**
 * Component that exposes Clerk integration components on the window object
 * so user vibes can access them without importing (which would trigger bundling issues)
 */
export function ExposeClerkIntegration() {
  useEffect(() => {
    // Expose VibeClerkIntegration so user vibes can wrap their components with it
    window.VibeClerkIntegration = VibeClerkIntegration;

    // Also expose useDashboardApi for advanced use cases
    window.useVibeDashboardApi = useDashboardApi;

    // Cleanup on unmount
    return () => {
      delete window.VibeClerkIntegration;
      delete window.useVibeDashboardApi;
    };
  }, []);

  return null;
}
