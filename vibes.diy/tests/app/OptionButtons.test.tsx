import React from "react";
import { vi, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OptionButtons } from "~/vibes.diy/app/components/OptionButtons.js";

const SAMPLE_OPTIONS = ["Add a settings page", "Make the empty state friendlier", "I'm done for now"];
const HELPER_TEXT = "These are optional. Pick one to suggest the next improvement, or type your own change.";

describe("OptionButtons", () => {
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
});
