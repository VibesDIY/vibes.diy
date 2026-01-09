import React, { StrictMode } from "react";
import { Outlet } from "react-router";

import { PostHogProvider } from "posthog-js/react";
import { ClerkProvider } from "@clerk/clerk-react";
import { VibesDiyEnv } from "./config/env.js";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { getClerkKeyForHostname } from "../clerk-env.js";

export default function App() {
  const clerkPubKey = typeof window !== "undefined" 
    ? getClerkKeyForHostname(window.location.hostname) 
    : getClerkKeyForHostname("localhost");

  return (
    <StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={clerkPubKey}>
          <ThemeProvider>
            <PostHogProvider
              apiKey={VibesDiyEnv.POSTHOG_KEY()}
              options={{
                api_host: VibesDiyEnv.POSTHOG_HOST(),
                opt_out_capturing_by_default: true,
              }}
            >
              <CookieConsentProvider>
                <Outlet />
                <ClientOnly>
                  <CookieBanner />
                </ClientOnly>
              </CookieConsentProvider>
            </PostHogProvider>
          </ThemeProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}