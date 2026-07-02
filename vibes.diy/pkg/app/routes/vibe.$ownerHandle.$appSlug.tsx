import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
import type { ShareMember, ShareViewer, ShareAccess, HandleOption, ChipFastPathState } from "@vibes.diy/base";
import {
  isUserSettingDefaultHandle,
  resolveCachedRead,
  resolveCachedHit,
  normalizeTransform,
  cachedSuggestionKey,
  cachedSuggestionVibeLinkKey,
} from "@vibes.diy/api-types";
import { switchActiveHandle, createAndUseHandle, handleAvatarUrl } from "./handle-picker-actions.js";
import { uploadHandleAvatar } from "../lib/upload-avatar.js";
import { useYoursNowToast } from "../hooks/use-yours-now-toast.js";
import { useShareModal } from "../components/ResultPreview/useShareModal.js";
import { useIframeApiInFlight } from "../hooks/useIframeApiInFlight.js";
import { useStatusBarScrollToTop } from "../hooks/useStatusBarScrollToTop.js";
import { ShareModal } from "../components/ResultPreview/ShareModal.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLatestVibeChips } from "../hooks/useLatestVibeChips.js";
import { useInVibeGeneration } from "../hooks/useInVibeGeneration.js";
import { useChatHydration } from "../hooks/useChatHydration.js";
import { promptReducer } from "./chat/prompt-state.js";
import { VibeEditorPanel } from "../components/vibe-editor/VibeEditorPanel.js";
import { type EditorTab } from "../components/vibe-editor/editor-tab-state.js";
import { InVibeBlurOverlay } from "../components/InVibeBlurOverlay.js";
import { GenerationStreamView } from "../components/GenerationStreamView.js";
import ThemeControls from "../components/ThemeControls.js";
import ThemePickerModal from "../components/ThemePickerModal.js";
import { useIframeCurrentTokens } from "../hooks/useIframeCurrentTokens.js";
import { vibesThemes, getThemeBySlug, type VibesTheme } from "@vibes.diy/prompts";
import { toast } from "react-hot-toast";
import {
  isMetaScreenShot,
  isMetaTitle,
  LLMChatEntry,
  VERIFYING_ACCESS_TOAST,
  type ResGetAppByFsId,
  type VibesFPApiParameters,
} from "@vibes.diy/api-types";
import { computeCardVariant } from "./vibe-card-variant.js";
import { readIntent, withIntent, withoutIntent } from "./vibe-intent.js";
import { forkDestination } from "./vibe-fork.js";
import { buildPinnedIframeUrl, resolveOwnerDraft } from "./vibe-draft-pin.js";
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
  // Cached-suggestion read lane (#2801): gated on the preview env flag so prod
  // stays inert (no producer writes, no read-lane lookups) until validated.
  const cachedSuggestionsEnabled = vctx.webVars.env.VIBES_CACHED_SUGGESTIONS === "on";
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
  // The served app's fsId as resolved by getAppByFsId. The primary
  // `/vibe/:owner/:app` URL carries no route `fsId`, so this is how the editor
  // surface (Code hydration + Data tab) learns which version is on screen. (#2518)
  const [resolvedFsId, setResolvedFsId] = useState<string | undefined>(undefined);
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

  // Cached-suggestion fast paths (#2917): per-chip state driving the
  // server-authoritative shield badge and the owner-only bless/unbless control,
  // keyed by chip text. `chipFastPathTuplesRef` holds the {key,fsId,sourceFsId}
  // tuples the bless/revoke writes need (revoke must match the FULL blessed
  // tuple — Codex #2915). `fastPathBump` re-derives them after a produce/bless/
  // revoke settles.
  const [chipFastPaths, setChipFastPaths] = useState<Record<string, ChipFastPathState>>({});
  const chipFastPathTuplesRef = useRef<
    Record<
      string,
      { bless?: { key: string; fsId: string; sourceFsId: string }; revoke?: { key: string; fsId: string; sourceFsId: string } }
    >
  >({});
  const [fastPathBump, setFastPathBump] = useState(0);

  // The edit card's suggestion chips are the vibe's OWN latest suggestions — the
  // trailing `▸` options the model emitted on the last codegen turn — not a
  // hardcoded placeholder. Sourced from the `getVibeChips` projection endpoint,
  // which returns ONLY the chip strings (never the private chat body) and gates
  // on app-access visibility, so anonymous visitors and non-owners landing on a
  // public vibe now see its curated transforms too — no owner gate. (#2755)
  const editChips = useLatestVibeChips({
    sharedApi: vctx.sharedApi,
    ownerHandle,
    appSlug,
    fsId,
  });

  const generation = useInVibeGeneration({
    ownerHandle: ownerHandle ?? "",
    appSlug: appSlug ?? "",
    fsId,
    chatApi: vctx.chatApi,
    sharedApi: vctx.sharedApi,
    srvVibeSandbox: vctx.srvVibeSandbox,
    enabled: isOwner,
    // A manual Code-tab save re-pins the owner draft to the saved fsId so the
    // running app reloads to it with the URL unchanged (Phase 2, #2518). Only
    // takes effect on the unversioned owner view (effectiveFsId = fsId ??
    // draftFsId ?? …), so a versioned /vibe/:fsId is unaffected. (#2866 guardrail)
    onSavedFsId: setDraftFsId,
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
  // Last-click-wins token for the async cached-read lane. Each chip submit on a
  // system vibe bumps it; a resolveCachedRead completion only acts if its token
  // is still current — so a slow cache-MISS can't fork/navigate after a newer
  // click already resolved (network timing must not pick the result). (Codex P2)
  const cachedReadSeqRef = useRef(0);
  // Producer (#2801): set when the OWNER runs an offered chip, holding the
  // (transform, source version) to register as a cached suggestion once the turn
  // settles. Cleared on any non-offered/non-owner click so a custom prompt is
  // never cached. The settle effect (below) does the best-effort write.
  const pendingProduceRef = useRef<{ readonly transform: string; readonly sourceFsId: string } | null>(null);
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

  // First-build refetch (#2518 / #2677 from-scratch case). A brand-new vibe has no
  // `apps` row until codegen persists its first build, so getAppByFsId resolves
  // not-found and the route latches `notFound` — and nothing else ever refetches
  // (setRetryCount is otherwise only bumped by the access-request flow). Once the
  // owner's first build has streamed its first code block (phase "live"), the dev
  // row is being written, so poll the grant until it flips to owner and the live
  // app loads. Self-cancels when `notFound` clears (deps change tears down the
  // interval); a failed turn never reaches "live", so this never polls forever,
  // and a 10× cap bounds the worst case (~20s) if the write never lands.
  useEffect(() => {
    if (!(notFound && isOwner) || generation.phase !== "live") return;
    let tries = 0;
    const id = setInterval(() => {
      setRetryCount((c) => c + 1);
      if (++tries >= 10) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [notFound, isOwner, generation.phase]);

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
    // Returns a promise on the offered-chip path so the card can hold the
    // clicked chip in its "working" state until the async work settles (cache
    // lookup + navigation take visible seconds); resolves `false` at every
    // terminal to release it. Sync paths return undefined — their feedback is
    // immediate (streamBody, toast, /remix navigation).
    (text: string): Promise<boolean> | undefined => {
      const trimmed = text.trim();
      if (!trimmed || !ownerHandle || !appSlug) return;

      // The write lane (today's behavior): owner generates in place, non-owner
      // makes it yours. Extracted so the cached-read lane below can fall through
      // to it on a miss. `cacheKey` (offered chips only) enables fast-fork-from-
      // cache (#2929 item 1): the signed-in non-owner fork passes it to forkApp,
      // which — if a produced (unblessed) result exists for it on a public source
      // — seeds the fork from that chip-applied code and reports `seededFromCache`,
      // so we skip the codegen auto-fire (no prompt64) and the user lands instantly
      // on their fork with the chip already applied. Any miss forks normally (the
      // chip's codegen still runs). Custom prompts pass no cacheKey (never cached).
      // Returns a promise when the lane's work is async (the /remix hop, the
      // inline fork + navigation) so a chip click can hold its working state
      // until the hand-off actually lands (Codex P2 on #3027); undefined when
      // feedback is immediate (owner codegen → streamBody, double-tap no-op).
      const runWriteLane = (cacheKey?: string): Promise<void> | undefined => {
        // Owner: generate in place (PR-A).
        if (isOwner) {
          generation.sendPrompt(trimmed);
          return;
        }
        const prompt64 = vctx.sthis.txt.base64.encode(trimmed);
        // Logged-out non-owner: keep the existing /remix hop (it handles
        // login -> fork -> prompt). Seamless inline fork needs a signed-in user.
        if (!authSignedIn) {
          return (async () => {
            await navigate(`/remix/${ownerHandle}/${appSlug}?${new URLSearchParams({ prompt64 }).toString()}`);
          })();
        }
        // Signed-in non-owner: make-it-yours INLINE, then land on the fork's /vibe
        // page carrying the prompt. The fork must complete (and the URL must point
        // at the fork) before any codegen opens. Anchor the destination on the
        // returned ResForkApp fields, not the pre-fork route params. The in-flight
        // guard stops a rapid double-tap from minting two forks.
        if (forkingRef.current) return;
        forkingRef.current = true;
        const tid = toast.loading("Making it yours…");
        return (async () => {
          const rFork = await vctx.chatApi.forkApp({
            srcUserSlug: ownerHandle,
            srcAppSlug: appSlug,
            srcFsId: fsId,
            ...(cacheKey ? { cacheKey } : {}),
          });
          if (rFork.isErr()) {
            forkingRef.current = false; // allow a retry
            toast.error(`Couldn't make it yours: ${rFork.Err().message}`, { id: tid });
            return;
          }
          toast.dismiss(tid);
          notifyRecentVibesChanged();
          // Fast fork: the server seeded the fork from the produced (chip-applied)
          // code, so the chip is already in place — drop prompt64 so the forked page
          // does NOT re-run codegen on top of it. Otherwise carry prompt64 to
          // auto-fire the chip's generation as before.
          const seeded = rFork.Ok().seededFromCache === true;
          await navigate(forkDestination(rFork.Ok(), seeded ? null : prompt64), { replace: true });
        })();
      };

      // Only a CURATED suggestion chip is eligible for a (potentially anonymous)
      // cached read. A custom "Other" / free-text prompt can carry PII into the
      // code it generates, so its result must NEVER become a publicly-readable
      // cached page — it's always a write (login-gated, fork on a non-owner). The
      // safe set is the offered-chip allowlist: a finite, curated list of known
      // transforms of already-public code, so a chip result adds no new PII. Match
      // the click against the chips the card is showing (normalized the same way
      // the cache key is); anything not on it skips the read lane entirely.
      //
      // This client check is defense-in-depth + avoids a needless lookup on every
      // custom prompt; the AUTHORITATIVE gate is server-side — precache only
      // stages chip-derived transforms and tags them public-read-eligible, and the
      // anonymous serve path serves an unpublished staged version only when the
      // source app is public AND that tag is present. (#2801)
      const isOfferedChip = cardChips.some((c) => normalizeTransform(c) === normalizeTransform(trimmed));

      // Producer capture (#2801): when the OWNER runs an offered chip, remember
      // the (transform, source version) so the settle effect registers the cached
      // suggestion. ONLY offered chips (a custom prompt is never cached — PII),
      // and skip the owner's unpublished draft as the source — a cached read must
      // be a transform of PUBLIC source code (the server grant/reader also enforce
      // this; this is the best-effort client policy, Charlie #2890). Any other
      // click clears a stale capture. Canonicalize the served fsId ONCE here and
      // reuse it for BOTH the producer capture and the read-lane lookup (Charlie:
      // canonicalize effectiveFsId once; route `fsId` is a hint). Gated on the
      // preview flag so prod stays inert.
      const sourceFsId = fsId ?? draftFsId ?? resolvedFsId;
      pendingProduceRef.current =
        cachedSuggestionsEnabled && isOwner && isOfferedChip && sourceFsId && sourceFsId !== draftFsId
          ? { transform: trimmed, sourceFsId }
          : null;

      if (!isOfferedChip) {
        // Custom prompts come from the composer (not OptionButtons), which has
        // its own feedback — fire and forget.
        void runWriteLane();
        return;
      }

      // Cached-suggestion read lane (#2801): the read/write decision is purely
      // "has this (source, transform) already been generated?" — it has NOTHING
      // to do with who is clicking. A precomputed chip result is staged as a new
      // fsId under THIS vibe's own owner/slug (same slug + new fsId = new code,
      // data carried; §2), unpublished until the owner publishes. A cache HIT is
      // a READ: navigate to that staged version — no codegen. A miss, or any
      // lookup error, soft-fails to the write lane, where identity DOES matter
      // (owner edits in place, non-owner forks). So identity is out of the read
      // decision and stays only in the write behavior. The decision is made
      // before anything commits.
      const submitSeq = ++cachedReadSeqRef.current;
      return (async () => {
        const decision = await resolveCachedRead({
          source: { ownerHandle, appSlug, ...(sourceFsId ? { fsId: sourceFsId } : {}) },
          transform: trimmed,
          // Resolve the staged result via the anonymous getCachedSuggestion
          // projection. Gated on the preview flag (off in prod until validated);
          // when off the lookup returns null and every chip is a write — a correct
          // no-op. A miss / not-visible returns no fsId → write lane.
          lookup: async ({ key }) => {
            if (!cachedSuggestionsEnabled) return null;
            const r = await vctx.sharedApi.getCachedSuggestion({ ownerHandle, appSlug, key });
            if (r.isErr()) return null;
            const res = r.Ok();
            // A cross-slug VIBE link (#2941) → navigate to the target vibe's
            // canonical URL (no fsId). A same-slug STAY → the staged fsId under
            // this vibe. Either is a server-authoritative hit; a miss returns null.
            if (res.targetOwnerHandle && res.targetAppSlug) {
              return { ownerHandle: res.targetOwnerHandle, appSlug: res.targetAppSlug };
            }
            return res.fsId ? { ownerHandle, appSlug, fsId: res.fsId } : null;
          },
        });
        // Drop a completion a newer chip click has superseded (last-click-wins):
        // otherwise a slow cache-MISS could runWriteLane/fork after a newer click
        // already navigated to a cache-HIT, letting network timing pick the
        // result. (Codex P2)
        if (cachedReadSeqRef.current !== submitSeq) return false;
        if (decision.kind === "read") {
          // A read hit means NO codegen runs for this click, so drop the producer
          // capture set at click time — otherwise it lingers (adopt doesn't navigate
          // away) and a LATER unrelated persist (e.g. a manual code save) would settle
          // it, registering that unrelated fsId under THIS chip's cache key (Codex P2,
          // #2938). Cleared for both adopt and navigate outcomes.
          pendingProduceRef.current = null;
          // Identity-AWARE routing of a hit (#2929 item 4), layered on top of the
          // identity-FREE resolveCachedRead. The OWNER doesn't get shunted to a
          // versioned permalink (read-only editor, no Publish) — they ADOPT the
          // staged version in place as their working draft: pin it (re-pins the
          // iframe, keeps the canonical URL + slug + data namespace) and surface the
          // Draft badge + Publish, mirroring the saveCode re-pin (onSavedFsId →
          // setDraftFsId). No codegen, no fork. Scoped to the canonical (no route
          // `fsId`) view so the owner-draft resolver — which re-runs only on
          // mount/persist/publish, not on this pin — can't race it; on a versioned
          // URL we keep the plain navigate. Everyone else keeps the read-lane page-view.
          const outcome = resolveCachedHit({ hit: decision.hit, isOwner });
          if (outcome.kind === "adopt" && !fsId) {
            setDraftFsId(outcome.fsId);
            setIsDraft(true);
            toast.success("Adopted — this version is your draft now.");
            return false;
          }
          // Await the transition so the chip's working state holds until the
          // destination (a cross-slug jump or a same-slug stay) has rendered.
          await navigate(decision.href);
          return false;
        }
        // A bless-MISS for an offered chip: fall to the write lane, but hand it the
        // content-address key so a signed-in non-owner gets a FAST fork seeded from
        // the produced (unblessed) result when one exists (#2929 item 1). Same key
        // the read lane just used; gated on the preview flag so prod stays inert.
        const fastForkKey = cachedSuggestionsEnabled
          ? cachedSuggestionKey({
              source: { ownerHandle, appSlug, ...(sourceFsId ? { fsId: sourceFsId } : {}) },
              transform: trimmed,
            })
          : undefined;
        // Hold the chip's working state through the whole write hand-off — for a
        // signed-in non-owner that's the inline fork + navigation to the fork
        // (Codex P2: releasing at fork-start unlocked the chips while forkingRef
        // still swallowed re-taps, a dead window with no feedback).
        await runWriteLane(fastForkKey);
        return false;
      })();
    },
    [
      isOwner,
      authSignedIn,
      ownerHandle,
      appSlug,
      fsId,
      draftFsId,
      resolvedFsId,
      navigate,
      vctx.sthis,
      vctx.chatApi,
      vctx.sharedApi,
      generation.sendPrompt,
      cardChips,
      cachedSuggestionsEnabled,
    ]
  );

  // Producer settle (#2801): once an owner's in-place chip turn PERSISTS
  // (persistedFsRef carries the new fsId), register the cached suggestion so the
  // next visitor's identical chip click is an O(1) read. Best-effort and
  // idempotent (ensureAppSettings upserts by key) — it must NEVER block or fail
  // the owner's edit flow (Charlie #2890), so errors are swallowed. Gated on the
  // pending capture set at click time (offered chips only, public source only).
  useEffect(() => {
    const pf = generation.persistedFsRef;
    const pending = pendingProduceRef.current;
    if (!pf || !pending || !isOwner || !ownerHandle || !appSlug) return;
    // Only register for THIS vibe's own settle (persistedFsRef carries full identity).
    if (pf.ownerHandle !== ownerHandle || pf.appSlug !== appSlug) return;
    pendingProduceRef.current = null;
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: pending.sourceFsId }, transform: pending.transform });
    void vctx.sharedApi
      .ensureAppSettings({ ownerHandle, appSlug, cachedSuggestion: { key, fsId: pf.fsId, sourceFsId: pending.sourceFsId } })
      // Re-derive the chips' fast-path state so the just-produced chip surfaces its
      // owner "Feature as fast path" control without a reload.
      .then(() => setFastPathBump((n) => n + 1))
      .catch(() => undefined);
  }, [generation.persistedFsRef, isOwner, ownerHandle, appSlug, vctx.sharedApi]);

  // Two source versions key the two different jobs (#2917):
  //
  //   • `clickSourceFsId` — what a chip CLICK keys against (`resolveCachedRead` in
  //     handleEditPrompt): `fsId ?? draftFsId ?? resolvedFsId`. The SHIELD is keyed
  //     on this so it only ever appears when a click would actually hit. On an
  //     owner draft this is the draft pin, which has no bless entry → no shield AND
  //     the click misses to the write lane: the shield never makes a promise the
  //     click won't keep (Codex P2).
  //   • `cacheSourceFsId` — the production HEAD the producer keys a result against,
  //     NEVER the draft (`fsId ?? resolvedFsId`). The owner's bless/unbless CONTROL
  //     is keyed on this so it finds the produce/bless entries regardless of the
  //     draft pin — owner management, not a read promise.
  const clickSourceFsId = fsId ?? draftFsId ?? resolvedFsId;
  const cacheSourceFsId = fsId ?? resolvedFsId;

  // Derive each visible chip's fast-path state (#2917). The shield is
  // SERVER-AUTHORITATIVE: `getCachedSuggestion` returns a stay-`fsId` only when the
  // result is blessed AND its source is public AND the app is visible — we never
  // assert a shield from a client heuristic (that would be a phishing vector). For
  // the owner we additionally read the produce + bless maps so we can offer
  // "Feature" on a produced chip and "Featured" (unbless) on a blessed one, and
  // capture the exact tuples the writes need. Gated on the preview flag, so prod
  // stays a no-op. Best-effort: any lookup error just leaves a chip un-decorated.
  useEffect(() => {
    if (!cachedSuggestionsEnabled || !ownerHandle || !appSlug || (!clickSourceFsId && !cacheSourceFsId) || cardChips.length === 0) {
      setChipFastPaths({});
      chipFastPathTuplesRef.current = {};
      return;
    }
    let cancelled = false;
    void (async () => {
      // Owner-only: the produce map gives the bless tuple, the bless map the revoke
      // tuple. Non-owners read neither and get no controls (only the shield).
      let produceMap: Record<string, { fsId: string; sourceFsId: string }> = {};
      // The bless map now holds same-slug stays ({fsId, sourceFsId}) AND cross-slug
      // vibe links (targetAppSlug, no fsId — #2941). The in-vibe bless/unbless
      // controls stay same-slug-only (a cross-slug link is curated via setup, not
      // the chip UI), so we only treat fsId-bearing entries as blessable here.
      let blessMap: Record<string, { fsId?: string; sourceFsId?: string; targetAppSlug?: string }> = {};
      if (isOwner) {
        const rSet = await vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug });
        if (rSet.isOk()) {
          produceMap = rSet.Ok().settings.entry.cachedSuggestions ?? {};
          blessMap = rSet.Ok().settings.entry.cachedSuggestionBlesses ?? {};
        }
      }
      const states: Record<string, ChipFastPathState> = {};
      const tuples: typeof chipFastPathTuplesRef.current = {};
      await Promise.all(
        cardChips.map(async (chip) => {
          // Server-authoritative affordance: ask getCachedSuggestion on the CLICK
          // key, so badge and click lane agree. A stay-`fsId` → shield ("stays
          // here"); a `targetAppSlug` → the `→` jump glyph ("opens another app",
          // #2941). Both come from the server; the client never asserts either.
          let shielded = false;
          let jump = false;
          // SHIELD (same-slug stay) — keyed on the EXACT source version
          // (clickSourceFsId), so it only ever appears when a click would hit.
          if (clickSourceFsId) {
            const shieldKey = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: clickSourceFsId }, transform: chip });
            try {
              const r = await vctx.sharedApi.getCachedSuggestion({ ownerHandle, appSlug, key: shieldKey });
              if (r.isOk()) shielded = Boolean(r.Ok().fsId);
            } catch {
              // Soft-fail: leave the chip un-shielded (it falls to the write lane on click).
            }
          }
          // JUMP (curated cross-slug link) — keyed on the SLUG alone (#2941), NOT
          // the source fsId, so the glyph survives a source-vibe update without a
          // re-bless (matches the durable link key the click lane resolves).
          //
          // Gated on NO stay hit, mirroring resolveCachedRead's stay-first priority:
          // the click lane tries the version-pinned stay key first and returns that
          // hit before consulting the link, and UnifiedVibeCard lets the → jump badge
          // win over the 🛡 shield — so if we set `jump` while a stay also hit, the
          // badge would promise a jump the click won't keep (Codex #2969). Stays and
          // curated links don't coexist by construction, but keep badge + click in
          // lockstep (and skip the extra lookup when a stay already won).
          if (!shielded) {
            const linkKey = cachedSuggestionVibeLinkKey({ ownerHandle, appSlug, transform: chip });
            try {
              const r = await vctx.sharedApi.getCachedSuggestion({ ownerHandle, appSlug, key: linkKey });
              if (r.isOk()) jump = Boolean(r.Ok().targetAppSlug);
            } catch {
              // Soft-fail: leave the chip without a jump glyph (the click lane still resolves it).
            }
          }
          // Control key = the production-HEAD key the produce/bless entries live under.
          const prodKey = cacheSourceFsId
            ? cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: cacheSourceFsId }, transform: chip })
            : undefined;
          const produced = prodKey ? produceMap[prodKey] : undefined;
          // Same-slug-only: a cross-slug bless (no fsId) is not blessable/revocable
          // via the chip UI, so ignore it for the controls.
          const blessedRec = prodKey ? blessMap[prodKey] : undefined;
          const blessed = blessedRec && blessedRec.fsId && blessedRec.sourceFsId ? blessedRec : undefined;
          states[chip] = {
            shielded,
            jump,
            // Bless/unbless availability comes from the bless MAP, not the shield —
            // so a latent bless (blessed but app currently private → no shield) stays
            // revocable instead of flipping back to "Feature" (Codex P2).
            canBless: isOwner && Boolean(produced) && !blessed,
            canUnbless: isOwner && Boolean(blessed),
          };
          tuples[chip] = {
            ...(produced && prodKey ? { bless: { key: prodKey, fsId: produced.fsId, sourceFsId: produced.sourceFsId } } : {}),
            // Revoke matches the FULL blessed tuple; fall back to the produce tuple
            // if the bless map is momentarily absent.
            ...(blessed && blessed.fsId && blessed.sourceFsId && prodKey
              ? { revoke: { key: prodKey, fsId: blessed.fsId, sourceFsId: blessed.sourceFsId } }
              : produced && prodKey
                ? { revoke: { key: prodKey, fsId: produced.fsId, sourceFsId: produced.sourceFsId } }
                : {}),
          };
        })
      );
      if (cancelled) return;
      setChipFastPaths(states);
      chipFastPathTuplesRef.current = tuples;
    })();
    return () => {
      cancelled = true;
    };
  }, [
    cachedSuggestionsEnabled,
    isOwner,
    ownerHandle,
    appSlug,
    clickSourceFsId,
    cacheSourceFsId,
    cardChips,
    vctx.sharedApi,
    fastPathBump,
  ]);

  // Owner blesses a produced chip → it becomes a fast-path "stay" (the shield
  // appears). Best-effort, owner-gated server-side; re-derives the fast-path state
  // on success. (#2917)
  const handleBlessChip = useCallback(
    (chip: string) => {
      if (!isOwner || !ownerHandle || !appSlug) return;
      const tuple = chipFastPathTuplesRef.current[chip]?.bless;
      if (!tuple) return;
      const tid = toast.loading("Featuring as fast path…");
      void (async () => {
        const r = await vctx.sharedApi.ensureAppSettings({
          ownerHandle,
          appSlug,
          cachedSuggestionBless: { ...tuple, op: "bless" },
        });
        const err = r.isErr() ? r.Err().message : r.Ok().error;
        if (err) {
          toast.error(`Couldn't feature it: ${err}`, { id: tid });
          return;
        }
        toast.success("Featured — visitors stay here now.", { id: tid });
        setFastPathBump((n) => n + 1);
      })();
    },
    [isOwner, ownerHandle, appSlug, vctx.sharedApi]
  );

  // Owner unblesses a chip → its shield disappears and visitor clicks fork again
  // (fail-to-fork). Revoke carries the FULL blessed tuple. (#2917)
  const handleUnblessChip = useCallback(
    (chip: string) => {
      if (!isOwner || !ownerHandle || !appSlug) return;
      const tuple = chipFastPathTuplesRef.current[chip]?.revoke;
      if (!tuple) return;
      const tid = toast.loading("Removing fast path…");
      void (async () => {
        const r = await vctx.sharedApi.ensureAppSettings({
          ownerHandle,
          appSlug,
          cachedSuggestionBless: { ...tuple, op: "revoke" },
        });
        const err = r.isErr() ? r.Err().message : r.Ok().error;
        if (err) {
          toast.error(`Couldn't remove it: ${err}`, { id: tid });
          return;
        }
        toast.success("Fast path removed — clicks fork again.", { id: tid });
        setFastPathBump((n) => n + 1);
      })();
    },
    [isOwner, ownerHandle, appSlug, vctx.sharedApi]
  );

  // #2772 D2: publish the owner's current draft. Mints a new top-of-stack production
  // server-side (no demote); on success bump the draft resolver so the badge + banner
  // clear and the iframe re-pins to the now-published production.
  //
  // Publish the EXACT pinned draft (`draftFsId`), not "latest dev": the Publish
  // control only shows on the unversioned owner-draft view, where `draftFsId` is the
  // version on screen. The no-`fsId` publishApp path resolves selectLatestDraftOrPublished,
  // which can differ from the pinned version once adopt-in-place (#2929 item 4) pins an
  // OLDER cached result as the draft — so clicking Publish would release a different
  // version than the iframe shows (Codex P1, #2938). Passing the pinned fsId makes
  // Publish ship exactly what's displayed; in the normal edit flow `draftFsId` already
  // IS the latest dev row, so this is byte-equivalent there.
  const handlePublish = useCallback(() => {
    if (!isOwner || !ownerHandle || !appSlug || publishing) return;
    setPublishing(true);
    const tid = toast.loading("Publishing…");
    void (async () => {
      const rPub = await vctx.chatApi.publishApp({ ownerHandle, appSlug, ...(draftFsId ? { fsId: draftFsId } : {}) });
      setPublishing(false);
      if (rPub.isErr()) {
        toast.error(`Couldn't publish: ${rPub.Err().message}`, { id: tid });
        return;
      }
      toast.success("Published — everyone sees it now.", { id: tid });
      notifyRecentVibesChanged();
      setPublishBump((n) => n + 1);
    })();
  }, [isOwner, ownerHandle, appSlug, publishing, draftFsId, vctx.chatApi]);

  // Edit-card Stop button: cancel the in-flight in-place edit as if it never
  // started (the hook reverts the preview, settles the turn, and re-arms the
  // codegen socket). Also drop any pending producer capture so an aborted chip
  // turn never registers a cached suggestion on a later unrelated persist.
  const handleStopGeneration = useCallback(() => {
    pendingProduceRef.current = null;
    generation.stop();
  }, [generation.stop]);

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
  //
  // The resolver also re-runs after an in-place edit PERSISTS — `generation.persistedFsRef`
  // (the fsRef of the canonical post-persist `block.end`) is in the deps, so a settled
  // edit re-triggers it. On that path the iframe is already showing the new draft (the
  // generation hot-swapped its source in place), and `resolveOwnerDraft` detects this by
  // comparing the resolved draft against the hot-swapped fsRef — by FULL vibe identity
  // (ownerHandle/appSlug/fsId), since a fork shares its source's fsId. When they match it
  // skips the re-pin so a `draftFsId` change doesn't reload identical code. The comparison
  // is timing-independent, so cross-vibe navigation can't synthesize a skipped pin (Charlie
  // review #2839) — even between a fork and its source. Mount and publish both pin.
  useEffect(() => {
    if (!isOwner || fsId || !ownerHandle || !appSlug) {
      setIsDraft(false);
      setDraftFsId(undefined);
      return;
    }
    let cancelled = false;
    void vctx.sharedApi.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" }).then((rRes) => {
      if (cancelled || rRes.isErr()) return;
      const {
        isDraft: nextIsDraft,
        pinFsId,
        repin,
      } = resolveOwnerDraft(rRes.Ok(), generation.persistedFsRef, {
        ownerHandle,
        appSlug,
      });
      setIsDraft(nextIsDraft);
      // Skip the re-pin only when the iframe already shows this exact draft (same vibe +
      // fsId) via the in-place hot-swap — otherwise a `draftFsId` change forces a reload.
      if (repin) setDraftFsId(pinFsId);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, fsId, ownerHandle, appSlug, publishBump, generation.persistedFsRef, vctx.sharedApi]);

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

  // Relay the iOS status-bar tap (scroll-to-top) into the cross-origin vibe
  // iframe — the native gesture never reaches a subframe. iOS-only, invisible
  // sentinel; see the hook for the mechanism.
  useStatusBarScrollToTop(srvVibeSandbox);

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
      // Capture the served fsId so the editor surface can hydrate without a
      // route `fsId` (the primary /vibe URL is unversioned). (#2518)
      if (res.fsId) setResolvedFsId(res.fsId);
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
    toast.loading(`${VERIFYING_ACCESS_TOAST}…`, { id: "vibe-access" });
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

  // In-page tabbed editor surface (#2518 Phase 1). `editorTab` is null when the
  // surface is closed (the card shows chips/Other or the Share view); a tab value
  // opens VibeEditorPanel in the card body.
  const [editorTab, setEditorTab] = useState<EditorTab | null>(null);

  // PromptState for the editor panel. The view-first panel reads the Code tab off
  // `hydratedFileSystem` (resolveCodeView) and the Chat tab off `blocks`. We own a
  // local reducer here and feed it via useChatHydration — the SAME persisted-chat
  // source the chat route hydrates — so an already-built vibe shows its source in
  // the Code tab without a live codegen session. (Chat-history replay is not wired
  // in Phase 1: an existing vibe with no in-session generation shows an empty Chat
  // tab; the Code tab is the populated read-only surface.)
  const [editorPromptState, editorDispatch] = useReducer(promptReducer, undefined, () => ({
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug ?? "",
    blocks: [],
    searchParams: searchParam,
    setSearchParams: setSearchParam,
    agentSavedBlockIds: new Set<string>(),
    connection: "live" as const,
  }));
  // Effective fsId the viewer is actually seeing: an explicit versioned URL wins,
  // else the owner's pinned draft, else the served app resolved by getAppByFsId.
  // Feeds the editor's Code hydration + Data tab so they work on the unversioned
  // `/vibe/:owner/:app` URL (Codex review). (#2518)
  const effectiveFsId = fsId ?? draftFsId ?? resolvedFsId;
  useChatHydration({
    ownerHandle: ownerHandle ?? "",
    appSlug: appSlug ?? "",
    fsId: effectiveFsId,
    sharedApi: vctx.sharedApi,
    dispatch: editorDispatch,
  });

  // ── Theme + palette changer (moved here from the Settings tab) ──────────────
  // The structural theme picker (ThemePickerModal) + the live palette/token
  // editor (ColorsetPicker) now live in the Edit card composer, mirroring the
  // legacy /chat surface. Owner-only: changing the structural theme fires an
  // in-place codegen turn, and persisting theme/palette settings is an owner op.
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<VibesTheme | null>(null);
  const [colorThemeSlug, setColorThemeSlug] = useState<string | null>(null);
  // Tokens the running app declares on `:root` (streamed from the sandbox), so
  // the palette picker can edit + remap every custom property the app has.
  const iframeCurrentTokens = useIframeCurrentTokens();

  // Hydrate the selected structural theme + palette from app_settings so the
  // composer's Theme button + palette swatch reflect the persisted choice.
  useEffect(() => {
    if (!isOwner || !ownerHandle || !appSlug) {
      setSelectedTheme(null);
      setColorThemeSlug(null);
      return;
    }
    let cancelled = false;
    void vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug }).then((res) => {
      if (cancelled || res.isErr()) return;
      const s = res.Ok().settings.entry.settings;
      setSelectedTheme(s.theme ? (getThemeBySlug(s.theme) ?? null) : null);
      setColorThemeSlug(s.colorTheme ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, ownerHandle, appSlug, vctx.sharedApi]);

  // Structural theme select: persist the catalog slug, then fire an in-place
  // restyle turn so the app re-generates against it. Imported (custom) .md
  // themes apply session-only — they're not in the catalog, so the backend
  // would drop them on validation. Mirrors the /chat handleThemeSelect flow,
  // but submits via the in-vibe generation hook instead of a textarea ref.
  const handleThemeSelect = useCallback(
    (theme: VibesTheme) => {
      setSelectedTheme(theme);
      setThemeModalOpen(false);
      if (!ownerHandle || !appSlug) return;
      const isCatalog = !!getThemeBySlug(theme.slug);
      if (!isCatalog) return;
      // Wait for the theme to land in app_settings before kicking off the
      // restyle turn — the server builds the prompt from the active theme.
      void vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug, theme: theme.slug }).then((res) => {
        if (res.isErr()) return;
        generation.sendPrompt("Please update the theme");
      });
    },
    [vctx.sharedApi, ownerHandle, appSlug, generation.sendPrompt]
  );

  // Persist a palette choice (slug only) so future codegen turns and reloads
  // honor it. Live recolor is the separate handleApplyLivePalette push.
  const handlePaletteSelect = useCallback(
    (slug: string) => {
      setColorThemeSlug(slug);
      if (ownerHandle && appSlug) void vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: slug });
    },
    [vctx.sharedApi, ownerHandle, appSlug]
  );

  // Live-only push: postMessage the composed CSS variable overrides into the
  // running iframe (palette swatch + per-token edits). Session-only — a reload
  // shows the palette's pristine values until a regenerate bakes them in.
  const handleApplyLivePalette = useCallback(
    (colors: Record<string, string>, colorsDark?: Record<string, string>) => {
      if (!vctx.srvVibeSandbox) return;
      vctx.srvVibeSandbox.pushColorOverride({
        type: "vibe.evt.color-override",
        colors,
        ...(colorsDark ? { colorsDark } : {}),
      });
    },
    [vctx.srvVibeSandbox]
  );

  // Reset reverts the override: empty `colors` clears the injected <style>, and
  // colorTheme:null drops the active.colorTheme so codegen falls back to the
  // structural theme's default palette.
  const handlePaletteReset = useCallback(() => {
    setColorThemeSlug(null);
    if (vctx.srvVibeSandbox) {
      vctx.srvVibeSandbox.pushColorOverride({ type: "vibe.evt.color-override", colors: {} });
    }
    if (ownerHandle && appSlug) void vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: null });
  }, [vctx.srvVibeSandbox, vctx.sharedApi, ownerHandle, appSlug]);

  // Regenerate-with-palette: persist the slug, then fire a turn that bakes the
  // literal :root block into the app code. Mirrors the /chat regenerate flow.
  const handlePaletteRegenerate = useCallback(
    (paletteSlug: string, paletteName: string, rootCssBlock: string) => {
      setColorThemeSlug(paletteSlug);
      if (!ownerHandle || !appSlug) return;
      const prompt = `Update the styles to use the "${paletteName}" palette.

Copy this \`<style>\` block VERBATIM into the app (replace any existing :root block). Do not change hex values, do not round, do not invent a dark-mode block if none is shown below. Reference every variable via \`bg-[var(--token)]\` / \`text-[var(--token)]\` / \`border-[var(--token)]\` — no inline hex literals.

\`\`\`html
<style>
${rootCssBlock}
</style>
\`\`\``;
      void vctx.sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: paletteSlug }).then((res) => {
        if (res.isErr()) return;
        generation.sendPrompt(prompt);
      });
    },
    [vctx.sharedApi, ownerHandle, appSlug, generation.sendPrompt]
  );

  // The composer control cluster, owner-only. Non-owners can't persist settings
  // or generate in place (their edits fork), so the theme changer stays hidden
  // for them — they get the chips/Other affordances only.
  const composerControls =
    isOwner && ownerHandle && appSlug ? (
      <ThemeControls
        selectedTheme={selectedTheme}
        onThemeButtonClick={() => setThemeModalOpen(true)}
        paletteOptions={vibesThemes}
        selectedPaletteSlug={colorThemeSlug ?? selectedTheme?.slug ?? undefined}
        onSelectPalette={handlePaletteSelect}
        onApplyLivePalette={handleApplyLivePalette}
        onResetPalette={handlePaletteReset}
        onRegeneratePalette={handlePaletteRegenerate}
        paletteStorageKey={`vibes-overrides:${ownerHandle}/${appSlug}`}
        paletteCurrentTokens={iframeCurrentTokens}
      />
    ) : undefined;

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
  // A world-readable vibe renders the live app full-screen in the (fixed) iframe.
  // The landing-card overlay below is in normal flow, so it paints BEHIND that
  // iframe — the cream card backing is lost and the CTAs float unreadably over
  // the running app (the logged-out non-public landing). For the persistent
  // landing states (access card / not-found) lift the overlay above the iframe
  // and dim the app behind a scrim so the card reads. The transient loading
  // state and non-readable vibes keep the existing in-flow grid background.
  const liftCardOverApp = isWorldReadable && (showCard || notFound);
  const requestAccessSubtitle = ownerDisplayName ? `Ask to collab with ${ownerDisplayName}.` : "Ask to join the collaboration.";
  // Show the codegen stream in the card for the WHOLE in-flight turn (until
  // block-end settles), not just the pre-first-code "streaming" phase. Gating on
  // phase flipped the body back to chips at the first code.end while the turn was
  // still running — so the (stale) suggestion chips re-appeared mid-edit and the
  // panel resized. isGenerating keeps the stream up until the turn fully settles.
  // (vibe-tour-chips-edit; supersedes the §1b phase gate.)
  const showGenStream = generation.isGenerating;

  // A just-created vibe resolves not-found (no `apps` row until the first build
  // persists). That isn't "App not available" — it's a first-build construction
  // state. Detect it from the build INTENT (carried ?prompt64) or an in-flight
  // generation, NOT from isOwner: isOwner resolves a beat after not-found latches
  // (handle bindings round-trip), and gating on it flashed "App not available"
  // during that window. Owner-gating still lives where it matters — the generation
  // hook (enabled: isOwner) and the refetch effect — so a true non-owner never
  // generates; they just see "Preparing…" instead of the not-available text in the
  // (contrived) stray-?prompt64 case. `prompt64` covers the pre-auto-fire window;
  // `isGenerating` covers the rest — no flicker between the two.
  const pendingFirstBuild = notFound && (searchParam.get("prompt64") !== null || generation.isGenerating);

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
      {/* Grid overlay — shown while grant is resolving or for card/not-found states.
          When the vibe is world-readable the live app is already painting in the
          fixed iframe, so lift this layer above it (fixed + z-index) and swap the
          opaque grid for a dim, blurred scrim — otherwise the card paints behind
          the running app and the CTAs read as floating, backing-less buttons.
          zIndex 5 keeps the lifted layer ABOVE the iframe (z-auto) but BELOW the
          SessionSidebar (fixed z-10) so the top-left logo can still open a usable
          sidebar over the landing card in these states (Codex P2). */}
      {!isAccessGranted && (
        <div
          className={cx("flex h-screen w-screen items-center justify-center", liftCardOverApp ? "fixed inset-0" : gridBackground)}
          style={
            liftCardOverApp
              ? { zIndex: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }
              : undefined
          }
        >
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
          ) : pendingFirstBuild ? (
            generation.isGenerating || generation.blocks.length > 0 ? (
              <div style={{ maxWidth: 500, width: "100%", margin: "0 16px" }}>
                <GenerationStreamView
                  blocks={generation.blocks}
                  messages={generation.counts.messages}
                  lines={generation.counts.lines}
                />
              </div>
            ) : (
              <div style={{ color: "var(--vibes-text-primary)" }}>Preparing…</div>
            )
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
                  // Log out from the handle picker's bottom row. Unlike the
                  // SessionSidebar / Settings logout (plain sign-out → Clerk's
                  // default "/" redirect), stay on THIS vibe: you signed out of
                  // an app you were looking at, so keep looking at it — as a
                  // visitor now (a private vibe just shows its login overlay).
                  // Full-URL reload via redirectUrl also resets all the
                  // ownership-gated route state cleanly.
                  onLogout={authSignedIn ? () => void clerk.signOut({ redirectUrl: window.location.href }) : undefined}
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
                  // While a change generates, the composer's submit button becomes
                  // a Stop button (the input stays editable so the next change can
                  // be queued up meanwhile).
                  generating={generation.isGenerating}
                  onStop={handleStopGeneration}
                  // Theme + palette changer above the composer (owner-only),
                  // moved here from the Settings tab.
                  composerControls={composerControls}
                  // Cached-suggestion fast paths (#2917): the server-authoritative
                  // shield badge for everyone + the owner-only bless/unbless control.
                  chipFastPaths={chipFastPaths}
                  onBlessChip={isOwner ? handleBlessChip : undefined}
                  onUnblessChip={isOwner ? handleUnblessChip : undefined}
                  onHome={() => {
                    // On a PR preview, stay on the preview subdomain so the home
                    // page reflects the same (preview) session — otherwise we'd
                    // jump to prod and mask the preview's real signed-in state.
                    // Reuses the createVibe helper's PR-origin detection.
                    window.open(resolveBuilderOriginFrom(window.location.origin), "_blank");
                  }}
                  onEdit={() => {
                    setEditorTab(null);
                    setShareViewOpen(false);
                  }}
                  onShare={() => {
                    setEditorTab(null);
                    setShareViewOpen(true);
                  }}
                  // #2518 Phase 1: open the in-page tabbed editor surface. Clears
                  // the Share view; defaults to the Code tab on first open.
                  editorActive={editorTab !== null}
                  onOpenEditor={() => {
                    setShareViewOpen(false);
                    setEditorTab((t) => t ?? "code");
                  }}
                  // Lazy codegen open (#2761): opening the edit card is the
                  // owner's first edit intent — bring up the codegen chat now
                  // rather than eagerly on /vibe mount, so passive browsing
                  // never opens a connection. activate() is a no-op once active,
                  // and a no-op for non-owners (the hook is enabled:false).
                  onOpenChange={(cardOpen) => {
                    if (cardOpen) generation.activate();
                  }}
                  shareButtonRef={shareModal.buttonRef}
                  selectedNav={editorTab ?? (shareViewOpen ? "share" : "edit")}
                  body={
                    editorTab ? (
                      <VibeEditorPanel
                        tab={editorTab}
                        onTab={setEditorTab}
                        ownerHandle={ownerHandle ?? ""}
                        appSlug={appSlug ?? ""}
                        fsId={effectiveFsId}
                        promptState={editorPromptState}
                        onActivateChat={() => generation.activate()}
                        canEdit={isOwner && !fsId}
                        saveCode={generation.saveCode}
                        saveState={generation.saveState}
                        isSaving={generation.isSaving}
                      />
                    ) : shareViewOpen ? (
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
      {/* Structural-theme picker for the Edit card composer's Theme button.
          Owner-only — the trigger lives in `composerControls`, gated the same way. */}
      {isOwner && (
        <ThemePickerModal
          open={themeModalOpen}
          onClose={() => setThemeModalOpen(false)}
          onSelect={handleThemeSelect}
          selectedSlug={selectedTheme?.slug}
          themes={vibesThemes}
        />
      )}
      {loginOverlay}
    </>
  );
}
