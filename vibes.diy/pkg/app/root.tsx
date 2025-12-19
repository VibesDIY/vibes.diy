import React, { StrictMode } from "react";
import type { MetaFunction } from "react-router-dom";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";

import { PostHogProvider } from "posthog-js/react";
import { VibesDiyEnv } from "./config/env.js";
// import type { Route } from "./+types/root";
// CSS loaded via <link> tag in index.tsx for SSR compatibility
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { ClerkProvider } from "@clerk/clerk-react";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { DashboardProvider } from "./contexts/DashboardContext.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

import Home from "./routes/home.js";
import { About } from "./routes/about.js";
import { Settings } from "./routes/settings.js";
import { Firehose } from "./routes/firehose.js";
import { Groups } from "./routes/groups.js";
import { MyVibes } from "./routes/my-vibes.js";
import { Remix } from "./routes/remix.js";
import { SsoCallback } from "./routes/sso-callback.js";
import { Logout } from "./routes/logout.js";
import { VibeInstanceList } from "./routes/vibe-instance-list.js";
import { VibeViewer } from "./routes/vibe-viewer.js";
import { Legal_Privacy } from "./routes/legal/privacy.js";
import { Legal_Tos } from "./routes/legal/tos.js";
import { Invite } from "./routes/invite.js";
import { CatchAll } from "./routes/catch-all.js";
import { VibeContextProvider } from "@vibes.diy/use-vibes-base";

function RawApp({ children }: { children?: React.ReactNode }) {
  return (
    <VibeContextProvider
      mountParams={{
        appSlug: "vibes-diy",
        titleId: "vibes-diy",
        installId: "vibes-diy",
        env: VibesDiyEnv.VibesEnv(),
      }}
    >
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
            <Outlet />
            <ClientOnly>
              <CookieBanner />
            </ClientOnly>
          </CookieConsentProvider>
        </PostHogProvider>
      </ThemeProvider>
    </VibeContextProvider>
  );
}

export function App() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta?.env?.VITE_APP_BASENAME || "/"}>
          <Routes>
            <Route path="/" element={<RawApp />}>
              <Route index element={<Home />} />
              <Route path="index.html" element={<Home />} />

              {/* Chat routes - all use Home component with different URL params */}
              <Route path="chat/:sessionId" element={<Home />} />
              <Route path="chat/:sessionId/:title" element={<Home />} />
              <Route path="chat/:sessionId/:title/app" element={<Home />} />
              <Route path="chat/:sessionId/:title/code" element={<Home />} />
              <Route path="chat/:sessionId/:title/data" element={<Home />} />
              <Route path="chat/:sessionId/:title/chat" element={<Home />} />
              <Route
                path="chat/:sessionId/:title/settings"
                element={<Home />}
              />

              {/* Vibe routes */}
              <Route path="vibes/mine" element={<MyVibes />} />
              <Route path="vibe/:titleId" element={<VibeInstanceList />} />

              {/* Other routes */}
              <Route path="groups" element={<Groups />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about" element={<About />} />
              <Route path="invite" element={<Invite />} />
              <Route path="sso-callback" element={<SsoCallback />} />
              <Route path="logout" element={<Logout />} />
              <Route path="remix/:vibeSlug?" element={<Remix />} />
              <Route path="firehose" element={<Firehose />} />

              {/* Legacy routes - can be removed if not needed */}
              <Route path="vibe-instance-list" element={<VibeInstanceList />} />
              <Route path="vibe-viewer" element={<VibeViewer />} />

              {/* Legal */}
              <Route path="legal/privacy" element={<Legal_Privacy />} />
              <Route path="legal/tos" element={<Legal_Tos />} />

              {/* 404 catch-all - must be last */}
              <Route path="*" element={<CatchAll />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
