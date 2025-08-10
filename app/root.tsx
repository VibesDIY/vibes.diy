import React from 'react';
import type { MetaFunction } from 'react-router';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router';

import { PostHogProvider } from 'posthog-js/react';
import { POSTHOG_KEY, POSTHOG_HOST, IS_DEV_MODE } from './config/env';
import type { Route } from './+types/root';
import './app.css';
import ClientOnly from './components/ClientOnly';
import CookieBanner from './components/CookieBanner';
import { NeedsLoginModal } from './components/NeedsLoginModal';
import { AuthProvider } from './contexts/AuthContext';
import { CookieConsentProvider } from './contexts/CookieConsentContext';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'alternate icon', href: '/favicon.ico' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export const meta: MetaFunction = () => {
  return [
    { title: 'Vibes DIY' },
    { name: 'description', content: 'Vibe coding made easy' },
    { property: 'og:title', content: 'Vibes DIY' },
    { property: 'og:description', content: 'Vibe coding made easy' },
    { property: 'og:image', content: 'https://vibes.diy/card2.png' },
    { property: 'og:url', content: 'https://vibes.diy' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Vibes DIY' },
    { name: 'twitter:description', content: 'Vibe coding made easy' },
    { name: 'twitter:image', content: 'https://vibes.diy/card2.png' },
    { name: 'twitter:url', content: 'https://vibes.diy' },
  ];
};

export function Layout({ children }: { children: React.ReactNode }) {
  // Handle dark mode detection and class management (replaces ThemeContext)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize dark mode based on system preference or existing class
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateDarkMode = (isDarkMode: boolean) => {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.dataset.theme = 'light';
      }
    };

    // Set initial state based on system preference
    const initialIsDarkMode = mediaQuery.matches;
    updateDarkMode(initialIsDarkMode);

    // Listen for system preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      updateDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/**
         * Netlify Split Testing opt-in/out via query params (pre-mount)
         *
         * Supports setting or clearing the `nf_ab` cookie before the app initializes
         * so Netlify can route this request (and subsequent ones) to a specific
         * branch deploy on the primary domain without redirecting. This preserves
         * origin-scoped storage like localStorage.
         *
         * Usage examples (open on the main domain):
         *   - Set to a branch:   ?nf_ab=my-experimental-branch
         *   - Clear the cookie:  ?nf_ab=clear  (aliases: off, reset, none)
         *   - Also accepts `ab=` as a synonym for `nf_ab=`
         */}
        <script
          // Intentionally inline and first in <head> to run before framework mount
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    var u = new URL(window.location.href);
    var sp = u.searchParams;
    var hasNf = sp.has('nf_ab');
    var hasAb = sp.has('ab');
    if (!hasNf && !hasAb) return;

    var value = hasNf ? sp.get('nf_ab') : sp.get('ab');
    var clear = value && /^(clear|off|reset|none)$/i.test(value);

    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    var cookieBase = 'nf_ab=';

    var currentMatch = document.cookie.match(/(?:^|; )nf_ab=([^;]+)/);
    var current = currentMatch ? decodeURIComponent(currentMatch[1]) : null;

    var changed = false;
    if (clear) {
      document.cookie = 'nf_ab=; Max-Age=0; Path=/; SameSite=Lax' + secure;
      changed = true;
    } else if (value && value !== current) {
      // Long-ish expiration so the choice sticks for developers
      var expires = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
      document.cookie = cookieBase + encodeURIComponent(value) + '; Expires=' + expires + '; Path=/; SameSite=Lax' + secure;
      changed = true;
    }

    if (changed) {
      // Remove our params to avoid reload loops and keep nice URLs
      sp.delete('nf_ab');
      sp.delete('ab');
      var newUrl = u.origin + u.pathname + (sp.toString() ? ('?' + sp.toString()) : '') + u.hash;
      window.location.replace(newUrl);
    }
  } catch (e) {
    // Swallow errors to avoid blocking page load in edge cases
  }
})();`,
          }}
        />
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
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
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
