import React, { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { VibesTheme } from "@vibes.diy/prompts";
import { parseDesignMd } from "@vibes.diy/prompts";
import { Button } from "./ui/button.js";

interface ThemePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (theme: VibesTheme) => void;
  selectedSlug?: string;
  themes: VibesTheme[];
}

interface ThemeCardProps {
  theme: VibesTheme;
  isSelected: boolean;
  fontLabel?: string;
  scrollRoot: HTMLElement | null;
  onSelect: (theme: VibesTheme) => void;
}

// Lazy-mount the iframe only when the card scrolls into the modal viewport.
// We watch the card itself rather than the iframe, so the swatch shows
// immediately and the iframe document fetch is deferred until the card is
// near-visible. Once mounted we don't unmount — re-mounting on scroll-back
// would re-fetch + flicker, and 43 tiny static HTMLs is well within budget.
function ThemeCard({ theme, isSelected, fontLabel, scrollRoot, onSelect }: ThemeCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setMounted(true);
            observer.disconnect();
            return;
          }
        }
      },
      // 200px rootMargin = pre-mount cards just below the fold so they're
      // ready by the time the user scrolls them into view.
      { root: scrollRoot, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, scrollRoot]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelect(theme)}
      className={
        isSelected
          ? "flex flex-col overflow-hidden rounded-[5px] border-2 border-blue-500 bg-white shadow-[3px_3px_0px_0px_#3b82f6] dark:bg-gray-800"
          : "flex flex-col overflow-hidden rounded-[5px] border-2 border-gray-300 bg-white transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0px_0px_black] dark:border-gray-700 dark:bg-gray-800 dark:hover:shadow-[2px_2px_0px_0px_white]"
      }
      aria-pressed={isSelected}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: theme.bgColor }}>
        {mounted && (
          <iframe
            src={`/themes/${theme.slug}.html`}
            title={theme.name}
            sandbox="allow-same-origin"
            loading="lazy"
            className="pointer-events-none absolute left-1/2 top-1/2 border-0"
            style={{
              width: 1400,
              height: 900,
              transform: "translate(-50%, -50%) scale(0.18)",
            }}
          />
        )}
        <span
          className="absolute bottom-2 left-2 inline-block h-7 w-7 rounded-full border-2 border-black/30 dark:border-white/40"
          style={{ backgroundColor: theme.accentColor }}
          aria-hidden
        />
      </div>
      <div className="flex flex-col items-start gap-0.5 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
        <span className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{theme.name}</span>
        {fontLabel && <span className="truncate text-[0.65rem] text-gray-500 dark:text-gray-400">{fontLabel}</span>}
      </div>
    </button>
  );
}

export default function ThemePickerModal({ open, onClose, onSelect, selectedSlug, themes }: ThemePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        // FileReader.result is string | ArrayBuffer | null. We pass `readAsText`
        // below so a string is what we expect, but be explicit instead of casting.
        if (typeof reader.result !== "string") return;
        const theme = parseDesignMd(reader.result, file.name.replace(/\.md$/i, "").toLowerCase());
        onSelect(theme);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onSelect]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Track the scroll container as a ref-callback so cards can attach
  // IntersectionObservers scoped to it. setState forces a re-render once
  // the modal mounts, which is when ThemeCards subscribe.
  useEffect(() => {
    if (!open) {
      setScrollRoot(null);
      return;
    }
    setScrollRoot(scrollRef.current);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a theme"
    >
      <div className="relative flex max-h-[85vh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden rounded-[5px] border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] dark:bg-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between border-b-2 border-black px-4 py-3 dark:border-gray-700">
          <span className="text-sm font-bold uppercase tracking-wider">Choose a Theme</span>
          <div className="flex items-center gap-2">
            <Button variant="electric" size="fixed" onClick={() => fileInputRef.current?.click()} aria-label="Import DESIGN.md">
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Import .md
            </Button>
            <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileImport} className="hidden" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-gray-700 shadow-[2px_2px_0px_0px_black] hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {themes.map((theme) => {
              const fontLabel = theme.bodyFont
                ? theme.bodyFont
                    .replace(/['"]/g, "")
                    .split(",")[0]
                    .replace(/^var\(--.*\)$/, "system")
                    .trim()
                : undefined;
              return (
                <ThemeCard
                  key={theme.slug}
                  theme={theme}
                  isSelected={theme.slug === selectedSlug}
                  fontLabel={fontLabel}
                  scrollRoot={scrollRoot}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
