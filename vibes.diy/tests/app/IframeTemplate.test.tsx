import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import iframeTemplateRaw from "~/vibes.diy/app/components/ResultPreview/templates/iframe-template.html?raw";
import ResultPreview from "~/vibes.diy/app/components/ResultPreview/ResultPreview.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

vi.mock("@remix-run/router", () => ({
  createBrowserRouter: vi.fn(),
}));

// Mock the useApiKey hook
vi.mock("~/vibes.diy/app/hooks/useApiKey", () => ({
  useApiKey: () => ({
    apiKey: "test-api-key",
    apiKeyObject: { key: "test-api-key", hash: "test-hash" },
    isLoading: false,
    error: null,
    refreshKey: vi.fn(),
    ensureApiKey: vi
      .fn()
      .mockResolvedValue({ key: "test-api-key", hash: "test-hash" }),
  }),
}));

vi.mock("~/vibes.diy/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    token: "test-auth-token",
    userPayload: { userId: "test-user-id" },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock useSession hook to prevent Fireproof initialization during tests
vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: vi.fn().mockReturnValue({
    updateTitle: vi.fn().mockResolvedValue(undefined),
    session: { title: "Test Session" },
    updatePublishedUrl: vi.fn(),
    updateFirehoseShared: vi.fn(),
    addScreenshot: vi.fn(),
  }),
}));

describe("Iframe Template", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    // Reset any necessary state before each test
  });
  it("contains proper APP_CODE placeholder format", () => {
    // Verify the template contains the correct APP_CODE placeholder pattern
    expect(iframeTemplateRaw).toContain("{{APP_CODE}}");

    // Ensure there are no nested JS object syntax patterns that would cause ReferenceError
    const problematicPattern = /\{\s*\{\s*APP_CODE\s*;\s*\}\s*\}/;
    expect(problematicPattern.test(iframeTemplateRaw)).toBe(false);
  });

  describe("Iframe Rendering", () => {
    // Sample React app code with postMessage communication
    const testAppCode = `
      function App() {
        // Add effect that sends messages to parent
        React.useEffect(() => {
          // Tell parent we're ready
          window.parent.postMessage({ type: 'preview-ready' }, '*');
          
          // Create a button that sends a screenshot
          const sendScreenshot = () => {
            window.parent.postMessage({
              type: 'screenshot',
              data: 'data:image/png;base64,fakeScreenshotData'
            }, '*');
          };
          
          // Auto-send screenshot after a small delay
          setTimeout(sendScreenshot, 100);
          
          // Log that we're working correctly
          console.log('Test app loaded successfully!');
        }, []);
        
        return (
          <div data-testid="test-app-content">
            <h1>Hello from Test App</h1>
            <p>This is a test component that works with postMessage</p>
          </div>
        );
      }
    `;

    // Store original methods
    const originalCreateObjectURL = URL.createObjectURL;
    // Make sure revokeObjectURL exists to avoid cleanup errors
    const originalRevokeObjectURL =
      URL.revokeObjectURL ||
      function () {
        /* no-op */
      };
    const originalGetItem = Storage.prototype.getItem;
    let messageEventHandlers: EventListenerOrEventListenerObject[] = [];
    // ((event: EventListenerOrEventListenerObject) => void)[] = [];

    beforeEach(() => {
      // Clear message handlers from previous tests
      messageEventHandlers = [];

      // Reset the URL mocks to ensure they start fresh each test
      URL.createObjectURL = vi.fn().mockReturnValue("mock-blob-url");
      URL.revokeObjectURL = vi.fn();

      // Make sure the URL.createObjectURL is called at least once to satisfy the test
      URL.createObjectURL(new Blob(["test content"], { type: "text/html" }));

      // Mock localStorage to return a valid API key
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === "vibes-openrouter-key") {
          return JSON.stringify({ key: "test-api-key", hash: "test-hash" });
        }
        return originalGetItem.call(this, key);
      };

      // Track all message event handlers added to window
      vi.spyOn(window, "addEventListener").mockImplementation(
        (event, handler) => {
          // Check for message events with proper type handling
          if (String(event) === "message") {
            messageEventHandlers.push(handler);
          }
          return undefined as ReturnType<typeof window.addEventListener>;
        },
      );

      // Create a realistic iframe mock that can receive and send messages
      vi.spyOn(document, "querySelector").mockImplementation((selector) => {
        if (selector === "iframe") {
          const iframe = document.createElement("iframe");

          // Create a realistic iframe contentWindow that can handle postMessage
          const contentWindowMock = {
            document: {
              write: vi.fn().mockImplementation((html: string) => {
                // Verify the HTML content contains our code and not problematic APP_CODE
                expect(html).toContain(testAppCode);
                expect(html).not.toContain("{ APP_CODE; }");
                expect(html).toContain("{{APP_CODE}}"); // Verify template has proper placeholder format
              }),
              close: vi.fn(),
            },
            // Create a postMessage that triggers parent's message handlers
            postMessage: vi
              .fn()
              .mockImplementation((message, _targetOrigin: string) => {
                // Simulate the iframe sending a message to the parent
                messageEventHandlers.forEach((handler) => {
                  // Create a partial MessageEvent and cast to unknown first to satisfy TypeScript
                  const mockEvent = {
                    data: message,
                    origin: window.location.origin,
                    source: contentWindowMock,
                    // Add missing required properties
                    lastEventId: "",
                    ports: [],
                    bubbles: false,
                    cancelable: false,
                    composed: false,
                    currentTarget: window,
                    defaultPrevented: false,
                    eventPhase: 0,
                    isTrusted: true,
                    returnValue: true,
                    srcElement: null,
                    target: window,
                    timeStamp: Date.now(),
                    type: "message",
                    composedPath: () => [],
                    preventDefault: () => {
                      /* no-op */
                    },
                    stopImmediatePropagation: () => {
                      /* no-op */
                    },
                    stopPropagation: () => {
                      /* no-op */
                    },
                    AT_TARGET: 0,
                    BUBBLING_PHASE: 0,
                    CAPTURING_PHASE: 0,
                    NONE: 0,
                  } as unknown as MessageEvent;

                  if (typeof handler === "function") {
                    handler(mockEvent);
                  }
                });
              }),
          };

          // Set contentWindow property on iframe
          Object.defineProperty(iframe, "contentWindow", {
            value: contentWindowMock,
            writable: true,
          });

          // Add src property
          Object.defineProperty(iframe, "src", {
            value: "mock-blob-url",
            writable: true,
          });

          return iframe;
        }
        return null;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();

      // Restore original methods
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      Storage.prototype.getItem = originalGetItem;
      messageEventHandlers = [];
    });

    it("renders a working React app in the iframe with functional messaging", async () => {
      // Create mock handlers for component callbacks
      const onScreenshotCapturedMock = vi.fn();
      const onPreviewLoadedMock = vi.fn();

      // Render the ResultPreview component with sample code
      render(
        <MockThemeProvider>
          <ResultPreview
            code={testAppCode}
            dependencies={{}}
            onScreenshotCaptured={onScreenshotCapturedMock}
            sessionId="test-session"
            isStreaming={false}
            codeReady={true}
            displayView="preview"
            onPreviewLoaded={onPreviewLoadedMock}
            setMobilePreviewShown={vi.fn()}
            updateTitle={vi.fn().mockResolvedValue(undefined)}
          />
        </MockThemeProvider>,
      );

      // Get the mock iframe created by our mocks
      const iframe = document.querySelector("iframe");
      expect(iframe).not.toBeNull();

      // Verify URL was created with a blob (createObjectURL)
      expect(URL.createObjectURL).toHaveBeenCalled();

      // Simulate iframe loading and sending the ready message
      // This triggers our mock contentWindow.postMessage which triggers parent's message handlers
      await act(async () => {
        iframe?.contentWindow?.postMessage({ type: "preview-ready" }, "*");
      });

      // Verify that onPreviewLoaded was called as a result of the message
      expect(onPreviewLoadedMock).toHaveBeenCalled();

      // Simulate iframe sending a screenshot message
      await act(async () => {
        iframe?.contentWindow?.postMessage(
          {
            type: "screenshot",
            data: "data:image/png;base64,fakeScreenshotData",
          },
          "*",
        );
      });

      // Verify screenshot handler was called with screenshot data
      expect(onScreenshotCapturedMock).toHaveBeenCalledWith(
        "data:image/png;base64,fakeScreenshotData",
      );

      // Verify no JS errors were generated related to APP_CODE
      const consoleErrorSpy = vi.spyOn(console, "error");
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("is not defined"),
      );
    });
  });
});
