import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { OptionButtons } from "@vibes.diy/base";

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

  it("renders a custom firstMessage in place of the default explainer", () => {
    const { container } = render(
      <OptionButtons options={SAMPLE_OPTIONS} isFirst firstMessage="Describe a change to edit this app live." />
    );
    expect(container.textContent).toContain("Describe a change to edit this app live.");
    expect(container.textContent).not.toContain(HELPER_TEXT);
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

  // Per-option decoration (#2917): a `badge` inside the option button + an
  // interactive `aside` rendered as a SIBLING (a button can't nest a button).
  it("renders a per-option badge inside the option and a sibling aside control", () => {
    const onAside = vi.fn();
    const { getByText, getByTestId } = render(
      <OptionButtons
        options={SAMPLE_OPTIONS}
        decorate={(o) =>
          o === "Add a settings page"
            ? { badge: <span data-testid="badge">★</span>, aside: <button onClick={onAside}>aside</button> }
            : undefined
        }
      />
    );
    // The badge lives inside the decorated option's own button.
    const badge = getByTestId("badge");
    expect(badge.closest("button")?.textContent).toContain("Add a settings page");
    // The aside is a SIBLING button — clicking it does NOT select the option.
    const onSelect = vi.fn();
    fireEvent.click(getByText("aside"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onAside).toHaveBeenCalledTimes(1);
    // The aside button is not nested inside the option button (invalid HTML).
    expect(getByText("aside").closest("button")).not.toBe(getByText("Add a settings page").closest("button"));
  });

  it("leaves undecorated options as plain full-width buttons (no behavior change)", () => {
    const onSelect = vi.fn();
    const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} decorate={() => undefined} />);
    fireEvent.click(getByText("Add a settings page"));
    expect(onSelect).toHaveBeenCalledWith("Add a settings page");
  });
});
