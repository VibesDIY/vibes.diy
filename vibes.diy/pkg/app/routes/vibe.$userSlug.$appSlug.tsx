import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth, useSession } from "@clerk/react";
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
import { getAppByFsIdEvento } from "@vibes.diy/api-svc/public/get-app-by-fsid.js";
import { isMetaScreenShot, isMetaTitle } from "@vibes.diy/api-types";

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
  const iframeUrlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reqLogin, setReqLogin] = useState(false);
  const [reqAccess, setReqAccess] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [revokedAccess, setRevokedAccess] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const { isSignedIn: authSignedIn, isLoaded } = useAuth();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const [searchParam] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBump, setPendingBump] = useState(0);

  const inGetAppByFsIdRef = useRef(false);

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

  // this is optional locked in
  const session = useSession();
  // const auth = useAuth()

  useEffect(() => {
    if (iframeUrlRef.current) {
      return;
    }
    if (!(appSlug && userSlug)) {
      return;
    }
    if (inGetAppByFsIdRef.current) {
      return;
    }
    inGetAppByFsIdRef.current = true;
    console.log(`call`, getAppByFsIdEvento);
    vctx.vibeDiyApi
      .getAppByFsId({
        fsId,
        appSlug,
        userSlug,
        token: searchParam.get("token") ?? undefined,
      })
      .then((rRes) => {
        inGetAppByFsIdRef.current = false;
        if (rRes.isErr()) {
          toast.error(`getAppByFsId failed with: ${rRes.Err().message}`);
          return;
        }
        const res = rRes.Ok();
        if (res.error) {
          setNotFound(true);
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
        const protocol = window.location.protocol === "https:" ? "https" : "http";
        console.log(`grant`, res.grant);
        switch (res.grant) {
          case "not-found":
            setNotFound(true);
            break;
          case "req-login.request":
            if (authSignedIn) {
              setReqAccess(true);
            } else {
              setReqLogin(true);
              setIsSidebarVisible(true);
            }
            break;
          case "req-login.invite":
            setReqLogin(true);
            setIsSidebarVisible(true);
            break;
          case "pending-request":
            setPendingRequest(true);
            break;
          case "revoked-access":
            setRevokedAccess(true);
            break;
          case "not-grant":
            setNotFound(true);
            break;
          case "accepted-email-invite":
          case "granted-access.editor":
          case "granted-access.viewer":
          case "granted-access.submitter":
          case "public-access":
          case "owner":
            {
              const port =
                window.location.port && window.location.port !== "80" && window.location.port !== "443"
                  ? window.location.port
                  : undefined;
              iframeUrlRef.current = calcEntryPointUrl({
                hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
                protocol,
                bindings: { appSlug, userSlug, fsId: res.fsId },
                port,
              });
              setReady(true);
            }
            break;
          default:
            toast.error(`Unexpected grant: ${res.grant}`);
        }
      });
  }, [userSlug, appSlug, fsId, session.isSignedIn, authSignedIn, retryCount]);

  useEffect(() => {
    if (!ready) return;
    return vctx.srvVibeSandbox.onRuntimeReady(() => {
      setRuntimeReady(true);
    }) as () => void;
  }, [ready, vctx.srvVibeSandbox]);

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

  const showIframe = ready && iframeUrlRef.current;
  const myUrl = showIframe ? URI.from(window.location.href) : null;
  const previewUrl = showIframe
    ? BuildURI.from(iframeUrlRef.current!).port(myUrl!.port).setParam("npmUrl", vctx.webVars.pkgRepos.workspace)
    : null;

  // Overlay content shown while iframe loads or when access is restricted
  const overlayContent =
    showLoginOverlay || revokedAccess || pendingRequest ? (
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
            While you wait you can remix to edit your own version, or clone to deploy a copy as-is. Either way it starts empty — you
            won't get this copy's data or collaboration.
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
      <div style={{ color: "var(--vibes-text-primary)" }}>{showIframe ? "Loading…" : "Preparing…"}</div>
    );

  return (
    <>
      {/* Stable outer container — never unmounted, so React reconciles instead of replacing */}
      <div className="fixed inset-0" style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}>
        {showIframe && previewUrl && (
          <div className="absolute inset-0 bg-gray-900">
            <iframe
              src={previewUrl.toString()}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              allow="camera; microphone"
              style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
            />
          </div>
        )}
        {(!showIframe || !runtimeReady) && (
          <div className={cx(gridBackground, "absolute inset-0 flex h-full w-full items-center justify-center")}>
            {!showIframe && (
              <div className="fixed top-4 left-4 z-50">
                <Delayed ms={1000}>
                  <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
                </Delayed>
              </div>
            )}
            {overlayContent}
          </div>
        )}
      </div>
      {showIframe &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50">
            <Delayed ms={1000}>
              <ExpandedVibesPill
                size={60}
                remixHref={remixUrl}
                cloneHref={cloneUrl}
                editHref={isOwner ? `/chat/${vibeSlug}` : undefined}
                onOwnerShare={isOwner ? shareModal.open : undefined}
                shareButtonRef={isOwner ? shareModal.buttonRef : undefined}
                shareBadgeCount={isOwner ? pendingCount : 0}
                onHome={() => {
                  window.open("https://vibes.diy", "_blank");
                }}
              />
              <ShareModal modal={shareModal} placement="above" />
            </Delayed>
          </div>,
          document.body
        )}
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
