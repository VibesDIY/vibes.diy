import { VibesDiyApi } from "@vibes.diy/api-impl";
import React, { createContext, useContext } from "react";
import { useEngagedVisit } from "./hooks/useEngagedVisit.js";
import { useCapiCompleteRegistration } from "./hooks/useCapiCompleteRegistration.js";
import { ClerkProvider, useClerk } from "@clerk/react";
import { useLocation } from "react-router";
import { vibeApiTarget } from "./vibe-api-target.js";
import { sharedReadShardFor } from "./shared-read-shard.js";
import { BuildURI, exception2Result, Future, KeyedResolvOnce, Lazy, Option, Result } from "@adviser/cement";
import { type } from "arktype";
import { PostHogProvider } from "posthog-js/react";
import { PkgRepos, VibesDiyApiIface } from "@vibes.diy/api-types";
import { vibesDiySrvSandbox, VibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { SuperThis } from "@fireproof/use-fireproof";
import { ensureSuperThis } from "@vibes.diy/identity";
import { toast } from "react-hot-toast";
import { ensureAssetSession, tearDownAssetSession } from "./lib/asset-session.js";
import { avatarConfirmController } from "./lib/avatar-confirm.js";
import { AvatarConfirmModal } from "./components/AvatarConfirmModal.js";
import type { DashAuthType } from "@vibes.diy/identity";
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
  ownerHandle: string;
  fsId: string;
}

export interface VibesDiyCtx {
  sthis: SuperThis;
  // dashApi: FPApiInterface;
  chatApi: VibesDiyApiIface;
  vibeApi?: VibesDiyApiIface;
  // Non-vibe-plane shared reads (+ notify on non-vibe pages). On vibe routes
  // this is vibeApi; otherwise a SharedSessions connection (per-user or global).
  sharedApi: VibesDiyApiIface;
  // Build (or fetch the cached) AppSessions connection for an arbitrary vibe
  // key. For vibe-data that isn't the page's primary vibe — e.g. DM threads
  // keyed by `<channelUserSlug>--dm`. Same data plane as vibeApi, no new DO.
  appApiFor?: (vibeKey: string) => VibesDiyApiIface;
  // Kept for backward compatibility during migration; set to undefined — notify now rides sharedApi.
  notifyApi?: VibesDiyApiIface;
  webVars: VibesDiyWebVars;
  srvVibeSandbox: vibesDiySrvSandbox;
  getToken?: () => Promise<Result<DashAuthType>>;
}

const realCtx: VibesDiyCtx = {
  sthis: {} as SuperThis,
  // dashApi: {} as FPApiInterface,
  chatApi: {} as VibesDiyApi,
  sharedApi: {} as VibesDiyApiIface,
  webVars: {} as VibesDiyCtx["webVars"],
  srvVibeSandbox: {} as VibesDiyCtx["srvVibeSandbox"],
};

// @internal Exported so tests can inject a context value via
// <VibesDiyContext.Provider> instead of module-mocking this provider (which
// bleeds under isolate:false). App code should use useVibesDiy(), not this.
export const VibesDiyContext = createContext<VibesDiyCtx>(realCtx as Readonly<VibesDiyCtx>);

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

  const location = useLocation();
  const target = vibeApiTarget(location.pathname);

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

  // Shared token-getter captured by both chatApi and vibeApi closures.
  // Set synchronously inside the chatApi .once() call below.
  let sharedGetToken: (() => Promise<Result<DashAuthType>>) | undefined;

  realCtx.chatApi = vibesDiyApis.get(apiUrl).once(() => {
    // Perf hint: if the user is landing on a viewer route, pin this WS to a
    // deterministic per-vibe DO shard so they join whatever DO is already warm
    // for that vibe. The shard is decided once at construction; SPA navigation
    // does not change it (the WS lives the lifetime of the page). For non-vibe
    // routes (chat, explore, root) we omit shardKey so codegen traffic keeps
    // its random-UUID load-balancing.
    const vibeMatch = typeof window !== "undefined" ? window.location.pathname.match(/^\/vibe\/([^/]+)\/([^/]+)/) : null;
    const shardKey = vibeMatch ? `${vibeMatch[1]}--${vibeMatch[2]}` : undefined;
    let clerkReady: undefined | Future<void> = new Future();
    const hostnameBase = realCtx.webVars.env.VIBES_SVC_HOSTNAME_BASE;
    const getToken = async (): Promise<Result<DashAuthType>> => {
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
    };
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
          // Stage C: drop the asset-host session cookie too. Best-effort
          // (network blip → cookie expires on its own per Max-Age).
          if (hostnameBase) {
            void tearDownAssetSession({ hostnameBase });
          }
        } else if (hostnameBase) {
          // Stage C: prime/refresh the asset-host session cookie. Login OR
          // silent token rotation both fire this listener; ensureAssetSession
          // is idempotent + cached so redundant calls are no-ops. By the
          // time the iframe boots and the srv-sandbox bridge gate runs,
          // the cookie's already in the jar.
          void ensureAssetSession({ getToken, hostnameBase });
        }
        // Note: the user-notification subscription is owned by
        // useBuildCompletionNotifications (mounted in the auth layout), which
        // subscribes whichever connection the current page already has —
        // preferring vibeApi (AppSessions) so we don't open a heavier chatApi
        // socket just for notifications when an app connection exists.
      }
    });
    realCtx.getToken = getToken;
    sharedGetToken = getToken;
    return new VibesDiyApi({
      apiUrl,
      shardKey,
      getToken,
    });
  });

  // AppSessions connection factory, keyed by an arbitrary vibe key. Same data
  // plane as vibeApi (skipShard, shared getToken); the module-level
  // vibesDiyApis.once() cache makes repeated calls for the same key return the
  // same instance, so callers can invoke this every render without churning a
  // WebSocket. Used for the primary vibeApi below and for DM threads (keyed
  // `<channelUserSlug>--dm`) on the /messages routes.
  const buildAppApi = (vibeKey: string): VibesDiyApiIface => {
    const appApiUrl = BuildURI.from(apiUrl).pathname("/api/app").cleanParams().setParam("vibe", vibeKey).toString();
    const capturedGetToken = sharedGetToken ?? realCtx.getToken;
    return vibesDiyApis.get(appApiUrl).once(() => {
      return new VibesDiyApi({
        apiUrl: appApiUrl,
        skipShard: true,
        getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
      });
    }) as VibesDiyApiIface;
  };
  realCtx.appApiFor = buildAppApi;

  // SharedSessions connection factory: targets /api/shared?shard=<x>.
  // skipShard: true preserves the ?shard param already embedded in the URL
  // (same pattern as buildAppApi with ?vibe= — see api/impl/index.ts:272-276
  // where skipShard || cfg.ws → use cfg.apiUrl as-is, no ?shard= appended).
  const buildSharedApi = (shard: string): VibesDiyApiIface => {
    const sharedUrl = BuildURI.from(apiUrl).pathname("/api/shared").cleanParams().setParam("shard", shard).toString();
    const capturedGetToken = sharedGetToken ?? realCtx.getToken;
    return vibesDiyApis.get(sharedUrl).once(
      () =>
        new VibesDiyApi({
          apiUrl: sharedUrl,
          skipShard: true, // shard is already embedded in the URL above; do not append a random one
          getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
        })
    ) as VibesDiyApiIface;
  };

  // Build vibeApi (→ AppSessions, which wires the doc-changed emit) for every
  // route that renders the vibe-data iframe: the /vibe/ viewer AND the /chat/
  // editor. Gated on a real appSlug — a chat with no app yet gets no vibeApi.
  // Reactive via useLocation() above so a freshly-created chat (navigated to
  // /chat/<owner>/<appSlug> after openChat) picks up its vibeApi. (#2306)
  if (target !== undefined) {
    realCtx.vibeApi = buildAppApi(`${target.ownerHandle}--${target.appSlug}`);
    realCtx.sharedApi = realCtx.vibeApi; // vibeApi already serves sharedHandlers
    realCtx.notifyApi = undefined; // notify rides sharedApi now
  } else {
    realCtx.vibeApi = undefined;
    // SharedSessions WS: authed → per-user shard (same as notifications);
    // anon → global singleton. Handles shared reads + user notify on non-vibe pages.
    realCtx.sharedApi = buildSharedApi(sharedReadShardFor(clerk.user?.id));
    realCtx.notifyApi = undefined; // notify rides sharedApi now
  }

  const sandboxHostnameBase = realCtx.webVars.env.VIBES_SVC_HOSTNAME_BASE;
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
    chatApi: realCtx.chatApi,
    vibeApi: realCtx.vibeApi,
    eventListeners: globalThis.window,
    openSignIn: () => clerk.openSignIn(),
    // Host-side consent gate (#1968): a sandboxed vibe can propose an avatar
    // write, but the AvatarConfirmModal (mounted below) must approve it before
    // ensureUserSettings runs.
    confirmAvatarUpdate: (req) => avatarConfirmController.request(req),
    // Stage C: bridge the asset-host cookie before the iframe gets ack.
    // Reuses the same module-level cache as the Clerk listener — if login
    // already primed the session, this resolves instantly.
    ...(sandboxHostnameBase
      ? {
          ensureAssetSession: async () => {
            const fn = realCtx.getToken;
            if (!fn) return;
            await ensureAssetSession({ getToken: fn, hostnameBase: sandboxHostnameBase });
          },
        }
      : {}),
  });

  // The sandbox is a module-level Lazy singleton — built once, on whatever
  // route first renders this provider. Refresh its vibe-data API on every
  // render so a sandbox first built on a non-vibe render (vibeApi undefined),
  // or a cross-vibe navigation, routes data ops to the current vibeApi instead
  // of the frozen constructor copy. Idempotent on an unchanged reference. (#2348)
  realCtx.srvVibeSandbox.setVibeApi?.(realCtx.vibeApi);

  useEngagedVisit();
  useCapiCompleteRegistration();
  return (
    <VibesDiyContext.Provider value={realCtx}>
      {children}
      <AvatarConfirmModal />
    </VibesDiyContext.Provider>
  );
}

function ConditionalPostHog({ children, webVars }: { children: React.ReactNode; webVars: VibesDiyWebVars }) {
  if (webVars.env.POSTHOG_KEY && webVars.env.POSTHOG_HOST) {
    return (
      <PostHogProvider
        apiKey={webVars.env.POSTHOG_KEY}
        options={{
          api_host: webVars.env.POSTHOG_HOST,
          opt_out_capturing_by_default: false,
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
