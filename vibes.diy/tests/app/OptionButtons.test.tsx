import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { OptionButtons } from "~/vibes.diy/app/components/OptionButtons.js";

const SAMPLE_OPTIONS = ["Add a settings page", "Make the empty state friendlier", "I'm done for now"];
const HELPER_TEXT = "These are optional. Pick one to suggest the next improvement, or type your own change.";

describe("OptionButtons", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
  });

  it("renders the explainer above the buttons when isFirst is true", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} isFirst={true} onSelect={onSelect} />);
    expect(container.textContent).toContain(HELPER_TEXT);
  });

  it("omits the explainer when isFirst is false", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} isFirst={false} onSelect={onSelect} />);
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });

  it("omits the explainer when isFirst is omitted (default false)", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });

  it("renders nothing when options is empty, even if isFirst is true", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={[]} isFirst={true} onSelect={onSelect} />);
    // The component returns null when options is empty — the helper should not appear standalone.
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });

  it("disables every chip after one is clicked", () => {
    const onSelect = vi.fn();
    const { getByText, getAllByRole } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
    fireEvent.click(getByText("Add a settings page"));
    for (const btn of getAllByRole("button")) {
      expect(btn).toBeDisabled();
    }
  });

  it("calls onSelect exactly once even if a chip is clicked repeatedly", () => {
    const onSelect = vi.fn();
    const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
    const chip = getByText("Add a settings page");
    fireEvent.click(chip);
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Add a settings page");
  });

  it("releases the selected lock after a failed async select", async () => {
    let settleFirstSelect: (ok: boolean) => void = () => {
      throw new Error("first select promise not initialized");
    };
    const firstSelect = new Promise<boolean>((resolve) => {
      settleFirstSelect = resolve;
    });
    const onSelect = vi.fn();
    onSelect.mockImplementationOnce(() => firstSelect);
    onSelect.mockImplementation(() => Promise.resolve(true));

    const { getByText, getAllByRole } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);

    const firstChipButton = getByText("Add a settings page").closest("button");
    const secondChip = getByText("Make the empty state friendlier");

    fireEvent.click(getByText("Add a settings page"));

    expect(firstChipButton).toHaveAttribute("aria-pressed", "true");
    for (const btn of getAllByRole("button")) {
      expect(btn).toBeDisabled();
    }

    settleFirstSelect(false);

    await waitFor(() => {
      expect(firstChipButton).toHaveAttribute("aria-pressed", "false");
      for (const btn of getAllByRole("button")) {
        expect(btn).not.toBeDisabled();
      }
    });

    fireEvent.click(secondChip);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("Make the empty state friendlier");
  });

  it("marks the clicked chip as pressed via aria-pressed", () => {
    const onSelect = vi.fn();
    const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
    fireEvent.click(getByText("Make the empty state friendlier"));
    expect(getByText("Make the empty state friendlier").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("does not select or call onSelect when the group is disabled (history)", () => {
    const onSelect = vi.fn();
    const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} disabled onSelect={onSelect} />);
    fireEvent.click(getByText("Add a settings page"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(getByText("Add a settings page").closest("button")).toHaveAttribute("aria-pressed", "false");
  });
});
