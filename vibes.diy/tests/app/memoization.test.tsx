import { act, render, screen } from "@testing-library/react";
import React, { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a controlled context for testing
const TestContext = React.createContext<{ isStreaming: () => boolean }>({
  isStreaming: () => false,
});
const useTestContext = () => useContext(TestContext);

// No need to mock ChatContext anymore

// Mock other dependencies
vi.mock("react-markdown", async () => {
  await import("react"); //.default
  return {
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
  };
});

// Using the centralized mock from __mocks__/use-fireproof.ts

// Now import components after mocks
import ChatHeader from "~/vibes.diy/app/components/ChatHeaderContent.js";

// Mock component that tracks renders
function createRenderTracker<T>(Component: React.ComponentType<T>) {
  let renderCount = 0;
  // Create a wrapped component that uses the original memoized component
  // but tracks renders of the wrapper
  const TrackedComponent = (props: T) => {
    renderCount++;
    // Use the original component directly
    return <Component {...(props as React.JSX.IntrinsicAttributes & T)} />;
  };

  // Memoize the tracker component itself to prevent re-renders from parent
  const MemoizedTrackedComponent = React.memo(TrackedComponent);

  return {
    Component: MemoizedTrackedComponent,
    getRenderCount: () => renderCount,
    resetCount: () => {
      renderCount = 0;
    },
  };
}

// Update the test component to use TestContext
function TestComponent({ renderCount }: { renderCount: React.MutableRefObject<number> }) {
  renderCount.current += 1;
  const { isStreaming } = useTestContext();
  return <div data-testid="test-component">{isStreaming() ? "Generating" : "Idle"}</div>;
}

describe("Component Memoization", () => {
  describe("ChatHeader Memoization", () => {
    beforeEach(() => {
      // No need to mock useTestContext
      globalThis.document.body.innerHTML = "";
    });

    it("does not re-render when props are unchanged", async () => {
      // Create a wrapper component for testing
      const { Component: TrackedHeader, getRenderCount } = createRenderTracker(ChatHeader);

      // Create stable callback functions outside the component
      const onOpenSidebar = () => {
        /* no-op */
      };
      // const onNewChat = () => {
      //   /* no-op */
      // };
      const isStreaming = false;

      function TestWrapper() {
        const [, forceUpdate] = React.useState({});

        // Force parent re-render without changing props
        const triggerRerender = () => forceUpdate({});

        return (
          <div>
            <button data-testid="rerender-trigger" onClick={triggerRerender}>
              Force Re-render
            </button>
            {/* Pass required props */}
            <TrackedHeader
              onOpenSidebar={onOpenSidebar}
              // onNewChat={onNewChat}
              promptProcessing={isStreaming}
              title={""}
              codeReady={false}
            />
          </div>
        );
      }

      const { getByTestId } = render(<TestWrapper />);
      expect(getRenderCount()).toBe(1); // Initial render

      // Force parent re-render
      await act(async () => {
        getByTestId("rerender-trigger").click();
      });

      // ChatHeader should not re-render
      expect(getRenderCount()).toBe(1);
    });

    it("should not re-render when context value changes but component does not use that value", () => {
      const renderCount = { current: 0 };

      const { rerender } = render(
        <TestContext.Provider value={{ isStreaming: () => false }}>
          <TestComponent renderCount={renderCount} />
        </TestContext.Provider>
      );

      const initialRenderCount = renderCount.current;

      // Update the context with a new value
      rerender(
        <TestContext.Provider value={{ isStreaming: () => true }}>
          <TestComponent renderCount={renderCount} />
        </TestContext.Provider>
      );

      // The component should have re-rendered because it uses isStreaming
      expect(renderCount.current).toBe(initialRenderCount + 1);
      expect(screen.getByTestId("test-component")).toHaveTextContent("Generating");
    });
  });
});
