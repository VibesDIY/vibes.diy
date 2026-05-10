import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VibeMountParams, ViewerEnv } from "./vibe.js";
import { isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";

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
      // Preserve apiBaseUrl from the seed; the event carries identity-only.
      setViewerEnv((prev) => {
        const apiBaseUrl = prev?.apiBaseUrl ?? mountParams.viewerEnv?.apiBaseUrl ?? "";
        return {
          viewer: event.data.viewer,
          access: event.data.access,
          ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
          apiBaseUrl,
        };
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mountParams.viewerEnv?.apiBaseUrl]);

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
