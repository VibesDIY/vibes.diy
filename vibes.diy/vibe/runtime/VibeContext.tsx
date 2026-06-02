import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VibeMountParams, ViewerEnv } from "./vibe.js";
import { isEvtVibeColorOverride, isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";

// Style element id used to install/replace the parent-pushed palette override.
// Kept stable so multiple overrides replace each other rather than stacking.
const COLOR_OVERRIDE_STYLE_ID = "vibe-color-override";

function renderTokens(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `  --${k}: ${v};`)
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
