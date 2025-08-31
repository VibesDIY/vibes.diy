import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "~/vibes.diy/app/contexts/AuthContext.js";
import type { TokenPayload } from "~/vibes.diy/app/utils/auth.js";
import Remix from "~/vibes.diy/app/routes/remix.js";

// Mock useLazyFireproof first
vi.mock("~/vibes.diy/app/hooks/useLazyFireproof", () => ({
  useLazyFireproof: () => ({
    useDocument: () => ({
      doc: { _id: "test-id", type: "user" },
      merge: vi.fn(),
      submit: vi.fn().mockResolvedValue({ ok: true }),
      save: vi.fn(),
    }),
    useLiveQuery: () => ({ docs: [] }),
    database: { get: vi.fn(), put: vi.fn() },
    open: vi.fn(),
  }),
}));

// Mock the Session hooks
vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: () => ({
    session: {
      _id: "test-session-id",
      title: "Test Session",
      publishedUrl: "",
      firehoseShared: false,
    },
    docs: [],
    sessionDatabase: {
      get: vi.fn().mockImplementation((id) => {
        if (id === "vibe") {
          return Promise.resolve({ _id: "vibe", created_at: Date.now() });
        }
        throw new Error("Not found");
      }),
      put: vi.fn().mockResolvedValue({ ok: true }),
    },
    openSessionDatabase: vi.fn().mockResolvedValue({}),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updatePublishedUrl: vi.fn(),
    updateFirehoseShared: vi.fn(),
    addScreenshot: vi.fn(),
    userMessage: {
      _id: "user-msg",
      type: "user",
      session_id: "test-session-id",
      text: "",
      created_at: Date.now(),
    },
    aiMessage: {
      _id: "ai-msg",
      type: "ai",
      session_id: "test-session-id",
      text: "",
      created_at: Date.now(),
    },
    vibeDoc: {
      _id: "vibe",
      title: "",
      encodedTitle: "",
      created_at: Date.now(),
      remixOf: "",
    },
    mergeUserMessage: vi.fn(),
    saveUserMessage: vi.fn(),
    submitUserMessage: vi.fn(),
    mergeAiMessage: vi.fn(),
    saveAiMessage: vi.fn(),
    submitAiMessage: vi.fn(),
    mergeVibeDoc: vi.fn(),
  }),
}));

// Create a wrapper component with auth context
const renderWithAuthContext = (
  ui: React.ReactNode,
  { isAuthenticated = true, userId = "test-user-id" } = {},
) => {
  const userPayload: TokenPayload | null = isAuthenticated
    ? {
        userId,
        exp: 9999999999,
        tenants: [],
        ledgers: [],
        iat: 1234567890,
        iss: "FP_CLOUD",
        aud: "PUBLIC",
      }
    : null;

  const authValue = {
    token: isAuthenticated ? "test-token" : null,
    isAuthenticated,
    isLoading: false,
    userPayload,
    checkAuthStatus: vi.fn(() => Promise.resolve()),
    processToken: vi.fn(),
    needsLogin: false,
    setNeedsLogin: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>,
  );
};

// Mock the API Key hook
vi.mock("~/vibes.diy/app/hooks/useApiKey", () => ({
  useApiKey: () => ({
    apiKey: "test-api-key",
  }),
}));

// Mock variables for React Router
const navigateMock = vi.fn();
let locationMock = {
  search: "?prompt=Make+it+pink",
  pathname: "/remix/test-app-slug",
};

// Mock React Router
vi.mock("react-router-dom", () => ({
  useParams: () => ({ vibeSlug: "test-app-slug" }),
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
}));

// Mock fetch
global.fetch = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    text: () =>
      Promise.resolve(
        "export default function App() { return <div>Test App</div>; }",
      ),
    json: () => Promise.resolve({}),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
  });
});

// Mock the utils
vi.mock("~/components/SessionSidebar/utils", () => ({
  encodeTitle: (title: string) => title,
}));

// Mock database manager
vi.mock("~/vibes.diy/app/utils/databaseManager", () => ({
  getSessionDatabaseName: vi
    .fn()
    .mockImplementation((id) => `session-${id || "default"}`),
}));

describe("Remix Route", () => {
  beforeEach(() => {
    // Reset mocks before each test
    navigateMock.mockReset();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue("test-auth-token"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it("should process vibe slug and navigate with prompt parameter", async () => {
    // Set up location with prompt parameter
    locationMock = {
      search: "?prompt=Make+it+pink",
      pathname: "/remix/test-app-slug",
    };

    renderWithAuthContext(<Remix />);
    // Verify loading screen is displayed
    expect(screen.getByText(/REMIXING TEST-APP-SLUG/i)).toBeInTheDocument();

    // Wait for the navigation to occur with the prompt parameter
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
      // Check that the URL contains the expected parts
      const callArg = navigateMock.mock.calls[0][0];
      expect(callArg).toContain("/chat/");
      expect(callArg).toContain("/chat?prompt=Make");
    });
  });

  it("should handle missing prompt parameter correctly", async () => {
    // Set up location without prompt parameter
    locationMock = { search: "", pathname: "/remix/test-app-slug" };

    renderWithAuthContext(<Remix />);

    // Wait for the navigation to occur without prompt parameter
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/chat\/.*\/.*\/chat$/),
      );
      expect(navigateMock).not.toHaveBeenCalledWith(
        expect.stringMatching(/\?prompt=/),
      );
    });
  });
});
