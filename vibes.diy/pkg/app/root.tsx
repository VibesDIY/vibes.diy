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
import "./app.css";
import { CopyableToaster } from "./components/CopyableToaster.js";
import { exception2Result } from "@adviser/cement";

// Decode the Clerk frontend API host from a publishable key (pk_<env>_<base64>).
// Used to emit a <link rel="preconnect"> hint so the browser warms the TCP/TLS
// connection to clerk before the SDK script even loads — shaves the first
// Clerk request's setup off the critical path.
function clerkFrontendHostFromKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const parts = key.split("_");
  if (parts.length < 3) return undefined;
  const rDecoded = exception2Result(() => atob(parts[2]));
  if (rDecoded.isErr()) return undefined;
  // Format is "<host>$" — strip the trailing terminator if present
  return rDecoded.Ok().replace(/\$+$/, "") || undefined;
}

// Cloudflare Web Analytics (RUM) beacon site token for the vibes.diy site.
// Public client-side token (ships in every page's HTML by design) — not a
// secret. The beacon is only rendered when the SSR layer enables it for the
// request (prod deployment + non-EU; see workers/app.ts `enableCfRum`).
const CF_WEB_ANALYTICS_TOKEN = "c8c1ae3173414bd9b08c2dcc00727eff";

// Default page metadata. React Router falls back to the nearest parent route's
// meta when a leaf route doesn't export its own, so this guarantees every page
// has a non-empty <title> even if a route forgets to set one.
export function meta() {
  return [{ title: "Vibes DIY" }, { name: "description", content: "Describe your vibe to make it a shareable app." }];
}

// Loader for root route
export async function loader(loaderCtx: { context: { vibeDiyAppParams: VibesFPApiParameters; enableCfRum?: boolean } }) {
  // const env = await fetch("/api/clientEnv")
  // console.log(`loader-invoke from root.tsx`, loaderCtx.context.vibeDiyAppParams.vibes.env);
  const params = loaderCtx.context.vibeDiyAppParams;
  return new Response(
    JSON.stringify({
      // pkgRepos: params.pkgRepos,
      cfWebAnalyticsToken: loaderCtx.context.enableCfRum ? CF_WEB_ANALYTICS_TOKEN : undefined,
      env: {
        GTM_CONTAINER_ID: params.vibes.env.GTM_CONTAINER_ID,
        POSTHOG_KEY: params.vibes.env.POSTHOG_KEY,
        POSTHOG_HOST: params.vibes.env.POSTHOG_HOST,

        // DASHBOARD_URL: params.vibes.env.DASHBOARD_URL,
        CLERK_PUBLISHABLE_KEY: params.clerkPublishableKey,
        VIBES_DIY_API_URL: params.vibes.env.VIBES_DIY_API_URL,
        VIBES_SVC_HOSTNAME_BASE: params.vibes.svc.hostnameBase,
        VIBES_CACHED_SUGGESTIONS: params.vibes.env.VIBES_CACHED_SUGGESTIONS,
      },
      pkgRepos: params.pkgRepos,
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
  const clerkHost = clerkFrontendHostFromKey(svcEnv.env.CLERK_PUBLISHABLE_KEY);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {clerkHost && <link rel="preconnect" href={`https://${clerkHost}`} crossOrigin="anonymous" />}
        {svcEnv.cfWebAnalyticsToken && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: svcEnv.cfWebAnalyticsToken })}
          />
        )}
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
            <CopyableToaster />
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
