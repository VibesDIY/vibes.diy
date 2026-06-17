import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorsetPicker from "~/vibes.diy/app/components/ColorsetPicker.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Slugs must exist in the generated colorsets bundle so the picker can resolve
// `draftColorset` (the Save button + token sections only render once it does).
const OPTIONS = [
  { slug: "aether", name: "Aether Brass", accentColor: "#cfa562", bgColor: "#dcbfa6" },
  { slug: "broadsheet", name: "Broadsheet", accentColor: "#222222", bgColor: "#f5f5f0" },
];

function setup(overrides: Partial<React.ComponentProps<typeof ColorsetPicker>> = {}) {
  const onSelectPalette = vi.fn();
  const onApplyLive = vi.fn();
  const onReset = vi.fn();
  const onRegenerate = vi.fn();
  render(
    <MockThemeProvider>
      <ColorsetPicker
        options={OPTIONS}
        selectedSlug="aether"
        themeSlug="aether"
        onSelectPalette={onSelectPalette}
        onApplyLive={onApplyLive}
        onReset={onReset}
        onRegenerate={onRegenerate}
        {...overrides}
      />
    </MockThemeProvider>
  );
  return { onSelectPalette, onApplyLive, onReset, onRegenerate };
}

describe("ColorsetPicker dirty + revert", () => {
  afterEach(() => {
    globalThis.document.body.innerHTML = "";
    globalThis.localStorage.clear();
    vi.clearAllMocks();
  });

  it("highlights Save when the draft is dirty and reverts the preview on close", async () => {
    const { onSelectPalette, onApplyLive, onRegenerate } = setup();

    fireEvent.click(screen.getByRole("button", { name: /palette/i }));

    // Save button appears once the colorset bundle resolves; clean on open.
    const save = await screen.findByRole("button", { name: /^save palette$/i });
    expect(save).toHaveAttribute("aria-label", "Save palette");

    // Pick a different palette → instant live preview + dirty highlight.
    fireEvent.click(screen.getByRole("button", { name: /use broadsheet palette/i }));
    expect(onSelectPalette).toHaveBeenCalledWith("broadsheet");
    await waitFor(() => expect(screen.getByRole("button", { name: /save palette \(unsaved changes\)/i })).toBeInTheDocument());
    // The preview push carried real tokens (non-empty colors).
    const previewCall = onApplyLive.mock.calls.at(-1);
    expect(Object.keys(previewCall?.[0] ?? {}).length).toBeGreaterThan(0);

    // Close without saving → the preview reverts (empty colors clear the
    // injected override) and onRegenerate was never called.
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onApplyLive.mock.calls.at(-1)?.[0]).toEqual({}));
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("does not revert when the popup is closed via Save", async () => {
    const { onApplyLive, onRegenerate } = setup();

    fireEvent.click(screen.getByRole("button", { name: /palette/i }));
    await screen.findByRole("button", { name: /^save palette$/i });

    fireEvent.click(screen.getByRole("button", { name: /use broadsheet palette/i }));
    const save = await screen.findByRole("button", { name: /save palette \(unsaved changes\)/i });

    fireEvent.click(save);

    expect(onRegenerate).toHaveBeenCalledTimes(1);
    // Saving keeps the previewed palette on screen — no empty revert push.
    expect(onApplyLive.mock.calls.at(-1)?.[0]).not.toEqual({});
  });

  it("does not treat hydrated localStorage overrides as dirty or wipe them on close", async () => {
    const key = "vibes-palette-test-key";
    // Seed a saved override for the active palette, as a prior session would.
    globalThis.localStorage.setItem(
      key,
      JSON.stringify({ version: 1, colorTheme: "aether", edits: { light: { accent: "#ff0000" } } })
    );

    const { onApplyLive } = setup({ storageKey: key });

    fireEvent.click(screen.getByRole("button", { name: /palette/i }));

    // Hydration runs after the bundle loads (post-open); the baseline must be
    // refreshed to the hydrated state so the restored override reads as clean.
    const save = await screen.findByRole("button", { name: /^save palette$/i });
    await waitFor(() => expect(save).toHaveAttribute("aria-label", "Save palette"));

    // Closing without changes must not wipe the saved override: no empty
    // revert push, and the localStorage entry survives.
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /save palette/i })).toBeNull());
    expect(onApplyLive.mock.calls.at(-1)?.[0]).not.toEqual({});
    expect(globalThis.localStorage.getItem(key)).not.toBeNull();
  });
});
