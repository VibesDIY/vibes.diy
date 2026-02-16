/// <reference types="vite/client" />

import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { ErrorBoundary as AppErrorBoundary } from "./ErrorBoundary.js";
import GtmNoScript from "./components/GtmNoScript.js";
import { VibeDiyProvider, VibeDiyWebVars } from "./vibe-diy-provider.js";
import { VibesFPApiParameters } from "@vibes.diy/api-types";
import "./app.css";

// Loader for root route
export async function loader(loaderCtx: { context: { vibeDiyAppParams: VibesFPApiParameters } }) {
  // const env = await fetch("/api/clientEnv")
  // console.log(`loader-invoke from root.tsx`, loaderCtx.context.vibeDiyAppParams.vibes.env);
  const params = loaderCtx.context.vibeDiyAppParams;
  return new Response(
    JSON.stringify({
      // pkgRepos: params.pkgRepos,
      env: {
        GTM_CONTAINER_ID: params.vibes.env.GTM_CONTAINER_ID,
        POSTHOG_KEY: params.vibes.env.POSTHOG_KEY,
        POSTHOG_HOST: params.vibes.env.POSTHOG_HOST,

        DASHBOARD_URL: params.vibes.env.DASHBOARD_URL,
        CLERK_PUBLISHABLE_KEY: params.clerkPublishableKey,
        VIBES_DIY_API_URL: params.vibes.env.VIBES_DIY_API_URL,
      },
      pkgRepos: params.pkgRepos,
    } satisfies VibeDiyWebVars),
    {
      headers: {
        "Content-type": "application/json",
      },
    }
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const svcEnv = useLoaderData<typeof loader>();
  if (!svcEnv) {
    return <></>;
  }
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <GtmNoScript svcVars={svcEnv} />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const webVars = useLoaderData<typeof loader>();
  if (!webVars) {
    return <></>;
  }
  return (
    <VibeDiyProvider webVars={webVars}>
      <AppErrorBoundary>
        <ThemeProvider>
          <CookieConsentProvider>
            <Outlet />
            <ClientOnly>
              <CookieBanner />
            </ClientOnly>
          </CookieConsentProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </VibeDiyProvider>
  );
}
