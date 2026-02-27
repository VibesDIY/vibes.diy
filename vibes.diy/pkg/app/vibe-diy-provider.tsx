import { VibeDiyApi } from "@vibes.diy/api-impl";
import { FPApiInterface } from "@fireproof/core-types-protocols-dashboard";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import { BuildURI, Future, KeyedResolvOnce, Lazy, Result } from "@adviser/cement";
import { PostHogProvider } from "posthog-js/react";
import { PkgRepos, VibesDiyApiIface } from "@vibes.diy/api-types";
import { vibesDiySrvSandbox, VibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { SuperThis } from "@fireproof/use-fireproof";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { toast } from "react-hot-toast";
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
    VIBES_SVC_HOSTNAME_BASE: string;

    CLERK_PUBLISHABLE_KEY: string;
  };
}

export interface AppUserSlugFsId {
  appSlug: string;
  userSlug: string;
  fsId: string;
}

export interface VibesDiyCtx {
  sthis: SuperThis;
  dashApi: FPApiInterface;
  vibeDiyApi: VibesDiyApiIface;
  webVars: VibeDiyWebVars;
  srvVibeSandbox: vibesDiySrvSandbox;
}

const realCtx: VibesDiyCtx = {
  sthis: {} as SuperThis,
  dashApi: {} as FPApiInterface,
  vibeDiyApi: {} as VibeDiyApi,
  webVars: {} as VibesDiyCtx["webVars"],
  srvVibeSandbox: {} as VibesDiyCtx["srvVibeSandbox"],
};

const VibeDiyContext = createContext<VibesDiyCtx>(realCtx as Readonly<VibesDiyCtx>);

const vibesDiyApis = new KeyedResolvOnce();

const lazySuperThis = Lazy(() => ensureSuperThis());

function LiveCycleVibeDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibeDiyWebVars }) {
  const clerk = useClerk();

  realCtx.webVars = webVars;

  realCtx.sthis = lazySuperThis();

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
  // console.log(`apiUrl`, apiUrl, realCtx.webVars.env.VIBES_DIY_API_URL)

  realCtx.vibeDiyApi = vibesDiyApis.get(apiUrl).once(() => {
    let clerkReady: undefined | Future<void> = new Future();
    clerk.addListener(() => {
      if (clerk.isSignedIn) {
        // console.log("clerk-evt", clerk.isSignedIn)
        clerkReady?.resolve(undefined);
      }
    });
    console.log("VibeDiyApi for", apiUrl);
    return new VibeDiyApi({
      apiUrl,
      getToken: async () => {
        if (clerkReady) {
          console.log("getToken-wait-clerkReady");
          await clerkReady.asPromise();
          clerkReady = undefined;
        }
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

  realCtx.srvVibeSandbox = VibesDiySrvSandbox({
    errorLogger: (r) => {
      let txt = "unknown error";
      if (typeof r === "string") {
        txt = r;
      }
      if (Result.Is(r)) {
        txt = r.Err().message;
      }
      if (r?.toString()) {
        txt = r.toString();
      }
      toast.error(txt);
    },
    dashApi: realCtx.dashApi as ReturnType<typeof clerkDashApi>,
    vibeDiyApi: realCtx.vibeDiyApi,
    eventListeners: globalThis.window,
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

export function useVibeDiy() {
  return useContext(VibeDiyContext);
}
