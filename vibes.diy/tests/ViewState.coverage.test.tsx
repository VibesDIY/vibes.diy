import { renderHook, act } from "@testing-library/react";
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
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ViewState } from "@vibes.diy/prompts";

describe("ViewState Coverage Tests", () => {
  const mockNavigate = vi.fn();
  const mockSessionId = "test-session-123";
  const mockTitle = "test-title";

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mocks
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useParams).mockReturnValue({
      sessionId: mockSessionId,
      title: mockTitle,
    });
  });

  test("should navigate to app view when previewReady becomes true and user is not in data or code view", () => {
    // Mock location to base path
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`, // Not in data or code view
    } as ReturnType<typeof useLocation>);

    // Initialize with props
    const initialProps = {
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: true,
      previewReady: false, // Start with previewReady=false to test the transition
    };

    let hookResult: Partial<ViewState>;

    // First initialize with streaming state
    const { unmount } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: initialProps,
      },
    );

    // Cleanup to reset refs
    unmount();

    // Render the hook with initial streaming state
    const { rerender } = renderHook(
      (props) => {
        hookResult = useViewState(props);
        return hookResult;
      },
      {
        initialProps: initialProps,
      },
    );

    // Clear any initial navigation calls
    mockNavigate.mockClear();

    // Update to simulate streaming ending
    rerender({
      ...initialProps,
      isStreaming: false, // Streaming has ended
      previewReady: true, // Preview is ready
    });

    // Verify navigation to app view occurred
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
  });

  test("should navigate to specified view when navigateToView is called with valid session", () => {
    // Mock location
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
    } as ReturnType<typeof useLocation>);

    // Setup props
    const props = {
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false,
      previewReady: true,
    };

    // Render the hook
    const { result } = renderHook(() => useViewState(props));

    // Call navigateToView to navigate to data view
    act(() => {
      result.current.navigateToView?.("data");
    });

    // Verify navigation occurred with correct path
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/data`,
    );

    // Clear mock for next test
    mockNavigate.mockClear();

    // Test preview view which should use 'app' suffix
    act(() => {
      result.current.navigateToView?.("preview");
    });

    // Verify navigation with 'app' suffix
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
    );
  });

  test("should not navigate when view is disabled", () => {
    // Mock location
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
    } as ReturnType<typeof useLocation>);

    // Setup props with data view disabled (during streaming)
    const props = {
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: true, // This should disable the data view
      previewReady: false,
    };

    // Render the hook
    const { result } = renderHook(() => useViewState(props));

    // Attempt to navigate to data view (which should be disabled)
    act(() => {
      result.current.navigateToView?.("data");
    });

    // Verify no navigation occurred since data view is disabled
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  test("should navigate to app view when streaming ends and user is not in data or code view", () => {
    // Mock location to base path - not in data or code view
    vi.mocked(useLocation).mockReturnValue({
      pathname: `/chat/${mockSessionId}/${mockTitle}`,
    } as ReturnType<typeof useLocation>);

    let hookResult: Partial<ViewState>;

    // First render to establish the wasStreamingRef value as true
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
          isStreaming: true, // Initially streaming
          previewReady: false, // Start with previewReady=false to test the transition
        },
      },
    );

    // Cleanup to reset refs
    unmount();

    // Re-render to get fresh refs
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
          isStreaming: true, // Still streaming
          previewReady: false, // Start with previewReady=false to test the transition
        },
      },
    );

    // Clear any initial navigation calls
    mockNavigate.mockClear();

    // Transition from streaming to not streaming - this should trigger lines 66-67
    rerender({
      sessionId: mockSessionId,
      title: mockTitle,
      code: 'console.log("test")',
      isStreaming: false, // Streaming just ended
      previewReady: true, // Preview is ready
    });

    // Verify navigation to app view occurred
    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/${mockSessionId}/${mockTitle}/app`,
      {
        replace: true,
      },
    );
  });
});
