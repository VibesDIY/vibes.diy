/// <reference types="vite/client" />
/**
 * Central configuration file for environment variables
 * Provides fallback values for required environment variables
 */
import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";

// Function to get the current database version from local storage
function getDatabaseVersion(): number {
  if (typeof window === "undefined") return 0;

  const storedVersion = localStorage.getItem("vibes-db-version") || "";
  return storedVersion ? JSON.parse(storedVersion) : 0;
}

// Function to increment the database version
export function incrementDatabaseVersion(): number {
  if (typeof window === "undefined") return 0;

  const currentVersion = getDatabaseVersion();
  const newVersion = currentVersion === 0 ? 1 : currentVersion + 1;

  localStorage.setItem("vibes-db-version", JSON.stringify(newVersion));
  return newVersion;
}

// Fireproof database name with version suffix
export function getVersionSuffix(): string {
  const version = getDatabaseVersion();
  return version === 0 ? "" : `${version}`;
}

// --- Vite Environment Variables ---
// Access environment variables safely with fallbacks

// Analytics

class vibesDiyEnv {
  readonly sthis = Lazy(() => ensureSuperThis());
  readonly PROMPT_FALL_BACKURL = Lazy(
    () =>
      new URL(
        ensureSuperThis().env.get("PROMPT_FALL_BACKURL") ??
          "https://esm.sh/@vibes.diy/prompts/llms",
      ),
  );

  readonly GA_TRACKING_ID = Lazy(
    () => ensureSuperThis().env.get("VITE_GOOGLE_ANALYTICS_ID") ?? "",
  );

  // PostHog
  readonly POSTHOG_KEY = Lazy(
    () => ensureSuperThis().env.get("VITE_POSTHOG_KEY") ?? "",
  );
  readonly POSTHOG_HOST = Lazy(
    () => ensureSuperThis().env.get("VITE_POSTHOG_HOST") ?? "",
  );

  // Application Behavior
  readonly IS_DEV_MODE = Lazy(() => ensureSuperThis().env.get("DEV") ?? false);
  readonly APP_MODE = Lazy(
    () => ensureSuperThis().env.get("MODE") ?? "production",
  );
  readonly APP_BASENAME = Lazy(
    () => ensureSuperThis().env.get("VITE_APP_BASENAME") ?? "/",
  );

  // Fireproof Connect & Auth
  readonly CONNECT_URL = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_CONNECT_URL") ??
      "https://connect.fireproof.direct/token",
  );
  readonly CONNECT_API_URL = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_CONNECT_API_URL") ??
      "https://connect.fireproof.direct/api",
  );
  readonly CLOUD_SESSION_TOKEN_PUBLIC_KEY = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_CLOUD_SESSION_TOKEN_PUBLIC") ??
      "zeWndr5LEoaySgKSo2aZniYqWtx2vKfVz4dd5GQwAuby3fPKcNyLp6mFpf9nCRFYbUcPiN2YT1ZApJ6f3WipiVjuMvyP1JYgHwkaoxDBpJiLoz1grRYkbao9ntukNNo2TQ4uSznUmNPrr4ZxjihoavHwB1zLhLNp5Qj78fBkjgEMA",
  );

  // Vibes Service API
  readonly API_BASE_URL = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_API_BASE_URL") ??
      "https://vibes-diy-api.com",
  );
  readonly APP_HOST_BASE_URL = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_APP_HOST_BASE_URL") ??
      "https://vibesdiy.app",
  );

  // CallAI Endpoint
  readonly CALLAI_ENDPOINT = Lazy(
    () =>
      ensureSuperThis().env.get("VITE_CALLAI_ENDPOINT") ?? this.API_BASE_URL(),
  );

  // Chat History Database
  readonly SETTINGS_DBNAME = Lazy(
    () =>
      (ensureSuperThis().env.get("VITE_VIBES_CHAT_HISTORY") ?? "vibes-chats") +
      getVersionSuffix(),
  );
}

export const VibesDiyEnv = new vibesDiyEnv();
