import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VibeMountParams, ViewerEnv } from "./vibe.js";
import { isEvtVibeColorOverride, isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";
import { generateTailwindRemapCss } from "./tailwindRemap.js";

// Style element id used to install/replace the parent-pushed palette override.
// Kept stable so multiple overrides replace each other rather than stacking.
const COLOR_OVERRIDE_STYLE_ID = "vibe-color-override";
// Static stylesheet that remaps common Tailwind utilities (rounded-md, p-4,
// text-lg, font-sans, etc.) to canonical CSS variables. Injected once per
// iframe boot so the modal's structural edits flow into apps that use
// literal Tailwind classes, not just `rounded-[var(--radius)]` arbitrary
// values. The remap uses `var(--canonical, <fallback>)` so apps with no
// canonical definitions render exactly as before.
const TAILWIND_REMAP_STYLE_ID = "vibe-tailwind-remap";

function renderTokens(map: Record<string, string>): string {
  // `!important` is essential here. The LLM emits the app's baseline `:root`
  // inside a `<style>` child of the component — which React renders into
  // the body, AFTER the override `<style>` we put in `<head>`. CSS cascade
  // then makes the app's `:root` win over ours and palette swaps look like
  // they did nothing. Marking each token `!important` makes the override win
  // regardless of document order, without us having to chase the React tree
  // to insert our style at the right spot.
  return Object.entries(map)
    .map(([k, v]) => `  --${k}: ${v} !important;`)
    .join("\n");
}

function applyColorOverride(colors: Record<string, string>, colorsDark?: Record<string, string>): void {
  if (typeof document === "undefined") return;
  // Empty colors → revert to embedded palette by removing the override.
  if (Object.keys(colors).length === 0) {
    document.getElementById(COLOR_OVERRIDE_STYLE_ID)?.remove();
    return;
  }
  const light = `:root {\n${renderTokens(colors)}\n}`;
  const dark = colorsDark
    ? `@media (prefers-color-scheme: dark) {\n  :root {\n${renderTokens(colorsDark).replace(/^/gm, "  ")}\n  }\n}`
    : "";
  const css = `${light}\n${dark}`;
  let el = document.getElementById(COLOR_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = COLOR_OVERRIDE_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

// Walk every stylesheet looking for `:root { … }` rules and collect their
// custom-property declarations. Skips our own override stylesheet so the
// parent sees the baseline values the app shipped with, not the values
// we're already pushing — otherwise the modal would render an echo of its
// own edits.
function discoverRootTokens(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const baseline: Record<string, string> = {};
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const owner = sheet.ownerNode;
      if (owner instanceof Element && owner.id === COLOR_OVERRIDE_STYLE_ID) continue;
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (rule.selectorText !== ":root") continue;
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style.item(i);
          if (!prop.startsWith("--")) continue;
          const name = prop.slice(2);
          if (!(name in baseline)) {
            baseline[name] = rule.style.getPropertyValue(prop).trim();
          }
        }
      }
    } catch {
      // CORS-blocked or otherwise unreadable sheet — skip silently.
    }
  }
  return baseline;
}

// Post discovered tokens to the parent. Called on mount and whenever style
// elements change (new app render, palette swap, etc.) so the parent's
// modal always reflects what the running app actually defines.
function publishRootTokens(): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const tokens = discoverRootTokens();
  if (Object.keys(tokens).length === 0) return;
  window.parent.postMessage({ type: "vibe.evt.tokens-discovered", tokens }, "*");
}

export interface Vibe {
  readonly mountParams: VibeMountParams;
}

const VibeContext = createContext<Vibe>({
  mountParams: { usrEnv: {} },
});

export interface VibeContextProviderProps {
  readonly mountParams: VibeMountParams;
  readonly children: ReactNode;
}

function LiveCycleVibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  // Live `viewerEnv` — initialized from server-rendered mountParams,
  // updated on `vibe.evt.viewerChanged` when the viewer's session
  // identity changes mid-iframe (sign in/out, persona switch).
  const [viewerEnv, setViewerEnv] = useState<ViewerEnv | undefined>(mountParams.viewerEnv);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (!isEvtVibeViewerChanged(event.data)) return;
      setViewerEnv({
        viewer: event.data.viewer,
        access: event.data.access,
        ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
        ...(event.data.grants ? { grants: event.data.grants } : {}),
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Listen for parent-pushed palette overrides so the running app can re-skin
  // without a codegen turn. Lives next to the viewerChanged listener because
  // they share the same message bridge — separating to a dedicated effect
  // keeps the concerns visually distinct.
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (!isEvtVibeColorOverride(event.data)) return;
      applyColorOverride(event.data.colors, event.data.colorsDark);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Inject the Tailwind utility remap once on mount. This stays for the life
  // of the iframe — `var(--canonical)` references update automatically via
  // CSS cascade whenever the color-override pipeline pushes new values, so
  // we never need to regenerate or re-inject this sheet.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(TAILWIND_REMAP_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = TAILWIND_REMAP_STYLE_ID;
    el.textContent = generateTailwindRemapCss();
    document.head.appendChild(el);
  }, []);

  // Publish the running app's `:root` baseline to the parent so the modal can
  // show "current tokens" — every CSS var the app actually defines, including
  // bespoke ones the canonical palette set doesn't cover. Republishes on
  // mutations to `<style>` elements (theme re-renders, dynamic CSS loads) so
  // the modal stays in sync with whatever the app currently has on the wire.
  useEffect(() => {
    if (typeof document === "undefined") return;
    publishRootTokens();
    // Defer once more after layout — the very first render may not have
    // committed all `<style>` children into document.styleSheets yet.
    const firstPaint = requestAnimationFrame(() => publishRootTokens());
    const observer = new MutationObserver(() => publishRootTokens());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });
    return () => {
      cancelAnimationFrame(firstPaint);
      observer.disconnect();
    };
  }, []);

  const ctx: Vibe = {
    mountParams: { ...mountParams, viewerEnv },
  };
  return <VibeContext.Provider value={ctx}>{children}</VibeContext.Provider>;
}

export function VibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  return <LiveCycleVibeContextProvider mountParams={mountParams}>{children}</LiveCycleVibeContextProvider>;
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
}
