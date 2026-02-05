import { VibeDiyApi } from "@vibes.diy/api-impl";
import { FPApiInterface } from "@fireproof/core-types-protocols-dashboard";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { VibesDiyEnv } from "./config/env.js";
import { BuildURI, KeyedResolvOnce, Result } from "@adviser/cement";

export interface VibeDiy {
  dashApi: FPApiInterface;
  vibeDiyApi: VibeDiyApi;
}

const realCtx: VibeDiy = {
  dashApi: {} as FPApiInterface,
  vibeDiyApi: {} as VibeDiyApi,
};
const VibeDiyContext = createContext<VibeDiy>(realCtx as Readonly<VibeDiy>);

const vibesDiyApis = new KeyedResolvOnce();

function LiveCycleVibeDiyProvider({ children }: { children: React.ReactNode }) {
  if (!globalThis.window) {
    return <>{children}</>;
  }
  const clerk = useClerk();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realCtx.dashApi = clerkDashApi(clerk as any, {
    apiUrl: VibesDiyEnv.VibesEnv().DASHBOARD_URL,
  });
  const apiUrl =
    VibesDiyEnv.VibesEnv().VIBES_DIY_API_URL ??
    BuildURI.from(window.location.href)
      .protocol(window.location.protocol.startsWith("https") ? "wss" : "ws")
      .pathname("/api")
      .cleanParams()
      .toString();
  realCtx.vibeDiyApi = vibesDiyApis.get(apiUrl).once(() => {
    console.log("VibeDiyApi for", apiUrl);
    return new VibeDiyApi({
      apiUrl,
      getToken: async () => {
        const ot = await clerk.session?.getToken({ template: "with-email" });
        if (!ot) {
          return Result.Err(`no token`);
        }
        return Result.Ok({
          type: "clerk",
          token: ot,
        });
      },
    });
  });

  return <VibeDiyContext.Provider value={realCtx}>{children}</VibeDiyContext.Provider>;
}

export function VibeDiyProvider({ children }: { children: React.ReactNode }) {
  // const dashApi = clerkDashApi(clerk, { apiUrl: mountParams.env.DASHBOARD_URL })
  return (
    <ClerkProvider publishableKey={VibesDiyEnv.CLERK_PUBLISHABLE_KEY()}>
      <LiveCycleVibeDiyProvider>{children}</LiveCycleVibeDiyProvider>
    </ClerkProvider>
  );
}

export function useVibeDiy(): VibeDiy {
  return useContext(VibeDiyContext);
}
