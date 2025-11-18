import React, { useEffect } from "react";
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
import { AuthProvider } from "./contexts/AuthContext.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: `${VibesDiyEnv.APP_BASENAME()}favicon.svg`,
  },
  { rel: "alternate icon", href: `${VibesDiyEnv.APP_BASENAME()}favicon.ico` },
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
  // Handle dark mode detection and class management (replaces ThemeContext)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize dark mode based on system preference or existing class
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateDarkMode = (isDarkMode: boolean) => {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.dataset.theme = "light";
      }
    };

    // Set initial state based on system preference
    const initialIsDarkMode = mediaQuery.matches;
    updateDarkMode(initialIsDarkMode);

    // Listen for system preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      updateDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <html lang="en">
      <head>
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
        {/* Import map for inline vibe rendering with ES modules */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                react: "https://esm.sh/react@>=19.1.0",
                "react-dom": "https://esm.sh/react-dom@>=19.1.0",
                "react-dom/client": "https://esm.sh/react-dom@>=19.1.0/client",
                "use-fireproof": "https://esm.sh/use-vibes@>=0.13.0",
                "call-ai": "https://esm.sh/call-ai",
                "use-vibes": "https://esm.sh/use-vibes@>=0.13.0",
                "https://esm.sh/use-fireproof":
                  "https://esm.sh/use-vibes@>=0.13.0",
                eruda: "https://esm.sh/eruda",
                three: "https://esm.sh/three",
              },
            }),
          }}
        />
        {/* Tailwind CSS v4 for inline vibe rendering - matches hosting runtime */}
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body>
        {/* TODO: Re-enable GtmNoScript when consent can be checked server-side */}
        {/* <GtmNoScript /> */}
        <AuthProvider>
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
        </AuthProvider>
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
