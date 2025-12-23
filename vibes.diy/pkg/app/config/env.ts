/// <reference types="vite/client" />
/**
 * Central configuration file for environment variables
 * Provides fallback values for required environment variables
 */
import { Lazy, runtimeFn } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { callAiEnv } from "call-ai";

// --- Vite Environment Variables ---
// Access environment variables safely with fallbacks

// Analytics

class vibesDiyEnv {
  readonly env = Lazy(() => callAiEnv.merge(ensureSuperThis().env));

  readonly PROMPT_FALL_BACKURL = Lazy(
    () =>
      new URL(
        this.env().get("PROMPT_FALL_BACKURL") ??
          "https://esm.sh/@vibes.diy/prompts/llms",
      ),
  );

  readonly GA_TRACKING_ID = Lazy(
    () =>
      this.env().get("VITE_GOOGLE_ANALYTICS_ID") ??
      this.env().get("GOOGLE_ANALYTICS_ID") ??
      "",
  );

  // Google Tag Manager
  readonly GTM_CONTAINER_ID = Lazy(
    () =>
      this.env().get("VITE_GTM_CONTAINER_ID") ??
      this.env().get("GTM_CONTAINER_ID") ??
      "",
  );

  // PostHog
  readonly POSTHOG_KEY = Lazy(
    () =>
      this.env().get("VITE_POSTHOG_KEY") ?? this.env().get("POSTHOG_KEY") ?? "",
  );
  readonly POSTHOG_HOST = Lazy(
    () =>
      this.env().get("VITE_POSTHOG_HOST") ??
      this.env().get("POSTHOG_HOST") ??
      "",
  );

  // Application Behavior
  readonly APP_MODE = Lazy(() => this.env().get("MODE") ?? "production");
  readonly APP_BASENAME = Lazy(
    () =>
      this.env().get("VITE_APP_BASENAME") ??
      this.env().get("APP_BASENAME") ??
      "/",
  );

  // // Fireproof Connect & Auth
  // readonly CONNECT_URL = Lazy(
  //   () =>
  //     this.env().get("VITE_CONNECT_URL") ??
  //     this.env().get("CONNECT_URL") ??
  //     "https://connect.fireproof.direct/token",
  // );
  // readonly CONNECT_API_URL = Lazy(
  //   () =>
  //     this.env().get("VITE_CONNECT_API_URL") ??
  //     "https://connect.fireproof.direct/api",
  // );
  // readonly CLOUD_SESSION_TOKEN_PUBLIC_KEY = Lazy(
  //   () =>
  //     this.env().get("VITE_CLOUD_SESSION_TOKEN_PUBLIC") ??
  //     "zeWndr5LEoaySgKSo2aZniYqWtx2vKfVz4dd5GQwAuby3fPKcNyLp6mFpf9nCRFYbUcPiN2YT1ZApJ6f3WipiVjuMvyP1JYgHwkaoxDBpJiLoz1grRYkbao9ntukNNo2TQ4uSznUmNPrr4ZxjihoavHwB1zLhLNp5Qj78fBkjgEMA",
  // );
  readonly APP_HOST_BASE_URL = Lazy(
    () =>
      new URL(
        this.env().get("VITE_APP_HOST_BASE_URL") ??
          this.env().get("APP_HOST_BASE_URL") ??
          "https://vibesdiy.app",
      ).href, // Keep trailing slash - standardize on YES trailing slash
  );

  readonly CLERK_PUBLISHABLE_KEY = Lazy(() => {
    const envKey = this.env().get("CLERK_PUBLISHABLE_KEY");
    if (envKey) {
      return envKey;
    }
    throw new Error(
      "CLERK_PUBLISHABLE_KEY is required in environment variables",
    );
    // // Use live key ONLY for vibes.diy, test key for everything else
    // const isProduction =
    //   runtimeFn().isBrowser && window.location.hostname === "vibes.diy";
    // return isProduction
    //   ? "pk_live_Y2xlcmsudmliZXMuZGl5JA"
    //   : "pk_test_c2luY2VyZS1jaGVldGFoLTMwLmNsZXJrLmFjY291bnRzLmRldiQ";
  });

  // Helper for server-side Clerk key selection based on hostname
  // static getClerkKeyForHostname(hostname: string): string {
  //   const isProduction = hostname === "vibes.diy";
  //   return isProduction
  //     ? "pk_live_Y2xlcmsudmliZXMuZGl5JA"
  //     : "pk_test_c2luY2VyZS1jaGVldGFoLTMwLmNsZXJrLmFjY291bnRzLmRldiQ";
  // }

  // Vibes Service API
  readonly API_BASE_URL = Lazy(() => {
    const envUrl =
      this.env().get("VITE_API_BASE_URL") ?? this.env().get("API_BASE_URL");
    if (envUrl) {
      return new URL(envUrl).href;
    }
    // Use production worker ONLY for vibes.diy, preview worker for everything else
    const isProduction =
      runtimeFn().isBrowser && window.location.hostname.endsWith("vibes.diy");
    const defaultUrl = isProduction
      ? "https://vibes-diy-api.com"
      : "https://vibes-hosting-v2-preview.jchris.workers.dev";
    return new URL(defaultUrl).href;
  });
  // readonly APP_HOST_BASE_URL = Lazy(
  //   () =>
  //     new URL(
  //       this.env().get("VITE_APP_HOST_BASE_URL") ?? "https://vibesdiy.app",
  //     ).href, // Keep trailing slash - standardize on YES trailing slash
  // );

  // CallAI Endpoint
  readonly CALLAI_ENDPOINT = Lazy(
    () =>
      new URL(
        this.env().get("VITE_CALLAI_ENDPOINT") ??
          this.env().get("CALLAI_ENDPOINT") ??
          this.API_BASE_URL(),
      ).href, // Keep trailing slash - standardize on YES trailing slash
  );

  // Chat History Database
  readonly SETTINGS_DBNAME = Lazy(
    () =>
      this.env().get("VITE_VIBES_CHAT_HISTORY") ??
      this.env().get("VIBES_CHAT_HISTORY") ??
      "vibes-chats",
  );

  readonly VibesEnv = Lazy(() => {
    const fpCloudUrl = this.env().get("FPCLOUD_URL");
    if (!fpCloudUrl) {
      throw new Error("FPCLOUD_URL is required in environment variables");
    }
    const dashboardUrl = this.env().get("DASHBOARD_URL");
    if (!dashboardUrl) {
      throw new Error("DASHBOARD_URL is required in environment variables");
    }
    return {
      FPCLOUD_URL: fpCloudUrl,
      DASHBOARD_URL: dashboardUrl,
      CLERK_PUBLISHABLE_KEY: this.CLERK_PUBLISHABLE_KEY(),
      API_BASE_URL: this.API_BASE_URL(),
      CALLAI_API_KEY: this.env().get("VITE_CALLAI_API_KEY") ?? "",
      CALLAI_CHAT_URL: this.CALLAI_ENDPOINT(),
      CALLAI_IMG_URL: this.CALLAI_ENDPOINT(),
    };
  });
}

export const VibesDiyEnv = new vibesDiyEnv();
