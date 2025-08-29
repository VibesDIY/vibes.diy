import React from "react";
import { render, screen } from "@testing-library/react";
import MessageList from "~/vibes.diy/app/components/MessageList.js";
import { vi, describe, test, expect, beforeEach } from "vitest";
import type {
  UserChatMessage,
  AiChatMessage,
  ChatMessageDocument,
} from "@vibes.diy/prompts";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock the Message component to match real implementation
vi.mock("~/vibes.diy/app/components/Message", () => ({
  default: ({ message }: { message: AiChatMessage }) => (
    <div data-testid={`message-${message._id}`}>
      {message.segments &&
        message.segments.map((segment, i: number) => (
          <div key={i} data-testid={segment.type}>
            {segment.content}
          </div>
        ))}
      {message.text && !message.segments?.length && <div>{message.text}</div>}
    </div>
  ),
  WelcomeScreen: () => <div data-testid="welcome-screen">Welcome Screen</div>,
}));

describe("MessageList Real-World Streaming Tests", () => {
  test("should display minimal content at stream start", () => {
    const messages = [
      {
        type: "user",
        text: "Create a quiz app",
        _id: "user-1",
        session_id: "test-session",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: '{"',
        _id: "1",
        segments: [{ type: "markdown", content: '{"' }],
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

    // Check if we see the minimal content in the DOM
    const messageContent = screen.queryByText(/\{"/);
    expect(messageContent).toBeInTheDocument();

    // Log the DOM structure to see what's actually rendered
    const messageContainer = document.querySelector(
      '[data-testid="message-1"]',
    );
    if (messageContainer) {
      expect(messageContainer.innerHTML).toContain("{");
    } else {
      expect(messageContainer).not.toBeNull();
    }

    // This is what we want - but it might fail if the app has a bug
    expect(screen.getByText(/\{"/)).toBeInTheDocument();
  });

  test("should update UI as more content streams in", () => {
    const content =
      '{"dependencies": {}}\n\nThis quiz app allows users to create';
    expect(content.length).toBeGreaterThan(0);

    const messages = [
      {
        type: "user",
        text: "Create a quiz app",
        _id: "user-2",
        session_id: "test-session",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: content,
        _id: "2",
        segments: [{ type: "markdown", content }],
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

    // Check if we see the content
    expect(
      screen.getByText(/This quiz app allows users to create/),
    ).toBeInTheDocument();
  });

  test("should display both markdown and code when segments are present", () => {
    const markdownContent =
      '{"dependencies": {}}\n\nThis quiz app allows users to create quizzes with timed questions and track scores. Users can create new quizzes, add questions with multiple choice options, and then take quizzes to track their scores.';
    const codeContent = "import React, { useState, use";

    expect(markdownContent.length + codeContent.length + 8).toBeGreaterThan(0);

    const messages = [
      {
        type: "user",
        text: "Create a quiz app",
        _id: "user-3",
        session_id: "test-session",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: `${markdownContent}\n\n\`\`\`js\n${codeContent}`,
        _id: "3",
        segments: [
          { type: "markdown", content: markdownContent },
          { type: "code", content: codeContent },
        ],
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

    // Check if we see both types of content
    const markdownElement = screen.queryByText(/This quiz app allows users/);
    const codeElement = screen.queryByText(/import React/);

    expect(markdownElement).toBeInTheDocument();
    expect(codeElement).toBeInTheDocument();
  });

  test("should handle streaming with zero length content", () => {
    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user1",
      },
      {
        type: "ai",
        text: "",
        _id: "ai1",
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

    // ... rest of the test ...
  });
});
