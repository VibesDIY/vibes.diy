import { VibeDiyApi } from "@vibes.diy/api-impl";
import { FPApiInterface } from "@fireproof/core-types-protocols-dashboard";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { BuildURI, KeyedResolvOnce, Result } from "@adviser/cement";
import { PostHogProvider } from "posthog-js/react";
import { PkgRepos } from "@vibes.diy/api-types";
import { SuperThis } from "@fireproof/use-fireproof";
import { ensureSuperThis } from "@fireproof/core-runtime";
// import { PkgRepos } from "@vibes.diy/api-types";

export interface VibeDiySvcVars {
  readonly pkgRepos: PkgRepos;
  readonly env: {
    GTM_CONTAINER_ID?: string;
    POSTHOG_KEY?: string;
    POSTHOG_HOST?: string;
    // WORKSPACE_NPM_URL: string;
    // PUBLIC_NPM_URL: string;
    DASHBOARD_URL: string;
    VIBES_DIY_API_URL: string;
    CLERK_PUBLISHABLE_KEY: string;
  };
}

export interface VibeDiy {
  sthis: SuperThis
  dashApi: FPApiInterface;
  vibeDiyApi: VibeDiyApi;
  svcVars: VibeDiySvcVars;
}

const realCtx: VibeDiy = {
  sthis: ensureSuperThis(),
  dashApi: {} as FPApiInterface,
  vibeDiyApi: {} as VibeDiyApi,
  svcVars: {} as VibeDiySvcVars,
};

const VibeDiyContext = createContext<VibeDiy>(realCtx as Readonly<VibeDiy>);

const vibesDiyApis = new KeyedResolvOnce();

// const VibesDiyEnv = {
//   POSTHOG_KEY(): string {
//     return "";
//   },
//   POSTHOG_HOST(): string {
//     return "";
//   },
//   CLERK_PUBLISHABLE_KEY(): string {
//     return "";
//   },
//   VibesEnv(): Record<string, string> {
//     return {};
//   },
// };

function LiveCycleVibeDiyProvider({ children, svcVars: vibeDiySvcVars }: { children: React.ReactNode; svcVars: VibeDiySvcVars }) {
  const clerk = useClerk();

  realCtx.svcVars = vibeDiySvcVars;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realCtx.dashApi = clerkDashApi(clerk as any, {
    apiUrl: realCtx.svcVars.env.DASHBOARD_URL,
  });
  const apiUrl =
    realCtx.svcVars.env.VIBES_DIY_API_URL ??
    BuildURI.from(window.location.href)
      .protocol(window.location.protocol.startsWith("https") ? "wss" : "ws")
      .pathname("/api")
      .cleanParams()
      .toString();
  realCtx.vibeDiyApi = vibesDiyApis.get(apiUrl).once(() => {
    console.log("VibeDiyApi for", apiUrl);
    return new VibeDiyApi({
      apiUrl,
      // pkgRepos: {
      //   private: VibesDiyEnv.VibesEnv().PRIVATE_NPM_URL,
      //   public: VibesDiyEnv.VibesEnv().PUBLIC_NPM_URL,
      // },
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

function ConditionalPostHog({ children, svcVars }: { children: React.ReactNode; svcVars: VibeDiySvcVars }) {
  if (svcVars.env.POSTHOG_KEY && svcVars.env.POSTHOG_HOST) {
    return (
      <PostHogProvider
        apiKey={svcVars.env.POSTHOG_KEY}
        options={{
          api_host: svcVars.env.POSTHOG_HOST,
          opt_out_capturing_by_default: true,
        }}
      >
        {children}
      </PostHogProvider>
    );
  }
  return <>{children}</>;
}

export function VibeDiyProvider({ children, svcVars }: { children: React.ReactNode; svcVars: VibeDiySvcVars }) {
  return (
    <ClerkProvider publishableKey={svcVars.env.CLERK_PUBLISHABLE_KEY}>
      <LiveCycleVibeDiyProvider svcVars={svcVars}>
        <ConditionalPostHog svcVars={svcVars}>{children}</ConditionalPostHog>
      </LiveCycleVibeDiyProvider>
    </ClerkProvider>
  );
}

export function useVibeDiy(): VibeDiy {
  return useContext(VibeDiyContext);
}
