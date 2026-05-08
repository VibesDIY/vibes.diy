import React, { useEffect, useRef, useCallback } from "react";
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

export default function ThemePickerModal({ open, onClose, onSelect, selectedSlug, themes }: ThemePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const theme = parseDesignMd(content, file.name.replace(/\.md$/i, "").toLowerCase());
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

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {themes.map((theme) => {
              const isSelected = theme.slug === selectedSlug;
              const fontLabel = theme.bodyFont
                ? theme.bodyFont
                    .replace(/['"]/g, "")
                    .split(",")[0]
                    .replace(/^var\(--.*\)$/, "system")
                    .trim()
                : undefined;
              return (
                <button
                  key={theme.slug}
                  type="button"
                  onClick={() => onSelect(theme)}
                  className={
                    isSelected
                      ? "flex flex-col overflow-hidden rounded-[5px] border-2 border-blue-500 bg-white shadow-[3px_3px_0px_0px_#3b82f6] dark:bg-gray-800"
                      : "flex flex-col overflow-hidden rounded-[5px] border-2 border-gray-300 bg-white transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0px_0px_black] dark:border-gray-700 dark:bg-gray-800 dark:hover:shadow-[2px_2px_0px_0px_white]"
                  }
                  aria-pressed={isSelected}
                >
                  <div
                    className="flex aspect-[16/10] w-full items-end justify-start p-3"
                    style={{ backgroundColor: theme.bgColor }}
                  >
                    <span
                      className="inline-block h-7 w-7 rounded-full border-2 border-black/30 dark:border-white/40"
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
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
