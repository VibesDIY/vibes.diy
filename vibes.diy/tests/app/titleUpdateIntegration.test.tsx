import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AppSettingsView from "~/vibes.diy/app/components/ResultPreview/AppSettingsView.js";

// Mock dependencies
const mockUpdateTitle = vi.fn().mockResolvedValue(undefined);
const mockDownloadHtml = vi.fn();

describe("Title Update Integration", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("should update title when user edits it", async () => {
    // Initial title similar to what happens after app generation
    const initialTitle = "Generated App Title";

    const { rerender } = render(
      <AppSettingsView title={initialTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />
    );

    // Check initial title is displayed
    expect(screen.getByText(initialTitle)).toBeInTheDocument();

    // Click Edit button
    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    // Get the input field
    const input = screen.getByPlaceholderText("Enter app name");
    expect(input).toHaveValue(initialTitle);

    // Change the title
    const newTitle = "My Updated Title";
    fireEvent.change(input, { target: { value: newTitle } });
    expect(input).toHaveValue(newTitle);

    // Save the title
    const saveButton = screen.getByTitle("Save");
    fireEvent.click(saveButton);

    // Check that onUpdateTitle was called with the new title
    await waitFor(() => {
      expect(mockUpdateTitle).toHaveBeenCalledWith(newTitle, true);
    });

    // Simulate the prop update that should happen after save
    rerender(<AppSettingsView title={newTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />);

    // Check that the new title is displayed
    expect(screen.getByText(newTitle)).toBeInTheDocument();
  });

  it("should handle title updates via keyboard", async () => {
    const initialTitle = "Initial Title";

    render(<AppSettingsView title={initialTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />);

    // Click Edit button
    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    // Get the input field
    const input = screen.getByPlaceholderText("Enter app name");

    // Change the title
    const newTitle = "Keyboard Updated Title";
    fireEvent.change(input, { target: { value: newTitle } });

    // Press Enter to save
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Check that onUpdateTitle was called
    await waitFor(() => {
      expect(mockUpdateTitle).toHaveBeenCalledWith(newTitle, true);
    });
  });

  it("should cancel edit when Escape is pressed", async () => {
    const initialTitle = "Initial Title";

    render(<AppSettingsView title={initialTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />);

    // Click Edit button
    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    // Get the input field
    const input = screen.getByPlaceholderText("Enter app name");

    // Change the title
    fireEvent.change(input, { target: { value: "Temporary Title" } });

    // Press Escape to cancel
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    // Check that onUpdateTitle was NOT called
    expect(mockUpdateTitle).not.toHaveBeenCalled();

    // Check that the original title is still displayed
    expect(screen.getByText(initialTitle)).toBeInTheDocument();
  });

  it("should not save if title is unchanged", async () => {
    const initialTitle = "Initial Title";

    render(<AppSettingsView title={initialTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />);

    // Click Edit button
    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    // Get the input field (but don't use it)
    screen.getByPlaceholderText("Enter app name");

    // Don't change the title, just click save
    const saveButton = screen.getByTitle("Save");
    fireEvent.click(saveButton);

    // Check that onUpdateTitle was NOT called
    expect(mockUpdateTitle).not.toHaveBeenCalled();
  });

  it("should update editedName state when title prop changes", async () => {
    const initialTitle = "Initial Title";

    const { rerender } = render(
      <AppSettingsView title={initialTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />
    );

    // Check initial title is displayed
    expect(screen.getByText(initialTitle)).toBeInTheDocument();

    // Simulate title prop changing (e.g., from AI generation or database update)
    const updatedTitle = "Externally Updated Title";
    rerender(<AppSettingsView title={updatedTitle} onUpdateTitle={mockUpdateTitle} onDownloadHtml={mockDownloadHtml} />);

    // Check that the new title is displayed
    expect(screen.getByText(updatedTitle)).toBeInTheDocument();

    // Click Edit button and verify the input has the updated value
    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    const input = screen.getByPlaceholderText("Enter app name");
    expect(input).toHaveValue(updatedTitle);
  });
});
