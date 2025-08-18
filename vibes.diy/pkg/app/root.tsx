import React from "react";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import type { MetaFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import { PostHogProvider } from "posthog-js/react";
import { POSTHOG_KEY, POSTHOG_HOST, IS_DEV_MODE } from "./config/env.js";
import type { Route } from "+types/root";
import "./app.css";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { NeedsLoginModal } from "./components/NeedsLoginModal.js";
import { AuthProvider } from "./contexts/AuthContext.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "alternate icon", href: "/favicon.ico" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export const meta: MetaFunction = () => {
  return [
    { title: "Vibes DIY" },
    { name: "description", content: "Vibe coding made easy" },
    { property: "og:title", content: "Vibes DIY" },
    { property: "og:description", content: "Vibe coding made easy" },
    { property: "og:image", content: "https://vibes.diy/card2.png" },
    { property: "og:url", content: "https://vibes.diy" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Vibes DIY" },
    { name: "twitter:description", content: "Vibe coding made easy" },
    { name: "twitter:image", content: "https://vibes.diy/card2.png" },
    { name: "twitter:url", content: "https://vibes.diy" },
  ];
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta data-testid="meta" />
          <Links />
        </head>
        <body>
          <AuthProvider>
            <PostHogProvider
              apiKey={POSTHOG_KEY}
              options={{
                api_host: POSTHOG_HOST,
                opt_out_capturing_by_default: true,
              }}
            >
              <CookieConsentProvider>
                {children}
                <ClientOnly>
                  <CookieBanner />
                  <NeedsLoginModal />
                </ClientOnly>
              </CookieConsentProvider>
              <ScrollRestoration data-testid="scroll-restoration" />
              <Scripts data-testid="scripts" />
            </PostHogProvider>
          </AuthProvider>
          <ScrollRestoration data-testid="scroll-restoration" />
          <Scripts data-testid="scripts" />
        </body>
      </html>
    </ThemeProvider>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (IS_DEV_MODE && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
