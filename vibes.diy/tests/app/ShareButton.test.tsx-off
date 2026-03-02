import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShareButton } from "~/vibes.diy/app/components/ResultPreview/ShareButton.js";

// Mock the SVG icon component
vi.mock("~/vibes.diy/app/components/HeaderContent/SvgIcons", () => ({
  PublishIcon: ({ className }: { className: string }) => <svg data-testid="publish-icon" className={className} />,
}));

describe("ShareButton", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    mockOnClick.mockReset();
  });

  it("renders with default props", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={false} urlCopied={false} />);

    // Button should be enabled and show the publish icon
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.getByTestId("publish-icon")).toBeInTheDocument();

    // Should have correct text
    expect(screen.getByText("Share")).toBeInTheDocument();

    // Should have correct aria-label and title for first-time publish
    expect(button).toHaveAttribute("aria-label", "Publish");
    expect(button).toHaveAttribute("title", "Share with the world");
  });

  it("renders with hasPublishedUrl=true", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={false} urlCopied={false} hasPublishedUrl={true} />);

    // Should have correct aria-label and title for sharing existing app
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Share App");
    expect(button).toHaveAttribute("title", "View and share URL");

    // Text should still be "Share"
    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("shows publishing state", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={true} urlCopied={false} />);

    // Button should be disabled when publishing
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    // Should show the loading spinner (circle)
    expect(screen.getByText("Share")).toBeInTheDocument();

    // Check for loading spinner
    const spinner = screen.getByLabelText("Publishing in progress");
    expect(spinner).toBeInTheDocument();
    expect(spinner.tagName.toLowerCase()).toBe("svg");
    expect(spinner.classList.contains("animate-spin")).toBe(true);
  });

  it("shows URL copied state", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={false} urlCopied={true} />);

    // Should show URL copied text
    expect(screen.getByText("URL copied")).toBeInTheDocument();

    // Should have checkmark icon instead of publish icon
    const button = screen.getByRole("button");
    expect(screen.queryByTestId("publish-icon")).not.toBeInTheDocument();

    // Should have an SVG element (the checkmark) inside the button
    const svgElement = button.querySelector("svg");
    expect(svgElement).not.toBeNull();
    expect(svgElement).toHaveClass("text-green-500");

    // Should have correct aria-label and title on button
    expect(button).toHaveAttribute("aria-label", "URL copied to clipboard");
    expect(button).toHaveAttribute("title", "URL copied to clipboard");
  });

  it("calls onClick when clicked", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={false} urlCopied={false} />);

    // Click the button
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Should call the onClick handler
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    render(<ShareButton onClick={mockOnClick} isPublishing={true} urlCopied={false} />);

    // Try to click the disabled button
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // The onClick handler should not be called
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("accepts and uses a ref", () => {
    // Create a ref
    const ref = React.createRef<HTMLButtonElement>();

    render(<ShareButton ref={ref} onClick={mockOnClick} isPublishing={false} urlCopied={false} />);

    // The ref should be attached to the button
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
