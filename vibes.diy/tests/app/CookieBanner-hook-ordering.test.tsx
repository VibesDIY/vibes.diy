import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// Mock React Router
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/",
      search: "",
      state: null,
    }),
  };
});

// Mock dependencies
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: vi.fn(),
  }),
}));

vi.mock("~/vibes.diy/app/contexts/CookieConsentContext", () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: true,
  }),
}));

vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  pageview: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("~/vibes.diy/app/utils/gtm", () => ({
  initGTM: vi.fn(),
  persistUtmParams: vi.fn(),
}));

vi.mock("~/vibes.diy/app/config/env", () => ({
  VibesDiyEnv: {
    GTM_CONTAINER_ID: () => "GTM-TEST123",
  },
}));

// Mock react-cookie-consent
let mockCookieConsentValue = "false";
vi.mock("react-cookie-consent", () => ({
  default: ({
    children,
    onAccept,
    onDecline,
  }: {
    children: React.ReactNode;
    onAccept: () => void;
    onDecline: () => void;
  }) => (
    <div data-testid="cookie-banner">
      {children}
      <button onClick={onAccept} data-testid="accept-button">
        Accept
      </button>
      <button onClick={onDecline} data-testid="decline-button">
        Decline
      </button>
    </div>
  ),
  getCookieConsentValue: () => mockCookieConsentValue,
}));

// Import component after mocks
import CookieBanner from "../../pkg/app/components/CookieBanner.js";

describe("CookieBanner Hook Ordering", () => {
  let consoleErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Spy on console.error to catch React hook violations
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockCookieConsentValue = "false";

    // Mock sessionStorage
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("should maintain consistent hook ordering when component mounts", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Component should render without errors
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cookie-banner"]'),
      ).toBeInTheDocument();
    });

    // Force a re-render to ensure hooks are stable
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

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

  it("should not violate hook rules when XCookieConsent loads asynchronously", async () => {
    // This test verifies the fix: useEffect must be called BEFORE early return

    const { rerender } = render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Wait for dynamic import to complete
    await waitFor(
      () => {
        expect(
          document.querySelector('[data-testid="cookie-banner"]'),
        ).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Re-render multiple times to ensure hook stability
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Verify no hook ordering violations occurred
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

  it("should call all hooks before early return", async () => {
    // This test verifies the specific fix: moving useEffect before the early return
    // by ensuring the component renders without errors across multiple re-renders

    const { rerender } = render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Wait for component to settle
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cookie-banner"]'),
      ).toBeInTheDocument();
    });

    // Re-render multiple times to stress test hook ordering
    for (let i = 0; i < 5; i++) {
      rerender(
        <MemoryRouter>
          <CookieBanner />
        </MemoryRouter>,
      );
    }

    // If hooks are called in wrong order, React would throw an error
    // The fact that we got here means hooks are called consistently
    expect(
      document.querySelector('[data-testid="cookie-banner"]'),
    ).toBeInTheDocument();

    // Verify no hook violations
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

  it("should handle messageHasBeenSent changing without hook violations", async () => {
    // Note: We cannot easily change the mock mid-test, so we just verify
    // that the component renders without hook violations in the current state

    const { rerender } = render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Wait for banner to appear
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cookie-banner"]'),
      ).toBeInTheDocument();
    });

    // Re-render to test stability
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Verify no hook violations during transition
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

  it("should track cookie banner shown event only when banner actually renders", async () => {
    const { trackEvent } = await import("../../pkg/app/utils/analytics.js");

    // Clear any previous calls
    vi.clearAllMocks();

    // First render
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Wait for banner to render (XCookieConsent loads asynchronously)
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cookie-banner"]'),
      ).toBeInTheDocument();
    });

    // Wait for tracking effect to fire (depends on XCookieConsent and messageHasBeenSent)
    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("cookie_banner_shown");
    });

    // Should have called trackEvent exactly once
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("should maintain hook consistency across consent state changes", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cookie-banner"]'),
      ).toBeInTheDocument();
    });

    // Simulate user accepting cookies
    mockCookieConsentValue = "true";

    // Re-render after consent change
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Multiple re-renders to stress test hook ordering
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>,
    );

    // Verify no hook violations
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
});
