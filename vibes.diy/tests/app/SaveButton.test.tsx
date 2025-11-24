import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveButton } from "~/vibes.diy/app/components/ResultPreview/SaveButton.js";

describe("SaveButton", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe("Rendering", () => {
    it("does not render if hasChanges is false", () => {
      const { queryByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={false}
          testId="save-button-1"
        />,
      );
      expect(queryByTestId("save-button-1")).toBeNull();
    });

    it("renders button when hasChanges is true", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          testId="save-button-2"
        />,
      );
      expect(getByTestId("save-button-2")).toBeInTheDocument();
    });
  });

  describe("Without errors", () => {
    it("button shows 'Save' text", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          syntaxErrorCount={0}
          testId="save-button-3"
        />,
      );
      const button = getByTestId("save-button-3");
      expect(button).toHaveTextContent("Save");
    });

    it("button is enabled and calls onClick when clicked", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          syntaxErrorCount={0}
          testId="save-button-4"
        />,
      );
      const button = getByTestId("save-button-4");
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("With errors", () => {
    it("button shows singular error message and is disabled", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          syntaxErrorCount={1}
          testId="save-button-5"
        />,
      );
      const button = getByTestId("save-button-5");
      expect(button).toHaveTextContent("1 Error");
      expect(button).toBeDisabled();
    });

    it("button shows plural error message and is disabled", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          syntaxErrorCount={3}
          testId="save-button-6"
        />,
      );
      const button = getByTestId("save-button-6");
      expect(button).toHaveTextContent("3 Errors");
      expect(button).toBeDisabled();
    });
  });

  describe("Props handling", () => {
    it("handles undefined syntaxErrorCount as 0", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          testId="save-button-7"
        />,
      );
      const button = getByTestId("save-button-7");
      expect(button).toHaveTextContent("Save");
    });

    it("applies correct color variant when no errors", () => {
      const { getByTestId } = render(
        <SaveButton
          onClick={mockOnClick}
          hasChanges={true}
          syntaxErrorCount={0}
          color="retro"
          testId="save-button-8"
        />,
      );
      const button = getByTestId("save-button-8");
      expect(button.className).toContain("bg-orange-400");
    });
  });
});
