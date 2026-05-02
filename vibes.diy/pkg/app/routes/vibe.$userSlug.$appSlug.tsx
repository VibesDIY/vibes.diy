import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMatches, useParams, useSearchParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth } from "@clerk/react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { Delayed } from "../components/Delayed.js";
import { VibesSwitch, VibesButton, BLUE, YELLOW, ExpandedVibesPill, gridBackground, cx } from "@vibes.diy/base";
import { AllowFireproofSharing } from "../components/AllowFireproofSharing.js";
import { useShareModal } from "../components/ResultPreview/useShareModal.js";
import { ShareModal } from "../components/ResultPreview/ShareModal.js";
import { useShareableDB } from "../hooks/useShareableDB.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { toast } from "react-hot-toast";
import { isMetaScreenShot, isMetaTitle, type ResGetAppByFsId, type VibesFPApiParameters } from "@vibes.diy/api-types";

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
  const [reqAccess, setReqAccess] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [revokedAccess, setRevokedAccess] = useState(false);
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
    if (isLoaded && !authSignedIn && fsId && userSlug && appSlug) {
      setIsSidebarVisible(true);
    }
    if (authSignedIn) {
      setIsSidebarVisible(false);
    }
  }, [isLoaded, authSignedIn, fsId, userSlug, appSlug]);

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

    const applyResToUI = (res: ResGetAppByFsId, signedIn: boolean | undefined): void => {
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
          setNotFound(true);
          toast.dismiss("vibe-access");
          break;
        case "req-login.request":
          if (signedIn) {
            setReqAccess(true);
          } else {
            setReqLogin(true);
            setIsSidebarVisible(true);
          }
          toast.dismiss("vibe-access");
          break;
        case "req-login.invite":
          setReqLogin(true);
          setIsSidebarVisible(true);
          toast.dismiss("vibe-access");
          break;
        case "pending-request":
          setPendingRequest(true);
          toast.dismiss("vibe-access");
          break;
        case "revoked-access":
          setRevokedAccess(true);
          toast.dismiss("vibe-access");
          break;
        case "not-grant":
          setNotFound(true);
          toast.dismiss("vibe-access");
          break;
        case "accepted-email-invite":
        case "granted-access.editor":
        case "granted-access.viewer":
        case "granted-access.submitter":
        case "public-access":
        case "owner":
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
      applyResToUI(cachedResRef.current, authSignedIn);
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
      applyResToUI(res, authSignedIn);
    });
  }, [userSlug, appSlug, fsId, searchParam, authSignedIn, retryCount, vctx.vibeDiyApi]);

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

  function sendAccessRequest() {
    // TODO: call the real request-access API
    toast.success("Access request sent");
    setReqAccess(false);
    setRetryCount((c) => c + 1);
  }

  const vibeSlug = `${userSlug}/${appSlug}`;
  const remixUrl = `/remix/${vibeSlug}`;
  const cloneUrl = `/remix/${vibeSlug}?skipChat=true`;

  const reqAccessOverlay = reqAccess
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 max-w-md w-full mx-4 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{appTitle ?? appSlug}</h2>
            {screenshotUrl && (
              <img
                src={screenshotUrl}
                alt={`Screenshot of ${appTitle ?? appSlug}`}
                className="w-full rounded border border-gray-200 dark:border-gray-700"
              />
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This app is private. To request access, the owner <strong>{userSlug}</strong> will see your email and display name.
            </p>
            <div className="flex gap-3 justify-end">
              <VibesButton variant={YELLOW} icon="remix" onClick={() => window.location.assign(remixUrl)}>
                Remix
              </VibesButton>
              <VibesButton variant={BLUE} icon="remix" onClick={() => window.location.assign(cloneUrl)}>
                Clone
              </VibesButton>
              <button
                type="button"
                onClick={() => setReqAccess(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAccessRequest}
                className="rounded px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Request access
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  const showLoginOverlay = !authSignedIn && isLoaded && (!!(fsId && userSlug && appSlug) || reqLogin);
  const loginOverlay = showLoginOverlay
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SignIn routing="hash" forceRedirectUrl={window.location.pathname + window.location.search} />
        </div>,
        document.body
      )
    : null;

  if (iframeUrl) {
    return (
      <>
        <div className={cx("fixed inset-0", gridBackground)} style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}>
          <iframe
            src={iframeUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            allow="camera; microphone"
            style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
          />
        </div>
        {/* Chrome (overlays, pill, sidebar) is client-only because createPortal
            references document.body, which throws under SSR. The iframe itself
            ships in the first byte of HTML so the browser starts fetching it
            immediately; chrome paints in after hydration. */}
        {hasMounted &&
          createPortal(
            <div className="fixed bottom-4 right-4 z-50">
              <Delayed ms={1000}>
                <ExpandedVibesPill
                  size={60}
                  remixHref={remixUrl}
                  cloneHref={cloneUrl}
                  editHref={isOwner ? `/chat/${vibeSlug}` : undefined}
                  onCommunity={shareModal.open}
                  communityButtonRef={shareModal.buttonRef}
                  communityBadgeCount={isOwner ? pendingCount : 0}
                  hasUnpublishedChanges={isOwner && shareModal.hasUnpublishedChanges}
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

  return (
    <>
      <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
        <div className="fixed top-4 left-4 z-50">
          <Delayed ms={1000}>
            <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </Delayed>
        </div>
        {showLoginOverlay || revokedAccess || pendingRequest ? (
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
              <p style={{ marginTop: 10, fontSize: 15, opacity: 0.7 }}>
                {showLoginOverlay
                  ? "Login required to view this app."
                  : revokedAccess
                    ? "Your access to this app has been revoked by the owner."
                    : "The owner of this vibe has received your access request. Please let them know to approve it."}
              </p>
              {screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt={`Screenshot of ${appTitle ?? appSlug}`}
                  style={{ width: "100%", marginTop: 16, border: "1px solid black" }}
                />
              )}
              <p style={{ marginTop: 16, fontSize: 14, opacity: 0.6 }}>
                While you wait you can remix to edit your own version, or clone to deploy a copy as-is. Either way it starts empty —
                you won't get this copy's data or collaboration.
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
                <VibesButton variant={YELLOW} icon="remix" onClick={() => window.location.assign(remixUrl)}>
                  Remix
                </VibesButton>
                <VibesButton variant={BLUE} icon="remix" onClick={() => window.location.assign(cloneUrl)}>
                  Clone
                </VibesButton>
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
      <Delayed ms={1000}>
        <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
      </Delayed>
      {loginOverlay}
      {reqAccessOverlay}
      {sharingState && (
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
