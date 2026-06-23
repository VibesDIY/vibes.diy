import React from "react";
import { render as rtlRender, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { setTestAuth } from "./clerk-test-mock.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

// Inject the VibesDiy context via the real provider instead of mocking it.
// Provide a benign recent-vibes API too: if the MyAppsSection mock loses the
// isolate:false race on a shared worker, HomePage can still mount without
// leaking unhandled rejections from useRecentVibes.
function emptyRecentVibesResult() {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ items: [], nextCursor: undefined }),
    Err: () => ({ message: "unexpected error" }),
  };
}

const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, {
    wrapper: vibesWrapper({
      sthis: { txt: { base64: { encode: (s: string) => `b64:${s}` } } },
      chatApi: { listRecentVibes: async () => emptyRecentVibesResult() },
    }),
    ...options,
  });

// Regression coverage for #1892: the login slide-out (SessionSidebar) auto-opens
// after a short delay on the homepage. It must only do that for signed-out
// visitors — an authenticated session should never see it pop open on load.

// react-router is provided for real by MemoryRouter in vibesWrapper.

// VibesDiy context is injected via vibesWrapper (see local render above).

// ThemeContext is provided by the real ThemeProvider in vibesWrapper.

// Clerk auth comes from the shared singleton mock (clerk-test-mock.ts).

// SessionSidebar stub reflects its isVisible prop so we can assert open/closed.
vi.mock("~/vibes.diy/app/components/SessionSidebar.js", () => ({
  default: ({ isVisible }: { isVisible: boolean }) => (
    <div data-testid="session-sidebar" data-visible={isVisible ? "true" : "false"} />
  ),
}));
vi.mock("~/vibes.diy/app/components/MyAppsSection.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  MyAppsSection: () => null,
}));
vi.mock("~/vibes.diy/app/components/NewSessionContent/VibeGallery.js", () => ({ default: () => null }));
vi.mock("~/vibes.diy/app/components/PillPortal.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PillPortal: () => null,
}));

// Use the real @vibes.diy/base design system (no mock) — partial base mocks
// poison files that import other base exports under isolate:false.

import HomePage from "~/vibes.diy/app/components/HomePage.js";

const PLACEHOLDER = "Describe your app in plain words — it builds instantly and changes as you type.";
// Auto-open delay in HomePage is 1000ms; give the negative cases headroom.
const AFTER_DELAY_MS = 1500;

function sidebarVisible() {
  return screen.getByTestId("session-sidebar").getAttribute("data-visible") === "true";
}

async function renderHomePage() {
  render(<HomePage />);
  // HomePage renders a blank placeholder until the mobile-check effect runs.
  await waitFor(() => screen.getByPlaceholderText(PLACEHOLDER));
}

describe("HomePage login slide-out auto-open (#1892)", () => {
  // Each test sets authState before rendering, so a bare cleanup() is enough.
  afterEach(() => {
    cleanup();
  });

  it("auto-opens the slide-out for signed-out visitors", async () => {
    setTestAuth({ isSignedIn: false, isLoaded: true });
    await renderHomePage();
    expect(sidebarVisible()).toBe(false);
    await waitFor(() => expect(sidebarVisible()).toBe(true), { timeout: 3000 });
  });

  it("does NOT auto-open the slide-out when already authenticated", async () => {
    setTestAuth({ isSignedIn: true, isLoaded: true });
    await renderHomePage();
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });

  it("does NOT auto-open while auth is still loading", async () => {
    setTestAuth({ isSignedIn: false, isLoaded: false });
    await renderHomePage();
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });

  // The auto-open is a one-time initial-load decision. An authenticated user
  // clicking Logout flips isSignedIn true→false; that transition must NOT
  // re-trigger the timer and reopen the panel they just closed (Codex review).
  it("does NOT reopen after an authenticated user logs out", async () => {
    setTestAuth({ isSignedIn: true, isLoaded: true });
    const { rerender } = render(<HomePage />);
    await waitFor(() => screen.getByPlaceholderText(PLACEHOLDER));
    // Simulate logout: auth resolves to signed-out on the same mounted instance.
    setTestAuth({ isSignedIn: false });
    rerender(<HomePage />);
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });
});
