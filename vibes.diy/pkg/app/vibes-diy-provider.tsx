import { VibesDiyApi } from "@vibes.diy/api-impl";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { BuildURI, Future, KeyedResolvOnce, Lazy, Result } from "@adviser/cement";
import { PostHogProvider } from "posthog-js/react";
import { PkgRepos, VibesDiyApiIface } from "@vibes.diy/api-types";
import { vibesDiySrvSandbox, VibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { SuperThis } from "@fireproof/use-fireproof";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { toast } from "react-hot-toast";
// import { PkgRepos } from "@vibes.diy/api-types";

export interface VibesDiyWebVars {
  readonly pkgRepos: PkgRepos;
  readonly env: {
    GTM_CONTAINER_ID?: string;
    POSTHOG_KEY?: string;
    POSTHOG_HOST?: string;
    // WORKSPACE_NPM_URL: string;
    // PUBLIC_NPM_URL: string;
    // DASHBOARD_URL: string;
    VIBES_DIY_API_URL: string;
    VIBES_SVC_HOSTNAME_BASE: string;
    // VIBES_SVC_PROTOCOL: string;
    // VIBES_SVC_PORT: string;

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
  // dashApi: FPApiInterface;
  vibeDiyApi: VibesDiyApiIface;
  webVars: VibesDiyWebVars;
  srvVibeSandbox: vibesDiySrvSandbox;
}

const realCtx: VibesDiyCtx = {
  sthis: {} as SuperThis,
  // dashApi: {} as FPApiInterface,
  vibeDiyApi: {} as VibesDiyApi,
  webVars: {} as VibesDiyCtx["webVars"],
  srvVibeSandbox: {} as VibesDiyCtx["srvVibeSandbox"],
};

const VibesDiyContext = createContext<VibesDiyCtx>(realCtx as Readonly<VibesDiyCtx>);

const vibesDiyApis = new KeyedResolvOnce();

const lazySuperThis = Lazy(() => ensureSuperThis());

function LiveCycleVibesDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibesDiyWebVars }) {
  const clerk = useClerk();

  realCtx.webVars = webVars;

  realCtx.sthis = lazySuperThis();

  const apiUrl =
    realCtx.webVars.env.VIBES_DIY_API_URL ??
    (typeof window !== "undefined"
      ? BuildURI.from(window.location.href)
          .protocol(window.location.protocol.startsWith("https") ? "wss" : "ws")
          .pathname("/api")
          .cleanParams()
          .toString()
      : undefined);

  if (apiUrl) {
    realCtx.vibeDiyApi = vibesDiyApis.get(apiUrl).once(() => {
      let clerkReady: undefined | Future<void> = new Future();
      clerk.addListener(() => {
        if (clerk.isSignedIn) {
          clerkReady?.resolve(undefined);
        }
      });
      return new VibesDiyApi({
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
  }

  if (typeof window !== "undefined" && realCtx.vibeDiyApi) {
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
      vibeDiyApi: realCtx.vibeDiyApi,
      eventListeners: window,
    });
  }

  return <VibesDiyContext.Provider value={realCtx}>{children}</VibesDiyContext.Provider>;
}

function ConditionalPostHog({ children, webVars }: { children: React.ReactNode; webVars: VibesDiyWebVars }) {
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

export function VibesDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibesDiyWebVars }) {
  return (
    <ClerkProvider publishableKey={webVars.env.CLERK_PUBLISHABLE_KEY}>
      <LiveCycleVibesDiyProvider webVars={webVars}>
        <ConditionalPostHog webVars={webVars}>{children}</ConditionalPostHog>
      </LiveCycleVibesDiyProvider>
    </ClerkProvider>
  );
}

export function useVibesDiy() {
  return useContext(VibesDiyContext);
}
