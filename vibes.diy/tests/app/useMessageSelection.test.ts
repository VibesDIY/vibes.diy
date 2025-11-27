import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMessageSelection } from "~/vibes.diy/app/hooks/useMessageSelection.js";
import type { ChatMessageDocument } from "@vibes.diy/prompts";

describe("useMessageSelection", () => {
  // Sample data for testing
  const createTestMessages = (count: number) => {
    const messages: ChatMessageDocument[] = [];

    for (let i = 0; i < count; i++) {
      const timestamp = Date.now() - (count - i) * 1000; // Older to newer
      messages.push({
        _id: `ai-message-${i}`,
        type: "ai",
        text: `AI message ${i} with code:\n\`\`\`javascript\nfunction example${i}() {\n  return "Code block ${i}";\n}\n\`\`\`\nEnd of message ${i}`,
        session_id: "test-session-id",
        created_at: timestamp,
      } as ChatMessageDocument);
    }

    return messages;
  };

  it("should select the latest AI message with code by default", () => {
    // Create multiple AI messages with code blocks in chronological order
    const messages = createTestMessages(3);

    const { result } = renderHook(() =>
      useMessageSelection({
        docs: messages,
        isStreaming: false,
        aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
        selectedResponseId: "",
        pendingAiMessage: null,
      }),
    );

    // Verify that the latest message is selected (highest index in our test data)
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-2");
  });

  it("should select messages by ID regardless of timestamps", () => {
    // Create messages with deliberately shuffled timestamps
    const messages = [
      {
        _id: "ai-message-0",
        type: "ai",
        text: "First message with code:\n```javascript\nfunction first() {}\n```",
        session_id: "test-session-id",
        created_at: Date.now() - 1000,
      } as ChatMessageDocument,
      {
        _id: "ai-message-1",
        type: "ai",
        text: "Second message with code:\n```javascript\nfunction second() {}\n```",
        session_id: "test-session-id",
        created_at: Date.now(), // Most recent timestamp
      } as ChatMessageDocument,
      {
        _id: "ai-message-2",
        type: "ai",
        text: "Third message with code:\n```javascript\nfunction third() {}\n```",
        session_id: "test-session-id",
        created_at: Date.now() - 500, // Middle timestamp
      } as ChatMessageDocument,
    ];

    const { result } = renderHook(() =>
      useMessageSelection({
        docs: messages,
        isStreaming: false,
        aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
        selectedResponseId: "",
        pendingAiMessage: null,
      }),
    );

    // Should select ai-message-2 as it has the highest ID value (based on alphabetical sorting)
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-2");
  });

  it("should prioritize explicit selection over default selection", () => {
    const messages = createTestMessages(3);

    const { result } = renderHook(() =>
      useMessageSelection({
        docs: messages,
        isStreaming: false,
        aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
        selectedResponseId: "ai-message-0", // Explicitly select the oldest
        pendingAiMessage: null,
      }),
    );

    // Should respect the explicit selection
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-0");
  });

  it("should handle missing code blocks correctly", () => {
    // Create messages with missing code blocks
    const messages = [
      {
        _id: "ai-message-0",
        type: "ai",
        text: "First message with NO code",
        session_id: "test-session-id",
        created_at: Date.now() - 2000,
      } as ChatMessageDocument,
      {
        _id: "ai-message-1",
        type: "ai",
        text: "Second message with code:\n```javascript\nfunction second() {}\n```",
        session_id: "test-session-id",
        created_at: Date.now() - 1000,
      } as ChatMessageDocument,
      {
        _id: "ai-message-2",
        type: "ai",
        text: "Third message with NO code",
        session_id: "test-session-id",
        created_at: Date.now(), // Most recent but no code
      } as ChatMessageDocument,
    ];

    const { result } = renderHook(() =>
      useMessageSelection({
        docs: messages,
        isStreaming: false,
        aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
        selectedResponseId: "",
        pendingAiMessage: null,
      }),
    );

    // Should select the most recent message that has a code block
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-1");
  });

  it("should handle messages being loaded asynchronously", () => {
    // Start with empty docs
    const { result, rerender } = renderHook(
      (props) => useMessageSelection(props),
      {
        initialProps: {
          docs: [] as ChatMessageDocument[],
          isStreaming: false,
          aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
          selectedResponseId: "",
          pendingAiMessage: null,
        },
      },
    );

    // Initially should not have a selection
    expect(result.current.selectedResponseDoc).toBeUndefined();

    // Now simulate docs loading
    const messages = createTestMessages(3);

    rerender({
      docs: messages,
      isStreaming: false,
      aiMessage: { text: "", type: "ai" } as ChatMessageDocument,
      selectedResponseId: "",
      pendingAiMessage: null,
    });

    // After loading, should select the latest message with code
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-2");
  });
});
