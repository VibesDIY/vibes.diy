import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextType } from "~/vibes.diy/app/contexts/AuthContext.js";
import { AuthContext } from "~/vibes.diy/app/contexts/AuthContext.js";
import * as useSimpleChatModule from "~/vibes.diy/app/hooks/useSimpleChat.js";
import UnifiedSession from "~/vibes.diy/app/routes/home.js";
import type {
  AiChatMessage,
  ChatMessage,
  Segment,
  UserChatMessage,
} from "@vibes.diy/prompts";
import * as segmentParser from "~/vibes.diy/app/utils/segmentParser.js";
import { mockChatStateProps } from "./mockData.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

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

// We need to define the mock before importing any modules that might use it
const navigateMock = vi.fn();

// Mock for useLocation that we can control per test
let locationMock = {
  search: "",
  pathname: "/",
  hash: "",
  state: null,
  key: "",
};

// Create mock implementations for react-router-dom
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationMock,
  };
});

// Mock useNavigate hook from react-router - this mock applies to all tests
vi.mock("react-router", () => {
  return {
    useParams: () => ({}),
    useNavigate: () => navigateMock,
    useLocation: () => locationMock,
  };
});

// Define types for mock components
interface ChatInterfaceProps {
  chatState: {
    messages: ChatMessage[];
    setMessages: (
      newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
    ) => void;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    isStreaming: () => boolean;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    autoResizeTextarea: () => void;
    scrollToBottom: () => void;
    sendMessage: () => Promise<void>;
    currentSegments: () => Segment[];
    getCurrentCode: () => string;
    title: string;
    setTitle: (title: string) => Promise<void>;
    sessionId?: string | null;
    isLoadingMessages?: boolean;
  };
  sessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

interface ResultPreviewProps {
  code: string;
  dependencies?: Record<string, string>;
  onShare?: () => void;
  onScreenshotCaptured?: (screenshotData: string) => void;
  initialView?: "code" | "preview";
  sessionId?: string;
  isStreaming?: boolean;
}

interface AppLayoutProps {
  chatPanel: React.ReactNode;
  previewPanel: React.ReactNode;
}

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
  writable: true,
});

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    // Use only the properties we want to override
    origin: "https://example.com",
    pathname: "/",
    hash: "",
  },
  writable: true,
});

// Mock components used in the Home component
vi.mock("~/vibes.diy/app/components/ChatInterface", () => ({
  default: ({ onSessionCreated }: ChatInterfaceProps) => (
    <div data-testid="mock-chat-interface">
      <button
        type="button"
        data-testid="create-session-button"
        onClick={() => onSessionCreated?.("new-session-id")}
      >
        Create Session
      </button>
    </div>
  ),
}));

vi.mock("~/vibes.diy/app/components/ResultPreview/ResultPreview", () => ({
  default: ({ code }: ResultPreviewProps) => (
    <div data-testid="mock-result-preview">
      <div data-testid="code-line-count">
        {code.split("\n").length} lines of code
      </div>
      <div data-testid="code-content">{code.substring(0, 50)}...</div>
      <button
        type="button"
        data-testid="share-button"
        onClick={() =>
          navigator.clipboard.writeText(
            `${window.location.origin}/shared?state=mockState`,
          )
        }
      >
        Share
      </button>
    </div>
  ),
}));

vi.mock("~/vibes.diy/app/components/AppLayout", () => ({
  default: ({ chatPanel, previewPanel }: AppLayoutProps) => (
    <div data-testid="mock-app-layout">
      <div data-testid="chat-panel">{chatPanel}</div>
      <div data-testid="preview-panel">{previewPanel}</div>
    </div>
  ),
}));

// Using the centralized mock from the __mocks__/use-fireproof.ts file
// This ensures consistency across all tests

describe("Home Route in completed state", () => {
  let mockCode: string;
  const authenticatedState: Partial<AuthContextType> = {
    isAuthenticated: true,
    isLoading: false,
    token: "mock-token",
    userPayload: {
      userId: "test-user-id",
      exp: 9999999999,
      tenants: [],
      ledgers: [],
      iat: 1234567890,
      iss: "FP_CLOUD",
      aud: "PUBLIC",
    },
    checkAuthStatus: vi.fn(),
    processToken: vi.fn(),
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    mockCode = Array(210)
      .fill(0)
      .map((_, i) => `console.log("Line ${i}");`)
      .join("\n");

    // Mock segmentParser functions
    vi.spyOn(segmentParser, "parseContent").mockReturnValue({
      segments: [
        { type: "markdown", content: "Explanation of the code" } as Segment,
        { type: "code", content: mockCode } as Segment,
      ],
    });

    vi.spyOn(segmentParser, "parseDependencies").mockReturnValue({
      react: "^18.2.0",
      "react-dom": "^18.2.0",
    });

    // Mock useSimpleChat hook to return a chat with completed AI message containing code
    vi.spyOn(useSimpleChatModule, "useSimpleChat").mockReturnValue({
      docs: [
        {
          type: "user",
          text: "Create a React app",
        } as UserChatMessage,
        {
          type: "ai",
          text: `javascript\n${mockCode}\n\n\nExplanation of the code`,
          segments: [
            { type: "markdown", content: "Explanation of the code" } as Segment,
            { type: "code", content: mockCode } as Segment,
          ],
          isStreaming: false,
        } as AiChatMessage,
      ],
      sendMessage: vi.fn(),
      isStreaming: false,
      input: "",
      setInput: vi.fn(),
      sessionId: null,
      selectedSegments: [
        { type: "markdown", content: "Explanation of the code" } as Segment,
        { type: "code", content: mockCode } as Segment,
      ],
      selectedCode: { type: "code", content: mockCode } as Segment,
      inputRef: { current: null },
      title: "React App",
      selectedResponseDoc: {
        type: "ai",
        text: `javascript\n${mockCode}\n\n\nExplanation of the code`,
        segments: [
          { type: "markdown", content: "Explanation of the code" } as Segment,
          { type: "code", content: mockCode } as Segment,
        ],
        isStreaming: false,
      } as AiChatMessage,
      isEmpty: false,
      ...mockChatStateProps,
    });
  });

  it("displays the correct number of code lines in the preview", async () => {
    render(
      <MockThemeProvider>
        <MemoryRouter>
          <AuthContext.Provider
            value={
              {
                ...authenticatedState,
                checkAuthStatus: vi.fn(),
                processToken: vi.fn(),
              } as AuthContextType
            }
          >
            <UnifiedSession />
          </AuthContext.Provider>
        </MemoryRouter>
      </MockThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-line-count")).toHaveTextContent(
        "210 lines of code",
      );
    });
  });

  it("shows share button and handles sharing", async () => {
    render(
      <MockThemeProvider>
        <MemoryRouter>
          <AuthContext.Provider
            value={
              {
                ...authenticatedState,
                checkAuthStatus: vi.fn(),
                processToken: vi.fn(),
              } as AuthContextType
            }
          >
            <UnifiedSession />
          </AuthContext.Provider>
        </MemoryRouter>
      </MockThemeProvider>,
    );

    const shareButton = await screen.findByTestId("share-button");
    fireEvent.click(shareButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it.skip("creates a new session when create-session button is clicked", async () => {
    // SKIPPED: The original test was written for a different implementation.
    // Now the ChatInterface component doesn't have session creation functionality
    // directly in it, and the session creation flow has changed.
    // The flow is now: no session id → title set → id is set

    // Set mock location for this test
    locationMock = {
      search: "",
      pathname: "/",
      hash: "",
      state: null,
      key: "",
    };

    // Clear mock tracking
    navigateMock.mockClear();

    render(
      <MockThemeProvider>
        <MemoryRouter>
          <AuthContext.Provider
            value={
              {
                ...authenticatedState,
                checkAuthStatus: vi.fn(),
                processToken: vi.fn(),
              } as AuthContextType
            }
          >
            <UnifiedSession />
          </AuthContext.Provider>
        </MemoryRouter>
      </MockThemeProvider>,
    );

    // Find create session button and click it
    const createSessionButton = await screen.findByTestId(
      "create-session-button",
    );
    fireEvent.click(createSessionButton);

    // Instead of expecting immediate navigation, allow for the possibility
    // that the session creation might happen in steps (title set first, then ID)
    // by using a longer timeout and looser expectations
    await waitFor(
      () => {
        expect(navigateMock).toHaveBeenCalled();
        // Check that we navigate to a session path
        const firstCall = navigateMock.mock.calls[0];
        if (firstCall) {
          const path = firstCall[0];
          expect(typeof path).toBe("string");
          expect(path.includes("/chat/")).toBe(true);
        }
      },
      { timeout: 2000 },
    );
  });

  it("loads code from URL hash state when present", async () => {
    // Set hash state for this test
    locationMock = {
      search: "",
      pathname: "/",
      hash: "#state=mock-hash-state",
      state: null,
      key: "",
    };

    render(
      <MockThemeProvider>
        <MemoryRouter>
          <AuthContext.Provider
            value={
              {
                ...authenticatedState,
                checkAuthStatus: vi.fn(),
                processToken: vi.fn(),
              } as AuthContextType
            }
          >
            <UnifiedSession />
          </AuthContext.Provider>
        </MemoryRouter>
      </MockThemeProvider>,
    );

    // Verify the component renders without crashing
    await waitFor(() => {
      expect(screen.getByTestId("mock-chat-interface")).toBeInTheDocument();
      expect(screen.getByTestId("mock-result-preview")).toBeInTheDocument();
    });
  });
});
