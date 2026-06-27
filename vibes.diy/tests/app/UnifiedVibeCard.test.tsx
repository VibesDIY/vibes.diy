import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedVibeCard } from "@vibes.diy/base";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("UnifiedVibeCard", () => {
  it("starts closed: title hidden, toggle present", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    expect(screen.queryByText("Bloom Machine")).toBeNull();
    expect(screen.getByRole("button", { name: /open vibe menu/i })).toBeTruthy();
  });

  it("opens to reveal the title when the toggle is clicked", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" appSlug="meghan/bloom" />);
    fireEvent.click(screen.getByRole("button", { name: /open vibe menu/i }));
    expect(screen.getByText("Bloom Machine")).toBeTruthy();
    expect(screen.getByText("meghan/bloom")).toBeTruthy();
  });

  it("renders chips and fires onSelectChip", () => {
    const onSelectChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={onSelectChip}
      />,
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    expect(onSelectChip).toHaveBeenCalledWith("Make it a drum kit");
  });

  it("submits the Other free-text row", () => {
    const onSubmitOther = vi.fn();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} />);
    const input = screen.getByPlaceholderText(/describe a change/i);
    fireEvent.change(input, { target: { value: "make it dark" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmitOther).toHaveBeenCalledWith("make it dark");
  });
});
