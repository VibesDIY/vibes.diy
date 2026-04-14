import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useShareModal } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";
import type { ChatMessageDocument } from "@vibes.diy/prompts";
import { publishApp } from "~/vibes.diy/app/utils/publishUtils.js";

vi.mock("~/vibes.diy/app/utils/publishUtils", () => ({
  publishApp: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "test-user-id",
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
});

describe("useShareModal", () => {
  const mockCode = "export const App = () => <div />;";
  const mockTitle = "Test App";
  const mockMessages: ChatMessageDocument[] = [
    {
      type: "user",
      text: "Build a test app",
      _id: "user-1",
      session_id: "test-session-id",
      created_at: Date.now(),
    },
  ];
  const updatePublishedUrl = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    (publishApp as Mock).mockResolvedValue("https://test-app.vibesdiy.app");
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      useShareModal({
        sessionId: "test-session-id",
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
      }),
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.canPublish).toBe(true);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.publishedUrl).toBeUndefined();
    expect(result.current.urlCopied).toBe(false);
    expect(result.current.autoJoinEnabled).toBe(false);
  });

  it("disables publish when sessionId is undefined", () => {
    const { result } = renderHook(() =>
      useShareModal({
        sessionId: undefined,
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
      }),
    );

    expect(result.current.canPublish).toBe(false);
  });

  it("publishes and sets a clean /vibe/{slug}/ URL", async () => {
    const { result } = renderHook(() =>
      useShareModal({
        sessionId: "test-session-id",
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
      }),
    );

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(publishApp).toHaveBeenCalledWith({
      sessionId: "test-session-id",
      code: mockCode,
      title: mockTitle,
      prompt: "Build a test app",
      updatePublishedUrl,
      token: "test-token",
      userId: "test-user-id",
    });

    expect(result.current.publishedUrl).toBe(
      `${window.location.origin}/vibe/test-app/`,
    );
    expect(result.current.isPublished).toBe(true);
  });

  it("copies the published URL", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareModal({
        sessionId: "test-session-id",
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
        publishedUrl: "https://vibes.diy/vibe/test-app/",
      }),
    );

    await act(async () => {
      await result.current.handleCopyUrl();
    });
    expect(writeText).toHaveBeenCalledWith("https://vibes.diy/vibe/test-app/");
    expect(result.current.urlCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.urlCopied).toBe(false);
    vi.useRealTimers();
  });

  it("toggles auto-join and persists to localStorage", async () => {
    const { result } = renderHook(() =>
      useShareModal({
        sessionId: "test-session-id",
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
      }),
    );

    await act(async () => {
      await result.current.handleToggleAutoJoin();
    });
    expect(result.current.autoJoinEnabled).toBe(true);
    expect(
      window.localStorage.getItem("vibes-share:auto-join:test-session-id"),
    ).toBe("true");

    await act(async () => {
      await result.current.handleToggleAutoJoin();
    });
    expect(result.current.autoJoinEnabled).toBe(false);
  });

  it("loads auto-join state from localStorage when opened", () => {
    window.localStorage.setItem(
      "vibes-share:auto-join:test-session-id",
      "true",
    );

    const { result } = renderHook(() =>
      useShareModal({
        sessionId: "test-session-id",
        code: mockCode,
        title: mockTitle,
        messages: mockMessages,
        updatePublishedUrl,
      }),
    );

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.autoJoinEnabled).toBe(true);
  });
});
