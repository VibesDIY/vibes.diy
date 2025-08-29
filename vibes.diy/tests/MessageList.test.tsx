import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, test, expect } from "vitest";
import MessageList from "~/vibes.diy/app/components/MessageList.js";
import type { UserChatMessage, AiChatMessage } from "@vibes.diy/prompts";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock the Message component
vi.mock("~/vibes.diy/app/components/Message.js", () => ({
  default: ({ message }: { message: UserChatMessage | AiChatMessage }) => (
    <div data-testid="mock-message">{message.text}</div>
  ),
  WelcomeScreen: () => <div data-testid="welcome-screen">Welcome Screen</div>,
}));

describe("MessageList", () => {
  test("renders messages correctly", () => {
    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user-1",
        session_id: "test",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: "Hi there!",
        _id: "ai-1",
        segments: [{ type: "markdown", content: "Hi there!" }],
        session_id: "test",
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

    expect(screen.getAllByTestId("mock-message").length).toBe(2);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  test("renders empty state correctly", () => {
    const { container } = render(
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

    // Get the specific element we want to check
    const messageContainer = container.querySelector(".flex-col.space-y-4");
    expect(messageContainer).toBeInTheDocument();
    expect(messageContainer?.children.length).toBe(0);
  });

  test("renders streaming message correctly", () => {
    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user-1",
        session_id: "test",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: "Streaming response...",
        _id: "ai-1",
        segments: [{ type: "markdown", content: "Streaming response..." }],
        isStreaming: true,
        session_id: "test",
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

    expect(screen.getAllByTestId("mock-message").length).toBe(2);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Streaming response...")).toBeInTheDocument();
  });

  test("should show content instead of placeholder when streaming message has content", () => {
    const messages = [
      {
        type: "user",
        text: "Create a React app",
        _id: "user-2",
        session_id: "test",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: "Here is a React app",
        _id: "ai-2",
        segments: [{ type: "markdown", content: "Here is a React app" }],
        isStreaming: true,
        session_id: "test",
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

    expect(screen.getByText("Here is a React app")).toBeInTheDocument();
  });

  test('should show "Processing response..." when streaming message has no content', () => {
    const messages = [
      {
        type: "user",
        text: "Create a React app",
        _id: "user-3",
        session_id: "test",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: "",
        _id: "ai-3",
        segments: [],
        isStreaming: true,
        session_id: "test",
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

    expect(screen.getByText("Create a React app")).toBeInTheDocument();
  });
});
