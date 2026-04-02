import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth, useSession } from "@clerk/react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { applyStableEntry } from "../lib/stable-entry.js";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { Delayed } from "../components/Delayed.js";
import { VibesSwitch, gridBackground, cx } from "@vibes.diy/base";
import { AllowFireproofSharing } from "../components/AllowFireproofSharing.js";
import { useShareableDB } from "../hooks/useShareableDB.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { toast } from "react-hot-toast";
import { getAppByFsIdEvento } from "@vibes.diy/api-svc/public/get-app-by-fsid.js";

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
  const [runtimeReady, setRuntimeReady] = useState(false);
  const { isSignedIn: authSignedIn, isLoaded } = useAuth();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const [searchParam] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);

  const inGetAppByFsIdRef = useRef(false);

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
          case "public-access":
          case "owner":
            {
              const port =
                window.location.port && window.location.port !== "80" && window.location.port !== "443"
                  ? window.location.port
                  : undefined;
              iframeUrlRef.current = applyStableEntry(
                BuildURI.from(
                  calcEntryPointUrl({
                    hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
                    protocol,
                    bindings: { appSlug, userSlug, fsId: res.fsId },
                    port,
                  })
                )
              ).toString();
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

  function sendAccessRequest() {
    // TODO: call the real request-access API
    toast.success("Access request sent");
    setReqAccess(false);
    setRetryCount((c) => c + 1);
  }

  const reqAccessOverlay = reqAccess
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Request access</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This app is private. To request access, the owner <strong>{userSlug}</strong> will see your email and display name.
            </p>
            <div className="flex gap-3 justify-end">
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
          <SignIn routing="hash" forceRedirectUrl={window.location.href} />
        </div>,
        document.body
      )
    : null;

  if (ready && iframeUrlRef.current) {
    const myUrl = URI.from(window.location.href);
    const previewUrl = BuildURI.from(iframeUrlRef.current).port(myUrl.port).setParam("npmUrl", vctx.webVars.pkgRepos.workspace);

    // console.log(`previewUrl`, previewUrl.toString());

    return (
      <>
        <div className="fixed inset-0 bg-gray-900" style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}>
          <iframe
            src={previewUrl.toString()}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
          />
          {!runtimeReady && (
            <div className={cx(gridBackground, "absolute inset-0 flex h-full w-full items-center justify-center")}>
              <div style={{ color: "var(--vibes-text-primary)" }}>Loading…</div>
            </div>
          )}
        </div>
        {createPortal(
          <div className="fixed bottom-4 right-4 z-50">
            <Delayed ms={1000}>
              <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
            </Delayed>
          </div>,
          document.body
        )}
        <Delayed ms={1000}>
          <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
        </Delayed>
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

  return (
    <>
      <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
        <div className="fixed top-4 left-4 z-50">
          <Delayed ms={1000}>
            <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </Delayed>
        </div>
        {showLoginOverlay ? (
          <div className="text-center text-lg font-semibold" style={{ color: "var(--vibes-text-primary)" }}>
            Login required to view this page
          </div>
        ) : revokedAccess ? (
          <div className="text-center space-y-2" style={{ color: "var(--vibes-text-primary)" }}>
            <div className="text-lg font-semibold">Access revoked</div>
            <div className="text-sm opacity-60">Your access to this app has been revoked by the owner.</div>
          </div>
        ) : pendingRequest ? (
          <div className="text-center space-y-2" style={{ color: "var(--vibes-text-primary)" }}>
            <div className="text-lg font-semibold">Access requested</div>
            <div className="text-sm opacity-60">Your request has been sent. You'll get access once the owner approves it.</div>
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
