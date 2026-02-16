import { VibeDiyApi } from "@vibes.diy/api-impl";
import { FPApiInterface } from "@fireproof/core-types-protocols-dashboard";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { BuildURI, KeyedResolvOnce, Result } from "@adviser/cement";
import { PostHogProvider } from "posthog-js/react";
import { PkgRepos  } from "@vibes.diy/api-types";
import { SuperThis } from "@fireproof/use-fireproof";
import { ensureSuperThis } from "@fireproof/core-runtime";
// import { PkgRepos } from "@vibes.diy/api-types";

export interface VibeDiyWebVars {
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

export interface VibesDiyCtx {
  sthis: SuperThis
  dashApi: FPApiInterface;
  vibeDiyApi: VibeDiyApi;
  webVars: VibeDiyWebVars
}

const realCtx: VibesDiyCtx = {
  sthis: ensureSuperThis(),
  dashApi: {} as FPApiInterface,
  vibeDiyApi: {} as VibeDiyApi,
  webVars: {} as VibesDiyCtx["webVars"],
};

const VibeDiyContext = createContext<VibesDiyCtx>(realCtx as Readonly<VibesDiyCtx>);

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

function LiveCycleVibeDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibeDiyWebVars }) {
  const clerk = useClerk();

  realCtx.webVars = webVars;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realCtx.dashApi = clerkDashApi(clerk as any, {
    apiUrl: realCtx.webVars.env.DASHBOARD_URL,
  });
  const apiUrl =
    realCtx.webVars.env.VIBES_DIY_API_URL ??
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

function ConditionalPostHog({ children, webVars }: { children: React.ReactNode; webVars: VibeDiyWebVars }) {
  if (webVars.env.POSTHOG_KEY && webVars.env.POSTHOG_HOST) {
    return (
      <PostHogProvider
        apiKey={webVars.env.POSTHOG_KEY}
        options={{
          api_host: webVars.env.POSTHOG_HOST,
          opt_out_capturing_by_default: true,
        }}
      >
        {children}
      </PostHogProvider>
    );
  }
  return <>{children}</>;
}

export function VibeDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibeDiyWebVars }) {
  return (
    <ClerkProvider publishableKey={webVars.env.CLERK_PUBLISHABLE_KEY}>
      <LiveCycleVibeDiyProvider webVars={webVars}>
        <ConditionalPostHog webVars={webVars}>{children}</ConditionalPostHog>
      </LiveCycleVibeDiyProvider>
    </ClerkProvider>
  );
}

export function useVibeDiy(): VibesDiyCtx {
  return useContext(VibeDiyContext);
}
