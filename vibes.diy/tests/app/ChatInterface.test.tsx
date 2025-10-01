import React from "react";
import { render } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import ChatInterface from "~/vibes.diy/app/components/ChatInterface.js";
import type { ChatState } from "@vibes.diy/prompts";
import { mockChatStateProps } from "./mockData.js";

/**
 * Tests for the ChatInterface component
 * This file verifies the fix for the 'input is not defined' error in ChatInterface.tsx
 */

// Mock the useFireproof hook
vi.mock("use-fireproof", () => ({
  useFireproof: () => ({
    database: {},
    useLiveQuery: () => ({ docs: [] }),
  }),
  toCloud: vi.fn().mockReturnValue({}),
}));

// Prepare mock data
const mockChatState: ChatState & {
  setMobilePreviewShown: (shown: boolean) => void;
  navigateToView: (view: unknown) => void;
} = {
  ...mockChatStateProps,
  docs: [],
  input: "",
  setInput: vi.fn(),
  isStreaming: false,
  inputRef: { current: null },
  sendMessage: vi.fn(),
  saveCodeAsAiMessage: vi.fn().mockResolvedValue("test-message-id"),
  title: "test title",
  sessionId: "test-session-id",
  selectedResponseDoc: undefined,
  selectedSegments: [],
  selectedCode: {
    type: "code",
    content: 'console.log("test")',
  },
  codeReady: false,
  isEmpty: true,
  addScreenshot: () => Promise.resolve(),
  setSelectedResponseId: vi.fn(),
  setMobilePreviewShown: vi.fn(),
  navigateToView: vi.fn(),
};

describe("ChatInterface Component", () => {
  it("renders without crashing", () => {
    // This test passes now that we've fixed the 'input is not defined' error
    // by properly destructuring input from chatState
    const { container } = render(<ChatInterface {...mockChatState} />);
    expect(container).toBeDefined();
  });
});
