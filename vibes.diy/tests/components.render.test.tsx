import React from "react";
// Vitest will automatically use mocks from __mocks__ directory
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockUseAuth,
  resetMockAuthState,
  setMockAuthState,
} from "./__mocks__/useAuth.js";
import ChatHeader from "~/vibes.diy/app/components/ChatHeaderContent.js";
import MessageList from "~/vibes.diy/app/components/MessageList.js";
import SessionSidebar from "~/vibes.diy/app/components/SessionSidebar.js";
import type { AuthContextType } from "~/vibes.diy/app/contexts/AuthContext.js";
import type {
  AiChatMessage,
  ChatMessageDocument,
  UserChatMessage,
} from "@vibes.diy/prompts";
import { mockSessionSidebarProps } from "./mockData.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock dependencies
vi.mock("react-markdown", () => {
  return {
    default: vi.fn(({ children }: { children: string }) => {
      // Use React.createElement instead of JSX
      return React.createElement(
        "div",
        { "data-testid": "markdown" },
        children,
      );
    }),
  };
});

// Mock the scrollIntoView method
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock the useAuth hook for SessionSidebar
vi.mock("~/vibes.diy/app/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the useSessionMessages hook for MessageList
vi.mock("~/vibes.diy/app/hooks/useSessionMessages", () => {
  return {
    useSessionMessages: (sessionId: string | null) => {
      // Check the sessionId to determine what to return
      if (sessionId === "streaming-session") {
        return {
          messages: [
            {
              type: "ai",
              text: "I am thinking...",
              segments: [{ type: "markdown", content: "I am thinking..." }],
              isStreaming: true,
              timestamp: Date.now(),
            },
          ],
          isLoading: false,
          addUserMessage: vi.fn(),
          updateAiMessage: vi.fn(),
        };
      }
      if (sessionId === "empty-session-streaming") {
        return {
          messages: [
            { type: "user", text: "Hello", timestamp: Date.now() },
            {
              type: "ai",
              text: "",
              segments: [],
              isStreaming: true,
              timestamp: Date.now(),
            },
          ],
          isLoading: false,
          addUserMessage: vi.fn(),
          updateAiMessage: vi.fn(),
        };
      }
      if (sessionId === "test-session") {
        return {
          messages: [
            { type: "user", text: "Hello", timestamp: Date.now() },
            {
              type: "ai",
              text: "Hi there",
              segments: [{ type: "markdown", content: "Hi there" }],
              timestamp: Date.now(),
            },
          ],
          isLoading: false,
          addUserMessage: vi.fn(),
          updateAiMessage: vi.fn(),
        };
      }
      return {
        messages: [],
        isLoading: false,
        addUserMessage: vi.fn(),
        updateAiMessage: vi.fn(),
      };
    },
  };
});

// Create mock functions we can control
const onOpenSidebar = vi.fn();

// Wrapper providing controlled context value

describe("Component Rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetMockAuthState();
  });

  describe("ChatHeader", () => {
    it("renders without crashing", () => {
      render(
        <MockThemeProvider>
          <ChatHeader
            onOpenSidebar={onOpenSidebar}
            title="Test Chat"
            isStreaming={false}
            codeReady={false}
          />
        </MockThemeProvider>,
      );
      expect(screen.getByText("Test Chat")).toBeInTheDocument();
    });

    it("applies tooltip classes correctly", () => {
      render(
        <MockThemeProvider>
          <ChatHeader
            onOpenSidebar={onOpenSidebar}
            title="Test Chat"
            isStreaming={false}
            codeReady={false}
          />
        </MockThemeProvider>,
      );
      expect(
        screen.getByText("New Vibe", { selector: "span.pointer-events-none" }),
      ).toBeInTheDocument();
    });

    it("handles new chat button click", () => {
      render(
        <MockThemeProvider>
          <ChatHeader
            onOpenSidebar={onOpenSidebar}
            title="Test Chat"
            isStreaming={false}
            codeReady={false}
          />
        </MockThemeProvider>,
      );

      // Just verify the new vibe button exists since we can't easily mock document.location
      const newVibeButton = screen.getByLabelText("New Vibe");
      expect(newVibeButton).toBeInTheDocument();

      // Note: we can't reliably test the navigation in JSDOM environment
      // In a real browser, clicking this button would navigate to '/'
    });
  });

  describe("SessionSidebar", () => {
    const authenticatedState: Partial<AuthContextType> = {
      isAuthenticated: true,
      isLoading: false,
      userPayload: {
        userId: "test-user",
        exp: 9999,
        tenants: [],
        ledgers: [],
        iat: 1234567890,
        iss: "FP_CLOUD",
        aud: "PUBLIC",
      },
    };
    const unauthenticatedState: Partial<AuthContextType> = {
      isAuthenticated: false,
      isLoading: false,
      userPayload: null,
    };

    it("renders in hidden state", async () => {
      const props = { ...mockSessionSidebarProps, isVisible: false };
      setMockAuthState(authenticatedState);
      render(
        <MockThemeProvider>
          <SessionSidebar {...props} />
        </MockThemeProvider>,
      );
      const sidebarElement = await screen.findByTestId("session-sidebar");
      expect(sidebarElement).toHaveClass("-translate-x-full");
    });

    it("renders in visible state", async () => {
      const props = { ...mockSessionSidebarProps, isVisible: true };
      setMockAuthState(authenticatedState);
      render(
        <MockThemeProvider>
          <SessionSidebar {...props} />
        </MockThemeProvider>,
      );
      const sidebarElement = await screen.findByTestId("session-sidebar");
      expect(sidebarElement).not.toHaveClass("-translate-x-full");
    });

    it("shows navigation menu items when authenticated", async () => {
      const props = { ...mockSessionSidebarProps, isVisible: true };
      setMockAuthState(authenticatedState);
      render(
        <MockThemeProvider>
          <SessionSidebar {...props} />
        </MockThemeProvider>,
      );
      expect(await screen.findByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("My Vibes")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
    });

    it("shows Login button when not authenticated", async () => {
      const props = { ...mockSessionSidebarProps, isVisible: true };
      setMockAuthState(unauthenticatedState);
      render(
        <MockThemeProvider>
          <SessionSidebar {...props} />
        </MockThemeProvider>,
      );
      expect(await screen.findByText("Log in")).toBeInTheDocument();
      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    });

    it("has a close button that works", () => {
      const onCloseMock = vi.fn();
      const props = {
        ...mockSessionSidebarProps,
        isVisible: true,
        onClose: onCloseMock,
      };
      setMockAuthState(authenticatedState);
      render(
        <MockThemeProvider>
          <SessionSidebar {...props} />
        </MockThemeProvider>,
      );
      fireEvent.click(screen.getByLabelText("Close sidebar"));
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe("MessageList", () => {
    it("renders empty list", () => {
      render(
        <MockThemeProvider>
          <MessageList
            messages={[]}
            isStreaming={false}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );

      // Verify the container is rendered but empty
      const messageContainer = document.querySelector(".flex-col.space-y-4");
      expect(messageContainer).toBeInTheDocument();
      expect(messageContainer?.children.length).toBe(0);
    });

    it("renders messages correctly", () => {
      const messages = [
        {
          type: "user" as const,
          text: "Hello",
          _id: "user-1",
          session_id: "test-session",
          created_at: Date.now(),
        } as UserChatMessage,
        {
          type: "ai" as const,
          text: "Hi there",
          _id: "ai-1",
          segments: [{ type: "markdown", content: "Hi there" }],
          session_id: "test-session",
          created_at: Date.now(),
        } as AiChatMessage,
      ];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={false}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there")).toBeInTheDocument();
    });

    it("renders placeholder text when streaming with no content", () => {
      const messages = [
        {
          type: "user" as const,
          text: "Hello",
          _id: "user-2",
          session_id: "test-session",
          created_at: Date.now(),
        } as UserChatMessage,
        {
          type: "ai" as const,
          text: "",
          _id: "ai-2",
          segments: [],
          isStreaming: true,
          session_id: "test-session",
          created_at: Date.now(),
        } as AiChatMessage,
      ];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={true}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
      // The Message component in our test displays "Processing response..." in a markdown element
      // when there's no content but streaming is true
      expect(screen.getAllByTestId("markdown").length).toBeGreaterThan(0);
    });

    it("renders streaming message", () => {
      const messages = [
        {
          type: "ai" as const,
          text: "I am thinking...",
          _id: "streaming-1",
          segments: [{ type: "markdown", content: "I am thinking..." }],
          isStreaming: true,
          session_id: "test-session",
          created_at: Date.now(),
        } as AiChatMessage,
      ];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={true}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
      expect(screen.getByText("I am thinking...")).toBeInTheDocument();
    });

    it("renders without crashing", () => {
      render(
        <MockThemeProvider>
          <MessageList
            messages={[]}
            isStreaming={false}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
    });

    it("renders messages with no streaming", () => {
      const messages = [
        {
          _id: "1",
          type: "user",
          text: "Hello, world!",
        },
        {
          _id: "2",
          type: "ai",
          text: "Hi there!",
        },
      ] as ChatMessageDocument[];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={false}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
    });

    it("renders messages with streaming", () => {
      const messages = [
        {
          _id: "1",
          type: "user",
          text: "Hello, world!",
        },
        {
          _id: "2",
          type: "ai",
          text: "Hi there!",
        },
      ] as ChatMessageDocument[];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={true}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
    });

    it("renders AI messages with streaming segments", () => {
      const messages = [
        {
          _id: "1",
          type: "ai",
          text: "This is a streaming message",
          segments: [
            { type: "markdown", content: "This is a " },
            { type: "code", content: 'const x = "streaming message";' },
          ],
        },
      ] as unknown as ChatMessageDocument[];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={true}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );
    });

    it("MessageList renders correctly with segments", () => {
      const messages = [
        {
          _id: "user1",
          type: "user" as const,
          text: "Hello",
        },
        {
          _id: "ai1",
          type: "ai" as const,
          text: "This is a test",
          segments: [{ type: "markdown", content: "This is a test" }],
        },
      ] as unknown as ChatMessageDocument[];

      render(
        <MockThemeProvider>
          <MessageList
            messages={messages}
            isStreaming={false}
            setSelectedResponseId={() => {
              /* no-op */
            }}
            selectedResponseId=""
            setMobilePreviewShown={() => {
              /* no-op */
            }}
            navigateToView={() => {
              /* no-op */
            }}
          />
        </MockThemeProvider>,
      );

      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("This is a test")).toBeInTheDocument();
    });
  });
});
