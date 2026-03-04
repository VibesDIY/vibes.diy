import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { SignIn, useAuth, useSession } from "@clerk/clerk-react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { Toaster } from "react-hot-toast";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { VibesSwitch } from "@vibes.diy/base";
import { AllowFireproofSharing } from "../components/AllowFireproofSharing.js";
import { useShareableDB } from "../hooks/useShareableDB.js";

export default function VibeIframeWrapper() {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  // const [searchParam] = useSearchParams();
  const vctx = useVibeDiy();
  const iframeUrlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const { isSignedIn: authSignedIn, isLoaded } = useAuth();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

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

  useEffect(() => {
    if (iframeUrlRef.current) {
      return;
    }
    if (fsId && userSlug && appSlug) {
      if (!authSignedIn) {
        return;
      }
      vctx.vibeDiyApi.getAppByFsId({ fsId }).then((res) => {
        if (res.isErr()) {
          console.error(`getAppByFsId failed with:`, res.Err());
          return;
        }
        const app = res.Ok();
        const protocol = window.location.protocol === "https:" ? "https" : "http";
        const port =
          window.location.port && window.location.port !== "80" && window.location.port !== "443"
            ? window.location.port
            : undefined;
        iframeUrlRef.current = calcEntryPointUrl({
          hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
          protocol,
          bindings: { appSlug: app.appSlug, userSlug: app.userSlug, fsId: app.fsId },
          port,
        });
        // console.log('xxxxxxx', iframeUrlRef.current)
        setReady(true);
      });
      return;
    }
    if (!session.isSignedIn) {
      return;
    }
    // TODO find public

    // const sectionId = searchParam.get("sectionId");
    //   if (userSlug && appSlug) {
    //     vctx.vibeDiyApi
    //       .getByUserSlugAppSlug({
    //         userSlug,
    //         appSlug,
    //         // sectionId: sectionId ?? "last",
    //       })
    //       .then((res) => {
    //         if (res.isErr()) {
    //           console.error(`getByUserSlugAppSlug failed with:`, res.Err());
    //         } else {
    //           const url = calcEntryPointUrl({
    //             hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
    //             protocol: vctx.webVars.env.VIBES_SVC_PROTOCOL,
    //             port: vctx.webVars.env.VIBES_SVC_PORT,
    //             bindings: {
    //                 appSlug,
    //                 userSlug,
    //                 fsId: res.Ok().fsId
    //             },
    //           });
    //           iframeUrlRef.current = url
    //           setReady(true);
    //         }
    //       });
    //   }
  }, [userSlug, appSlug, fsId, session.isSignedIn, authSignedIn]);

  useEffect(() => {
    if (!ready) return;
    return vctx.srvVibeSandbox.onRuntimeReady(() => {
      setRuntimeReady(true);
    }) as () => void;
  }, [ready, vctx.srvVibeSandbox]);

  const { sharingState, dbRef, onResult, onDismiss, onLoginRedirect } = useShareableDB();

  const showLoginOverlay = !authSignedIn && isLoaded && !!(fsId && userSlug && appSlug);
  const loginOverlay = showLoginOverlay
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SignIn routing="hash" fallbackRedirectUrl={window.location.href} />
        </div>,
        document.body
      )
    : null;

  // if (searchParam.get("sectionId") && !session.isSignedIn) {
  //   return <div>to use sectionId you need to be logged in</div>;
  // }

  if (ready && iframeUrlRef.current) {
    const myUrl = URI.from(window.location.href);
    const previewUrl = BuildURI.from(iframeUrlRef.current).port(myUrl.port).setParam("npmUrl", vctx.webVars.pkgRepos.workspace);

    return (
      <>
        <Toaster />
        <div className="fixed inset-0 bg-gray-900" style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}>
          <iframe
            src={previewUrl.toString()}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
          />
          {!runtimeReady && (
            <div className="grid-background absolute inset-0 flex h-full w-full items-center justify-center">
              <div style={{ color: "var(--vibes-text-primary)" }}>Loading…</div>
            </div>
          )}
        </div>
        {createPortal(
          <div className="fixed bottom-4 right-4 z-50">
            <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </div>,
          document.body
        )}
        <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
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
      <div className="grid-background flex h-screen w-screen items-center justify-center">
        {showLoginOverlay ? (
          <div className="text-center text-lg font-semibold" style={{ color: "var(--vibes-text-primary)" }}>
            Login required to view this page
          </div>
        ) : (
          <div style={{ color: "var(--vibes-text-primary)" }}>Preparing…</div>
        )}
      </div>
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
      {loginOverlay}
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
