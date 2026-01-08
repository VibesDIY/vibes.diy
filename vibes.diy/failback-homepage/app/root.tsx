import React, { StrictMode } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";

import { PostHogProvider } from "posthog-js/react";
import { VibesDiyEnv } from "./config/env.js";
import ClientOnly from "./components/ClientOnly.js";
import CookieBanner from "./components/CookieBanner.js";
import { CookieConsentProvider } from "./contexts/CookieConsentContext.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

// Only import Home for the failback homepage - other routes disabled
import Home from "./routes/home.js";

function RawApp({ children }: { children?: React.ReactNode }) {
  return (
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
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
