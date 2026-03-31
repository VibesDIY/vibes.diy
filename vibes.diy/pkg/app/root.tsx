/// <reference types="vite/client" />

import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { ErrorBoundary as AppErrorBoundary } from "./ErrorBoundary.js";
import GtmNoScript from "./components/GtmNoScript.js";
import { VibesDiyProvider, VibesDiyWebVars } from "./vibes-diy-provider.js";
import { VibesFPApiParameters } from "@vibes.diy/api-types";
import { getVibesGlobalCSS } from "@vibes.diy/base";
import { BuildURI } from "@adviser/cement";
import "./app.css";
import { Toaster } from "react-hot-toast";

// Loader for root route
export async function loader({ request, context }: { request: Request; context: { vibeDiyAppParams: VibesFPApiParameters } }) {
  const params = context.vibeDiyAppParams;

  const stableEntry = request.headers.get("x-stable-entry");
  let workspace = params.pkgRepos.workspace;
  if (stableEntry && stableEntry !== "*") {
    workspace = BuildURI.from(workspace).setParam("@stable-entry@", stableEntry).toString();
  }

  return new Response(
    JSON.stringify({
      env: {
        GTM_CONTAINER_ID: params.vibes.env.GTM_CONTAINER_ID,
        POSTHOG_KEY: params.vibes.env.POSTHOG_KEY,
        POSTHOG_HOST: params.vibes.env.POSTHOG_HOST,

        CLERK_PUBLISHABLE_KEY: params.clerkPublishableKey,
        VIBES_DIY_API_URL: params.vibes.env.VIBES_DIY_API_URL,
        VIBES_SVC_HOSTNAME_BASE: params.vibes.svc.hostnameBase,
      },
      pkgRepos: { ...params.pkgRepos, workspace },
    } satisfies VibesDiyWebVars),
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
        <style dangerouslySetInnerHTML={{ __html: getVibesGlobalCSS() }} />
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
    <VibesDiyProvider webVars={webVars}>
      <AppErrorBoundary>
        <ThemeProvider>
          <CookieConsentProvider>
            <Toaster></Toaster>
            <Outlet />
            <ClientOnly>
              <CookieBanner />
            </ClientOnly>
          </CookieConsentProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </VibesDiyProvider>
  );
}
