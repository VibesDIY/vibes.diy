import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import { ClerkProvider } from "@clerk/clerk-react";
import { PostHogProvider } from "posthog-js/react";
import { VibesDiyEnv } from "./config/env.js";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { ErrorBoundary as AppErrorBoundary } from "./ErrorBoundary.js";
import GtmNoScript from "./components/GtmNoScript.js";

import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <GtmNoScript />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={VibesDiyEnv.CLERK_PUBLISHABLE_KEY()}>
      <AppErrorBoundary>
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
      </AppErrorBoundary>
    </ClerkProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>
  );
}
