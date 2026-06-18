import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

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

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({ sthis: { txt: { base64: { encode: (s: string) => `b64:${s}` } } } }),
}));

vi.mock("~/vibes.diy/app/contexts/ThemeContext.js", () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true }),
}));

// Stub heavy children so the test doesn't pull in data hooks / the design system.
vi.mock("~/vibes.diy/app/components/SessionSidebar.js", () => ({ default: () => null }));
vi.mock("~/vibes.diy/app/components/MyAppsSection.js", () => ({ MyAppsSection: () => null }));
vi.mock("~/vibes.diy/app/components/NewSessionContent/VibeGallery.js", () => ({ default: () => null }));
vi.mock("~/vibes.diy/app/components/PillPortal.js", () => ({
  PillPortal: () => null,
  PILL_CLEARANCE_Y: 0,
}));

vi.mock("@vibes.diy/base", () => ({
  VibesButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  ArrowLeftIcon: () => <span />,
  ArrowRightIcon: () => <span />,
  gridBackground: "",
  cx: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

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
