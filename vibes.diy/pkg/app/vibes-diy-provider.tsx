import { VibesDiyApi } from "@vibes.diy/api-impl";
import React, { createContext, useContext } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { BuildURI, exception2Result, Future, KeyedResolvOnce, Lazy, Option, Result } from "@adviser/cement";
import { type } from "arktype";
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

// Cache the most recent Clerk session JWT so `getToken()` can return instantly
// before the Clerk SDK finishes its deferred-bundle load (~2s on first paint).
// We store {token, exp} under this key; exp is parsed from the JWT itself.
// EXP_MARGIN_SEC is the safety window — any cached token expiring within this
// many seconds is treated as stale and we fall through to the slow path.
export const TOKEN_STORAGE_KEY = "vibes.diy.clerk-token";
export const EXP_MARGIN_SEC = 60;

const CachedClerkToken = type({
  token: "string",
  exp: "number",
});
type CachedClerkToken = typeof CachedClerkToken.infer;

const JwtPayload = type({
  exp: "number",
  "+": "delete",
});

export function readCachedClerkToken(): CachedClerkToken | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return undefined;
  const rParsed = exception2Result(() => JSON.parse(raw));
  if (rParsed.isErr()) return undefined;
  const validated = CachedClerkToken(rParsed.Ok());
  if (validated instanceof type.errors) return undefined;
  return validated;
}

export function writeCachedClerkToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  const [, payloadB64] = token.split(".");
  if (!payloadB64) return;
  const rPayload = exception2Result(() => JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))));
  if (rPayload.isErr()) return;
  const validated = JwtPayload(rPayload.Ok());
  if (validated instanceof type.errors) return;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, exp: validated.exp } satisfies CachedClerkToken));
}

export function clearCachedClerkToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Single source of truth for "is the cache usable right now?". Returns the
// token wrapped in Option.Some when usable; otherwise None — and self-clears
// localStorage in the one case where a stale entry must not survive (Clerk
// loaded + signed-out). Splitting this predicate across multiple call sites
// is what produced the regression fixed by b61781c8.
export function readUsableCachedToken(args: {
  readonly clerkLoaded: boolean;
  readonly clerkSignedIn: boolean;
  readonly nowSec: number;
}): Option<string> {
  if (args.clerkLoaded && !args.clerkSignedIn) {
    clearCachedClerkToken();
    return Option.None();
  }
  const cached = readCachedClerkToken();
  if (!cached || cached.exp <= args.nowSec + EXP_MARGIN_SEC) return Option.None();
  return Option.Some(cached.token);
}

function LiveCycleVibesDiyProvider({ children, webVars }: { children: React.ReactNode; webVars: VibesDiyWebVars }) {
  const clerk = useClerk();

  realCtx.webVars = webVars;

  realCtx.sthis = lazySuperThis();

  const apiUrl =
    realCtx.webVars.env.VIBES_DIY_API_URL ??
    BuildURI.from(window.location.href)
      .protocol(window.location.protocol.startsWith("https") ? "wss" : "ws")
      .pathname("/api")
      .cleanParams()
      .toString();
  // console.log(`apiUrl`, apiUrl, realCtx.webVars.env.VIBES_DIY_API_URL)

  realCtx.vibeDiyApi = vibesDiyApis.get(apiUrl).once(() => {
    // Perf hint: if the user is landing on a viewer route, pin this WS to a
    // deterministic per-vibe DO shard so they join whatever DO is already warm
    // for that vibe. The shard is decided once at construction; SPA navigation
    // does not change it (the WS lives the lifetime of the page). For non-vibe
    // routes (chat, explore, root) we omit shardKey so codegen traffic keeps
    // its random-UUID load-balancing.
    const vibeMatch = typeof window !== "undefined" ? window.location.pathname.match(/^\/vibe\/([^/]+)\/([^/]+)/) : null;
    const shardKey = vibeMatch ? `${vibeMatch[1]}--${vibeMatch[2]}` : undefined;
    let clerkReady: undefined | Future<void> = new Future();
    clerk.addListener(() => {
      if (clerk.loaded) {
        // console.log("clerk-evt", clerk.loaded, clerk.isSignedIn)
        clerkReady?.resolve(undefined);
        // Proactive sign-out wipe: redundant with readUsableCachedToken's
        // self-clear on read, but fires immediately so a parallel reader in
        // another tab/component sees the empty cache without waiting for its
        // next getToken().
        if (!clerk.isSignedIn) {
          clearCachedClerkToken();
        }
      }
    });
    return new VibesDiyApi({
      apiUrl,
      shardKey,
      getToken: async () => {
        // Fast path: a cached JWT from a prior page load that still has more
        // than EXP_MARGIN_SEC seconds remaining. Lets the first WS message
        // fire without waiting for Clerk's SDK to finish loading.
        const usable = readUsableCachedToken({
          clerkLoaded: clerk.loaded,
          clerkSignedIn: !!clerk.isSignedIn,
          nowSec: Math.floor(Date.now() / 1000),
        });
        if (usable.IsSome()) {
          return Result.Ok({ type: "clerk", token: usable.Unwrap() });
        }
        if (clerkReady) {
          await clerkReady.asPromise();
          clerkReady = undefined;
        }
        if (!clerk.isSignedIn) {
          return Result.Err("not signed in");
        }
        const ot = await clerk.session?.getToken({ template: "with-email" });
        if (!ot) {
          return Result.Err(`no token`);
        }
        writeCachedClerkToken(ot);
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
    // dashApi: realCtx.dashApi as ReturnType<typeof clerkDashApi>,
    vibeDiyApi: realCtx.vibeDiyApi,
    eventListeners: globalThis.window,
  });

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
