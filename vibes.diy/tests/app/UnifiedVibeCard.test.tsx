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
      />
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    expect(onSelectChip).toHaveBeenCalledWith("Make it a drum kit");
  });

  it("keeps chips clickable after a selection (no permanent lock)", () => {
    const onSelectChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={onSelectChip}
      />
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    fireEvent.click(screen.getByText("Add a high score"));
    expect(onSelectChip).toHaveBeenCalledTimes(2);
    expect(onSelectChip).toHaveBeenNthCalledWith(1, "Make it a drum kit");
    expect(onSelectChip).toHaveBeenNthCalledWith(2, "Add a high score");
  });

  it("submits the Other free-text row", () => {
    const onSubmitOther = vi.fn();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} />);
    const input = screen.getByPlaceholderText(/describe a change/i);
    fireEvent.change(input, { target: { value: "make it dark" } });
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    fireEvent.submit(form);
    expect(onSubmitOther).toHaveBeenCalledWith("make it dark");
  });

  it("fires nav callbacks and closes via the toggle", () => {
    const onHome = vi.fn();
    const onShare = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        onHome={onHome}
        onShare={onShare}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    expect(onHome).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(onShare).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /close vibe menu/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the handle stub when handleSlug is set", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" />);
    expect(screen.getByText("@meghan")).toBeTruthy();
  });

  it("shows the in-vibe edit explainer and an Edit nav button", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open chips={["Make it a drum kit"]} />);
    expect(screen.getByText("Describe a change to edit this app live.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit/i })).toBeTruthy();
  });

  it("keeps a single persistent toggle in both states (no remount/resize)", () => {
    const { rerender } = render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    // Closed: the one toggle is present and labelled "Open vibe menu".
    expect(screen.getByRole("button", { name: /open vibe menu/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /close vibe menu/i })).toBeNull();
    // Open: the SAME toggle persists, now labelled "Close vibe menu" — there is
    // never a second, differently-sized switch.
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open />);
    expect(screen.getByRole("button", { name: /close vibe menu/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open vibe menu/i })).toBeNull();
  });

  it("forwards shareButtonRef to the Share nav button (so an external popover can anchor)", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open shareButtonRef={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.getAttribute("aria-label")).toBe("Share");
  });
});
