import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Regression coverage for #1892: the login slide-out (SessionSidebar) auto-opens
// after a short delay on the homepage. It must only do that for signed-out
// visitors — an authenticated session should never see it pop open on load.

// Controllable auth state, mutated per-test before render.
const authState: { isSignedIn: boolean; isLoaded: boolean } = {
  isSignedIn: false,
  isLoaded: true,
};

vi.mock("react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children }: { to: string; children?: React.ReactNode }) => <a href={to}>{children}</a>,
  };
});

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({ sthis: { txt: { base64: { encode: (s: string) => `b64:${s}` } } } }),
}));

vi.mock("~/vibes.diy/app/contexts/ThemeContext.js", () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => authState,
}));

// SessionSidebar stub reflects its isVisible prop so we can assert open/closed.
vi.mock("~/vibes.diy/app/components/SessionSidebar.js", () => ({
  default: ({ isVisible }: { isVisible: boolean }) => (
    <div data-testid="session-sidebar" data-visible={isVisible ? "true" : "false"} />
  ),
}));
vi.mock("~/vibes.diy/app/components/MyAppsSection.js", () => ({ MyAppsSection: () => null }));
vi.mock("~/vibes.diy/app/components/NewSessionContent/VibeGallery.js", () => ({ default: () => null }));
vi.mock("~/vibes.diy/app/components/PillPortal.js", () => ({
  PillPortal: () => null,
  PILL_CLEARANCE_Y: 0,
}));

vi.mock("@vibes.diy/base", () => ({
  VibesButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  ArrowLeftIcon: () => <span />,
  ArrowRightIcon: () => <span />,
  gridBackground: "",
  cx: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import HomePage from "~/vibes.diy/app/components/HomePage.js";

const PLACEHOLDER = "Describe your vibe to make it a shareable app.";
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
    authState.isSignedIn = false;
    authState.isLoaded = true;
    await renderHomePage();
    expect(sidebarVisible()).toBe(false);
    await waitFor(() => expect(sidebarVisible()).toBe(true), { timeout: 3000 });
  });

  it("does NOT auto-open the slide-out when already authenticated", async () => {
    authState.isSignedIn = true;
    authState.isLoaded = true;
    await renderHomePage();
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });

  it("does NOT auto-open while auth is still loading", async () => {
    authState.isSignedIn = false;
    authState.isLoaded = false;
    await renderHomePage();
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });

  // The auto-open is a one-time initial-load decision. An authenticated user
  // clicking Logout flips isSignedIn true→false; that transition must NOT
  // re-trigger the timer and reopen the panel they just closed (Codex review).
  it("does NOT reopen after an authenticated user logs out", async () => {
    authState.isSignedIn = true;
    authState.isLoaded = true;
    const { rerender } = render(<HomePage />);
    await waitFor(() => screen.getByPlaceholderText(PLACEHOLDER));
    // Simulate logout: auth resolves to signed-out on the same mounted instance.
    authState.isSignedIn = false;
    rerender(<HomePage />);
    await new Promise((r) => setTimeout(r, AFTER_DELAY_MS));
    expect(sidebarVisible()).toBe(false);
  });
});
