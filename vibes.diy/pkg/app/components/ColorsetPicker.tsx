import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CANONICAL_STRUCTURAL,
  CANONICAL_TOKENS,
  deriveCanonical,
  deriveStructural,
  renderRootCssBlock,
  type Colorset,
  type VibesTheme,
} from "@vibes.diy/prompts";

interface ColorsetPickerProps {
  options: VibesTheme[];
  selectedSlug?: string;
  themeSlug?: string;
  onSelectPalette: (slug: string) => void;
  onApplyLive: (colors: Record<string, string>, colorsDark?: Record<string, string>) => void;
  onReset: () => void;
  // Ask the LLM to regenerate the app using the current palette. The picker
  // closes itself before firing so the textarea is visible. The `rootCssBlock`
  // argument is the literal `:root { … } @media { … }` to embed in the user
  // message — sending just the name leaves the LLM guessing hex values.
  onRegenerate?: (paletteSlug: string, paletteName: string, rootCssBlock: string) => void;
  // localStorage key for persisting palette + per-token edits per app. When
  // set, edits hydrate on mount and persist on every change; picking a new
  // palette clears the entry so it reflects the active baseline.
  storageKey?: string;
  // Tokens the running app declares on `:root`, streamed from the sandbox.
  // When set, the picker renders a "Current tokens" section sourced from
  // this map so the user can edit + remap every property the app actually
  // has — including bespoke ones outside the canonical vocabulary.
  currentTokens?: Record<string, string>;
}

interface StoredOverrides {
  version: 1;
  colorTheme: string;
  edits: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
    structural?: Record<string, string>;
  };
}

function readStoredOverrides(key: string): StoredOverrides | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOverrides;
    if (parsed.version !== 1 || typeof parsed.colorTheme !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
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

type Mode = "light" | "dark";

function SectionHeader({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={
        subtle
          ? "mt-1.5 mb-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
          : "mt-1.5 mb-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300"
      }
    >
      {label}
    </div>
  );
}

// Resolve `var(--name)` chains against the current scope so the swatch can
// render the *effective* color even when the value is mapped through canonical
// indirection. Caps recursion at 4 to defang cycles (which CSS itself would
// fall through to inherit/initial anyway).
function resolveCssValue(value: string, scope: Record<string, string>, depth = 0): string {
  if (depth > 4) return value;
  const m = value.match(/^\s*var\(--([\w-]+)(?:\s*,\s*(.+))?\)\s*$/);
  if (!m) return value;
  const referenced = scope[m[1]];
  if (referenced !== undefined) return resolveCssValue(referenced, scope, depth + 1);
  return m[2] ?? value;
}

// One row in the "Current tokens" section. Sources its value from the running
// app (overlaid with the user's edits), and for bespoke (non-canonical) names
// surfaces a "Map to" dropdown that writes `var(--canonical)` into the edits
// — so picking a new palette automatically restyles the bespoke token via
// CSS cascade, no LLM regen required.
function CurrentTokenRow({
  name,
  value,
  isCanonical,
  mappableOptions,
  onEdit,
  onMap,
  scope,
}: {
  name: string;
  value: string;
  isCanonical: boolean;
  mappableOptions: readonly string[];
  onEdit: (name: string, value: string) => void;
  onMap: (name: string, target: string) => void;
  scope: Record<string, string>;
}) {
  const isMapping = /^\s*var\(--[\w-]+\)\s*$/.test(value);
  const mappedTo = isMapping ? value.match(/^\s*var\(--([\w-]+)\)\s*$/)?.[1] ?? "" : "";
  const resolved = resolveCssValue(value, scope);
  // Heuristic: if the resolved value parses as a color (hex/rgba/oklch/hsl/
  // named), show a swatch + color picker. Otherwise it's structural — text
  // input only.
  const looksLikeColor = /^(#[0-9a-fA-F]{3,8}|rgb|hsl|oklch|oklab|color\(|var\()/i.test(resolved.trim()) ||
    /^[a-z]+$/i.test(resolved.trim());
  const hexValue = looksLikeColor ? cssToHex(resolved) : "#000000";
  return (
    <div className="flex items-center gap-2 text-[0.7rem]">
      <span
        className="relative inline-block h-5 w-5 shrink-0 overflow-hidden rounded border border-black/30 dark:border-white/30"
        style={{ backgroundColor: looksLikeColor ? resolved : "transparent" }}
        title={isMapping ? `Mapped to --${mappedTo}` : resolved}
      >
        {looksLikeColor && (
          <input
            type="color"
            value={hexValue}
            onChange={(e) => onEdit(name, e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Edit ${name}`}
          />
        )}
      </span>
      <span className="w-[100px] shrink-0 truncate text-gray-800 dark:text-gray-200" title={name}>
        {name}
        {!isCanonical && (
          <span className="ml-1 text-[0.55rem] font-semibold uppercase text-amber-600 dark:text-amber-400">
            bespoke
          </span>
        )}
      </span>
      {/* Structural / non-color tokens get a text input so the user can type
          `1.5rem`, `Comic Sans`, etc. Color tokens get the swatch+picker
          combo handled above; their value text is read-only display. */}
      {looksLikeColor ? (
        <span
          className="min-w-0 flex-1 truncate font-mono text-[0.6rem] text-gray-500 dark:text-gray-400"
          title={isMapping ? `${value} → ${resolved}` : value}
        >
          {isMapping ? `→${mappedTo}` : value}
        </span>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onEdit(name, e.target.value)}
          className="min-w-0 flex-1 rounded border border-black/20 bg-white px-1.5 py-0.5 font-mono text-[0.65rem] text-gray-700 focus:border-blue-500 focus:outline-none dark:border-white/20 dark:bg-gray-800 dark:text-gray-200"
          aria-label={`Edit ${name}`}
          spellCheck={false}
        />
      )}
      {!isCanonical && (
        <select
          value={mappedTo}
          onChange={(e) => onMap(name, e.target.value)}
          className="max-w-[80px] shrink-0 truncate rounded border border-black/20 bg-white px-1 py-0.5 text-[0.55rem] text-gray-700 focus:border-blue-500 focus:outline-none dark:border-white/20 dark:bg-gray-800 dark:text-gray-200"
          title="Map this token to a canonical name — it will track the canonical via CSS cascade across palette swaps."
        >
          <option value="">Map to…</option>
          {mappableOptions.map((opt) => (
            <option key={opt} value={opt}>
              → {opt}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// Mode-agnostic editable row for structural tokens (font, radius, spacing,
// border-width). Uses a plain text input since these values aren't colors —
// `<input type=color>` wouldn't accept a font stack or "1rem".
function StructuralRow({
  token,
  baseline,
  edited,
  onEdit,
  dim,
}: {
  token: string;
  baseline: string;
  edited?: string;
  onEdit: (token: string, value: string) => void;
  dim?: boolean;
}) {
  const current = edited ?? baseline;
  return (
    <label
      className={
        dim
          ? "flex items-center gap-2 text-[0.7rem] opacity-60 hover:opacity-100"
          : "flex items-center gap-2 text-[0.7rem]"
      }
    >
      <span className="w-[110px] shrink-0 truncate text-gray-800 dark:text-gray-200" title={token}>
        {token}
      </span>
      <input
        type="text"
        value={current}
        onChange={(e) => onEdit(token, e.target.value)}
        className="min-w-0 flex-1 rounded border border-black/20 bg-white px-1.5 py-0.5 font-mono text-[0.65rem] text-gray-700 focus:border-blue-500 focus:outline-none dark:border-white/20 dark:bg-gray-800 dark:text-gray-200"
        aria-label={`Edit ${token}`}
        spellCheck={false}
      />
    </label>
  );
}

// One editable row. Splits responsibility from the picker shell so the same
// row renders identically across the three sections (defined / unused / extras),
// only differing in `dim` styling.
function TokenRow({
  token,
  baseline,
  edited,
  onEdit,
  mode,
  dim,
}: {
  token: string;
  baseline: string;
  edited?: string;
  onEdit: (token: string, value: string) => void;
  mode: Mode;
  dim?: boolean;
}) {
  const current = edited ?? baseline;
  // The <input type=color> only accepts #RRGGBB so we convert via cssToHex
  // for the picker. The visible swatch is painted with the original value
  // (oklch / rgba / named — anything the browser understands) so the user
  // sees the *actual* color the LLM will emit, not the lossy sRGB rasterization.
  const hexValue = cssToHex(current);
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(current);
  const tooltip = isHex ? current : `${current}  (≈ ${hexValue} for picker)`;
  return (
    <label
      className={
        dim
          ? "flex items-center gap-2 text-[0.7rem] opacity-60 hover:opacity-100"
          : "flex items-center gap-2 text-[0.7rem]"
      }
    >
      <span
        className="relative inline-block h-5 w-5 shrink-0 overflow-hidden rounded border border-black/30 dark:border-white/30"
        style={{ backgroundColor: current }}
        title={tooltip}
      >
        <input
          type="color"
          value={hexValue}
          onChange={(e) => onEdit(token, e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Edit ${token} (${mode})`}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{token}</span>
      <span
        className="max-w-[12ch] truncate font-mono text-[0.6rem] text-gray-500 dark:text-gray-400"
        title={tooltip}
      >
        {current}
      </span>
    </label>
  );
}

export default function ColorsetPicker({
  options,
  selectedSlug,
  themeSlug,
  onSelectPalette,
  onApplyLive,
  onReset,
  onRegenerate,
  storageKey,
  currentTokens,
}: ColorsetPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftSlug, setDraftSlug] = useState<string | undefined>(selectedSlug ?? themeSlug);
  const [mode, setMode] = useState<Mode>("light");
  // Per-mode edit buckets so the user can tweak `--background` in light and
  // dark independently without one mode overwriting the other.
  const [editsLight, setEditsLight] = useState<Record<string, string>>({});
  const [editsDark, setEditsDark] = useState<Record<string, string>>({});
  // Structural is mode-agnostic (font, radius, spacing don't flip on dark),
  // so a single bucket. Applies in both Light and Dark via the live push.
  const [editsStructural, setEditsStructural] = useState<Record<string, string>>({});
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

  // Merge edits over the source palette per mode. For dark, when the colorset
  // doesn't ship a `colorsDark`, fall back to the light baseline so the user
  // sees something to edit and any change creates the dark variant.
  const mergedLight = useMemo(
    () => (draftColorset ? { ...draftColorset.colors, ...editsLight } : undefined),
    [draftColorset, editsLight]
  );
  const mergedDark = useMemo(() => {
    if (!draftColorset) return undefined;
    const hasDarkSource = draftColorset.colorsDark !== undefined;
    const hasDarkEdits = Object.keys(editsDark).length > 0;
    if (!hasDarkSource && !hasDarkEdits) return undefined;
    return { ...(draftColorset.colorsDark ?? draftColorset.colors), ...editsDark };
  }, [draftColorset, editsDark]);
  // Filled structural (8 canonical + extras) with edits layered on top. Same
  // shape regardless of mode — the runtime applies these to :root once.
  const mergedStructural = useMemo(() => {
    if (!draftColorset) return undefined;
    return {
      ...deriveStructural(draftColorset.structural),
      ...(draftColorset.structuralExtras ?? {}),
      ...editsStructural,
    };
  }, [draftColorset, editsStructural]);

  useEffect(() => {
    if (!draftColorset || !mergedLight) return;
    // Runtime accepts any token name in the `colors` payload — it just renders
    // each as a CSS var on :root — so we ride structural through the same
    // channel rather than introducing a new event type. Fires regardless of
    // `open` state so the hydrated edits from localStorage apply at boot.
    const liveLight = { ...mergedLight, ...(mergedStructural ?? {}) };
    onApplyLive(liveLight, mergedDark);
  }, [draftColorset, mergedLight, mergedDark, mergedStructural, onApplyLive]);

  // Hydrate edits from localStorage on first mount (once the bundle has
  // loaded so `draftSlug` reflects the persisted colorTheme). If the stored
  // entry was for a different palette, ignore it — palette swap is meant to
  // overwrite per-token edits per the user's mental model.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current || !storageKey || !lookupColorset || !draftSlug) return;
    const stored = readStoredOverrides(storageKey);
    if (stored && stored.colorTheme === draftSlug) {
      if (stored.edits.light) setEditsLight(stored.edits.light);
      if (stored.edits.dark) setEditsDark(stored.edits.dark);
      if (stored.edits.structural) setEditsStructural(stored.edits.structural);
    }
    didHydrateRef.current = true;
  }, [storageKey, lookupColorset, draftSlug]);

  // Persist edits on every change. Removes the entry when there are no edits
  // so the storage stays clean and a fresh swatch click starts from a blank
  // slate.
  useEffect(() => {
    if (!didHydrateRef.current || !storageKey || !draftSlug || typeof localStorage === "undefined") {
      return;
    }
    const hasAny =
      Object.keys(editsLight).length > 0 ||
      Object.keys(editsDark).length > 0 ||
      Object.keys(editsStructural).length > 0;
    try {
      if (!hasAny) {
        localStorage.removeItem(storageKey);
        return;
      }
      const payload: StoredOverrides = {
        version: 1,
        colorTheme: draftSlug,
        edits: {
          ...(Object.keys(editsLight).length > 0 ? { light: editsLight } : {}),
          ...(Object.keys(editsDark).length > 0 ? { dark: editsDark } : {}),
          ...(Object.keys(editsStructural).length > 0 ? { structural: editsStructural } : {}),
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // localStorage may be disabled (private mode, quota exceeded) — edits
      // still live in React state for the session, just not persisted.
    }
  }, [storageKey, draftSlug, editsLight, editsDark, editsStructural]);

  const resetTheme = themeSlug ? options.find((t) => t.slug === themeSlug) : undefined;
  const isOverridden = selectedSlug !== undefined && selectedSlug !== themeSlug;
  const buttonTheme = options.find((t) => t.slug === (selectedSlug ?? themeSlug)) ?? options[0];

  function handleSwatchClick(slug: string) {
    setDraftSlug(slug);
    setEditsLight({});
    setEditsDark({});
    setEditsStructural({});
    onSelectPalette(slug);
  }

  function handleResetClick() {
    setDraftSlug(themeSlug);
    setEditsLight({});
    setEditsDark({});
    setEditsStructural({});
    onReset();
  }

  function handleTokenEdit(token: string, value: string) {
    if (!draftColorset) return;
    if (mode === "light") {
      setEditsLight((current) => ({ ...current, [token]: value }));
    } else {
      setEditsDark((current) => ({ ...current, [token]: value }));
    }
  }

  function handleStructuralEdit(token: string, value: string) {
    if (!draftColorset) return;
    setEditsStructural((current) => ({ ...current, [token]: value }));
  }

  function handleRegenerate() {
    if (!onRegenerate || !draftColorset || !draftSlug || !mergedLight) return;
    setOpen(false);
    // Split structural edits into canonical vs extras based on
    // CANONICAL_STRUCTURAL so the rendered :root keeps the same blocks the
    // yaml uses.
    const structEditsCanonical: Record<string, string> = {};
    const structEditsExtras: Record<string, string> = {};
    for (const [k, v] of Object.entries(editsStructural)) {
      if (CANONICAL_STRUCTURAL.includes(k as (typeof CANONICAL_STRUCTURAL)[number])) {
        structEditsCanonical[k] = v;
      } else {
        structEditsExtras[k] = v;
      }
    }
    // Fold per-token edits for color (both modes) AND structural into the
    // colorset before rendering — otherwise the regenerate prompt carries
    // stale values and the LLM's diff is against the wrong baseline.
    const merged: Colorset = {
      ...draftColorset,
      colors: mergedLight,
      colorsDark: mergedDark,
      structural: { ...(draftColorset.structural ?? {}), ...structEditsCanonical },
      structuralExtras:
        Object.keys(structEditsExtras).length > 0 || draftColorset.structuralExtras
          ? { ...(draftColorset.structuralExtras ?? {}), ...structEditsExtras }
          : undefined,
    };
    // Strip extras from the LLM-facing :root so the regenerated app uses only
    // canonical tokens — extras baked into the app's :root can't be overridden
    // by a future palette swap (the new palette doesn't define those names),
    // and that's exactly the bug this whole flow exists to prevent.
    onRegenerate(draftSlug, draftColorset.name, renderRootCssBlock(merged, { includeExtras: false }));
  }

  // Token rows split into three buckets for the active mode:
  //   1. defined  — canonical tokens the theme explicitly sets
  //   2. unused   — canonical tokens the theme does NOT set (with the same
  //                 derived fallback the LLM will see). Lets the user verify
  //                 every theme advertises the same 13 slots regardless of
  //                 coverage.
  //   3. extras   — theme-bespoke tokens (`comp-accent-text`, `dial-chassis`,
  //                 …). Editable just like canonical.
  const activeEdits = mode === "light" ? editsLight : editsDark;
  const lightEditCount = Object.keys(editsLight).length;
  const darkEditCount = Object.keys(editsDark).length;
  const sections = useMemo(() => {
    if (!draftColorset) return null;
    const sourceCanonical =
      mode === "light" ? draftColorset.colors : draftColorset.colorsDark ?? {};
    const fallbackBase =
      mode === "light"
        ? draftColorset.colors
        : draftColorset.colorsDark ?? draftColorset.colors;
    const sourceExtras =
      mode === "light" ? draftColorset.extras : draftColorset.extrasDark;
    const derived = deriveCanonical(fallbackBase);

    const defined: [string, string][] = [];
    const unused: [string, string][] = [];
    for (const token of CANONICAL_TOKENS) {
      const sourceValue = sourceCanonical[token];
      if (sourceValue !== undefined) {
        defined.push([token, sourceValue]);
      } else {
        // For dark mode without `colorsDark`, derived is just the light
        // fallback — gives the user a visible starting point to edit into a
        // dark variant rather than an empty row.
        unused.push([token, derived[token] ?? ""]);
      }
    }
    const extras: [string, string][] = sourceExtras ? Object.entries(sourceExtras) : [];
    return { defined, unused, extras };
  }, [draftColorset, mode]);

  // Mode-agnostic structural sections. Same shape as `sections` above but
  // sourced from `structural` / `structuralExtras` and CANONICAL_STRUCTURAL.
  const structuralSections = useMemo(() => {
    if (!draftColorset) return null;
    const source = draftColorset.structural ?? {};
    const derived = deriveStructural(source);
    const defined: [string, string][] = [];
    const unused: [string, string][] = [];
    for (const token of CANONICAL_STRUCTURAL) {
      const sourceValue = source[token];
      if (sourceValue !== undefined) {
        defined.push([token, sourceValue]);
      } else {
        unused.push([token, derived[token] ?? ""]);
      }
    }
    const extras: [string, string][] = draftColorset.structuralExtras
      ? Object.entries(draftColorset.structuralExtras)
      : [];
    return { defined, unused, extras };
  }, [draftColorset]);
  const structuralEditCount = Object.keys(editsStructural).length;

  // Source of truth for the "CURRENT TOKENS" section: every CSS var the
  // running app declared on :root, with the user's per-token edits layered
  // on top so the displayed value matches what the iframe actually shows.
  // Falls back to the selected palette's tokens when the iframe hasn't
  // published anything yet (e.g. SSR boot, app still loading).
  const currentTokensView = useMemo(() => {
    if (!currentTokens || Object.keys(currentTokens).length === 0) return null;
    const merged: Record<string, string> = {
      ...currentTokens,
      ...(mergedLight ?? {}),
      ...editsLight,
      ...editsStructural,
    };
    const colorRows: { name: string; value: string; isCanonical: boolean }[] = [];
    const structuralRows: { name: string; value: string; isCanonical: boolean }[] = [];
    const STRUCTURAL_HINTS = [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "radius",
      "spacing",
      "padding",
      "margin",
      "gap",
      "border-width",
      "shadow",
    ];
    for (const name of Object.keys(merged)) {
      const value = merged[name];
      const isCanonical =
        CANONICAL_TOKENS.includes(name as (typeof CANONICAL_TOKENS)[number]) ||
        CANONICAL_STRUCTURAL.includes(name as (typeof CANONICAL_STRUCTURAL)[number]);
      const isStructural =
        CANONICAL_STRUCTURAL.includes(name as (typeof CANONICAL_STRUCTURAL)[number]) ||
        STRUCTURAL_HINTS.some((hint) => name.includes(hint));
      const row = { name, value, isCanonical };
      if (isStructural) structuralRows.push(row);
      else colorRows.push(row);
    }
    return { colorRows, structuralRows };
  }, [currentTokens, mergedLight, editsLight, editsStructural]);

  // Canonical option list for the "Map to" dropdown shown next to bespoke
  // tokens. Selecting one writes `var(--<canonical>)` to edits, which the
  // runtime applies so the bespoke token tracks the canonical via cascade.
  const mappableOptions = useMemo(() => {
    return [...CANONICAL_TOKENS, ...CANONICAL_STRUCTURAL];
  }, []);

  function handleMapToken(bespokeName: string, target: string) {
    if (!draftColorset) return;
    if (target === "") {
      // Unmap — drop the edit. The token reverts to its baked-in value.
      setEditsLight((current) => {
        const next: Record<string, string> = {};
        for (const k of Object.keys(current)) if (k !== bespokeName) next[k] = current[k];
        return next;
      });
      setEditsStructural((current) => {
        const next: Record<string, string> = {};
        for (const k of Object.keys(current)) if (k !== bespokeName) next[k] = current[k];
        return next;
      });
      return;
    }
    const mapping = `var(--${target})`;
    if (CANONICAL_STRUCTURAL.includes(target as (typeof CANONICAL_STRUCTURAL)[number])) {
      setEditsStructural((current) => ({ ...current, [bespokeName]: mapping }));
    } else {
      setEditsLight((current) => ({ ...current, [bespokeName]: mapping }));
    }
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
                  title="Bake the current palette + edits into the app code via the LLM. Live edits in this modal apply instantly without this button — only click Save when you want the changes to become permanent in the generated code."
                >
                  Save palette
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
                {draftColorset && sections ? (
                  <>
                    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900">
                      <div className="flex items-baseline justify-between pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        <span className="truncate">{draftColorset.name}</span>
                      </div>
                      <div className="-mx-3 mb-1 flex border-b border-gray-200 px-3 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => setMode("light")}
                          aria-pressed={mode === "light"}
                          className={
                            mode === "light"
                              ? "relative -mb-px border-b-2 border-black px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-gray-900 dark:border-gray-100 dark:text-gray-100"
                              : "px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          }
                        >
                          Light
                          {lightEditCount > 0 && (
                            <span
                              aria-hidden
                              className="absolute right-0 top-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("dark")}
                          aria-pressed={mode === "dark"}
                          className={
                            mode === "dark"
                              ? "relative -mb-px border-b-2 border-black px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-gray-900 dark:border-gray-100 dark:text-gray-100"
                              : "px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          }
                        >
                          Dark
                          {darkEditCount > 0 && (
                            <span
                              aria-hidden
                              className="absolute right-0 top-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500"
                            />
                          )}
                          {mode === "dark" && draftColorset.colorsDark === undefined && darkEditCount === 0 && (
                            <span className="ml-1 normal-case text-[0.55rem] font-normal text-gray-400">
                              (none defined)
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                    {currentTokensView ? (
                      <>
                        <SectionHeader label="Current tokens (from app)" />
                        {currentTokensView.colorRows.map((row) => (
                          <CurrentTokenRow
                            key={`cur-${row.name}`}
                            name={row.name}
                            value={row.value}
                            isCanonical={row.isCanonical}
                            mappableOptions={mappableOptions}
                            onEdit={handleTokenEdit}
                            onMap={handleMapToken}
                            scope={currentTokens ?? {}}
                          />
                        ))}
                        {currentTokensView.structuralRows.length > 0 && (
                          <>
                            <SectionHeader label="Structural (from app)" />
                            {currentTokensView.structuralRows.map((row) => (
                              <CurrentTokenRow
                                key={`cur-struct-${row.name}`}
                                name={row.name}
                                value={row.value}
                                isCanonical={row.isCanonical}
                                mappableOptions={mappableOptions}
                                onEdit={handleStructuralEdit}
                                onMap={handleMapToken}
                                scope={currentTokens ?? {}}
                              />
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {sections.defined.length > 0 && (
                          <>
                            <SectionHeader label="Standard tokens" />
                            {sections.defined.map(([token, baseline]) => (
                              <TokenRow
                                key={`def-${token}`}
                                token={token}
                                baseline={baseline}
                                edited={activeEdits[token]}
                                onEdit={handleTokenEdit}
                                mode={mode}
                              />
                            ))}
                          </>
                        )}
                        {sections.unused.length > 0 && (
                          <>
                            <SectionHeader
                              label="Standard (not defined — using fallback)"
                              subtle
                            />
                            {sections.unused.map(([token, fallback]) => (
                              <TokenRow
                                key={`unused-${token}`}
                                token={token}
                                baseline={fallback}
                                edited={activeEdits[token]}
                                onEdit={handleTokenEdit}
                                mode={mode}
                                dim
                              />
                            ))}
                          </>
                        )}
                        {sections.extras.length > 0 && (
                          <>
                            <SectionHeader label="Theme extras" />
                            {sections.extras.map(([token, baseline]) => (
                              <TokenRow
                                key={`extra-${token}`}
                                token={token}
                                baseline={baseline}
                                edited={activeEdits[token]}
                                onEdit={handleTokenEdit}
                                mode={mode}
                              />
                            ))}
                          </>
                        )}
                      </>
                    )}
                    {structuralSections && (
                      <>
                        <div className="mt-2 border-t border-gray-200 dark:border-gray-700" />
                        {structuralSections.defined.length > 0 && (
                          <>
                            <SectionHeader
                              label={
                                structuralEditCount > 0
                                  ? "Structural (mode-agnostic) •"
                                  : "Structural (mode-agnostic)"
                              }
                            />
                            {structuralSections.defined.map(([token, baseline]) => (
                              <StructuralRow
                                key={`struct-def-${token}`}
                                token={token}
                                baseline={baseline}
                                edited={editsStructural[token]}
                                onEdit={handleStructuralEdit}
                              />
                            ))}
                          </>
                        )}
                        {structuralSections.unused.length > 0 && (
                          <>
                            <SectionHeader
                              label="Structural (not defined — using fallback)"
                              subtle
                            />
                            {structuralSections.unused.map(([token, fallback]) => (
                              <StructuralRow
                                key={`struct-unused-${token}`}
                                token={token}
                                baseline={fallback}
                                edited={editsStructural[token]}
                                onEdit={handleStructuralEdit}
                                dim
                              />
                            ))}
                          </>
                        )}
                        {structuralSections.extras.length > 0 && (
                          <>
                            <SectionHeader label="Structural extras" />
                            {structuralSections.extras.map(([token, baseline]) => (
                              <StructuralRow
                                key={`struct-extra-${token}`}
                                token={token}
                                baseline={baseline}
                                edited={editsStructural[token]}
                                onEdit={handleStructuralEdit}
                              />
                            ))}
                          </>
                        )}
                      </>
                    )}
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
