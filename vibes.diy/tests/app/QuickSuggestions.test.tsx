import React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import QuickSuggestions from "~/vibes.diy/app/components/QuickSuggestions.js";

// Mock Link component from react-router-dom since PublishedVibeCard uses it
vi.mock("react-router-dom", () => {
  return {
    Link: vi.fn(({ to, children, onClick, ...props }) => {
      return React.createElement(
        "a",
        {
          "data-testid": "router-link",
          href: to,
          onClick: onClick,
          ...props,
        },
        children,
      );
    }),
  };
});

describe("QuickSuggestions", () => {
  it("renders multiple suggestion buttons", () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <QuickSuggestions onSelectSuggestion={onSelectSuggestion} />,
    );

    // Get all buttons in the component
    const buttons = container.querySelectorAll("button");

    // Verify that multiple suggestion buttons are rendered
    expect(buttons.length).toBeGreaterThan(3);
  });

  it("handles suggestion click with correct callback", () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <QuickSuggestions onSelectSuggestion={onSelectSuggestion} />,
    );

    // Get the first button (any button would work for this test)
    const buttons = container.querySelectorAll("button");
    const firstButton = buttons[0];

    // Verify button exists and is clickable

    // Click the button
    fireEvent.click(firstButton);

    // Verify the callback was called
    expect(onSelectSuggestion).toHaveBeenCalled();

    // Verify the callback was called with a string (we don't test the exact string
    // to make the test more resilient to content changes)
    const callArgument = onSelectSuggestion.mock.calls[0][0];
    expect(typeof callArgument).toBe("string");
    expect(callArgument.length).toBeGreaterThan(10); // Should be a substantial text prompt
  });

  it("renders buttons with appropriate styling", () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <QuickSuggestions onSelectSuggestion={onSelectSuggestion} />,
    );

    // Get a sample button
    const button = container.querySelector("button");

    // Check that it has expected styling classes
    expect(button).toHaveClass("rounded-md");
    expect(button).toHaveClass("cursor-pointer");
  });
});

  it("supports select-all checkbox to auto-fill combined features", () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <QuickSuggestions onSelectSuggestion={onSelectSuggestion} />,
    );

    const selectAll = container.querySelector(
      'input[aria-label="Select all suggested features"]',
    ) as HTMLInputElement | null;
    expect(selectAll).not.toBeNull();

    if (selectAll) {
      // Click the select-all checkbox
      fireEvent.click(selectAll);

      // Verify callback was invoked with a combined string
      expect(onSelectSuggestion).toHaveBeenCalled();
      const arg = onSelectSuggestion.mock.calls[0][0];
      expect(typeof arg).toBe("string");
      // Combined prompt should contain multiple lines joined with dashes
      expect(arg.includes("- ")).toBe(true);
    }
  });
