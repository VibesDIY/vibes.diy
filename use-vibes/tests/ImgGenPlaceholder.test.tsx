import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { ImgGenDisplayPlaceholder } from "@vibes.diy/use-vibes-base";

describe("ImgGenDisplayPlaceholder Component", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("Base Rendering", () => {
    it("renders waiting message when no prompt", () => {
      render(<ImgGenDisplayPlaceholder prompt={undefined} progress={0} error={undefined} />);
      expect(screen.getByText("Waiting for prompt")).toBeInTheDocument();
    });

    it("renders prompt text when prompt is provided", () => {
      render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={0} error={undefined} />);
      const matches = screen.getAllByText("Test prompt");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("Error State", () => {
    it("displays error message when error is provided", () => {
      render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={0} error={new Error("Test error message")} />);
      expect(screen.getByText("Image Generation Failed")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("handles and formats JSON error messages properly", () => {
      const jsonError = new Error(
        'Error: {"error": "Custom Error Title", "details": {"error": {"message": "Custom error details"}}}'
      );
      render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={0} error={jsonError} />);
      expect(screen.getByText("Custom Error Title")).toBeInTheDocument();
      expect(screen.getByText("Custom error details")).toBeInTheDocument();
    });

    it("handles moderation blocked errors with special formatting", () => {
      const moderationError = new Error('Error: {"code": "moderation_blocked"}');
      render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={0} error={moderationError} />);
      expect(screen.getByText("Failed to generate image")).toBeInTheDocument();
      expect(screen.getByText(/Your request was rejected/)).toBeInTheDocument();
      expect(screen.getByText(/safety system/)).toBeInTheDocument();
    });
  });

  describe("Generating State", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows prompt text during generation", () => {
      render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={50} error={undefined} />);
      const matches = screen.getAllByText("Test prompt");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("renders progress bar when prompt is provided", () => {
      const { container } = render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={75} error={undefined} />);
      // Progress bar width is set after a 20ms setTimeout
      act(() => {
        vi.advanceTimersByTime(25);
      });
      const progressBar = container.querySelector('[aria-hidden="true"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: "75%" });
    });

    it("enforces minimum 5% progress", () => {
      const { container } = render(<ImgGenDisplayPlaceholder prompt="Test prompt" progress={2} error={undefined} />);
      act(() => {
        vi.advanceTimersByTime(25);
      });
      const progressBar = container.querySelector('[aria-hidden="true"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: "5%" });
    });

    it("does not render progress bar without a prompt", () => {
      const { container } = render(<ImgGenDisplayPlaceholder prompt={undefined} progress={50} error={undefined} />);
      const progressBar = container.querySelector('[aria-hidden="true"]');
      expect(progressBar).toBeNull();
    });
  });
});
