import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewControls } from "~/vibes.diy/app/components/ResultPreview/ViewControls.js";

// Mock the SVG icons

vi.mock("~/vibes.diy/app/components/HeaderContent/SvgIcons.js", async (original) => {
  const actual = await original<typeof import("~/vibes.diy/app/components/HeaderContent/SvgIcons.js")>();
  return {
    ...actual,
    PreviewIcon: ({ className }: { className: string; isLoading?: boolean; title?: string }) => (
      <span data-testid="preview-icon" className={className}>
        Preview Icon
      </span>
    ),
    CodeIcon: ({ className }: { className: string; isLoading?: boolean }) => (
      <span data-testid="code-icon" className={className}>
        Code Icon
      </span>
    ),
    DataIcon: ({ className }: { className: string }) => (
      <span data-testid="data-icon" className={className}>
        Data Icon
      </span>
    ),
  };
});

describe("Navigation Fix Tests", () => {
  // Test data for the view controls
  const mockViewControls = {
    preview: {
      enabled: true,
      icon: "app-icon",
      label: "App",
    },
    code: {
      enabled: true,
      icon: "code-icon",
      label: "Code",
    },
    data: {
      enabled: true,
      icon: "data-icon",
      label: "Data",
    },
  };

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("properly passes onClick handler to buttons", () => {
    const mockNavigateToView = vi.fn();

    render(<ViewControls viewControls={mockViewControls} currentView="preview" onClick={mockNavigateToView} />);

    // Verify all buttons are rendered
    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();

    // Click the Code button
    fireEvent.click(screen.getByText("Code"));

    // Verify the onClick handler was called with the correct view
    expect(mockNavigateToView).toHaveBeenCalledWith("code");
  });

  it("navigates between different views correctly", () => {
    const mockNavigateToView = vi.fn();

    // Start with preview as current view
    const { unmount } = render(<ViewControls viewControls={mockViewControls} currentView="preview" onClick={mockNavigateToView} />);

    // Click the Data button
    fireEvent.click(screen.getByText("Data"));
    expect(mockNavigateToView).toHaveBeenCalledWith("data");
    mockNavigateToView.mockClear();

    // Unmount and remount with code as current view
    unmount();
    render(<ViewControls viewControls={mockViewControls} currentView="code" onClick={mockNavigateToView} />);

    // Click the App button
    fireEvent.click(screen.getByText("App"));
    expect(mockNavigateToView).toHaveBeenCalledWith("preview");
    mockNavigateToView.mockClear();

    // Verify the current view is highlighted correctly
    const codeButton = screen.getByText("Code").closest("button");
    expect(codeButton?.className).toContain("bg-light-background-00");
  });

  it("respects disabled state of buttons", () => {
    const mockNavigateToView = vi.fn();
    const disabledControls = {
      ...mockViewControls,
      data: {
        ...mockViewControls.data,
        enabled: false,
      },
    };

    render(<ViewControls viewControls={disabledControls} currentView="preview" onClick={mockNavigateToView} />);

    // Verify the Data button is disabled
    const dataButton = screen.getByText("Data").closest("button");
    expect(dataButton).toBeDisabled();

    // Try to click the disabled button
    fireEvent.click(screen.getByText("Data"));

    // Verify the onClick handler was not called
    expect(mockNavigateToView).not.toHaveBeenCalled();
  });
});
