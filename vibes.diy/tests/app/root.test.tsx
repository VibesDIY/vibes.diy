import React from "react";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
    fireproof: vi.fn(),
    Database: class MockDatabase {},
    DocFileMeta: class MockDocFileMeta {},
    DocBase: {},
    ImgFile: class MockImgFile {},
    toCloud: vi.fn(),
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
  useClerk: () => ({
    client: {},
    session: {},
  }),
  useSession: () => ({
    session: null,
    isLoaded: true,
    isSignedIn: false,
  }),
}));

describe("Root Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset document classes
    document.documentElement.classList.remove("dark");
  });

  // Use server-side rendering here to avoid noisy full-document render output
  // while still verifying that the root layout and core providers compose.
  it("statically renders Layout with children and core providers", () => {
    const html = renderToStaticMarkup(
      <Layout>
        <div data-testid="test-content">Test Child Content</div>
      </Layout>,
    );

    expect(html).toContain("Test Child Content");
    expect(html).toContain('data-testid="cookie-banner"');
  });

  it("renders the ErrorBoundary component with an error", () => {
    const testError = new Error("Test error");

    const res = render(<ErrorBoundary error={testError} params={{}} />);

    // Check that the error message is displayed
    expect(res.getByText("Oops!")).toBeDefined();
    expect(res.getByText("Test error")).toBeDefined();
  });
});
