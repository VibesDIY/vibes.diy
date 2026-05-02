// Regression test for: viewer route must not reference `window` during SSR.
//
// React Router 7 server-renders the route components on the worker (no
// `window`), then hydrates on the client. Any synchronous `window.foo` access
// in the component body or in a useMemo throws on SSR and the page becomes a
// 500 ("Unexpected Server Error" → React Router default error fallback).
//
// This test runs in node env (no `globalThis.window`) and renders the viewer
// route via `renderToString`. If any change to the route reintroduces a
// synchronous `window` reference, this throws and the test fails.

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true }),
  useSession: () => ({ isSignedIn: false }),
  SignIn: () => null,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useClerk: () => ({ loaded: false, isSignedIn: false, addListener: () => () => undefined, session: null }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
  }),
  Toaster: () => null,
}));

vi.mock("../../../pkg/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({
    sthis: {},
    vibeDiyApi: {
      listUserSlugBindings: () => Promise.resolve({ isErr: () => true, Err: () => new Error("ssr") }),
      listRequestGrants: () => Promise.resolve({ isErr: () => true, Err: () => new Error("ssr") }),
      getAppByFsId: () => Promise.resolve({ isErr: () => true, Err: () => new Error("ssr") }),
    },
    webVars: {
      env: { VIBES_SVC_HOSTNAME_BASE: "test.vibesdiy.net" },
      pkgRepos: { workspace: "https://test.vibesdiy.net/vibe-pkg/", public: "https://esm.sh" },
    },
    srvVibeSandbox: {
      onRuntimeReady: () => () => undefined,
    },
  }),
}));

vi.mock("../../../pkg/app/hooks/useShareableDB.js", () => ({
  useShareableDB: () => ({
    sharingState: undefined,
    dbRef: { current: null },
    onResult: () => undefined,
    onDismiss: () => undefined,
    onLoginRedirect: () => undefined,
  }),
}));

vi.mock("../../../pkg/app/components/ResultPreview/useShareModal.js", () => ({
  useShareModal: () => ({
    isOpen: false,
    open: () => undefined,
    close: () => undefined,
    buttonRef: { current: null },
  }),
}));

vi.mock("../../../pkg/app/hooks/useDocumentTitle.js", () => ({
  useDocumentTitle: () => undefined,
}));

import VibeIframeWrapper from "../../../pkg/app/routes/vibe.$userSlug.$appSlug.js";

describe("viewer route SSR safety", () => {
  it("globalThis.window is undefined in this test (node env)", () => {
    expect(typeof globalThis.window).toBe("undefined");
  });

  // The route's full render needs ClerkProvider to be alive — which it isn't
  // in a no-window node env (Clerk is browser-only). What we're guarding
  // against here is the SSR-specific bug class: a synchronous `window.foo`
  // access in the route function (render phase, useMemo, etc.) that crashes
  // the worker before any provider can intervene. So: render the route, and
  // if anything throws, the message must NOT mention `window`. A regression
  // that puts `window.location` back into a useMemo trips this.
  it("synchronous render does not reference `window`", () => {
    let caught: unknown;
    try {
      renderToString(
        <MemoryRouter initialEntries={["/vibe/og/test-app/"]}>
          <Routes>
            <Route path="/vibe/:userSlug/:appSlug/*" element={<VibeIframeWrapper />} />
          </Routes>
        </MemoryRouter>
      );
    } catch (e) {
      caught = e;
    }
    if (caught) {
      const msg = String((caught as Error)?.message ?? caught);
      // A downstream provider error is tolerable here; a window reference is not.
      expect(msg).not.toMatch(/window/i);
    }
  });
});
