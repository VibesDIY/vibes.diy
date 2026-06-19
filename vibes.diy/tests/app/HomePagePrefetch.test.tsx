import React from "react";
import { render as rtlRender, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { vibesWrapper } from "./vibes-provider-harness.js";

// Inject the VibesDiy context via the real provider instead of mocking it.
const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: vibesWrapper({ sthis: { txt: { base64: { encode: (s: string) => `b64:${s}` } } } }), ...options });

// The chat route chunk is warmed on interaction intent via a hidden
// <Link to="/chat/prompt" prefetch="render">. These tests assert that
// behavior at the component level: the link is absent until the user shows
// intent, then appears pointing at /chat/prompt. We deliberately do NOT
// exercise the real React Router prefetch/discovery internals — Link is
// stubbed to a plain anchor so the test stays behavior-level.

// ---- dependency mocks (must be declared before importing the component) ----

vi.mock("react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
      <a href={to} data-testid="prefetch-link">
        {children}
      </a>
    ),
  };
});

// VibesDiy context is injected via vibesWrapper (see local render above).

// ThemeContext is provided by the real ThemeProvider in vibesWrapper.

// Clerk auth comes from the shared singleton mock (clerk-test-mock.ts); its
// signed-out default (isSignedIn:false, isLoaded:true) is what these tests need.

// Stub heavy children so the test doesn't pull in data hooks / the design system.
// SessionSidebar stub mirrors HomePageLoginSlideout's (identical factories don't
// bleed under isolate:false); it reflects isVisible but these tests ignore it.
vi.mock("~/vibes.diy/app/components/SessionSidebar.js", () => ({
  default: ({ isVisible }: { isVisible: boolean }) => (
    <div data-testid="session-sidebar" data-visible={isVisible ? "true" : "false"} />
  ),
}));
vi.mock("~/vibes.diy/app/components/MyAppsSection.js", () => ({ MyAppsSection: () => null }));
vi.mock("~/vibes.diy/app/components/NewSessionContent/VibeGallery.js", () => ({ default: () => null }));
vi.mock("~/vibes.diy/app/components/PillPortal.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PillPortal: () => null,
}));

// Use the real @vibes.diy/base design system (no mock) — partial base mocks
// poison files that import other base exports under isolate:false.

// Import the component AFTER all vi.mock() calls.
import HomePage from "~/vibes.diy/app/components/HomePage.js";
import { quickSuggestions } from "~/vibes.diy/app/data/quick-suggestions-data.js";

const PLACEHOLDER = "Describe your vibe to make it a shareable app.";

async function renderHomePage() {
  render(<HomePage />);
  // HomePage renders a blank placeholder until the mobile check effect runs.
  return waitFor(() => screen.getByPlaceholderText(PLACEHOLDER));
}

describe("HomePage chat-route prefetch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not prefetch the chat route before any interaction", async () => {
    await renderHomePage();
    expect(screen.queryByTestId("prefetch-link")).toBeNull();
  });

  it("prefetches the chat route on textarea focus", async () => {
    const textarea = await renderHomePage();
    fireEvent.focus(textarea);
    const link = screen.getByTestId("prefetch-link");
    expect(link).toHaveAttribute("href", "/chat/prompt");
  });

  it("prefetches the chat route when a suggestion is selected", async () => {
    await renderHomePage();
    expect(screen.queryByTestId("prefetch-link")).toBeNull();
    fireEvent.click(screen.getAllByText(quickSuggestions[0].label)[0]);
    expect(screen.getByTestId("prefetch-link")).toHaveAttribute("href", "/chat/prompt");
  });
});
