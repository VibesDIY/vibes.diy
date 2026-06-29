import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMatches, useNavigate, useParams, useSearchParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth, useClerk } from "@clerk/react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { Delayed } from "../components/Delayed.js";
import {
  VibesSwitch,
  VibesButton,
  BLUE,
  YELLOW,
  UnifiedVibeCard,
  SharePanelView,
  gridBackground,
  cx,
  useMobile,
  resolveBuilderOriginFrom,
} from "@vibes.diy/base";
import type { ShareMember, ShareViewer, ShareAccess, HandleOption } from "@vibes.diy/base";
import { isUserSettingDefaultHandle } from "@vibes.diy/api-types";
import { switchActiveHandle, createAndUseHandle, handleAvatarUrl } from "./handle-picker-actions.js";
import { uploadHandleAvatar } from "../lib/upload-avatar.js";
import { useYoursNowToast } from "../hooks/use-yours-now-toast.js";
import { useShareModal } from "../components/ResultPreview/useShareModal.js";
import { useIframeApiInFlight } from "../hooks/useIframeApiInFlight.js";
import { ShareModal } from "../components/ResultPreview/ShareModal.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLatestVibeChips } from "../hooks/useLatestVibeChips.js";
import { useInVibeGeneration } from "../hooks/useInVibeGeneration.js";
import { InVibeBlurOverlay } from "../components/InVibeBlurOverlay.js";
import { GenerationStreamView } from "../components/GenerationStreamView.js";
import { toast } from "react-hot-toast";
import { isMetaScreenShot, isMetaTitle, type ResGetAppByFsId, type VibesFPApiParameters } from "@vibes.diy/api-types";
import { computeCardVariant } from "./vibe-card-variant.js";
import { readIntent, withIntent, withoutIntent } from "./vibe-intent.js";
import { forkDestination } from "./vibe-fork.js";
import { buildPinnedIframeUrl } from "./vibe-draft-pin.js";
import { notifyRecentVibesChanged } from "../hooks/useRecentVibes.js";
import { adminModeStorageKey } from "../lib/admin-mode.js";
import { RUNTIME_PREVIEW_IFRAME_ALLOW, RUNTIME_PREVIEW_IFRAME_SANDBOX } from "../lib/iframe-policy.js";

// Server-render the iframe URL so the <iframe src=...> ships in the very
// first byte of HTML. Without this, the browser can't start fetching the
// iframe document until React has hydrated and a useEffect has run — adding
// hundreds of ms to perceived load time on viewer pages.
interface VibeLoaderCtx {
  readonly vibeDiyAppParams: VibesFPApiParameters;
  readonly vibeOgTitle?: string;
  readonly isWorldReadable?: boolean;
}

interface VibeLoaderData {
  readonly iframeUrl: string | undefined;
  readonly vibeOgTitle: string | undefined;
  readonly isWorldReadable: boolean;
}

function isWriterCapableGrant(grant: ResGetAppByFsId["grant"]): boolean {
  return grant === "owner" || grant === "accepted-email-invite" || grant === "granted-access.editor";
}

export async function loader(loaderCtx: {
  params: Record<string, string | undefined>;
  request: Request;
  context: VibeLoaderCtx;
}): Promise<VibeLoaderData> {
  const { ownerHandle, appSlug, fsId } = loaderCtx.params;
  if (!ownerHandle || !appSlug) {
    return { iframeUrl: undefined, vibeOgTitle: undefined, isWorldReadable: false };
  }
  const reqUrl = URI.from(loaderCtx.request.url);
  const protocol = reqUrl.protocol === "https:" ? "https" : "http";
  const port = reqUrl.port && reqUrl.port !== "80" && reqUrl.port !== "443" ? reqUrl.port : undefined;
  const params = loaderCtx.context.vibeDiyAppParams;
  const baseUrl = calcEntryPointUrl({
    hostnameBase: params.vibes.svc.hostnameBase,
    protocol,
    bindings: { appSlug, ownerHandle, ...(fsId ? { fsId } : {}) },
    port,
  });
  const reqParams = Object.fromEntries(reqUrl.getParams);
  const iframeUrl = BuildURI.from(baseUrl)
    .searchParams(reqParams, "merge")
    .setParam("npmUrl", params.pkgRepos.workspace)
    .toString();
  return {
    iframeUrl,
    vibeOgTitle: loaderCtx.context.vibeOgTitle,
    isWorldReadable: loaderCtx.context.isWorldReadable ?? false,
  };
}

export function meta({
  data,
  params,
  matches,
}: {
  data: VibeLoaderData;
  params: Record<string, string>;
  matches: { data: unknown }[];
}) {
  const { ownerHandle, appSlug } = params;
  const rootData = matches[0]?.data as { env?: { VIBES_SVC_HOSTNAME_BASE?: string } } | undefined;
  const hostnameBase = rootData?.env?.VIBES_SVC_HOSTNAME_BASE?.replace(/^\./, "") ?? "vibes.diy";
  const imageUrl = `https://${appSlug}--${ownerHandle}.${hostnameBase}/screenshot.jpg`;
  const title = data?.vibeOgTitle ?? appSlug ?? "Vibe";

  return [
    { title: `${title} - vibes.diy` },
    { name: "description", content: `${title} - built on vibes.diy` },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: `${title} - built on vibes.diy` },
    { property: "og:image", content: imageUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: `${title} - built on vibes.diy` },
    { name: "twitter:image", content: imageUrl },
  ];
}

export default function VibeIframeWrapper() {
  const { ownerHandle, appSlug, fsId } = useParams<{ ownerHandle: string; appSlug: string; fsId?: string }>();
  const navigate = useNavigate();
  useDocumentTitle(`${ownerHandle} - ${appSlug} - vibes.diy`);
  // const [searchParam] = useSearchParams();
  const vctx = useVibesDiy();
  // Vibe-scoped doc-plane ops (e.g. subscribeViewerGrants) run on AppSessions
  // (vibeApi) so doc-changed fan-out + local access-fn eval happen locally.
  // These are VIBE_ONLY ops, so there is no codegen fallback — when vibeApi is
  // absent, mint the AppSessions connection for this route's vibe key via
  // appApiFor. Both are Conn<"vibe">. (#2714, was #2265 A1)
  const dataApi = vctx.vibeApi ?? (ownerHandle && appSlug ? vctx.appApiFor?.(`${ownerHandle}--${appSlug}`) : undefined);
  // Iframe URL: prefer the SSR-computed value from the loader so the
  // <iframe src=...> ships in the first byte of HTML and the browser can
  // start fetching the iframe document without waiting for React hydration.
  // Fall back to client-side computation when the loader didn't run — e.g.
  // the SSR regression test (MemoryRouter with no data router) and any
  // future client-only mount paths. Use useMatches instead of useLoaderData
  // so this works in non-data routers (the test) without throwing. Render
  // must remain SSR-safe: no synchronous window access.
  const matches = useMatches();
  const loaderData = matches[matches.length - 1]?.data as { iframeUrl?: string; isWorldReadable?: boolean } | undefined;
  const isWorldReadable = (loaderData as { isWorldReadable?: boolean } | undefined)?.isWorldReadable ?? false;
  const [iframeUrl, setIframeUrl] = useState<string | undefined>(loaderData?.iframeUrl);
  // #2772 D1: the owner's latest unpublished in-place draft. `draftFsId` re-pins the
  // iframe to that version; `isDraft` drives the "Draft · unpublished" badge. Both stay
  // unset for non-owners, versioned URLs, and owners whose latest is already published.
  // Declared here (above the iframe-sync effect) because that effect pins `draftFsId`.
  const [draftFsId, setDraftFsId] = useState<string | undefined>(undefined);
  const [isDraft, setIsDraft] = useState(false);
  // #2772 D2: publish-in-flight flag + a bump that re-runs the draft resolver after
  // a successful publish (so the badge + banner clear and the iframe re-pins to the
  // freshly-published production).
  const [publishing, setPublishing] = useState(false);
  const [publishBump, setPublishBump] = useState(0);
  const isNetworkActive = useIframeApiInFlight();
  // Gate the post-iframe chrome (overlays, pill, sidebar) until after client
  // hydration. The chrome uses createPortal(..., document.body), which calls
  // document at parent render time — that throws on SSR. Hydration-safe: SSR
  // and initial client render both see hasMounted=false (matching markup),
  // then useEffect flips it true and chrome paints in.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const ssrIframeUrl = loaderData?.iframeUrl;
  useEffect(() => {
    if (ssrIframeUrl && !draftFsId) {
      // On the data-router path the loader re-runs on a client-side param change
      // (e.g. the seamless non-owner fork navigating to /vibe/$yours/$forkSlug),
      // producing a fresh loader iframeUrl. The `iframeUrl` state was only seeded
      // once at mount, so without copying the new value the <iframe src> stays
      // pinned to the source app and the fork's generation would hot-swap the
      // stale runtime. Sync state to the current loader URL. (#2677 PR-B)
      //
      // EXCEPTION (#2772 D1): when the owner has an unpublished draft, `draftFsId`
      // is set and we fall through to re-pin the iframe to that draft version —
      // a single transition from the SSR production paint (which is the correct
      // first paint for anon + the owner before their draft resolves).
      setIframeUrl(ssrIframeUrl);
      return;
    }
    if (!appSlug || !ownerHandle) {
      setIframeUrl(undefined);
      return;
    }
    const myUrl = URI.from(window.location.href);
    const port = myUrl.port && myUrl.port !== "80" && myUrl.port !== "443" ? myUrl.port : undefined;
    // A versioned URL (route-param `fsId`) is an explicit request and is NEVER
    // overridden; only the unversioned owner-draft case pins `draftFsId`. The query
    // params are merged so a `?token`/etc. survives the re-pin (spec §3b).
    setIframeUrl(
      buildPinnedIframeUrl({
        hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol === "https:" ? "https" : "http",
        port,
        appSlug,
        ownerHandle,
        fsId,
        draftFsId,
        currentParams: Object.fromEntries(myUrl.getParams),
        npmUrl: vctx.webVars.pkgRepos.workspace,
      })
    );
  }, [
    ssrIframeUrl,
    appSlug,
    ownerHandle,
    fsId,
    draftFsId,
    vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
    vctx.webVars.pkgRepos.workspace,
  ]);

  const [notFound, setNotFound] = useState(false);
  const [reqLogin, setReqLogin] = useState(false);
  const [cardGrant, setCardGrant] = useState<ResGetAppByFsId["grant"] | undefined>(undefined);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState<string | null>(null);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | undefined>(undefined);
  const { isSignedIn: authSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const [searchParam, setSearchParam] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  // The edit card's suggestion chips are the vibe's OWN latest suggestions — the
  // trailing `▸` options the model emitted on the last codegen turn — not a
  // hardcoded placeholder. Owner-gated read (the owner's chat is private), so
  // non-owners get the text-input-only card. (#2704-adjacent regression fix, §1a.)
  const editChips = useLatestVibeChips({
    sharedApi: vctx.sharedApi,
    ownerHandle,
    appSlug,
    fsId,
    enabled: isOwner,
  });

  const generation = useInVibeGeneration({
    ownerHandle: ownerHandle ?? "",
    appSlug: appSlug ?? "",
    fsId,
    chatApi: vctx.chatApi,
    sharedApi: vctx.sharedApi,
    srvVibeSandbox: vctx.srvVibeSandbox,
    enabled: isOwner,
  });

  // The chips the edit card displays. Once an in-place edit has run we prefer the
  // fresh follow-up chips the model just streamed over the (now stale) pre-edit
  // persisted-chat chips. We only re-settle this OUTSIDE a turn: while one streams,
  // `suggestionChips` is parsed from the in-progress block and would churn line by
  // line — the chips are hidden behind the stream then, but they still reserve the
  // panel's height, so freezing them keeps the panel from resizing mid-edit.
  //
  // Distinguish "no local edit yet" from "a local edit ran but offered no options":
  // once the user has started an in-place edit THIS session we trust its
  // `suggestionChips` even when empty (→ the text-input-only state), rather than
  // restoring the stale pre-edit `editChips`. Gate on `hasLocalEdit`, not on the
  // mere presence of blocks — replayed chat history also fills blocks on open and
  // would wrongly override the fsId-scoped persisted chips on a versioned view.
  const [cardChips, setCardChips] = useState<readonly string[]>(editChips);
  useEffect(() => {
    if (generation.isGenerating) return;
    setCardChips(generation.hasLocalEdit ? generation.suggestionChips : editChips);
  }, [generation.isGenerating, generation.hasLocalEdit, generation.suggestionChips, editChips]);

  // On the forked /vibe page (?prompt64 carried from a seamless non-owner fork),
  // auto-fire the generation once ownership resolves to us — only when isOwner is
  // true (i.e. the page is already our own fork), so we never send against the
  // owner's session. Guarded by a ref + scrubbed from the URL so a refresh/re-render
  // doesn't re-fire. (#2677 PR-B)
  const autoFiredRef = useRef(false);
  // Guards against a rapid double-submit forking the same vibe twice (each fork
  // would mint a separate copy). Reset on vibe change (below) and on fork error.
  const forkingRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    const p64 = searchParam.get("prompt64");
    if (!p64 || !isOwner) return;
    autoFiredRef.current = true;
    generation.sendPrompt(vctx.sthis.txt.base64.decode(p64));
    const next = new URLSearchParams(searchParam);
    next.delete("prompt64");
    setSearchParam(next, { replace: true });
  }, [isOwner, searchParam, setSearchParam, generation.sendPrompt, vctx.sthis]);

  // The edit affordance, routed by ownership at the moment of the write
  // (§2 "Ownership decides, at the write"):
  //   - Owner → generate in place: sendPrompt drives the in-card codegen stream.
  //   - Signed-in non-owner → make it yours INLINE: forkApp to your handle, then
  //     land on the fork's /vibe page carrying ?prompt64 so it auto-fires there.
  //   - Logged-out non-owner → the /remix hop (it handles login → fork → prompt).
  // A non-owner can't write the owner's chat (the server rejects on userId
  // mismatch), so the fork must complete and the URL must be the fork before any
  // codegen opens. URLSearchParams encodes the base64 safely (+, /, = are
  // URL-significant).
  const handleEditPrompt = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !ownerHandle || !appSlug) return;
      // Owner: generate in place (PR-A).
      if (isOwner) {
        generation.sendPrompt(trimmed);
        return;
      }
      const prompt64 = vctx.sthis.txt.base64.encode(trimmed);
      // Logged-out non-owner: keep the existing /remix hop (it handles
      // login -> fork -> prompt). Seamless inline fork needs a signed-in user.
      if (!authSignedIn) {
        void navigate(`/remix/${ownerHandle}/${appSlug}?${new URLSearchParams({ prompt64 }).toString()}`);
        return;
      }
      // Signed-in non-owner: make-it-yours INLINE, then land on the fork's /vibe
      // page carrying the prompt. The fork must complete (and the URL must point
      // at the fork) before any codegen opens. Anchor the destination on the
      // returned ResForkApp fields, not the pre-fork route params. The in-flight
      // guard stops a rapid double-tap from minting two forks.
      if (forkingRef.current) return;
      forkingRef.current = true;
      const tid = toast.loading("Making it yours…");
      void (async () => {
        const rFork = await vctx.chatApi.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: fsId });
        if (rFork.isErr()) {
          forkingRef.current = false; // allow a retry
          toast.error(`Couldn't make it yours: ${rFork.Err().message}`, { id: tid });
          return;
        }
        toast.dismiss(tid);
        notifyRecentVibesChanged();
        // On success we navigate to the fork; the slug-keyed reset effect clears
        // forkingRef so the new page can fork again later if needed.
        void navigate(forkDestination(rFork.Ok(), prompt64), { replace: true });
      })();
    },
    [isOwner, authSignedIn, ownerHandle, appSlug, fsId, navigate, vctx.sthis, vctx.chatApi, generation.sendPrompt]
  );

  // #2772 D2: publish the owner's current draft. Mints a new top-of-stack production
  // server-side (no demote); on success bump the draft resolver so the badge + banner
  // clear and the iframe re-pins to the now-published production.
  const handlePublish = useCallback(() => {
    if (!isOwner || !ownerHandle || !appSlug || publishing) return;
    setPublishing(true);
    const tid = toast.loading("Publishing…");
    void (async () => {
      const rPub = await vctx.chatApi.publishApp({ ownerHandle, appSlug });
      setPublishing(false);
      if (rPub.isErr()) {
        toast.error(`Couldn't publish: ${rPub.Err().message}`, { id: tid });
        return;
      }
      toast.success("Published — everyone sees it now.", { id: tid });
      notifyRecentVibesChanged();
      setPublishBump((n) => n + 1);
    })();
  }, [isOwner, ownerHandle, appSlug, publishing, vctx.chatApi]);

  const adminStorageKey = ownerHandle && appSlug ? adminModeStorageKey(ownerHandle, appSlug) : "";
  const [adminMode, setAdminMode] = useState(() => {
    if (typeof window === "undefined" || !adminStorageKey) return false;
    return localStorage.getItem(adminStorageKey) === "true";
  });
  const adminModeRef = useRef(adminMode);
  useEffect(() => {
    adminModeRef.current = adminMode;
  }, [adminMode]);
  // One-time "it's yours now" message when landing here from a fresh clone (#1856).
  useYoursNowToast();

  const [myUserSlug, setMyUserSlug] = useState<string | undefined>(undefined);
  // The handles this account can act as, for the active-handle switcher (#2678,
  // the UI for #2275). The avatar URL is the per-handle endpoint (#2434); it 404s
  // gracefully to the initial when a handle has no photo yet.
  const [myHandles, setMyHandles] = useState<HandleOption[]>([]);
  const [handlePickerBusy, setHandlePickerBusy] = useState(false);
  // Cache-buster bumped after an avatar upload so the per-handle /u/<h>/avatar
  // endpoint re-paints with the new image instead of the cached one.
  const [avatarVersion, setAvatarVersion] = useState(0);
  // The viewer's grant on this vibe — used to decide whether the comments
  // composer is enabled when the owner has flipped "Only collaborators can
  // comment" on. Owner + editor stay enabled; viewer/submitter/public/none
  // get the disabled hint.
  const [myGrant, setMyGrant] = useState<"owner" | "editor" | "viewer" | "submitter" | "public" | "none">("none");
  // Pending request count is still fetched (network side effect feeds future
  // share-popover wiring, #2680) but no longer rendered after the pill→card
  // swap; underscore-prefixed so the unused-var lint stays green.
  const [_pendingCount, setPendingCount] = useState(0);
  const [pendingBump, setPendingBump] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const inRefreshViewerFromWhoAmIRef = useRef(false);

  const inGetAppByFsIdRef = useRef(false);
  // Dedupe key + cached response: when only `authSignedIn` flips post-Clerk-hydration,
  // we re-derive UI from the cached response instead of re-firing the API call.
  // Without this, every viewer load fires getAppByFsId twice — once optimistically with
  // the cached JWT (~73 ms cold), once after Clerk's useAuth/useSession finalize.
  const lastFiredKeyRef = useRef<string>("");
  const cachedResRef = useRef<ResGetAppByFsId | undefined>(undefined);
  const hasRuntimeReadyRef = useRef(false);
  const writerGrantActiveRef = useRef(false);
  const pendingWriterViewerRefreshRef = useRef(false);

  useEffect(() => {
    hasRuntimeReadyRef.current = false;
    writerGrantActiveRef.current = false;
    pendingWriterViewerRefreshRef.current = false;
    // The /vibe route component is reused across client-side vibe→vibe nav, so
    // reset the auto-fire one-shot too — otherwise a second seamless fork in the
    // same session (carrying ?prompt64) would be suppressed and never generate.
    autoFiredRef.current = false;
    forkingRef.current = false;
    // Clear the previous vibe's draft pin synchronously on nav — the draft effect
    // re-resolves async, so without this the new vibe briefly shows the old draft
    // fsId (the route component is reused across vibe→vibe nav). (#2772 D1)
    setDraftFsId(undefined);
    setIsDraft(false);
  }, [ownerHandle, appSlug]);

  useEffect(() => {
    if (!authSignedIn || !ownerHandle) {
      setIsOwner(false);
      setMyUserSlug(undefined);
      setMyHandles([]);
      return;
    }
    let cancelled = false;
    // Resolve the handle list + the active (default) handle together: ownership is
    // account-level (any of your handles), so isOwner is independent of which
    // handle is active. The active handle is the `defaultHandle` setting honored
    // server-side by resolveActiveHandle (#2275); fall back to the first binding.
    void Promise.all([vctx.sharedApi.listHandleBindings({}), vctx.sharedApi.ensureUserSettings({ settings: [] })]).then(
      ([bRes, sRes]) => {
        if (cancelled || bRes.isErr()) return;
        const items = bRes.Ok().items;
        setIsOwner(items.some((item) => item.ownerHandle === ownerHandle));
        setMyHandles(items.map((i) => ({ slug: i.ownerHandle, avatarUrl: handleAvatarUrl(i.ownerHandle) })));
        const def = sRes.isOk() ? sRes.Ok().settings.filter(isUserSettingDefaultHandle)[0]?.ownerHandle : undefined;
        const active = def && items.some((i) => i.ownerHandle === def) ? def : items[0]?.ownerHandle;
        if (active) setMyUserSlug(active);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [authSignedIn, ownerHandle, vctx.sharedApi]);

  // #2772 D1: owner draft read. When the owner views the UNVERSIONED /vibe URL,
  // resolve their latest-incl-dev fsId (selectMode:"ownerLatest", owner-verified
  // server-side). A `dev` result means an unpublished draft → pin it (the iframe-sync
  // effect re-pins to `draftFsId`) + show the badge; a `production` result means
  // up-to-date → leave the production paint as is. Versioned URLs (route-param `fsId`)
  // and non-owners are guarded out, so the public surface is unchanged.
  useEffect(() => {
    if (!isOwner || fsId || !ownerHandle || !appSlug) {
      setIsDraft(false);
      setDraftFsId(undefined);
      return;
    }
    let cancelled = false;
    void vctx.sharedApi.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" }).then((rRes) => {
      if (cancelled || rRes.isErr()) return;
      const res = rRes.Ok();
      // Only honor a genuine owner grant on a dev row; anything else stays on production.
      if (res.error || res.grant !== "owner" || !res.fsId || res.mode !== "dev") {
        setIsDraft(false);
        setDraftFsId(undefined);
        return;
      }
      setIsDraft(true);
      setDraftFsId(res.fsId);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, fsId, ownerHandle, appSlug, publishBump, vctx.sharedApi]);

  useEffect(() => {
    if (!isOwner || !ownerHandle || !appSlug) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    vctx.sharedApi.listRequestGrants({ appSlug, ownerHandle, pager: { limit: 100 } }).then((res) => {
      if (cancelled || res.isErr()) return;
      setPendingCount(res.Ok().items.filter((r) => r.state === "pending").length);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, ownerHandle, appSlug, vctx.sharedApi, pendingBump]);

  useEffect(() => {
    if (!isOwner || !ownerHandle || !appSlug) {
      return;
    }
    void vctx.sharedApi.subscribeRequestGrants({ appSlug, ownerHandle });
    const unsubscribe = vctx.sharedApi.onRequestGrant((evt) => {
      if (evt.grant.ownerHandle === ownerHandle && evt.grant.appSlug === appSlug) {
        setPendingBump((n) => n + 1);
      }
    });
    return unsubscribe;
  }, [isOwner, ownerHandle, appSlug, vctx.sharedApi]);

  useEffect(() => {
    if (!vctx.sharedApi || !authSignedIn) {
      setDmUnreadCount(0);
      return;
    }
    let cancelled = false;
    vctx.sharedApi.listDmThreads({}).then((res) => {
      if (cancelled || res.isErr()) return;
      const total = res.Ok().items.reduce((sum, t) => sum + t.unreadCount, 0);
      setDmUnreadCount(total);
    });
    return () => {
      cancelled = true;
    };
  }, [vctx.sharedApi, authSignedIn]);

  useEffect(() => {
    if (authSignedIn) {
      setIsSidebarVisible(false);
    }
  }, [authSignedIn]);

  // On the "App not available" screen the top-left logo + sidebar are the only
  // thing to interact with, so open the sidebar by default once we resolve to
  // not-found. Runs only on the false→true transition, so it stays closeable.
  useEffect(() => {
    if (notFound) {
      setIsSidebarVisible(true);
    }
  }, [notFound]);

  // Subscribe to DM navigation requests from the iframe. A vibe posts
  // ReqOpenDmThread to ask the parent to open a direct-message thread.
  const srvVibeSandbox = vctx.srvVibeSandbox;

  const refreshViewerFromWhoAmI = useCallback(
    async (adminOverride?: boolean) => {
      if (!srvVibeSandbox || !ownerHandle || !appSlug) return;
      if (inRefreshViewerFromWhoAmIRef.current) return;
      inRefreshViewerFromWhoAmIRef.current = true;

      try {
        // admin mode is a doc-plane concern → ride the AppSessions (vibe)
        // connection; no codegen fallback. (#2714)
        const conn = vctx.vibeApi ?? vctx.appApiFor?.(`${ownerHandle}--${appSlug}`);
        if (!conn) return;
        const rRes = await conn.whoAmI({
          tid: crypto.randomUUID(),
          appSlug,
          ownerHandle,
          adminMode: adminOverride ?? adminModeRef.current,
        });
        if (rRes.isErr()) return;
        const r = rRes.Ok();
        srvVibeSandbox.pushViewerChanged({
          type: "vibe.evt.viewerChanged",
          viewer: r.viewer,
          access: r.access,
          ...(r.isOwner !== undefined ? { isOwner: r.isOwner } : {}),
          ...(r.grants ? { grants: r.grants } : {}),
          ...(r.adminMode !== undefined ? { adminMode: r.adminMode } : {}),
        });
        setMyGrant(
          r.isOwner
            ? "owner"
            : r.access === "editor" || r.access === "override"
              ? "editor"
              : r.access === "viewer"
                ? "viewer"
                : r.access === "submitter"
                  ? "submitter"
                  : "public"
        );
      } finally {
        inRefreshViewerFromWhoAmIRef.current = false;
      }
    },
    [appSlug, ownerHandle, srvVibeSandbox, vctx.vibeApi, vctx.appApiFor]
  );

  const flushPendingWriterViewerRefresh = useCallback(async (): Promise<void> => {
    if (!pendingWriterViewerRefreshRef.current || !hasRuntimeReadyRef.current) return;
    await refreshViewerFromWhoAmI();
    pendingWriterViewerRefreshRef.current = false;
  }, [refreshViewerFromWhoAmI]);

  // Switch the active handle: persist it as the `defaultHandle` user setting, which
  // resolveActiveHandle honors when attributing later writes (codegen/fork/data).
  // After the write, re-run whoAmI so the embedded vibe's viewer identity + grants
  // (useViewer / vibe.evt.viewerChanged) switch personas too — otherwise the iframe
  // keeps the old handle while document writes use the new one (Codex P1).
  const handleSelectHandle = useCallback(
    (slug: string) =>
      switchActiveHandle({
        slug,
        currentSlug: myUserSlug,
        sharedApi: vctx.sharedApi,
        setBusy: setHandlePickerBusy,
        setActiveHandle: setMyUserSlug,
        refreshViewer: refreshViewerFromWhoAmI,
      }),
    [myUserSlug, vctx.sharedApi, refreshViewerFromWhoAmI]
  );

  const handleNewHandle = useCallback(
    (handle?: string) =>
      createAndUseHandle({
        ownerHandle: handle,
        sharedApi: vctx.sharedApi,
        setBusy: setHandlePickerBusy,
        setHandles: setMyHandles,
        setActiveHandle: setMyUserSlug,
        refreshViewer: refreshViewerFromWhoAmI,
      }),
    [vctx.sharedApi, refreshViewerFromWhoAmI]
  );

  // Make a new avatar for the active handle from the card's viewer tag — the same
  // upload + consent-overlay flow Settings uses (uploadHandleAvatar). On success
  // bust the avatar URL and re-run whoAmI so the embedded vibe's viewer (its
  // avatar comes from the same endpoint) repaints too.
  const handlePickAvatar = useCallback(
    async (file: File) => {
      if (!myUserSlug) return;
      const result = await uploadHandleAvatar({ sharedApi: vctx.sharedApi, handle: myUserSlug, file });
      if (!result.ok) {
        if (!result.cancelled) toast.error(result.error);
        return;
      }
      setAvatarVersion((v) => v + 1);
      void refreshViewerFromWhoAmI();
    },
    [myUserSlug, vctx.sharedApi, refreshViewerFromWhoAmI]
  );

  useEffect(() => {
    if (!srvVibeSandbox) return;
    return srvVibeSandbox.onRuntimeReady(() => {
      hasRuntimeReadyRef.current = true;
      void flushPendingWriterViewerRefresh();
    }) as () => void;
  }, [srvVibeSandbox, flushPendingWriterViewerRefresh]);

  useEffect(() => {
    if (!srvVibeSandbox || !myUserSlug) return;
    return srvVibeSandbox.onOpenDmThread(({ recipientUserSlug }) => {
      void navigate(`/messages/${myUserSlug}/${recipientUserSlug}`);
    }) as () => void;
  }, [srvVibeSandbox, myUserSlug, navigate]);

  // Resolve grant + chrome data async. The iframe is already mounted from
  // first paint; this just decides which (if any) overlay to layer on top.
  // Dedupes by params hash: if only `authSignedIn` flips (Clerk SDK finishing
  // hydration after we already fired with the cached JWT), re-derive UI from
  // the cached response instead of hitting the API again.
  useEffect(() => {
    if (!(appSlug && ownerHandle)) {
      return;
    }
    const token = searchParam.get("token") ?? undefined;
    const paramsKey = `${ownerHandle}|${appSlug}|${fsId ?? ""}|${token ?? ""}|${retryCount}`;

    const applyResToUI = (res: ResGetAppByFsId): void => {
      const resolvedOwnerDisplayName = res.ownerDisplayName?.trim();
      setOwnerDisplayName(resolvedOwnerDisplayName && resolvedOwnerDisplayName !== "" ? resolvedOwnerDisplayName : undefined);
      if (res.error) {
        writerGrantActiveRef.current = false;
        pendingWriterViewerRefreshRef.current = false;
        setNotFound(true);
        toast.dismiss("vibe-access");
        return;
      }
      const shot = res.meta.find(isMetaScreenShot);
      if (shot) {
        setScreenshotUrl(`/assets/cid/?url=${encodeURIComponent(shot.assetUrl)}&mime=${encodeURIComponent(shot.mime)}`);
      }
      const titleMeta = res.meta.find(isMetaTitle);
      if (titleMeta) {
        setAppTitle(titleMeta.title);
      }
      switch (res.grant) {
        case "not-found":
        case "not-grant":
          setNotFound(true);
          setCardGrant(res.grant);
          toast.dismiss("vibe-access");
          break;
        case "req-login.request":
        case "req-login.invite":
        case "pending-request":
        case "revoked-access":
          setCardGrant(res.grant);
          toast.dismiss("vibe-access");
          break;
        case "accepted-email-invite":
        case "granted-access.editor":
        case "granted-access.viewer":
        case "granted-access.submitter":
        case "public-access":
        case "owner":
          setCardGrant(res.grant);
          setMyGrant(
            res.grant === "owner"
              ? "owner"
              : res.grant === "granted-access.editor" || res.grant === "accepted-email-invite"
                ? "editor"
                : res.grant === "granted-access.viewer"
                  ? "viewer"
                  : res.grant === "granted-access.submitter"
                    ? "submitter"
                    : "public"
          );
          toast.dismiss("vibe-access");
          break;
        default:
          toast.error(`Unexpected grant: ${res.grant}`, { id: "vibe-access" });
      }

      const writerCapableGrant = isWriterCapableGrant(res.grant);
      if (writerCapableGrant) {
        if (!writerGrantActiveRef.current) {
          pendingWriterViewerRefreshRef.current = true;
        }
        if (pendingWriterViewerRefreshRef.current) {
          void flushPendingWriterViewerRefresh();
        }
      } else {
        pendingWriterViewerRefreshRef.current = false;
      }
      writerGrantActiveRef.current = writerCapableGrant;
    };

    // Auth-only flip: same params, already have a response — just re-render.
    if (lastFiredKeyRef.current === paramsKey && cachedResRef.current) {
      applyResToUI(cachedResRef.current);
      return;
    }
    if (inGetAppByFsIdRef.current) {
      return;
    }
    inGetAppByFsIdRef.current = true;
    lastFiredKeyRef.current = paramsKey;
    toast.loading("Verifying access…", { id: "vibe-access" });
    vctx.sharedApi.getAppByFsId({ fsId, appSlug, ownerHandle, token }).then((rRes) => {
      inGetAppByFsIdRef.current = false;
      if (rRes.isErr()) {
        toast.error(`getAppByFsId failed with: ${rRes.Err().message}`, { id: "vibe-access" });
        return;
      }
      const res = rRes.Ok();
      cachedResRef.current = res;
      applyResToUI(res);
    });
  }, [ownerHandle, appSlug, fsId, searchParam, retryCount, vctx.sharedApi, flushPendingWriterViewerRefresh]);

  useEffect(() => {
    if (authSignedIn !== true) return;
    const intent = readIntent(searchParam);
    if (intent === undefined) return;
    // Scrub before firing so refresh/re-render doesn't repeat the action.
    window.history.replaceState(null, "", withoutIntent(window.location.pathname + window.location.search));
    if (intent === "install") {
      fireInstall();
    } else if (intent === "join") {
      void fireJoin();
    }
    // Only re-run on auth flip; searchParam is read at effect time, and we
    // scrub the intent param before firing so subsequent renders early-return.
  }, [authSignedIn]);

  const toggleAdmin = useCallback(async () => {
    const next = !adminMode;
    if (adminStorageKey) localStorage.setItem(adminStorageKey, String(next));
    setAdminMode(next);

    await refreshViewerFromWhoAmI(next);
  }, [adminMode, adminStorageKey, refreshViewerFromWhoAmI]);

  useEffect(() => {
    if (!authSignedIn || !ownerHandle || !appSlug || !dataApi) return;
    void dataApi.subscribeViewerGrants({ appSlug, ownerHandle });
    const unsubscribe = dataApi.onViewerGrantsChanged((evt) => {
      if (evt.ownerHandle !== ownerHandle || evt.appSlug !== appSlug) return;
      void refreshViewerFromWhoAmI();
    });
    return unsubscribe;
  }, [authSignedIn, ownerHandle, appSlug, refreshViewerFromWhoAmI, dataApi]);

  // Agent-in-vibe Share view (#2680): tapping Share swaps the card body to the in-card
  // SharePanelView. Declared before useShareModal so it can drive the hook's settings
  // load (shareViewActive) without opening the legacy modal.
  const [shareViewOpen, setShareViewOpen] = useState(false);

  const shareModal = useShareModal({
    ownerHandle: ownerHandle ?? "",
    appSlug: appSlug ?? "",
    fsId,
    chatApi: vctx.chatApi,
    sharedApi: vctx.sharedApi,
    hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
    shareViewActive: shareViewOpen,
  });

  const prevShareOpenRef = useRef(shareModal.isOpen);
  useEffect(() => {
    if (prevShareOpenRef.current && !shareModal.isOpen) {
      setPendingBump((n) => n + 1);
    }
    prevShareOpenRef.current = shareModal.isOpen;
  }, [shareModal.isOpen]);

  const [shareMembers, setShareMembers] = useState<ShareMember[]>([]);
  useEffect(() => {
    if (!shareViewOpen || !authSignedIn || !ownerHandle || !appSlug) return;
    let cancelled = false;
    void vctx.sharedApi.listMembers({ ownerHandle, appSlug }).then((res) => {
      if (cancelled) return;
      // listMembers returns collaborators (not the owner); prepend the owner so the
      // roster always leads with them. Carry each member's real grant role through —
      // including "submitter" (a write-capable, read-restricted member — the form-filler
      // role), surfaced by name in the roster rather than mislabeled as a reader (Codex P2).
      const collaborators: ShareMember[] = res.isOk() ? res.Ok().members.map((m) => ({ handle: m.displayName, role: m.role })) : [];
      setShareMembers([{ handle: ownerHandle, role: "owner" }, ...collaborators]);
    });
    return () => {
      cancelled = true;
    };
  }, [shareViewOpen, authSignedIn, ownerHandle, appSlug, vctx.sharedApi]);

  const shareViewer: ShareViewer = isOwner
    ? "author"
    : myGrant === "editor" || myGrant === "viewer" || myGrant === "submitter"
      ? "member"
      : "anonymous";
  // Source the toggle's state from the persisted `publicAccess` setting once the
  // Share view has loaded it; until then fall back to the loader's world-readable
  // hint (so there's no flash — it just sharpens to the authoritative value).
  const shareAccess: ShareAccess = shareModal.settingsLoaded
    ? shareModal.publicAccessEnabled
      ? "public"
      : "request"
    : isWorldReadable
      ? "public"
      : "request";

  const vibeSlug = `${ownerHandle}/${appSlug}`;
  const cloneUrl = `/remix/${vibeSlug}?skipChat=true`;

  const showLoginOverlay = !authSignedIn && isLoaded && reqLogin;
  const loginOverlay = showLoginOverlay
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SignIn
            routing="hash"
            forceRedirectUrl={window.location.pathname + window.location.search}
            signUpForceRedirectUrl={window.location.pathname + window.location.search}
          />
        </div>,
        document.body
      )
    : null;

  function fireInstall() {
    window.location.assign(cloneUrl);
  }

  async function fireJoin() {
    if (appSlug === undefined || ownerHandle === undefined) return;
    const r = await vctx.sharedApi.requestAccess({ appSlug, ownerHandle });
    if (r.isErr()) {
      toast.error(`Request failed: ${r.Err().message}`);
      return;
    }
    toast.success("Request sent");
    setRetryCount((c) => c + 1); // re-fetch grant; flips to pending-request
  }

  function onClickInstall() {
    if (authSignedIn === true) {
      fireInstall();
      return;
    }
    const here = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", withIntent(here, "install"));
    setReqLogin(true);
  }

  function onClickJoin() {
    if (authSignedIn === true) {
      void fireJoin();
      return;
    }
    const here = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", withIntent(here, "join"));
    setReqLogin(true);
  }

  const cardVariant = computeCardVariant(cardGrant);
  const isAccessGranted = cardVariant === "iframe";
  // Desktop landing buttons get extra vertical padding so the two-line labels
  // ("FRESH \n INSTALL", "JOIN \n COLLAB") don't crowd the button edge. Mobile
  // already sizes nicely via the base width:100% / minHeight:60px rules.
  const isMobileViewport = useMobile();
  const ctaStyle =
    isMobileViewport === true
      ? undefined
      : { paddingLeft: 18, paddingRight: 18, paddingTop: 14, paddingBottom: 18, height: "auto" };
  const showCard = cardVariant === "request" || cardVariant === "invite" || cardVariant === "pending" || cardVariant === "revoked";
  const requestAccessSubtitle = ownerDisplayName ? `Ask to collab with ${ownerDisplayName}.` : "Ask to join the collaboration.";
  // Show the codegen stream in the card for the WHOLE in-flight turn (until
  // block-end settles), not just the pre-first-code "streaming" phase. Gating on
  // phase flipped the body back to chips at the first code.end while the turn was
  // still running — so the (stale) suggestion chips re-appeared mid-edit and the
  // panel resized. isGenerating keeps the stream up until the turn fully settles.
  // (vibe-tour-chips-edit; supersedes the §1b phase gate.)
  const showGenStream = generation.isGenerating;

  return (
    <>
      {/* Iframe — rendered as soon as iframeUrl is known. Hidden behind the grid
          until the grant resolves to an access state, then revealed. This lets
          the browser start fetching the iframe document from the SSR'd src
          immediately while preventing the flash on non-public apps. */}
      {iframeUrl && (
        <div
          className={cx("fixed inset-0", gridBackground)}
          style={{
            isolation: "isolate",
            transform: "translate3d(0,0,0)",
            visibility: isWorldReadable || isAccessGranted ? "visible" : "hidden",
          }}
        >
          <iframe
            src={iframeUrl}
            className="w-full h-full border-none"
            sandbox={RUNTIME_PREVIEW_IFRAME_SANDBOX}
            allow={RUNTIME_PREVIEW_IFRAME_ALLOW}
            style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
          />
          <InVibeBlurOverlay active={generation.blurPx > 0} blurPx={generation.blurPx} />
        </div>
      )}
      {isWorldReadable && cardGrant === undefined && (
        <div className="fixed inset-0 z-40" style={{ pointerEvents: "all" }} aria-hidden />
      )}
      {/* Grid overlay — shown while grant is resolving or for card/not-found states */}
      {!isAccessGranted && (
        <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
          {/* Top-left logo doubles as the sidebar toggle. Only show it on the
              persistent card / not-found screens — never during transient
              "loading" — so the logo doesn't flash top-left before reappearing
              as the bottom-right pill once access resolves. */}
          {(showCard || notFound) && (
            <div className="fixed top-4 left-4 z-50">
              <Delayed ms={1000}>
                <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
              </Delayed>
            </div>
          )}
          {showCard ? (
            <div style={{ maxWidth: 500, width: "100%", margin: "0 16px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <div
                style={{
                  height: 30,
                  width: "100%",
                  backgroundColor: "rgba(0, 154, 206, 0.4)",
                  border: "1px solid black",
                  marginBottom: 1,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.38)",
                }}
              />
              <div
                style={{
                  backgroundColor: "rgb(255, 255, 240)",
                  color: "rgb(34, 31, 32)",
                  border: "1px solid black",
                  boxShadow: "0 0 0 1px white",
                  padding: "24px 24px",
                }}
              >
                <h2 style={{ fontWeight: "bold", fontSize: 32, lineHeight: "34px" }}>{appTitle ?? appSlug}</h2>
                {screenshotUrl && (
                  <img
                    src={screenshotUrl}
                    alt={`Screenshot of ${appTitle ?? appSlug}`}
                    style={{ width: "100%", marginTop: 16, border: "1px solid black" }}
                  />
                )}
                <p
                  style={{
                    marginTop: 24,
                    fontFamily: '"Georgia", "Charter", "Iowan Old Style", serif',
                    fontStyle: "italic",
                    fontWeight: 600,
                    fontSize: 26,
                    lineHeight: 1.15,
                    textAlign: "right",
                    textShadow: "3px 3px 0 rgba(0, 154, 206, 0.55)",
                  }}
                >
                  How would you like to open {appTitle ?? appSlug}?
                </p>
                <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 200 }}>
                    <VibesButton variant={BLUE} icon="remix" onClick={onClickInstall} style={ctaStyle}>
                      Fresh Install
                    </VibesButton>
                    <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, textAlign: "center" }}>
                      Run a new copy with your own data.
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 200 }}>
                    <VibesButton
                      variant={YELLOW}
                      icon="collab"
                      onClick={onClickJoin}
                      style={
                        cardVariant === "pending" || cardVariant === "revoked"
                          ? { ...ctaStyle, opacity: 0.55, cursor: "not-allowed" }
                          : ctaStyle
                      }
                      disabled={cardVariant === "pending" || cardVariant === "revoked"}
                    >
                      {cardVariant === "invite"
                        ? "Join collab"
                        : cardVariant === "pending"
                          ? "Requested"
                          : cardVariant === "revoked"
                            ? "Revoked"
                            : "Request access"}
                    </VibesButton>
                    <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, textAlign: "center" }}>
                      {cardVariant === "invite"
                        ? "You've been granted access."
                        : cardVariant === "pending"
                          ? "The owner has your request. Let them know to approve at this URL."
                          : cardVariant === "revoked"
                            ? "Your access was revoked."
                            : requestAccessSubtitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : notFound ? (
            <div className="text-center text-lg font-semibold" style={{ color: "var(--vibes-text-primary)" }}>
              App not available
            </div>
          ) : (
            <div style={{ color: "var(--vibes-text-primary)" }}>Preparing…</div>
          )}
        </div>
      )}
      {/* Chrome (pill, share modal) — client-only, only shown when access is granted.
          createPortal references document.body, which throws under SSR. */}
      {isAccessGranted &&
        hasMounted &&
        createPortal(
          <>
            {/* Full-viewport overlay layer: the card floats above the running app
                and shows it around its edges. pointer-events-none lets clicks reach
                the app everywhere EXCEPT the card's own interactive surfaces (the
                card re-enables pointer-events on its toggle and open dialog). */}
            <div className="pointer-events-none fixed inset-0 z-50">
              <Delayed ms={1000}>
                <UnifiedVibeCard
                  appTitle={appTitle ?? appSlug ?? "Vibe"}
                  appSlug={vibeSlug}
                  appIconUrl={screenshotUrl ?? undefined}
                  isOwner={isOwner}
                  handleSlug={myUserSlug}
                  handleAvatarUrl={
                    myUserSlug ? `${handleAvatarUrl(myUserSlug)}${avatarVersion ? `?v=${avatarVersion}` : ""}` : undefined
                  }
                  handles={myHandles}
                  onSelectHandle={(slug) => void handleSelectHandle(slug)}
                  onNewHandle={(handle) => void handleNewHandle(handle)}
                  // Owner-only: making a new avatar writes to the active handle.
                  // Pass the promise through (no `void`) so ViewerTagView's
                  // `await onPickFile` holds its uploading state through the
                  // upload + consent + save, and a second pick can't supersede a
                  // still-pending confirmation (Codex P2).
                  onPickAvatar={isOwner ? handlePickAvatar : undefined}
                  handlePickerBusy={handlePickerBusy}
                  viewerMode={shareViewer === "author" ? "author" : shareViewer === "member" ? "member" : "visitor"}
                  // Only a viewer grant is read-only; submitter is write-capable
                  // (canWrite, db-acl-eval) so it gets no lock (Codex P2).
                  memberReadOnly={myGrant === "viewer"}
                  adminMode={adminMode}
                  // #2772 D1: the owner-only "Draft · unpublished" badge — set when
                  // the owner is pinned to their latest unpublished in-place draft.
                  publishState={isDraft ? "draft" : undefined}
                  // #2772 D2: the in-card Publish control — only a real, settled draft.
                  // Gate on isGenerating (turn in flight until block-end), NOT showGenStream
                  // (phase flips to "live" at the first code.end while the turn still runs),
                  // so the owner can't ship a partial generation (Charlie review).
                  onPublish={isDraft && !generation.isGenerating ? handlePublish : undefined}
                  publishing={publishing}
                  chips={cardChips}
                  onSelectChip={handleEditPrompt}
                  onSubmitOther={handleEditPrompt}
                  onHome={() => {
                    // On a PR preview, stay on the preview subdomain so the home
                    // page reflects the same (preview) session — otherwise we'd
                    // jump to prod and mask the preview's real signed-in state.
                    // Reuses the createVibe helper's PR-origin detection.
                    window.open(resolveBuilderOriginFrom(window.location.origin), "_blank");
                  }}
                  onEdit={() => setShareViewOpen(false)}
                  onShare={() => setShareViewOpen(true)}
                  // Lazy codegen open (#2761): opening the edit card is the
                  // owner's first edit intent — bring up the codegen chat now
                  // rather than eagerly on /vibe mount, so passive browsing
                  // never opens a connection. activate() is a no-op once active,
                  // and a no-op for non-owners (the hook is enabled:false).
                  onOpenChange={(cardOpen) => {
                    if (cardOpen) generation.activate();
                  }}
                  shareButtonRef={shareModal.buttonRef}
                  selectedNav={shareViewOpen ? "share" : "edit"}
                  body={
                    shareViewOpen ? (
                      <SharePanelView
                        url={shareModal.publishedUrl ?? `${window.location.origin}/vibe/${vibeSlug}`}
                        copied={shareModal.urlCopied}
                        onCopy={() => void shareModal.handleCopyUrl()}
                        viewer={shareViewer}
                        members={shareMembers}
                        access={shareAccess}
                        onChangeAccess={(next) => void shareModal.handleSetPublicAccess(next === "public")}
                        accessPending={!shareModal.settingsLoaded || shareModal.isTogglingPublicAccess}
                        onSelectMember={() => shareModal.open()}
                      />
                    ) : undefined
                  }
                  // The stream LAYERS over the chips (height reserved) rather than
                  // replacing the whole body, so the panel doesn't resize as the
                  // turn streams in. (vibe-tour-chips-edit)
                  streamBody={
                    showGenStream ? (
                      <GenerationStreamView
                        blocks={generation.blocks}
                        messages={generation.counts.messages}
                        lines={generation.counts.lines}
                      />
                    ) : undefined
                  }
                  onSignIn={
                    authSignedIn
                      ? undefined
                      : () =>
                          clerk.openSignIn({ forceRedirectUrl: window.location.href, signUpForceRedirectUrl: window.location.href })
                  }
                  isTwinkling={isNetworkActive}
                />
              </Delayed>
            </div>
            {/* Share modal keeps its prior bottom-right anchor (popover placement
                is revisited in #2680). */}
            <div className="fixed bottom-4 right-4 z-50">
              <Delayed ms={1000}>
                <ShareModal
                  modal={shareModal}
                  placement="above"
                  isOwner={isOwner}
                  myGrant={myGrant}
                  adminMode={adminMode}
                  onToggleAdmin={isOwner ? toggleAdmin : undefined}
                />
              </Delayed>
            </div>
          </>,
          document.body
        )}
      {hasMounted && (
        <Delayed ms={1000}>
          <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" dmUnreadCount={dmUnreadCount} />
        </Delayed>
      )}
      {loginOverlay}
    </>
  );
}
