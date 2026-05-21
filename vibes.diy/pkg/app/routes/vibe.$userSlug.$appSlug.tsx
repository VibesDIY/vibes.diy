import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMatches, useParams, useSearchParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth } from "@clerk/react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { Delayed } from "../components/Delayed.js";
import { VibesSwitch, VibesButton, BLUE, YELLOW, ExpandedVibesPill, gridBackground, cx, useMobile } from "@vibes.diy/base";
import { AllowFireproofSharing } from "../components/AllowFireproofSharing.js";
import { useShareModal } from "../components/ResultPreview/useShareModal.js";
import { useIframeApiInFlight } from "../hooks/useIframeApiInFlight.js";
import { ShareModal } from "../components/ResultPreview/ShareModal.js";
import { useShareableDB } from "../hooks/useShareableDB.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { toast } from "react-hot-toast";
import { isMetaScreenShot, isMetaTitle, type ResGetAppByFsId, type VibesFPApiParameters } from "@vibes.diy/api-types";
import { computeCardVariant } from "./vibe-card-variant.js";
import { readIntent, withIntent, withoutIntent } from "./vibe-intent.js";

// Server-render the iframe URL so the <iframe src=...> ships in the very
// first byte of HTML. Without this, the browser can't start fetching the
// iframe document until React has hydrated and a useEffect has run — adding
// hundreds of ms to perceived load time on viewer pages.
export async function loader(loaderCtx: {
  params: Record<string, string | undefined>;
  request: Request;
  context: { vibeDiyAppParams: VibesFPApiParameters };
}): Promise<{ iframeUrl: string | undefined }> {
  const { userSlug, appSlug, fsId } = loaderCtx.params;
  if (!userSlug || !appSlug) {
    return { iframeUrl: undefined };
  }
  const reqUrl = URI.from(loaderCtx.request.url);
  const protocol = reqUrl.protocol === "https:" ? "https" : "http";
  const port = reqUrl.port && reqUrl.port !== "80" && reqUrl.port !== "443" ? reqUrl.port : undefined;
  const params = loaderCtx.context.vibeDiyAppParams;
  const baseUrl = calcEntryPointUrl({
    hostnameBase: params.vibes.svc.hostnameBase,
    protocol,
    bindings: { appSlug, userSlug, ...(fsId ? { fsId } : {}) },
    port,
  });
  const iframeUrl = BuildURI.from(baseUrl).setParam("npmUrl", params.pkgRepos.workspace).toString();
  return { iframeUrl };
}

export function meta({ params, matches }: { params: Record<string, string>; matches: { data: unknown }[] }) {
  const { userSlug, appSlug } = params;
  const rootData = matches[0]?.data as { env?: { VIBES_SVC_HOSTNAME_BASE?: string } } | undefined;
  const hostnameBase = rootData?.env?.VIBES_SVC_HOSTNAME_BASE?.replace(/^\./, "") ?? "vibes.diy";
  const imageUrl = `https://${appSlug}--${userSlug}.${hostnameBase}/screenshot.jpg`;
  const faviconUrl = `https://${appSlug}--${userSlug}.${hostnameBase}/favicon.svg`;
  const title = appSlug ?? "Vibe";

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
    { tagName: "link", rel: "icon", type: "image/svg+xml", href: faviconUrl },
  ];
}

export default function VibeIframeWrapper() {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  useDocumentTitle(`${userSlug} - ${appSlug} - vibes.diy`);
  // const [searchParam] = useSearchParams();
  const vctx = useVibesDiy();
  // Iframe URL: prefer the SSR-computed value from the loader so the
  // <iframe src=...> ships in the first byte of HTML and the browser can
  // start fetching the iframe document without waiting for React hydration.
  // Fall back to client-side computation when the loader didn't run — e.g.
  // the SSR regression test (MemoryRouter with no data router) and any
  // future client-only mount paths. Use useMatches instead of useLoaderData
  // so this works in non-data routers (the test) without throwing. Render
  // must remain SSR-safe: no synchronous window access.
  const matches = useMatches();
  const loaderData = matches[matches.length - 1]?.data as { iframeUrl?: string } | undefined;
  const [iframeUrl, setIframeUrl] = useState<string | undefined>(loaderData?.iframeUrl);
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
    if (ssrIframeUrl) return;
    if (!appSlug || !userSlug) {
      setIframeUrl(undefined);
      return;
    }
    const myUrl = URI.from(window.location.href);
    const port = myUrl.port && myUrl.port !== "80" && myUrl.port !== "443" ? myUrl.port : undefined;
    const baseUrl = calcEntryPointUrl({
      hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
      protocol: myUrl.protocol === "https:" ? "https" : "http",
      bindings: { appSlug, userSlug, ...(fsId ? { fsId } : {}) },
      port,
    });
    setIframeUrl(BuildURI.from(baseUrl).setParam("npmUrl", vctx.webVars.pkgRepos.workspace).toString());
  }, [ssrIframeUrl, appSlug, userSlug, fsId, vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE, vctx.webVars.pkgRepos.workspace]);
  const [notFound, setNotFound] = useState(false);
  const [reqLogin, setReqLogin] = useState(false);
  const [cardGrant, setCardGrant] = useState<ResGetAppByFsId["grant"] | undefined>(undefined);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState<string | null>(null);
  const { isSignedIn: authSignedIn, isLoaded } = useAuth();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const [searchParam] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  // The viewer's grant on this vibe — used to decide whether the comments
  // composer is enabled when the owner has flipped "Only collaborators can
  // comment" on. Owner + editor stay enabled; viewer/submitter/public/none
  // get the disabled hint.
  const [myGrant, setMyGrant] = useState<"owner" | "editor" | "viewer" | "submitter" | "public" | "none">("none");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBump, setPendingBump] = useState(0);

  const inGetAppByFsIdRef = useRef(false);
  // Dedupe key + cached response: when only `authSignedIn` flips post-Clerk-hydration,
  // we re-derive UI from the cached response instead of re-firing the API call.
  // Without this, every viewer load fires getAppByFsId twice — once optimistically with
  // the cached JWT (~73 ms cold), once after Clerk's useAuth/useSession finalize.
  const lastFiredKeyRef = useRef<string>("");
  const cachedResRef = useRef<ResGetAppByFsId | undefined>(undefined);

  useEffect(() => {
    if (!authSignedIn || !userSlug) {
      setIsOwner(false);
      return;
    }
    vctx.vibeDiyApi.listUserSlugBindings({}).then((res) => {
      if (res.isErr()) return;
      setIsOwner(res.Ok().items.some((item) => item.userSlug === userSlug));
    });
  }, [authSignedIn, userSlug, vctx.vibeDiyApi]);

  useEffect(() => {
    if (!isOwner || !userSlug || !appSlug) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    vctx.vibeDiyApi.listRequestGrants({ appSlug, userSlug, pager: { limit: 100 } }).then((res) => {
      if (cancelled || res.isErr()) return;
      setPendingCount(res.Ok().items.filter((r) => r.state === "pending").length);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, userSlug, appSlug, vctx.vibeDiyApi, pendingBump]);

  useEffect(() => {
    if (!isOwner || !userSlug || !appSlug) {
      return;
    }
    void vctx.vibeDiyApi.subscribeRequestGrants({ appSlug, userSlug });
    const unsubscribe = vctx.vibeDiyApi.onRequestGrant((evt) => {
      if (evt.grant.userSlug === userSlug && evt.grant.appSlug === appSlug) {
        setPendingBump((n) => n + 1);
      }
    });
    return unsubscribe;
  }, [isOwner, userSlug, appSlug, vctx.vibeDiyApi]);

  useEffect(() => {
    if (authSignedIn) {
      setIsSidebarVisible(false);
    }
  }, [authSignedIn]);

  // Resolve grant + chrome data async. The iframe is already mounted from
  // first paint; this just decides which (if any) overlay to layer on top.
  // Dedupes by params hash: if only `authSignedIn` flips (Clerk SDK finishing
  // hydration after we already fired with the cached JWT), re-derive UI from
  // the cached response instead of hitting the API again.
  useEffect(() => {
    if (!(appSlug && userSlug)) {
      return;
    }
    const token = searchParam.get("token") ?? undefined;
    const paramsKey = `${userSlug}|${appSlug}|${fsId ?? ""}|${token ?? ""}|${retryCount}`;

    const applyResToUI = (res: ResGetAppByFsId): void => {
      if (res.error) {
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
        case "req-login.auto-join":
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
    vctx.vibeDiyApi.getAppByFsId({ fsId, appSlug, userSlug, token }).then((rRes) => {
      inGetAppByFsIdRef.current = false;
      if (rRes.isErr()) {
        toast.error(`getAppByFsId failed with: ${rRes.Err().message}`, { id: "vibe-access" });
        return;
      }
      const res = rRes.Ok();
      cachedResRef.current = res;
      applyResToUI(res);
    });
  }, [userSlug, appSlug, fsId, searchParam, retryCount, vctx.vibeDiyApi]);

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

  const { sharingState, dbRef, onResult, onDismiss, onLoginRedirect } = useShareableDB();

  const shareModal = useShareModal({
    userSlug: userSlug ?? "",
    appSlug: appSlug ?? "",
    fsId,
    vibeDiyApi: vctx.vibeDiyApi,
  });

  const prevShareOpenRef = useRef(shareModal.isOpen);
  useEffect(() => {
    if (prevShareOpenRef.current && !shareModal.isOpen) {
      setPendingBump((n) => n + 1);
    }
    prevShareOpenRef.current = shareModal.isOpen;
  }, [shareModal.isOpen]);

  const vibeSlug = `${userSlug}/${appSlug}`;
  const cloneUrl = `/remix/${vibeSlug}?skipChat=true`;

  const showLoginOverlay = !authSignedIn && isLoaded && reqLogin;
  const loginOverlay = showLoginOverlay
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SignIn routing="hash" forceRedirectUrl={window.location.pathname + window.location.search} />
        </div>,
        document.body
      )
    : null;

  function fireInstall() {
    window.location.assign(cloneUrl);
  }

  async function fireJoin() {
    if (appSlug === undefined || userSlug === undefined) return;
    const r = await vctx.vibeDiyApi.requestAccess({ appSlug, userSlug });
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

  return (
    <>
      {/* Iframe — rendered as soon as iframeUrl is known. Hidden behind the grid
          until the grant resolves to an access state, then revealed. This lets
          the browser start fetching the iframe document from the SSR'd src
          immediately while preventing the flash on non-public apps. */}
      {iframeUrl && (
        <div
          className={cx("fixed inset-0", gridBackground)}
          style={{ isolation: "isolate", transform: "translate3d(0,0,0)", visibility: isAccessGranted ? "visible" : "hidden" }}
        >
          <iframe
            src={iframeUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            allow="camera; microphone"
            style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
          />
        </div>
      )}
      {/* Grid overlay — shown while grant is resolving or for card/not-found states */}
      {!isAccessGranted && (
        <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
          <div className="fixed top-4 left-4 z-50">
            <Delayed ms={1000}>
              <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
            </Delayed>
          </div>
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
                            : "Ask to join the collaboration."}
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
          <div className="fixed bottom-4 right-4 z-50">
            <Delayed ms={1000}>
              <ExpandedVibesPill
                size={60}
                cloneHref={cloneUrl}
                editHref={isOwner ? `/chat/${vibeSlug}` : undefined}
                onCommunity={shareModal.open}
                communityButtonRef={shareModal.buttonRef}
                communityBadgeCount={isOwner ? pendingCount : 0}
                hasUnpublishedChanges={isOwner && shareModal.hasUnpublishedChanges}
                appTitle={appTitle ?? appSlug}
                appIconUrl={screenshotUrl ?? undefined}
                appSlug={vibeSlug}
                isTwinkling={isNetworkActive}
                onHome={() => {
                  window.open("https://vibes.diy", "_blank");
                }}
              />
              <ShareModal modal={shareModal} placement="above" isOwner={isOwner} myGrant={myGrant} />
            </Delayed>
          </div>,
          document.body
        )}
      {hasMounted && (
        <Delayed ms={1000}>
          <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
        </Delayed>
      )}
      {loginOverlay}
      {hasMounted && sharingState && (
        <AllowFireproofSharing
          state={sharingState}
          dbRef={dbRef}
          onResult={onResult}
          onDismiss={onDismiss}
          onLoginRedirect={onLoginRedirect}
        />
      )}
    </>
  );
}
