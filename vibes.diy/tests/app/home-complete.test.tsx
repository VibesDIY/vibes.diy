import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
// import * as useSimpleChatModule from "~/vibes.diy/app/hooks/useSimpleChat.js";
import Home from "~/vibes.diy/app/routes/home.js";
import type {
  AiChatMessage,
  ChatMessage,
  Segment,
  UserChatMessage,
} from "@vibes.diy/prompts";

// Define mocks using vi.hoisted to ensure they are available to hoisted vi.mock calls
const mocks = vi.hoisted(() => {
  return {
    navigateMock: vi.fn(),
    mockParams: { value: {} as Record<string, string | undefined> },
    locationMock: {
      search: "",
      pathname: "/",
      hash: "",
      state: null,
      key: "",
    },
    mockUseAuth: vi.fn(),
    cookieConsentSetMessageHasBeenSent: vi.fn(),
  };
});

// Mock the CookieConsentContext
vi.mock("~/vibes.diy/app/contexts/CookieConsentContext", () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: false,
    setMessageHasBeenSent: mocks.cookieConsentSetMessageHasBeenSent,
  }),
  CookieConsentProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Create mock implementations for react-router (note: not react-router-dom)
vi.mock("react-router", async () => {
  const { vi } = await import("vitest");
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
    useLocation: () => mocks.locationMock,
    useParams: () => mocks.mockParams.value,
    useLoaderData: () => ({ urlPrompt: null, urlModel: null }),
  };
});

// Define types for mock components
interface _ChatInterfaceProps {
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

interface _ResultPreviewProps {
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

// Mock the new session architecture components
vi.mock("~/vibes.diy/app/components/NewSessionView", () => ({
  default: ({ onSessionCreate }: { onSessionCreate: (id: string) => void }) => (
    <div data-testid="new-session-view">
      <div data-testid="mock-chat-interface">
        <button
          type="button"
          data-testid="create-session-button"
          onClick={() => onSessionCreate("new-session-id")}
        >
          Create Session
        </button>
      </div>
    </div>
  ),
}));

vi.mock("~/vibes.diy/app/components/SessionView", () => ({
  default: ({
    urlPrompt,
    urlModel,
  }: {
    urlPrompt?: string | null;
    urlModel?: string | null;
  }) => (
    <div data-testid="session-view">
      <div data-testid="mock-chat-interface">Chat Interface</div>
      <div data-testid="mock-result-preview">
        <div data-testid="code-line-count">210 lines of code</div>
        {urlPrompt && <div data-testid="url-prompt">{urlPrompt}</div>}
        {urlModel && <div data-testid="url-model">{urlModel}</div>}
        <div data-testid="code-content">console.log("Line 0");...</div>
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

// Mock segmentParser functions
vi.mock("@vibes.diy/prompts", async (original) => {
  const mockCode = Array(210)
    .fill(0)
    .map((_, i) => `console.log("Line ${i}");`)
    .join("\n");
  const all = (await original()) as typeof import("@vibes.diy/prompts");
  return {
    ...all,
    parseContent: () => ({
      segments: [
        { type: "markdown", content: "Explanation of the code" } as Segment,
        { type: "code", content: mockCode } as Segment,
      ],
    }),
  };
});

// Mock useSimpleChat hook
vi.mock("~/vibes.diy/app/hooks/useSimpleChat", async (original) => {
  const { vi } = await import("vitest");
  const mockCode = Array(210)
    .fill(0)
    .map((_, i) => `console.log("Line ${i}");`)
    .join("\n");
  const { mockChatStateProps } = await import("./mockData.js");
  const all =
    (await original()) as typeof import("~/vibes.diy/app/hooks/useSimpleChat.js");
  return {
    ...all,
    useSimpleChat: vi.fn().mockReturnValue({
      docs: [
        {
          type: "user",
          text: "Create a React app",
        } as UserChatMessage,
        {
          type: "ai",
          text: `   javascript\n${mockCode}\n   \n\nExplanation of the code`,
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
        text: `   javascript\n${mockCode}\n   \n\nExplanation of the code`,
        segments: [
          { type: "markdown", content: "Explanation of the code" } as Segment,
          { type: "code", content: mockCode } as Segment,
        ],
        isStreaming: false,
      } as AiChatMessage,
      isEmpty: false,
      ...mockChatStateProps,
    }),
  };
});

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: mocks.mockUseAuth,
}));

describe("Home Route in completed state", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset mock params
    mocks.mockParams.value = {};

    // vi.spyOn(segmentParser, "parseDependencies").mockReturnValue({
    //   react: "^18.2.0",
    //   "react-dom": "^18.2.0",
    // });
  });

  it("displays the correct number of code lines in the preview when session exists", async () => {
    // Set mock params to simulate sessionId in URL
    mocks.mockParams.value = { sessionId: "test-session-123" };
    mocks.mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      userId: "test-user-id",
    });

    render(
      <MemoryRouter initialEntries={["/chat/test-session-123"]}>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-line-count")).toHaveTextContent(
        "210 lines of code",
      );
    });
  });

  it("shows share button and handles sharing when session exists", async () => {
    // Set mock params to simulate sessionId in URL
    mocks.mockParams.value = { sessionId: "test-session-123" };
    mocks.mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      userId: "test-user-id",
    });

    render(
      <MemoryRouter initialEntries={["/chat/test-session-123"]}>
        <Home />
      </MemoryRouter>,
    );

    const shareButton = await screen.findByTestId("share-button");
    fireEvent.click(shareButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it.skip("creates a new session when create-session button is clicked", async () => {
    // Set mock location for this test
    Object.assign(mocks.locationMock, {
      search: "",
      pathname: "/",
      hash: "",
      state: null,
      key: "",
    });

    // Clear mock tracking
    mocks.navigateMock.mockClear();
    mocks.mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      userId: "test-user-id",
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
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
        expect(mocks.navigateMock).toHaveBeenCalled();
        // Check that we navigate to a session path
        const firstCall = mocks.navigateMock.mock.calls[0];
        if (firstCall) {
          const path = firstCall[0];
          expect(typeof path).toBe("string");
          expect(path.includes("/chat/")).toBe(true);
        }
      },
      { timeout: 2000 },
    );
  });

  it("renders NewSessionView by default when no session in URL", async () => {
    // Clear mock params to simulate no sessionId in URL
    mocks.mockParams.value = {};
    mocks.mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      userId: "test-user-id",
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>,
    );

    // Should render new session view by default
    await waitFor(() => {
      expect(screen.getByTestId("new-session-view")).toBeInTheDocument();
      expect(screen.getByTestId("mock-chat-interface")).toBeInTheDocument();
    });
  });
});
