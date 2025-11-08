import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// Mock React Router hooks
let mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = {};
let mockLocation = { search: "", pathname: "/", state: null };
let mockLoaderData: { urlPrompt: string | null; urlModel: string | null } = {
  urlPrompt: null,
  urlModel: null,
};

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => mockLocation,
    useLoaderData: () => mockLoaderData,
  };
});

// Mock modules before imports
vi.mock("~/vibes.diy/app/components/NewSessionView", () => ({
  default: () => <div data-testid="new-session-view">NewSessionView</div>,
}));

vi.mock("~/vibes.diy/app/components/SessionView", () => ({
  default: () => <div data-testid="session-view">SessionView</div>,
}));

vi.mock("~/vibes.diy/app/hooks/useSimpleChat", () => ({
  useSimpleChat: () => ({
    docs: [],
    input: "",
    setInput: vi.fn(),
    isStreaming: false,
    inputRef: { current: null },
    sendMessage: vi.fn(),
    selectedSegments: [],
    selectedCode: null,
    title: "",
    sessionId: null,
    selectedResponseDoc: undefined,
    codeReady: false,
    addScreenshot: vi.fn(),
  }),
}));

vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: () => ({
    session: null,
    loading: false,
    error: null,
    loadSession: vi.fn(),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updateMetadata: vi.fn(),
    addScreenshot: vi.fn(),
    createSession: vi.fn().mockResolvedValue("new-session-id"),
    database: {
      put: vi.fn().mockResolvedValue({ ok: true }),
    },
    mergeSession: vi.fn(),
  }),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/utils", () => ({
  encodeTitle: (title: string) => title.replace(/\s+/g, "-"),
}));

vi.mock("~/vibes.diy/app/contexts/CookieConsentContext", () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: false,
    setMessageHasBeenSent: vi.fn(),
  }),
}));

// Import the component under test after mocks
import SessionWrapper from "../../pkg/app/routes/home.js";

describe("SessionWrapper Hook Ordering", () => {
  let consoleErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Spy on console.error to catch React hook violations
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Reset mocks
    mockNavigate = vi.fn();
    mockParams = {};
    mockLocation = { search: "", pathname: "/", state: null };
    mockLoaderData = { urlPrompt: null, urlModel: null };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("should maintain consistent hook ordering when navigating from ?prompt parameter", async () => {
    // Set up mocks for this test
    mockParams = { sessionId: undefined };
    mockLocation = {
      pathname: "/",
      search: "?prompt=Image+auto-tagger",
      state: null,
    };
    mockLoaderData = {
      urlPrompt: "Image auto-tagger",
      urlModel: null,
    };

    // Initial render with ?prompt parameter (no sessionId)
    render(
      <MemoryRouter initialEntries={["/?prompt=Image+auto-tagger"]}>
        <SessionWrapper />
      </MemoryRouter>,
    );

    // We may briefly set a sessionId before navigation for consistency; either view is acceptable here
    expect(
      screen.queryByTestId("new-session-view") ||
        screen.queryByTestId("session-view"),
    ).toBeInTheDocument();

    // Wait for navigation to be called
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // Verify no React hook errors were logged
    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("hook") ||
            arg.includes("Rendered more hooks") ||
            arg.includes("Rendered fewer hooks")),
      ),
    );

    expect(hookErrors).toEqual([]);
  });

  it("should not violate hook rules when sessionId changes from null to value", async () => {
    // Initial render without sessionId
    mockParams = { sessionId: undefined };
    mockLocation = {
      pathname: "/",
      search: "",
      state: null,
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SessionWrapper />
      </MemoryRouter>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="new-session-view"]'),
      ).toBeInTheDocument();
    });

    // Clean up first render
    unmount();

    // Simulate session creation by updating mock params
    mockParams = { sessionId: "session-123456" };
    mockLocation = {
      pathname: "/chat/session-123456",
      search: "",
      state: null,
    };

    // Render with new sessionId
    render(
      <MemoryRouter initialEntries={["/chat/session-123456"]}>
        <SessionWrapper />
      </MemoryRouter>,
    );

    // Should now show SessionView
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="session-view"]'),
      ).toBeInTheDocument();
    });

    // Verify no hook ordering errors
    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("hook") ||
            arg.includes("Rendered more hooks") ||
            arg.includes("Rendered fewer hooks")),
      ),
    );

    expect(hookErrors).toEqual([]);
  });

  it("should handle ?prompt with ?model parameters without hook violations", async () => {
    // Set up mocks for this test
    mockParams = { sessionId: undefined };
    mockLocation = {
      pathname: "/",
      search: "?prompt=Image+tagger&model=anthropic/claude-sonnet-4.5",
      state: null,
    };
    mockLoaderData = {
      urlPrompt: "Image tagger",
      urlModel: "anthropic/claude-sonnet-4.5",
    };

    render(
      <MemoryRouter
        initialEntries={[
          "/?prompt=Image+tagger&model=anthropic/claude-sonnet-4.5",
        ]}
      >
        <SessionWrapper />
      </MemoryRouter>,
    );

    // Wait for navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // Check navigation was called with both parameters preserved
    const navCall = mockNavigate.mock.calls[0];
    expect(navCall[0]).toContain("prompt=Image+tagger");
    expect(navCall[0]).toContain("model=anthropic%2Fclaude-sonnet-4.5");

    // Verify no hook ordering violations
    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("hook") ||
            arg.includes("Rendered more hooks") ||
            arg.includes("Rendered fewer hooks")),
      ),
    );

    expect(hookErrors).toEqual([]);
  });

  it("should use navigate() instead of window.location.href for redirects", async () => {
    // Set up mocks for this test
    mockParams = { sessionId: undefined };
    mockLocation = {
      pathname: "/",
      search: "?prompt=Test",
      state: null,
    };
    mockLoaderData = {
      urlPrompt: "Test",
      urlModel: null,
    };

    render(
      <MemoryRouter initialEntries={["/?prompt=Test"]}>
        <SessionWrapper />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // Verify navigate() was used instead of window.location.href
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navArgs = mockNavigate.mock.calls[0];
    expect(navArgs[0]).toMatch(/^\/chat\/session-\d+\/Test\?prompt=Test$/);
    expect(navArgs[1]).toBeUndefined();
  });
});
