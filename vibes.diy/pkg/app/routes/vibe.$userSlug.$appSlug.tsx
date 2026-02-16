import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { BuildURI, URI } from "@adviser/cement";
import { useSession } from "@clerk/clerk-react";

export default function VibeIframeWrapper() {
  const { userSlug, appSlug } = useParams<{ userSlug: string; appSlug: string }>();
  const [searchParam] = useSearchParams();
  const vctx = useVibeDiy();
  const [iframeUrl, setIframeUrl] = useState<string | null>();

  // this is optional locked in
  const session = useSession();

  useEffect(() => {
    if (!session.isSignedIn) {
      return
    }
    const sectionId = searchParam.get("sectionId");
    if (sectionId && userSlug && appSlug) {
      vctx.vibeDiyApi
        .getByUserSlugAppSlug({
          userSlug,
          appSlug,
          sectionId,
        })
        .then((res) => {
          if (res.isErr()) {
            console.error(`getByUserSlugAppSlug failed with:`, res.Err());
          } else {
            setIframeUrl(res.Ok().entryPointUrl);
          }
        });
    }
  }, [userSlug, appSlug, searchParam.get("sectionId"), session]);

  if (iframeUrl) {
    const myUrl = URI.from(window.location.href);
    const previewUrl = BuildURI.from(iframeUrl).port(myUrl.port).setParam("npmUrl", vctx.webVars.pkgRepos.workspace);
    console.log(`iframe src=`, previewUrl.asObj());

    return (
      <div
        className="fixed inset-0 bg-gray-900"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      >
        {/* <pre>{JSON.stringify({ sectionId, ends: findApp(promptState)}, null, 2)}</pre> */}
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
    return <div>to use sectionId you need to be logged in</div>
  }
  return <div>loading app</div>;
}
