import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Colorset, VibesTheme } from "@vibes.diy/prompts";

interface ColorsetPickerProps {
  options: VibesTheme[];
  selectedSlug?: string;
  themeSlug?: string;
  onSelectPalette: (slug: string) => void;
  onApplyLive: (colors: Record<string, string>, colorsDark?: Record<string, string>) => void;
  onReset: () => void;
  // Ask the LLM to regenerate the app using the current palette. The picker
  // closes itself before firing so the textarea is visible.
  onRegenerate?: (paletteSlug: string, paletteName: string) => void;
}

const POPOVER_W = 560;
const POPOVER_GAP = 8;

function Swatch({
  theme,
  isSelected,
  isReset,
  onClick,
}: {
  theme: VibesTheme;
  isSelected: boolean;
  isReset?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={isReset ? `Revert to ${theme.name} (default)` : theme.name}
      aria-label={isReset ? `Revert to ${theme.name} default palette` : `Use ${theme.name} palette`}
      aria-pressed={isSelected}
      onClick={onClick}
      className={
        isSelected
          ? "relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-blue-500 shadow-[2px_2px_0px_0px_#3b82f6]"
          : "relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-black/40 transition-transform hover:-translate-y-px hover:shadow-[2px_2px_0px_0px_black] dark:border-white/40"
      }
      style={{
        background: `linear-gradient(135deg, ${theme.bgColor} 0%, ${theme.bgColor} 60%, ${theme.accentColor} 60%, ${theme.accentColor} 100%)`,
      }}
    >
      {isReset && (
        <svg
          aria-hidden
          className="absolute right-[-3px] top-[-3px] h-3 w-3 rounded-full bg-white text-black dark:bg-gray-900 dark:text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3.5-7.1" />
          <path d="M3 4v5h5" />
        </svg>
      )}
    </button>
  );
}

// `<input type="color">` only accepts #RRGGBB. Our colorsets ship oklch, rgba,
// hsl, named colors — anything the browser understands as CSS color. We use a
// 1×1 canvas because it MUST rasterize to sRGB to produce a pixel; getComputedStyle
// alone is unreliable for newer color spaces (some browsers return "oklch(...)"
// verbatim instead of normalizing to rgb). The alpha channel doubles as a
// success signal: if the canvas refused the fillStyle, the pixel stays
// transparent (alpha 0) and we know to fall back. Alpha in the source is
// dropped — the color input has no alpha channel.
const hexCache = new Map<string, string>();
let sharedCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  sharedCtx = canvas.getContext("2d");
  return sharedCtx;
}

function cssToHex(raw: string): string {
  if (typeof document === "undefined") return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  const cached = hexCache.get(raw);
  if (cached) return cached;
  const ctx = getCtx();
  if (!ctx) return "#000000";
  // Clear to fully-transparent black so we can detect a fill that was rejected
  // by comparing alpha. clearRect resets every channel to 0.
  ctx.clearRect(0, 0, 1, 1);
  // Some browsers throw on unrecognized fillStyle; most just ignore it. Wrap
  // both paths so a malformed source can't crash the picker.
  try {
    ctx.fillStyle = raw;
  } catch {
    hexCache.set(raw, "#000000");
    return "#000000";
  }
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const [r, g, b, a] = [data[0], data[1], data[2], data[3]];
  if (a === 0) {
    // fillStyle was silently rejected — the canvas is still transparent.
    hexCache.set(raw, "#000000");
    return "#000000";
  }
  const hex = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  hexCache.set(raw, hex);
  return hex;
}

export default function ColorsetPicker({
  options,
  selectedSlug,
  themeSlug,
  onSelectPalette,
  onApplyLive,
  onReset,
  onRegenerate,
}: ColorsetPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftSlug, setDraftSlug] = useState<string | undefined>(selectedSlug ?? themeSlug);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Fixed-position offsets computed from the trigger's bounding rect. We
  // recompute on open + on window resize/scroll so the popover stays
  // anchored when the layout shifts.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [lookupColorset, setLookupColorset] = useState<((slug: string) => Colorset | undefined) | null>(null);

  useEffect(() => {
    if (!open || lookupColorset || typeof window === "undefined") return;
    let cancelled = false;
    void import("../../../../prompts/pkg/themes/colorsets-bundle.js")
      .then((mod) => {
        if (!cancelled) setLookupColorset(() => mod.getColorsetBySlug);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, lookupColorset]);

  useEffect(() => {
    if (!open) setDraftSlug(selectedSlug ?? themeSlug);
  }, [selectedSlug, themeSlug, open]);

  const recompute = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Default: open upward (popover sits above the button, common for
    // chat-input toolbars). Clamp left so the popover stays on screen.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_W, vw - 16);
    let left = rect.left;
    if (left + width + 8 > vw) left = vw - width - 8;
    if (left < 8) left = 8;
    // The popover doesn't have a measured height yet on first open — pick a
    // reasonable cap (340) for the upward/downward decision and let the
    // popover scroll if it overflows.
    const cap = 340;
    let top = rect.top - POPOVER_GAP - cap;
    if (top < 8) {
      // Not enough room above — open downward instead.
      top = Math.min(rect.bottom + POPOVER_GAP, vh - cap - 8);
    }
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    recompute();
  }, [open, recompute]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => recompute();
    const onScroll = () => recompute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, recompute]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const draftColorset: Colorset | undefined = useMemo(
    () => (draftSlug && lookupColorset ? lookupColorset(draftSlug) : undefined),
    [draftSlug, lookupColorset]
  );

  useEffect(() => {
    if (!open || !draftColorset) return;
    const nextColors = { ...draftColorset.colors, ...edits };
    onApplyLive(nextColors, draftColorset.colorsDark);
  }, [draftColorset, edits, onApplyLive, open]);

  const resetTheme = themeSlug ? options.find((t) => t.slug === themeSlug) : undefined;
  const isOverridden = selectedSlug !== undefined && selectedSlug !== themeSlug;
  const buttonTheme = options.find((t) => t.slug === (selectedSlug ?? themeSlug)) ?? options[0];

  function handleSwatchClick(slug: string) {
    setDraftSlug(slug);
    setEdits({});
    onSelectPalette(slug);
  }

  function handleResetClick() {
    setDraftSlug(themeSlug);
    setEdits({});
    onReset();
  }

  function handleTokenEdit(token: string, value: string) {
    if (!draftColorset) return;
    setEdits((current) => ({ ...current, [token]: value }));
  }

  function handleRegenerate() {
    if (!onRegenerate || !draftColorset || !draftSlug) return;
    setOpen(false);
    onRegenerate(draftSlug, draftColorset.name);
  }

  const popover =
    open && pos
      ? createPortal(
          <div
            ref={popoverRef}
            style={{ top: pos.top, left: pos.left, width: Math.min(POPOVER_W, window.innerWidth - 16) }}
            className="fixed z-[10000] flex flex-col gap-2 rounded-md border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_black] dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-black pb-2 dark:border-gray-700">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                Palette
              </span>
              {onRegenerate && draftColorset && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="rounded border border-black/40 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-gray-800 hover:bg-light-background-01 dark:border-white/40 dark:text-gray-100 dark:hover:bg-dark-background-01"
                  title="Ask the LLM to rewrite the app to use this palette via CSS variables"
                >
                  Regenerate with this palette
                </button>
              )}
            </div>

            <div className="grid grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)] gap-3">
              <div className="flex max-h-[260px] flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
                {resetTheme && (
                  <Swatch
                    key="__reset"
                    theme={resetTheme}
                    isReset
                    isSelected={!isOverridden && draftSlug === themeSlug}
                    onClick={handleResetClick}
                  />
                )}
                {options
                  .filter((t) => t.slug !== themeSlug)
                  .map((t) => (
                    <Swatch
                      key={t.slug}
                      theme={t}
                      isSelected={t.slug === draftSlug}
                      onClick={() => handleSwatchClick(t.slug)}
                    />
                  ))}
              </div>

              <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto border-l border-gray-200 pl-3 dark:border-gray-700">
                {draftColorset ? (
                  <>
                    <div className="sticky top-0 flex items-baseline justify-between bg-white pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                      <span className="truncate">{draftColorset.name}</span>
                      {Object.keys(edits).length > 0 && (
                        <span className="text-[0.55rem] font-normal text-blue-600 dark:text-blue-400">edited</span>
                      )}
                    </div>
                    {Object.entries(draftColorset.colors).map(([token, baseline]) => {
                      const current = edits[token] ?? baseline;
                      const hexValue = cssToHex(current);
                      const isHex = /^#[0-9a-fA-F]{3,8}$/.test(current);
                      return (
                        <label key={token} className="flex items-center gap-2 text-[0.7rem]">
                          <input
                            type="color"
                            value={hexValue}
                            onChange={(e) => handleTokenEdit(token, e.target.value)}
                            className="h-5 w-5 shrink-0 cursor-pointer rounded border border-black/30 dark:border-white/30"
                            aria-label={`Edit ${token}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{token}</span>
                          <span
                            className="font-mono text-[0.6rem] text-gray-500 dark:text-gray-400"
                            title={isHex ? hexValue : `Original: ${current}`}
                          >
                            {hexValue}
                          </span>
                        </label>
                      );
                    })}
                  </>
                ) : (
                  <div className="py-4 text-center text-[0.7rem] text-gray-500 dark:text-gray-400">
                    Pick a palette to edit its tokens.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-light-secondary dark:text-dark-secondary hover:bg-light-background-01 dark:hover:bg-dark-background-01 transition-colors"
        aria-label={buttonTheme ? `Palette: ${buttonTheme.name}` : "Pick a palette"}
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="6.5" cy="11" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="11" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        {buttonTheme ? (
          <>
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: buttonTheme.accentColor }}
            />
            <span className="max-w-[100px] truncate">Palette</span>
          </>
        ) : (
          <span>Palette</span>
        )}
      </button>
      {popover}
    </div>
  );
}
