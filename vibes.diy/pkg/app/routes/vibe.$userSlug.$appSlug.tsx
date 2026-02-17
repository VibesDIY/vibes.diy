import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { useSession } from "@clerk/clerk-react";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";

export default function VibeIframeWrapper() {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  const [searchParam] = useSearchParams();
  const vctx = useVibeDiy();
  const iframeUrlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // this is optional locked in
  const session = useSession();

  useEffect(() => {
    if (iframeUrlRef.current) {
      return;
    }
    if (fsId && userSlug && appSlug) {
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
    const sectionId = searchParam.get("sectionId");
    if (userSlug && appSlug) {
      vctx.vibeDiyApi
        .getByUserSlugAppSlug({
          userSlug,
          appSlug,
          sectionId: sectionId ?? "last",
        })
        .then((res) => {
          if (res.isErr()) {
            console.error(`getByUserSlugAppSlug failed with:`, res.Err());
          } else {
            iframeUrlRef.current = res.Ok().entryPointUrl;
            setReady(true);
          }
        });
    }
  }, [userSlug, appSlug, fsId, searchParam.get("sectionId"), session.isSignedIn]);

  if (ready && iframeUrlRef.current) {
    const myUrl = URI.from(window.location.href);
    const previewUrl = BuildURI.from(iframeUrlRef.current).port(myUrl.port).setParam("npmUrl", vctx.webVars.pkgRepos.workspace);
    // console.log(`iframe src=`, previewUrl.asObj());

    return (
      <div className="fixed inset-0 bg-gray-900" style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}>
        <iframe
          src={previewUrl.toString()}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms"
          style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
        />
      </div>
    );
  }
  if (searchParam.get("sectionId") && !session.isSignedIn) {
    return <div>to use sectionId you need to be logged in</div>;
  }
  return <div>loading app</div>;
}
