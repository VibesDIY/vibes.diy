import React from "react";
import type { VibesTheme } from "@vibes.diy/prompts";
import ColorsetPicker from "./ColorsetPicker.js";

export interface ThemeControlsProps {
  // Structural theme picker (opens the ThemePickerModal). The host owns the
  // modal + open state; this just renders the trigger button.
  selectedTheme?: VibesTheme | null;
  onThemeButtonClick?: () => void;
  // Palette picker — separate from the structural theme picker because
  // swapping the palette is a no-LLM, instant-apply action. See ColorsetPicker.
  paletteOptions?: VibesTheme[];
  selectedPaletteSlug?: string;
  onSelectPalette?: (slug: string) => void;
  onApplyLivePalette?: (colors: Record<string, string>, colorsDark?: Record<string, string>) => void;
  onResetPalette?: () => void;
  onRegeneratePalette?: (paletteSlug: string, paletteName: string, rootCssBlock: string) => void;
  paletteStorageKey?: string;
  paletteCurrentTokens?: Record<string, string>;
}

/**
 * The theme + palette control cluster: a structural-theme button (opens the
 * host's ThemePickerModal) next to the inline ColorsetPicker. Shared by the
 * legacy /chat composer (ChatInput) and the /vibe edit card so both surfaces
 * offer the same theme-changing affordances.
 */
export default function ThemeControls({
  selectedTheme,
  onThemeButtonClick,
  paletteOptions,
  selectedPaletteSlug,
  onSelectPalette,
  onApplyLivePalette,
  onResetPalette,
  onRegeneratePalette,
  paletteStorageKey,
  paletteCurrentTokens,
}: ThemeControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {onThemeButtonClick && (
        <button
          type="button"
          onClick={onThemeButtonClick}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-light-secondary dark:text-dark-secondary hover:bg-light-background-01 dark:hover:bg-dark-background-01 transition-colors"
          aria-label={selectedTheme ? `Theme: ${selectedTheme.name}` : "Choose a theme"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
          {selectedTheme ? (
            <>
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedTheme.accentColor }}
              />
              <span className="max-w-[100px] truncate">{selectedTheme.name}</span>
            </>
          ) : (
            <span>Theme</span>
          )}
        </button>
      )}
      {paletteOptions && onSelectPalette && onApplyLivePalette && onResetPalette && (
        <ColorsetPicker
          options={paletteOptions}
          selectedSlug={selectedPaletteSlug}
          themeSlug={selectedTheme?.slug}
          onSelectPalette={onSelectPalette}
          onApplyLive={onApplyLivePalette}
          onReset={onResetPalette}
          onRegenerate={onRegeneratePalette}
          storageKey={paletteStorageKey}
          currentTokens={paletteCurrentTokens}
        />
      )}
    </div>
  );
}
