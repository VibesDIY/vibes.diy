import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyAgentInstructionsButton } from "~/vibes.diy/app/components/vibe-editor/CopyAgentInstructionsButton.js";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("CopyAgentInstructionsButton", () => {
  it("copies the vibe-specific agent brief and flashes 'Copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Browser clipboard is permission/focus-gated in the test runner — stub it.
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<CopyAgentInstructionsButton ownerHandle="jchris" appSlug="hat-smeller" />);
    const btn = screen.getByRole("button", { name: /instructions for your coding agent/i });
    expect(btn.textContent).toBe("Copy agent instructions");

    fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("npx vibes-diy pull jchris/hat-smeller --dir hat-smeller");
    expect(copied).toContain("npx vibes-diy help");
    expect(copied).toContain("npx vibes-diy login");

    // The async clipboard resolve flips the label to "Copied".
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /instructions for your coding agent/i }).textContent).toBe("Copied")
    );
  });

  it("stays silent (no throw) when the clipboard write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<CopyAgentInstructionsButton ownerHandle="a" appSlug="b" />);
    const btn = screen.getByRole("button", { name: /instructions for your coding agent/i });
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalled();
    // Label never flips to "Copied" on failure.
    await new Promise((r) => setTimeout(r, 20));
    expect(btn.textContent).toBe("Copy agent instructions");
  });
});
