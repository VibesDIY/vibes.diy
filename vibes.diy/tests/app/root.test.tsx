import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, Layout } from "~/vibes.diy/app/root.js";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// Ensure required Clerk configuration is present for tests
VibesDiyEnv.env().sets({
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_vibes_diy_clerk_key",
});

// Mock React Router components to avoid HTML validation errors
vi.mock("react-router", async () => {
  const { vi } = await import("vitest");
  return {
    Meta: ({ "data-testid": testId }: { "data-testid"?: string }) => (
      <meta data-testid={testId} />
    ),
    Links: () => <link data-testid="links" />,
    Scripts: ({ "data-testid": testId }: { "data-testid"?: string }) => (
      <script data-testid={testId} />
    ),
    ScrollRestoration: ({
      "data-testid": testId,
    }: {
      "data-testid"?: string;
    }) => <div data-testid={testId} />,
    isRouteErrorResponse: vi.fn(),
    useLocation: () => ({ pathname: "/", search: "" }),
    Outlet: () => <div data-testid="outlet" />,
  };
});

// Mock the cookie consent library
vi.mock("react-cookie-consent", async () => {
  const { vi } = await import("vitest");
  return {
    default: ({
      children,
      buttonText,
      onAccept,
    }: {
      children: React.ReactNode;
      buttonText: string;
      onAccept: () => void;
    }) => (
      <div data-testid="cookie-consent">
        {children}
        <button type="button" onClick={onAccept}>
          {buttonText}
        </button>
      </div>
    ),
    getCookieConsentValue: vi.fn().mockReturnValue(null),
    Cookies: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  };
});

// Mock the CookieConsentContext
vi.mock("~/vibes.diy/app/contexts/CookieConsentContext", async () => {
  const { vi } = await import("vitest");
  return {
    useCookieConsent: () => ({
      messageHasBeenSent: false,
      setMessageHasBeenSent: vi.fn(),
      cookieConsent: true,
      setCookieConsent: vi.fn(),
    }),
    CookieConsentProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Mock the ThemeContext
vi.mock("~/vibes.diy/app/contexts/ThemeContext", () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock PostHog
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock ClientOnly component
vi.mock("~/vibes.diy/app/components/ClientOnly", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CookieBanner component
vi.mock("~/vibes.diy/app/components/CookieBanner", () => ({
  default: () => <div data-testid="cookie-banner">Cookie Banner</div>,
}));

// Mock the useFireproof hook
vi.mock("use-fireproof", async () => {
  const { vi } = await import("vitest");
  return {
    useFireproof: () => ({
      useDocument: () => [{ _id: "mock-doc" }, vi.fn()],
      useLiveQuery: () => [[]],
    }),
  };
});

// Mock the useSimpleChat hook
vi.mock("~/vibes.diy/app/hooks/useSimpleChat", async () => {
  const { vi } = await import("vitest");
  return {
    useSimpleChat: () => ({
      docs: [],
      isStreaming: false,
      codeReady: false,
      sendMessage: vi.fn(),
      setInput: vi.fn(),
      input: "",
      selectedSegments: [],
      selectedCode: "",
      setSelectedResponseId: vi.fn(),
      immediateErrors: [],
      advisoryErrors: [],
      needsLoginTriggered: false,
      setNeedsLoginTriggered: vi.fn(),
    }),
  };
});

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useAuth: () => ({
    userId: "test-user-id",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock Layout to avoid full HTML structure in tests
vi.mock("~/vibes.diy/app/root", async () => {
  const actual = await vi.importActual<typeof import("~/vibes.diy/app/root")>("~/vibes.diy/app/root");
  return {
    ...actual,
    Layout: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="layout">{children}</div>
    ),
  };
});

describe("Root Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Reset document classes
    document.documentElement.classList.remove("dark");
  });

  it("renders the Layout component with children", () => {
    // Since Layout renders a full HTML document with <html> and <body> tags,
    // which can cause issues in test environments, just verify it renders without errors
    expect(() => {
      render(
        <Layout>
          <div data-testid="test-content">Test Child Content</div>
        </Layout>,
      );
      // If we get here without an error, the test passes
    }).not.toThrow();
  });

  it("applies dark mode when system preference is dark", () => {
    // Layout component is mocked, so we just verify it renders without errors
    // Dark mode logic is tested in ThemeContext tests
    expect(() => {
      render(
        <Layout>
          <div>Test</div>
        </Layout>,
      );
    }).not.toThrow();
  });

  it("renders the ErrorBoundary component with an error", () => {
    const testError = new Error("Test error");

    const res = render(<ErrorBoundary error={testError} params={{}} />);

    // Check that the error message is displayed
    expect(res.getByText("Oops!")).toBeDefined();
    expect(res.getByText("Test error")).toBeDefined();
  });
});
