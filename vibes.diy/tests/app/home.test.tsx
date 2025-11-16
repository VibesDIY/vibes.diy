import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnifiedSession from "~/vibes.diy/app/routes/home.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock Clerk
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  useUser: () => ({ user: { id: "test-user-id" } }),
  useSignIn: () => ({ signIn: null }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock the CookieConsentContext
vi.mock("~/vibes.diy/app/contexts/CookieConsentContext", () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: false,
    setMessageHasBeenSent: vi.fn(),
  }),
  CookieConsentProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock dependencies
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

// Mock the useSession hook
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

// Using centralized mock from __mocks__/use-fireproof.ts

// Create mock implementations for react-router (note: not react-router-dom)
let mockParams: Record<string, string | undefined> = {};
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => mockParams,
    useLocation: () => ({ search: "", pathname: "/" }),
    useLoaderData: () => ({ urlPrompt: null, urlModel: null }),
  };
});

// Mock for the utility functions
vi.mock("~/vibes.diy/app/utils/sharing", () => ({
  decodeStateFromUrl: () => ({ code: "", dependencies: {} }),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/utils", () => ({
  encodeTitle: (title: string) => title,
}));

// Mock AppLayout component to make testing easier
vi.mock("~/vibes.diy/app/components/AppLayout", () => {
  return {
    __esModule: true,
    default: ({
      chatPanel,
      previewPanel,
      chatInput,
      suggestionsComponent,
    }: {
      chatPanel: React.ReactNode;
      previewPanel: React.ReactNode;
      chatInput?: React.ReactNode;
      suggestionsComponent?: React.ReactNode;
    }) => {
      return (
        <div data-testid="app-layout">
          <div data-testid="chat-panel">{chatPanel}</div>
          <div data-testid="preview-panel">{previewPanel}</div>
          {chatInput && (
            <div data-testid="chat-input-container">{chatInput}</div>
          )}
          {suggestionsComponent && (
            <div data-testid="suggestions-container">
              {suggestionsComponent}
            </div>
          )}
        </div>
      );
    },
  };
});

// Mock NewSessionView and SessionView components
vi.mock("~/vibes.diy/app/components/NewSessionView", () => {
  return {
    __esModule: true,
    default: ({
      onSessionCreate,
    }: {
      onSessionCreate: (id: string) => void;
    }) => {
      return (
        <div data-testid="new-session-view">
          <div data-testid="chat-interface">Chat Interface</div>
          <button
            data-testid="create-session"
            onClick={() => onSessionCreate("test-session-id")}
          >
            Create Session
          </button>
        </div>
      );
    },
  };
});

vi.mock("~/vibes.diy/app/components/SessionView", () => {
  return {
    __esModule: true,
    default: ({
      urlPrompt,
      urlModel,
    }: {
      urlPrompt?: string | null;
      urlModel?: string | null;
    }) => {
      return (
        <div data-testid="session-view">
          <div data-testid="chat-interface">Chat Interface</div>
          <div data-testid="result-preview">Result Preview</div>
          {urlPrompt && <div data-testid="url-prompt">{urlPrompt}</div>}
          {urlModel && <div data-testid="url-model">{urlModel}</div>}
        </div>
      );
    },
  };
});

// Remove this mock since we're now mocking at the component level

describe("Home Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock params
    mockParams = {};
  });

  it("should render NewSessionView when no sessionId in URL", async () => {
    // Ensure mockParams is empty for this test
    mockParams = {};

    render(
      <MockThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <UnifiedSession />
        </MemoryRouter>
      </MockThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("new-session-view")).toBeInTheDocument();
      expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    });
  });

  it("should render SessionView when sessionId exists in URL", async () => {
    // Set mock params to simulate sessionId in URL
    mockParams = { sessionId: "test-session-123" };

    render(
      <MockThemeProvider>
        <MemoryRouter initialEntries={["/chat/test-session-123"]}>
          <UnifiedSession />
        </MemoryRouter>
      </MockThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("session-view")).toBeInTheDocument();
      // Use a more specific selector within the session-view
      const sessionView = screen.getByTestId("session-view");
      expect(
        sessionView.querySelector('[data-testid="chat-interface"]'),
      ).toBeInTheDocument();
    });
  });
});
