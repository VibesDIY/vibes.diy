// No need to import React for these tests
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useViewState,
  ViewStateProps,
} from "~/vibes.diy/app/utils/ViewState.js";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ViewState } from "../../prompts/pkg/view-state.js";

// Mock react-router-dom hooks
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(),
  useLocation: vi.fn(),
}));

describe("useViewState during streaming", () => {
  const mockNavigate = vi.fn();
  const mockSessionId = "test-session-id";
  const mockTitle = "test-title";
  // Title is already encoded for test simplicity

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useParams).mockReturnValue({
      sessionId: mockSessionId,
      title: mockTitle,
    });

    // Default location (base path)
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should display code view when streaming starts for first message", () => {
    // Setup: Initial state with no code
    let hookResult: Partial<ViewState> = {};

    // Render hook with initial state (no streaming, no code)
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: "", // No code yet
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Cleanup to reset refs
    unmount();

    // Re-render with streaming started and some code
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: "", // No code initially
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Now transition to streaming with code
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("hello")', // Now we have code
      isStreaming: true, // Now streaming
      previewReady: false,
    });

    // We don't expect URL navigation for initial code display
    // This behavior is handled by the component using the hook
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should NOT navigate to /app when preview becomes ready during active streaming", () => {
    // Setup: start with streaming already in progress on the base path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`, // Base path (no view suffix)
    } as ReturnType<typeof useLocation>);

    let hookResult: Partial<ViewState> = {};

    // Initialize with streaming in progress
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: true,
          previewReady: false,
        },
      },
    );

    // Cleanup to reset refs
    unmount();

    // Reinitialize with streaming
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: true,
          previewReady: false,
        },
      },
    );

    // Now preview becomes ready but still streaming
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: true, // Still streaming
      previewReady: true, // Preview is ready
    });

    // UPDATED BEHAVIOR: Navigate to app view whenever preview is ready, even during streaming
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );

    // UPDATED BEHAVIOR: displayView should be 'preview' when previewReady is true, even during streaming
    expect(hookResult.displayView).toBe("preview");

    // Now end streaming and verify navigation happens
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false, // Streaming complete
      previewReady: true, // Preview is ready
    });

    // NOW it should navigate to app view
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
  });

  test("should not navigate to app view when on code path and preview becomes ready", () => {
    // Set up with explicitly on code view
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/code`,
    } as ReturnType<typeof useLocation>);

    let hookResult: Partial<ViewState> = {};

    // Initialize with streaming active and on code view
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: true,
          previewReady: false,
        },
      },
    );

    // Cleanup to reset refs
    unmount();

    // Reinitialize with streaming on code view
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          sessionId: mockSessionId,
          title: mockTitle,
          code: 'console.log("test")',
          isStreaming: true,
          previewReady: false,
        },
      },
    );

    // Now streaming ends and preview becomes ready
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false, // Streaming ended
      previewReady: true, // Preview is ready
    }); // Type assertion needed for test

    // Should not navigate since we're explicitly on /code view
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should not navigate when on data path and preview becomes ready", () => {
    // Set up with explicitly on data view
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}/data`,
    } as ReturnType<typeof useLocation>);

    let hookResult: Partial<ViewState> = {};

    // Initialize on data view
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
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

    // Cleanup to reset refs
    unmount();

    // Reinitialize on data view
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
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

    // Now preview becomes ready
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true, // Preview is ready
    });

    // Should not navigate since we're explicitly on /data view
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should handle initial app flow from root URL with correct navigation timing", () => {
    // Setup: Root URL path - no session or title params yet
    vi.mocked(useLocation).mockReturnValue({
      pathname: "/",
    } as ReturnType<typeof useLocation>);

    // Initial phase has no sessionId or title in params
    vi.mocked(useParams).mockReturnValue({});

    let hookResult: Partial<ViewState> = {};

    // Initialize at root with streaming starting
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          // No sessionId or title in props yet
          code: "",
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Verify initial state
    expect(hookResult.currentView).toBe("preview"); // Default view is preview
    expect(mockNavigate).not.toHaveBeenCalled();

    // Cleanup to reset refs
    unmount();

    // Simulate streaming starts but still no session/title (first part of response)
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          // Still no sessionId or title
          code: 'console.log("hello world")',
          isStreaming: true,
          previewReady: false,
        } as ViewStateProps,
      },
    );

    // No navigation should happen without sessionId/title
    expect(mockNavigate).not.toHaveBeenCalled();

    // Now simulate that the response has been persisted and we get sessionId and title
    // This would happen after the LLM response is saved to the database
    vi.mocked(useParams).mockReturnValue({
      sessionId: mockSessionId,
      title: mockTitle,
    });

    // Update with new sessionId and title
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("hello world")',
      isStreaming: true,
      previewReady: false,
    }); // Type assertion to bypass type checking for test

    // No navigation yet since streaming is still ongoing and preview isn't ready
    expect(mockNavigate).not.toHaveBeenCalled();

    // Now simulate preview becomes ready
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("hello world")',
      isStreaming: true,
      previewReady: true,
    }); // Type assertion to bypass type checking for test

    // UPDATED BEHAVIOR: Navigate to app view whenever preview is ready, even during streaming
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );

    // End streaming and verify navigation happens
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false, // Streaming ended
      previewReady: true, // Preview is ready
    }); // Type assertion needed for test

    // NOW it should navigate to app view
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
  });

  test("EXPECTED BEHAVIOR: should stay on code view when first code lines arrive during streaming", () => {
    // Setup: Root URL path with no session/title params yet
    vi.mocked(useLocation).mockReturnValue({
      pathname: "/",
    } as ReturnType<typeof useLocation>);

    // Initial phase has no sessionId or title in params (new chat)
    vi.mocked(useParams).mockReturnValue({});

    let hookResult: Partial<ViewState> = {};

    // Initialize at root, no streaming yet
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          // No sessionId or title in props yet
          code: "",
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Default view should be preview (code not showing yet)
    expect(hookResult.currentView).toBe("preview");
    expect(mockNavigate).not.toHaveBeenCalled();

    // Cleanup to reset refs
    unmount();

    // NOW: Streaming starts with first empty message
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          // Still no sessionId/title, but now we're streaming
          code: "",
          isStreaming: true,
          previewReady: false,
        },
      },
    );

    // During initial streaming, currentView should remain preview
    // (The UI component will show code view based on isStreaming flag)
    expect(hookResult.currentView).toBe("preview");
    expect(mockNavigate).not.toHaveBeenCalled();

    // First code lines arrive, still streaming (THIS IS THE CRITICAL MOMENT)
    rerender({
      code: 'console.log("Hello World")',
      isStreaming: true,
      previewReady: false, // Preview not ready yet
    });

    // Code view should stay visible (no navigation should happen)
    // Even though we don't have session/title yet, we're still in initial streaming mode
    expect(mockNavigate).not.toHaveBeenCalled();
    // The component should still show code
    expect(hookResult.viewControls?.code.loading).toBe(true); // Code icon should be spinning
  });

  test("FIXED: View stays in code view when first code lines arrive during streaming", () => {
    // Setup: Root URL path with no session/title params yet
    vi.mocked(useLocation).mockReturnValue({
      pathname: "/",
    } as ReturnType<typeof useLocation>);

    // Initial phase has no sessionId or title in params (new chat)
    vi.mocked(useParams).mockReturnValue({});

    let hookResult: Partial<ViewState> = {};

    // Initialize at root, no streaming yet
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          // No sessionId or title in props yet
          code: "",
          isStreaming: false,
          previewReady: false,
        },
      },
    );

    // Cleanup to reset refs
    unmount();

    // Streaming starts with first empty message
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: {
          code: "",
          isStreaming: true,
          previewReady: false,
        } as ViewStateProps,
      },
    );

    // Simulate sessionId and title becoming available
    vi.mocked(useParams).mockReturnValue({
      sessionId: mockSessionId,
      title: mockTitle,
    });

    // Bug scenario: First code lines arrive AND app preview becomes marked as ready
    // (Even though it's not really ready on screen - this seems to be happening)
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("Hello World")', // First code arrived
      isStreaming: true, // Still streaming
      previewReady: true, // THIS IS THE BUG - preview marked ready too early
    });

    // UPDATED BEHAVIOR: Navigate to app view whenever preview is ready, even during streaming
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );

    // UPDATED BEHAVIOR: displayView should be 'preview' when previewReady is true, even during streaming
    expect(hookResult.displayView).toBe("preview");

    // Only after streaming ends will it navigate to app view
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("Hello World")',
      isStreaming: false, // Streaming has finished
      previewReady: true, // Preview is ready
    }); // Type assertion needed for test

    // NOW navigate to app view is expected
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
    // (User sees empty app view instead of code being written)
  });
});
