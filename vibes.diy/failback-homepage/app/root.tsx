import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import "./app.css";

import { ClerkProvider } from "@clerk/clerk-react";
import { PostHogProvider } from "posthog-js/react";
import { VibesDiyEnv } from "./config/env.js";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const postHogKey = VibesDiyEnv.POSTHOG_KEY();

  const content = (
    <CookieConsentProvider>
      <Outlet />
      <ClientOnly>
        <CookieBanner />
      </ClientOnly>
    </CookieConsentProvider>
  );

  return (
    <ClerkProvider publishableKey={VibesDiyEnv.CLERK_PUBLISHABLE_KEY()}>
      <ThemeProvider>
        {postHogKey ? (
          <PostHogProvider
            apiKey={postHogKey}
            options={{
              api_host: VibesDiyEnv.POSTHOG_HOST(),
              opt_out_capturing_by_default: true,
            }}
          >
            {content}
          </PostHogProvider>
        ) : (
          content
        )}
      </ThemeProvider>
    </ClerkProvider>
  );
}
