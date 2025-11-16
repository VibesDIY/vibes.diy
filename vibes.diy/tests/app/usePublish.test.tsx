import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { usePublish } from "~/vibes.diy/app/components/ResultPreview/usePublish.js";
import type {
  AiChatMessage,
  ChatMessageDocument,
  UserChatMessage,
} from "@vibes.diy/prompts";
import { trackPublishShared } from "~/vibes.diy/app/utils/analytics.js";
import { publishApp } from "~/vibes.diy/app/utils/publishUtils.js";

// Mock dependencies
vi.mock("~/vibes.diy/app/utils/publishUtils", () => ({
  publishApp: vi.fn(),
}));

vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  trackPublishShared: vi.fn(),
}));

// Mock navigation clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
  writable: true,
});

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "test-user-id",
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

describe("usePublish Hook", () => {
  const mockSessionId = "test-session-id";
  const mockCode = "const App = () => <div>Test App</div>; export default App;";
  const mockTitle = "Test App";
  const mockMessages: ChatMessageDocument[] = [
    {
      type: "user",
      text: "Create a test app",
      _id: "user-1",
      session_id: "test-session-id",
      created_at: Date.now(),
    } as UserChatMessage,
    {
      type: "ai",
      text: "Here is your app",
      _id: "ai-1",
      session_id: "test-session-id",
      created_at: Date.now(),
    } as AiChatMessage,
  ];
  const mockUpdatePublishedUrl = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default implementation for publishApp
    (publishApp as Mock).mockResolvedValue("https://test-app.vibesdiy.app");
  });

  it("initializes with correct default values", () => {
    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    expect(result.current.isPublishing).toBe(false);
    expect(result.current.urlCopied).toBe(false);
    expect(result.current.publishedAppUrl).toBeUndefined();
    expect(result.current.isShareModalOpen).toBe(false);
    expect(typeof result.current.handlePublish).toBe("function");
    expect(typeof result.current.toggleShareModal).toBe("function");
  });

  it("initializes with provided publishedUrl", () => {
    const initialUrl = "https://initial-app.vibesdiy.app";

    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
        publishedUrl: initialUrl,
      }),
    );

    expect(result.current.publishedAppUrl).toBe(initialUrl);
  });

  it("toggles the share modal", () => {
    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    // Initial state should be closed
    expect(result.current.isShareModalOpen).toBe(false);

    // Open the modal
    act(() => {
      result.current.toggleShareModal();
    });
    expect(result.current.isShareModalOpen).toBe(true);

    // Close the modal
    act(() => {
      result.current.toggleShareModal();
    });
    expect(result.current.isShareModalOpen).toBe(false);
  });

  it("publishes the app and updates state correctly", async () => {
    const mockAppUrl = "https://published-app.vibesdiy.app";
    (publishApp as Mock).mockResolvedValue(mockAppUrl);

    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    // Call handlePublish
    await act(async () => {
      await result.current.handlePublish();
    });

    // Verify publishApp was called with correct args
    expect(publishApp).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      code: mockCode,
      title: mockTitle,
      prompt: "Create a test app", // First user message
      updatePublishedUrl: mockUpdatePublishedUrl,
      userId: "test-user-id",
      token: "test-token",
    });

    // Verify state updates
    expect(result.current.publishedAppUrl).toBe(mockAppUrl);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAppUrl);
    expect(trackPublishShared).toHaveBeenCalledWith(
      expect.objectContaining({ published_url: mockAppUrl }),
    );

    // Verify urlCopied state is set to true initially (the core functionality)
    expect(result.current.urlCopied).toBe(true);

    // Note: We don't test the timeout reset to avoid slow tests
    // The timeout is just UX and doesn't affect core functionality
  });

  it("handles failure to publish gracefully", async () => {
    // Mock a failure in publishApp
    (publishApp as Mock).mockRejectedValue(new Error("Failed to publish"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* no-op */
    });

    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    // Call handlePublish
    await act(async () => {
      await result.current.handlePublish();
    });

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in handlePublish:",
      expect.any(Error),
    );

    // Verify state resets
    expect(result.current.isPublishing).toBe(false);

    // Clean up
    consoleSpy.mockRestore();
  });

  it("handles special case for first message as prompt", async () => {
    const specialMessages: ChatMessageDocument[] = [
      {
        type: "user",
        text: "System prompt",
        _id: "0001-user-first",
        session_id: "test-session-id",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "user",
        text: "Actual user prompt",
        _id: "user-2",
        session_id: "test-session-id",
        created_at: Date.now(),
      } as UserChatMessage,
      {
        type: "ai",
        text: "Response",
        _id: "ai-1",
        session_id: "test-session-id",
        created_at: Date.now(),
      } as AiChatMessage,
    ];

    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: specialMessages,
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    // Call handlePublish
    await act(async () => {
      await result.current.handlePublish();
    });

    // Verify publishApp was called with second message as prompt
    expect(publishApp).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Actual user prompt",
      }),
    );
  });

  it("does nothing when no messages to publish", async () => {
    const { result } = renderHook(() =>
      usePublish({
        sessionId: mockSessionId,
        code: mockCode,
        title: mockTitle,
        messages: [] as ChatMessageDocument[],
        updatePublishedUrl: mockUpdatePublishedUrl,
      }),
    );

    // Call handlePublish
    await act(async () => {
      await result.current.handlePublish();
    });

    // Verify publishApp was not called
    expect(publishApp).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });
});
