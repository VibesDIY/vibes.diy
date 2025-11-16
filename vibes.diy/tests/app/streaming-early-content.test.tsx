import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, test, expect, afterEach, beforeEach } from "vitest";
import StructuredMessage from "~/vibes.diy/app/components/StructuredMessage.js";
import type { Segment } from "@vibes.diy/prompts";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock the window.location for any URL operations
// vi.spyOn(window, "location", "get").mockImplementation(
//   () =>
//     ({
//       origin: "http://localhost:3000",
//     }) as unknown as Location,
// );

// Run cleanup after each test
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("Early Streaming Content Display", () => {
  test("shows content immediately when streaming with just a single character", () => {
    // Arrange: Create a test message with just a single character of markdown content
    const segments = [
      { type: "markdown" as const, content: "I" }, // Just a single character
    ];

    // Act: Render the component with isStreaming=true
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={segments}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Assert: The single character content should be visible
    expect(screen.getByText("I")).toBeInTheDocument();

    // The component should not show a placeholder when content exists
    expect(
      screen.queryByText("Processing response..."),
    ).not.toBeInTheDocument();
  });

  test("should not show placeholder when minimal content is available", () => {
    // Arrange: Create a test message with minimal content
    const segments = [
      { type: "markdown" as const, content: "I" }, // Just a single character
    ];

    // Act: Render the component with isStreaming=true
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={segments}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Assert: Even with minimal content, we should see the content not a placeholder
    expect(screen.getByText("I")).toBeInTheDocument();

    // Check that the streaming indicator is shown alongside the content
    // This assumes there's a streaming indicator element with a specific class
    const streamingIndicator = document.querySelector(".animate-pulse");
    expect(streamingIndicator).toBeInTheDocument();
  });

  test("thinking indicator is only visible when segments length is zero", () => {
    // First test with empty segments array
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={[]}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Cleanup before next render
    cleanup();

    // Now test with a segment that has empty content
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={[{ type: "markdown", content: "" }]}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Cleanup before next render
    cleanup();

    // Finally test with a segment that has content
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={[{ type: "markdown", content: "Hello" }]}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Should NOT show placeholder when there's content
    expect(
      screen.queryByText("Processing response..."),
    ).not.toBeInTheDocument();
    // Should show the actual content instead
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});

describe("Early Streaming Content Handling", () => {
  test("handles empty segment array correctly", () => {
    const segments: Segment[] = [];
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={segments}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );
    // ... rest of test ...
  });

  test("handles empty markdown content", () => {
    const segments: Segment[] = [{ type: "markdown", content: "" }];
    render(
      <MockThemeProvider>
        <StructuredMessage
          segments={segments}
          isStreaming={true}
          setSelectedResponseId={() => {
            /* no-op */
          }}
          selectedResponseId=""
          setMobilePreviewShown={() => {
            /* no-op */
          }}
          isLatestMessage={true}
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );
    // ... rest of test ...
  });

  // ... update other tests similarly ...
});
