import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StructuredMessage from "~/vibes.diy/app/components/StructuredMessage.js";
import type { Segment } from "@vibes.diy/prompts";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

describe("Streaming Content Tests", () => {
  test("renders code and markdown segments", () => {
    const segments: Segment[] = [
      {
        type: "markdown",
        content: "This is a markdown segment",
      },
      {
        type: "code",
        content: 'const x = "hello";',
      },
    ];

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
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Ensure both segments are rendered
    expect(screen.getByText("This is a markdown segment")).toBeInTheDocument();
    expect(screen.getByText('const x = "hello";')).toBeInTheDocument();
  });

  test("shows markdown content immediately when streaming", () => {
    // Arrange: Create a test message with some markdown content
    const segments = [
      { type: "markdown", content: "This is a test message" },
    ] as Segment[];

    // Act: Render the component with streaming flag
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
          navigateToView={() => {
            /* no-op */
          }}
        />
      </MockThemeProvider>,
    );

    // Assert: The content should be visible
    expect(screen.getByText("This is a test message")).toBeInTheDocument();
  });

  test('should not show "Thinking..." when content is available', () => {
    // Our streaming setup should not be showing "Thinking..." if we have content
    // This is a placeholder for checking that the UI behavior is correct
    // In the real app, "Thinking..." indicator and content should be mutually exclusive
    // This test would need to be expanded using the appropriate component hierarchy
  });
});
