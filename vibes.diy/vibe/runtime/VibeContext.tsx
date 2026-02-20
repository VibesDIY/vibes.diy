import React, { createContext, useContext, type ReactNode } from "react";
import { VibeMountParams } from "./vibe.js";

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
  console.log("LiveCycleVibeContextProvider", mountParams);
  const ctx: Vibe = {
    mountParams: { usrEnv: {} },
  };
  return <VibeContext.Provider value={ctx}>{children}</VibeContext.Provider>;
}

export function VibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  return <LiveCycleVibeContextProvider mountParams={mountParams}>{children}</LiveCycleVibeContextProvider>;
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
}
