import React from "react";
import { render, screen } from "@testing-library/react";
import MessageList from "~/vibes.diy/app/components/MessageList.js";
import { vi, describe, test, expect, beforeEach } from "vitest";
import type { ChatMessageDocument } from "@vibes.diy/prompts";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock scrollIntoView
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock Message component to simplify testing
vi.mock("~/vibes.diy/app/components/Message", () => ({
  default: ({
    message,
  }: {
    message: { text?: string; segments: { type: string; content: string }[] };
  }) => (
    <div data-testid="mock-message">
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

describe("MessageList streaming tests", () => {
  test("should display minimal content at stream start", () => {
    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user1",
      },
      {
        type: "ai",
        text: "{",
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

    // Test that the very basic first character of the stream is visible
    const minimalContent = "{";
    const visibleContent = screen.getByText(minimalContent);
    expect(visibleContent).toBeInTheDocument();
  });

  test("should update UI as more content streams in", () => {
    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user1",
      },
      {
        type: "ai",
        text: '{"dependencies": {}}\n\nThis qui',
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

    // Check that the partial content is visible
    const partialContent = screen.getByText(/This qui/);
    expect(partialContent).toBeInTheDocument();
  });

  // Add more tests for specific streaming behaviors

  test("should display both markdown and code when segments are present", () => {
    const markdownContent =
      '{"dependencies": {}}\n\nThis quick example shows how to use React hooks with TypeScript.\n\nFirst, let\'s create a simple counter component:';
    const codeContent = "import React, { useState, use";

    const messages = [
      {
        type: "user",
        text: "Hello",
        _id: "user1",
      },
      {
        type: "ai",
        text: markdownContent + "\n\n```jsx\n" + codeContent,
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

    // Check that both the markdown and code content are visible
    const mdContent = screen.getByText(/This quick example/);
    expect(mdContent).toBeInTheDocument();

    const codeElement = screen.getByText(/import React/);
    expect(codeElement).toBeInTheDocument();
  });

  // Test other aspects of streaming messages
});
