import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewControls } from "~/vibes.diy/app/components/ResultPreview/ViewControls.js";

describe("ViewControls", () => {
  const mockViewControls = {
    preview: {
      enabled: true,
      icon: "app-icon",
      label: "App",
      loading: false,
    },
    code: {
      enabled: true,
      icon: "code-icon",
      label: "Code",
      loading: false,
    },
    data: {
      enabled: true,
      icon: "data-icon",
      label: "Data",
      loading: false,
    },
    settings: {
      enabled: true,
      icon: "export-icon",
      label: "Settings",
      loading: false,
    },
  };

  // Mock the SVG icons
  vi.mock("~/vibes.diy/app/components/HeaderContent/SvgIcons", () => ({
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
    SettingsIcon: ({ className }: { className: string }) => (
      <span data-testid="settings-icon" className={className}>
        Settings Icon
      </span>
    ),
  }));

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders all view controls", () => {
    render(<ViewControls viewControls={mockViewControls} currentView="preview" />);

    // Check that all buttons are rendered
    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Check that the icons are rendered
    expect(screen.getByTestId("preview-icon")).toBeInTheDocument();
    expect(screen.getByTestId("code-icon")).toBeInTheDocument();
    expect(screen.getByTestId("data-icon")).toBeInTheDocument();
    expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
  });

  it("highlights the current view", () => {
    render(<ViewControls viewControls={mockViewControls} currentView="code" />);

    // Get all buttons
    const appButton = screen.getByText("App").closest("button");
    const codeButton = screen.getByText("Code").closest("button");
    const dataButton = screen.getByText("Data").closest("button");
    const settingsButton = screen.getByText("Settings").closest("button");

    // Check that the code button has the active class
    expect(codeButton?.className).toContain("bg-light-background-00");

    // Check that the other buttons don't have the active class
    expect(appButton?.className).not.toContain("bg-light-background-00");
    expect(dataButton?.className).not.toContain("bg-light-background-00");
    expect(settingsButton?.className).not.toContain("bg-light-background-00");
  });

  it("disables buttons when enabled is false", () => {
    const disabledControls = {
      ...mockViewControls,
      data: {
        ...mockViewControls.data,
        enabled: false,
      },
    };

    render(<ViewControls viewControls={disabledControls} currentView="preview" />);

    // Get all buttons
    const appButton = screen.getByText("App").closest("button");
    const codeButton = screen.getByText("Code").closest("button");
    const dataButton = screen.getByText("Data").closest("button");
    const settingsButton = screen.getByText("Settings").closest("button");

    // Check that the data button is disabled
    expect(dataButton).toBeDisabled();

    // Check that the other buttons are not disabled
    expect(appButton).not.toBeDisabled();
    expect(codeButton).not.toBeDisabled();
    expect(settingsButton).not.toBeDisabled();
  });

  it("calls onClick handler when a button is clicked", () => {
    const mockOnClick = vi.fn();

    render(<ViewControls viewControls={mockViewControls} currentView="preview" onClick={mockOnClick} />);

    // Click the Code button
    fireEvent.click(screen.getByText("Code"));

    // Check that the onClick handler was called with the correct view
    expect(mockOnClick).toHaveBeenCalledWith("code");

    // Click the Data button
    fireEvent.click(screen.getByText("Data"));

    // Check that the onClick handler was called with the correct view
    expect(mockOnClick).toHaveBeenCalledWith("data");

    // Click the Settings button
    fireEvent.click(screen.getByText("Settings"));

    // Check that the onClick handler was called with the correct view
    expect(mockOnClick).toHaveBeenCalledWith("settings");
  });

  it("properly navigates between views when onClick is provided", () => {
    // This test simulates the fix we implemented for the navigation issue
    const mockNavigateToView = vi.fn();

    render(<ViewControls viewControls={mockViewControls} currentView="preview" onClick={mockNavigateToView} />);

    // Test navigation to code view
    fireEvent.click(screen.getByText("Code"));
    expect(mockNavigateToView).toHaveBeenCalledWith("code");
    mockNavigateToView.mockClear();

    // Test navigation to data view
    fireEvent.click(screen.getByText("Data"));
    expect(mockNavigateToView).toHaveBeenCalledWith("data");
    mockNavigateToView.mockClear();

    // Test navigation to settings view
    fireEvent.click(screen.getByText("Settings"));
    expect(mockNavigateToView).toHaveBeenCalledWith("settings");
    mockNavigateToView.mockClear();

    // Render with a different current view
    const { unmount } = render(<ViewControls viewControls={mockViewControls} currentView="code" onClick={mockNavigateToView} />);
    unmount();

    // Render again with code as current view
    render(<ViewControls viewControls={mockViewControls} currentView="code" onClick={mockNavigateToView} />);

    // Test navigation to app view - use a more specific selector
    // Get the button that contains the App text and has the preview icon
    const appButtons = screen.getAllByText("App");
    const appButton = appButtons.find((el) => {
      // Find the button that contains the preview icon
      const button = el.closest("button");
      return button && button.querySelector('[data-testid="preview-icon"]');
    });

    if (appButton) {
      fireEvent.click(appButton);
      expect(mockNavigateToView).toHaveBeenCalledWith("preview");
    } else {
      throw new Error("App button with preview icon not found");
    }
  });

  it("does not call onClick when disabled button is clicked", () => {
    const mockOnClick = vi.fn();
    const disabledControls = {
      ...mockViewControls,
      data: {
        ...mockViewControls.data,
        enabled: false,
      },
    };

    render(<ViewControls viewControls={disabledControls} currentView="preview" onClick={mockOnClick} />);

    // Try to click the disabled Data button
    const dataButton = screen.getByText("Data").closest("button");
    if (dataButton) {
      fireEvent.click(dataButton);
    }

    // Check that the onClick handler was not called
    expect(mockOnClick).not.toHaveBeenCalled();
  });
});
