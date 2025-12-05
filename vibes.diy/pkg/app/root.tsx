import React from "react";
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
import { VibesDiyEnv } from "./config/env.js";
import type { Route } from "./+types/root";
import "./app.css";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import GtmNoScript from "./components/GtmNoScript.js";
import { ClerkProvider } from "@clerk/clerk-react";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { getLibraryImportMap } from "@vibes.diy/hosting-base/config/library-import-map";

export const links: Route.LinksFunction = () => {
  const rawBase = VibesDiyEnv.APP_BASENAME();
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return [
    {
      rel: "icon",
      type: "image/svg+xml",
      href: `${base}favicon.svg`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: `${base}favicon-32x32.png`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: `${base}favicon-16x16.png`,
    },
    { rel: "alternate icon", href: `${base}favicon.ico` },
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: `${base}apple-touch-icon.png`,
    },
    {
      rel: "manifest",
      href: `${base}site.webmanifest`,
    },
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
};

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
    <html lang="en">
      <head>
        {/* Import map for inline vibe rendering with ES modules */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                // Only include React imports in production (dev mode uses bundled versions)
                ...(!import.meta.env.DEV ? getLibraryImportMap() : {}),
              },
            }),
          }}
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/**
         * Netlify Split Testing opt-in/out via query params (pre-mount)
         *
         * Moved to a small static file to keep CSP strict (no 'unsafe-inline').
         * The script must execute before the app mounts; keep it first in <head>.
         * <script src="/nf-ab.cookie.js"></script>
         */}
        {/* FIREPROOF-UPGRADE-BRANCH: Fireproof 0.23.0 */}
        <Meta data-testid="meta" />
        <Links />
        {/* Tailwind CSS v4 for inline vibe rendering - matches hosting runtime */}
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        {/* Babel Standalone for JSX transformation in inline vibe rendering */}
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      </head>
      <body>
        {/* TODO: Re-enable GtmNoScript when consent can be checked server-side */}
        {/* <GtmNoScript /> */}
        <ClerkProvider publishableKey={VibesDiyEnv.CLERK_PUBLISHABLE_KEY()}>
          <ThemeProvider>
            <PostHogProvider
              apiKey={VibesDiyEnv.POSTHOG_KEY()}
              options={{
                api_host: VibesDiyEnv.POSTHOG_HOST(),
                opt_out_capturing_by_default: true,
              }}
            >
              <CookieConsentProvider>
                {children}
                <ClientOnly>
                  <CookieBanner />
                </ClientOnly>
              </CookieConsentProvider>
              <ScrollRestoration data-testid="scroll-restoration" />
              <Scripts data-testid="scripts" />
            </PostHogProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
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
  } else if (error && error instanceof Error) {
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
