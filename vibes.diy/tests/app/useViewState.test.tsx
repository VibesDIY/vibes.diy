import { renderHook } from "@testing-library/react";
import { useViewState } from "~/vibes.diy/app/utils/ViewState.js";
import { vi, describe, test, expect, beforeEach } from "vitest";

// Mock react-router-dom hooks
vi.mock("react-router-dom", () => {
  return {
    useNavigate: vi.fn(),
    useParams: vi.fn(),
    useLocation: vi.fn(),
  };
});

// Mock encodeTitle from utils
vi.mock("~/vibes.diy/app/components/SessionSidebar/utils", () => {
  return {
    encodeTitle: vi.fn((title) => title), // Simple mock that returns the title unchanged
  };
});

// Import mocked modules
import {
  useNavigate,
  useParams,
  useLocation,
  type NavigateFunction,
} from "react-router-dom";

describe("useViewState", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;
  const mockSessionId = "test-session-123";
  const mockTitle = "test-title";

  beforeEach(() => {
    vi.resetAllMocks();
    mockNavigate = vi.fn();

    // Setup default mocks
    vi.mocked(useNavigate).mockReturnValue(
      mockNavigate as unknown as NavigateFunction,
    );
    vi.mocked(useParams).mockReturnValue({
      sessionId: mockSessionId,
      title: mockTitle,
    });
  });

  test("should determine correct view from path", () => {
    // Test app path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/app`,
    } as ReturnType<typeof useLocation>);

    const { result: appResult } = renderHook(() =>
      useViewState(
        {
          code: "const test = true;",
          isStreaming: false,
          previewReady: true,
        },
        "/chat/session123/title/app",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    expect(appResult.current.currentView).toBe("preview");

    // Test code path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/code`,
    } as ReturnType<typeof useLocation>);

    const { result: codeResult } = renderHook(() =>
      useViewState(
        {
          code: "const test = true;",
          isStreaming: false,
          previewReady: true,
        },
        "/chat/session123/title/code",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    expect(codeResult.current.currentView).toBe("code");

    // Test data path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/data`,
    } as ReturnType<typeof useLocation>);

    const { result: dataResult } = renderHook(() =>
      useViewState(
        {
          code: "const test = true;",
          isStreaming: false,
          previewReady: true,
        },
        "/chat/session123/title/data",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    expect(dataResult.current.currentView).toBe("data");
  });

  test("should not redirect when explicitly on /app and preview becomes ready", () => {
    // Setup location with /app path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/app`,
    } as ReturnType<typeof useLocation>);

    // Initialize with preview not ready
    const { result, rerender } = renderHook(() =>
      useViewState(
        {
          code: 'console.log("test")',
          isStreaming: false,
          previewReady: false,
        },
        "/chat/session123/title/app",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    // Verify initial state
    expect(result.current.currentView).toBe("preview");
    expect(mockNavigate).not.toHaveBeenCalled();

    // Update with preview ready
    rerender({
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    });

    // Should not navigate when already on /app
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should not redirect when explicitly on /code and preview becomes ready", () => {
    // Setup location with /code path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/code`,
    } as ReturnType<typeof useLocation>);

    // Initialize with preview not ready
    const { result, rerender } = renderHook(() =>
      useViewState(
        {
          code: 'console.log("test")',
          isStreaming: false,
          previewReady: false,
        },
        "/chat/session123/title/code",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    // Verify initial state
    expect(result.current.currentView).toBe("code");
    expect(mockNavigate).not.toHaveBeenCalled();

    // Update with preview ready
    rerender({
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    });

    // Should not navigate when already on /code
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should not redirect when explicitly on /data and preview becomes ready", () => {
    // Setup location with /data path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/data`,
    } as ReturnType<typeof useLocation>);

    // Initialize with preview not ready
    const { result, rerender } = renderHook(() =>
      useViewState(
        {
          code: 'console.log("test")',
          isStreaming: false,
          previewReady: false,
        },
        "/chat/session123/title/data",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    // Verify initial state
    expect(result.current.currentView).toBe("data");
    expect(mockNavigate).not.toHaveBeenCalled();

    // Update with preview ready
    rerender({
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    });

    // Should not navigate when already on /data
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should auto-navigate to /app when on base path and preview becomes ready", () => {
    // Setup location with base path (no view suffix)
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
    } as ReturnType<typeof useLocation>);

    // Create a new mock navigate for this specific test
    const testNavigate = vi.fn();

    // Initialize with preview not ready
    const { rerender } = renderHook(
      (props) =>
        useViewState(
          props,
          `/chat/${mockSessionId}/${mockTitle}`,
          testNavigate,
        ),
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Verify navigate not called initially
    expect(testNavigate).not.toHaveBeenCalled();

    // Now trigger the useEffect with a change to previewReady
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true, // <-- This change should trigger navigation
    });

    // Should navigate to /app when on base path
    expect(testNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
  });

  test("should only redirect once when previewReady transitions from false to true", () => {
    // Setup location with base path (no view suffix)
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
    } as ReturnType<typeof useLocation>);

    // Create a new mock navigate for this specific test
    const testNavigate = vi.fn();

    // Initialize with preview not ready
    const { rerender } = renderHook(
      (props) =>
        useViewState(
          props,
          `/chat/${mockSessionId}/${mockTitle}`,
          testNavigate,
        ),
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // First update - previewReady becomes true, should trigger navigation
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    });

    // Should navigate to /app once
    expect(testNavigate).toHaveBeenCalledTimes(1);
    expect(testNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );

    // Reset mock to check if another call happens
    testNavigate.mockReset();

    // Re-render again with previewReady still true
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    });

    // Should not navigate again since wasPreviewReadyRef is now true
    expect(testNavigate).not.toHaveBeenCalled();
  });

  test("should determine settings view from path", () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/settings`,
    } as ReturnType<typeof useLocation>);

    const { result } = renderHook(() =>
      useViewState(
        {
          code: "const test = true;",
          isStreaming: false,
          previewReady: true,
        },
        "/chat/session123/title/settings",
        mockNavigate as unknown as NavigateFunction,
      ),
    );

    expect(result.current.currentView).toBe("settings");
  });
});
