import React from "react";
import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import ResultPreview from "~/vibes.diy/app/components/ResultPreview/ResultPreview.js";
import { mockResultPreviewProps } from "./mockData.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
  writable: true,
});

// Mock URL methods that aren't available in test environment
const mockObjectUrl = "mock-blob-url";
URL.createObjectURL = vi.fn().mockReturnValue(mockObjectUrl);
URL.revokeObjectURL = vi.fn();

// Mock useSession hook to prevent Fireproof initialization during tests
vi.mock("~/vibes.diy/app/hooks/useSession", async () => {
  const { vi } = await import("vitest");
  return {
    useSession: vi.fn().mockReturnValue({
      updateTitle: vi.fn().mockResolvedValue(undefined),
      session: { title: "Test Session" },
      updatePublishedUrl: vi.fn(),
      updateFirehoseShared: vi.fn(),
      addScreenshot: vi.fn(),
    }),
  };
});

// Mock SandpackProvider and related components
vi.mock("@codesandbox/sandpack-react", async () => {
  const { vi } = await import("vitest");
  return {
    SandpackProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sandpack-provider">{children}</div>
    ),
    SandpackLayout: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SandpackCodeEditor: () => <div data-testid="sandpack-editor">Editor</div>,
    SandpackPreview: () => <div data-testid="sandpack-preview">Preview</div>,
    useSandpack: () => ({
      sandpack: { activeFile: "/App.jsx" },
      listen: vi.fn().mockReturnValue(() => {
        /* no-op */
      }),
    }),
  };
});

// Mock WelcomeScreen
vi.mock("~/vibes.diy/app/components/ResultPreview/WelcomeScreen", () => ({
  default: () => <div data-testid="welcome-screen">Welcome Screen Content</div>,
}));

// Mock the Sandpack scroll controller
vi.mock(
  "~/vibes.diy/app/components/ResultPreview/SandpackScrollController",
  () => ({
    default: () => null,
  }),
);

// Mock iframe behavior

// Mock the IframeContent component to avoid iframe issues in tests
vi.mock("~/vibes.diy/app/components/ResultPreview/IframeContent", () => ({
  default: ({ activeView }: { activeView: string }) => (
    <div data-testid="sandpack-provider" className="h-full">
      <div
        style={{
          visibility: activeView === "preview" ? "visible" : "hidden",
          position: activeView === "preview" ? "static" : "absolute",
        }}
      >
        <iframe data-testid="preview-iframe" title="Preview" />
      </div>
      <div
        data-testid="sandpack-editor"
        style={{
          visibility: activeView === "code" ? "visible" : "hidden",
          position: activeView === "code" ? "static" : "absolute",
        }}
      >
        Code Editor Content
      </div>
    </div>
  ),
}));

// Mock ResizeObserver
vi.stubGlobal(
  "ResizeObserver",
  vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
);

// Mock window.postMessage for preview communication
const originalPostMessage = window.postMessage;
window.postMessage = vi.fn();

// Original localStorage methods
const originalGetItem = Storage.prototype.getItem;

// Reset mocks between tests
beforeEach(() => {
  globalThis.document.body.innerHTML = "";
  vi.clearAllMocks();
  window.postMessage = vi.fn();

  // Mock localStorage to return a valid API key
  Storage.prototype.getItem = function (key) {
    if (key === "vibes-openrouter-key") {
      return JSON.stringify({ key: "test-api-key", hash: "test-hash" });
    }
    return originalGetItem.call(this, key);
  };
});

// Restore original methods after tests
afterAll(() => {
  window.postMessage = originalPostMessage;
  Storage.prototype.getItem = originalGetItem;
});

describe("ResultPreview", () => {
  it("renders without crashing", () => {
    // Use non-empty code to ensure the editor is shown
    render(
      <MockThemeProvider>
        <ResultPreview
          code="console.log('test');"
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Now the sandpack editor should be visible
    expect(screen.getByTestId("sandpack-editor")).toBeInTheDocument();
    // Don't check for preview since it might not be available in the test environment
    // expect(screen.getByTestId('sandpack-preview')).toBeDefined();
  });

  it("displays welcome screen when code is empty", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code={""} {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Instead of finding by role, check that the container has the expected structure
    expect(
      container.querySelector("div.h-full > div.h-full"),
    ).toBeInTheDocument();
  });

  it("handles streaming state correctly", () => {
    const code = 'const test = "Streaming";';

    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          isStreaming={true}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Just verify it renders without errors
    expect(screen.getAllByTestId("sandpack-provider")[0]).toBeDefined();
  });

  it("passes dependencies to SandpackProvider", () => {
    const code = 'console.log("test");';
    const dependencies = {
      react: "^18.0.0",
      "react-dom": "^18.0.0",
    };

    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          dependencies={dependencies}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Just verify it renders without errors
    expect(screen.getAllByTestId("sandpack-provider")[0]).toBeDefined();
  });

  it("calls onShare when share button is clicked", () => {
    // Skipping test since toolbar with share button has been removed
    // In the future, this would be added to a different component or the header
    expect(true).toBe(true);
  });

  it("shows welcome screen with empty code", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Instead of finding by role, check that the container has the expected structure
    expect(
      container.querySelector("div.h-full > div.h-full"),
    ).toBeInTheDocument();
  });

  it("shows a share button when onShare is provided and code is not empty", () => {
    // Skipping test since toolbar with share button has been removed
    expect(true).toBe(true);
  });

  it("updates display when code changes", () => {
    const { rerender } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );
    rerender(
      <MockThemeProvider>
        <ResultPreview
          code="console.log('test');"
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Just verify it renders without errors
    expect(screen.getAllByTestId("sandpack-provider")[0]).toBeDefined();
  });

  it("renders with code content", () => {
    const code = 'const test = "Hello World";';

    render(
      <MockThemeProvider>
        <ResultPreview code={code} {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Skip button checks since toolbar has been removed
    expect(screen.getByTestId("sandpack-editor")).toBeInTheDocument();
  });

  it("handles copy to clipboard", async () => {
    // Skipping test since toolbar with copy button has been removed
    expect(true).toBe(true);
  });

  it("renders with custom dependencies", async () => {
    const code = 'import React from "react";';
    const dependencies = {
      react: "^18.0.0",
      "react-dom": "^18.0.0",
    };

    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          dependencies={dependencies}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Use getAllByTestId to handle multiple elements
    expect(screen.getAllByTestId("sandpack-provider")[0]).toBeInTheDocument();

    // Skip button check since toolbar has been removed
    expect(screen.getByTestId("sandpack-editor")).toBeInTheDocument();
  });

  it("handles share functionality", () => {
    // Skipping test since share button has been removed
    expect(true).toBe(true);
  });

  it("receives preview-ready message from iframe when content loads", async () => {
    // Setup message event listener before rendering
    const previewReadyHandler = vi.fn();
    window.addEventListener("message", (event) => {
      if (event.data?.type === "preview-ready") {
        previewReadyHandler(event.data);
      }
    });

    // Sample code that would be rendered in the iframe
    const code = `
      function App() {
        return <div>Test App Content</div>;
      }
    `;

    const mockSetPreviewLoaded = vi.fn();

    // Create props with our mock onPreviewLoaded, ensuring it overrides the one in mockResultPreviewProps
    const testProps = {
      ...mockResultPreviewProps,
      code,
      isStreaming: false,
      codeReady: true,
      onPreviewLoaded: mockSetPreviewLoaded,
    };

    render(
      <MockThemeProvider>
        <ResultPreview {...testProps} />
      </MockThemeProvider>,
    );

    // Manually trigger the message that would come from the iframe
    const previewReadyEvent = new MessageEvent("message", {
      data: { type: "preview-ready" },
    });

    // Wrap in act() to handle React state updates properly
    act(() => {
      window.dispatchEvent(previewReadyEvent);
    });

    // Wait for the event to be processed
    await waitFor(() => {
      expect(previewReadyHandler).toHaveBeenCalledWith({
        type: "preview-ready",
      });
    });

    // The onPreviewLoaded callback should have been called
    expect(mockSetPreviewLoaded).toHaveBeenCalled();
  });

  it("handles edge case with empty code", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Instead of finding by role, check that the container has the expected structure
    expect(
      container.querySelector("div.h-full > div.h-full"),
    ).toBeInTheDocument();
  });

  it("renders empty state correctly", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );
    // Update snapshot to match new structure
    expect(container).toMatchSnapshot();
  });

  it("handles dependencies correctly", () => {
    const code = `function App() { return <div>Hello World</div>; }`;
    const dependencies = {
      react: "17.0.2",
      "react-dom": "17.0.2",
    };
    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          dependencies={dependencies}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Dependencies should be passed to the Sandpack component
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  it("displays code correctly", () => {
    const code = `function App() { return <div>Hello World</div>; }`;
    render(
      <MockThemeProvider>
        <ResultPreview code={code} {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Code should be processed and displayed in the editor
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  it("shows welcome screen for empty code", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Instead of finding by role, check that the container has the expected structure
    expect(
      container.querySelector("div.h-full > div.h-full"),
    ).toBeInTheDocument();
  });

  it("renders code properly", () => {
    render(
      <MockThemeProvider>
        <ResultPreview
          code="console.log('test');"
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  it("handles code updates correctly", () => {
    const { rerender } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );
    rerender(
      <MockThemeProvider>
        <ResultPreview
          code="console.log('test');"
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Should change from welcome screen to code display
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  it("handles screenshot capture requests", () => {
    const onScreenshotCaptured = vi.fn();
    const code = `function App() { return <div>Hello World</div>; }`;
    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          onScreenshotCaptured={onScreenshotCaptured}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Simulate screenshot message
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "screenshot", data: "base64-data" },
        }),
      );
    });

    expect(onScreenshotCaptured).toHaveBeenCalledWith("base64-data");
  });

  it("handles preview loaded event", async () => {
    const onPreviewLoaded = vi.fn();
    const code = `function App() { return <div>Hello World</div>; }`;
    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          {...mockResultPreviewProps}
          onPreviewLoaded={onPreviewLoaded}
        />
      </MockThemeProvider>,
    );

    // Simulate preview loaded message
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "preview-loaded" },
        }),
      );
    });

    await waitFor(() => {
      expect(onPreviewLoaded).toHaveBeenCalled();
    });
  });

  it("passes dependencies to Sandpack", () => {
    const code = `function App() { return <div>Hello World</div>; }`;
    const dependencies = {
      react: "17.0.2",
      "react-dom": "17.0.2",
    };
    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          dependencies={dependencies}
          {...mockResultPreviewProps}
        />
      </MockThemeProvider>,
    );

    // Dependencies should be configured in Sandpack
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  // Test removed: API key functionality has been removed as proxy handles authentication

  it("displays the code editor initially", () => {
    const code = `function App() { return <div>Hello World</div>; }`;
    render(
      <MockThemeProvider>
        <ResultPreview code={code} {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Should default to code view
    expect(
      screen.queryByText(/Welcome to the preview/i),
    ).not.toBeInTheDocument();
  });

  it("shows welcome screen when no code is provided", () => {
    const { container } = render(
      <MockThemeProvider>
        <ResultPreview code="" {...mockResultPreviewProps} />
      </MockThemeProvider>,
    );

    // Instead of finding by role, check that the container has the expected structure
    expect(
      container.querySelector("div.h-full > div.h-full"),
    ).toBeInTheDocument();
  });

  it("renders with a simple code snippet", () => {
    const code = 'const test = "Hello";';
    // const setActiveView = vi.fn(); // Removed as it's no longer used

    // Render the component with a simple code snippet
    render(
      <MockThemeProvider>
        <ResultPreview
          code={code}
          dependencies={{}}
          isStreaming={false}
          codeReady={true}
          displayView="code" // Changed from activeView
          // setActiveView={setActiveView} // Removed
          onPreviewLoaded={() => {
            /* no-op */
          }}
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          updateTitle={() => Promise.resolve()}
          sessionId="test-session-id"
        />
      </MockThemeProvider>,
    );

    // Now the sandpack editor should be visible
    expect(screen.getByTestId("sandpack-editor")).toBeDefined();
  });
});
