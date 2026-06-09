import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";
import React, { useEffect, useMemo, useState } from "react";
import { BuildURI, URI } from "@adviser/cement";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { useAuth } from "@clerk/react";

export function DataView({ promptState: _p }: { promptState: PromptState }) {
  const { ownerHandle, appSlug, fsId } = useParams<{ ownerHandle: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars, chatApi } = useVibesDiy();
  const { isSignedIn } = useAuth();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !ownerHandle) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    void chatApi.listHandleBindings({}).then((res) => {
      if (cancelled) return;
      if (res.isErr()) {
        setIsOwner(false);
        return;
      }
      setIsOwner(res.Ok().items.some((item) => item.ownerHandle === ownerHandle));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ownerHandle, chatApi]);

  const previewUrl = useMemo(() => {
    if (fsId && appSlug && ownerHandle) {
      const myUrl = URI.from(window.location.href);
      const baseUrl = calcEntryPointUrl({
        hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol as "http" | "",
        port: myUrl.port,
        // Carry the route's pinned fsId so the DB-explorer reflects the
        // same snapshot the preview iframe is showing (not always-latest).
        bindings: { appSlug, ownerHandle, fsId },
      });
      const uri = BuildURI.from(baseUrl)
        .appendRelative(".db-explorer")
        .setParam("npmUrl", svcVars.pkgRepos.workspace)
        .setParam("preview", "yes");
      if (isOwner) {
        uri.setParam("adminMode", "yes");
      }
      return uri;
    }
    return null;
  }, [fsId, ownerHandle, appSlug, isOwner]);

  if (!previewUrl) {
    return <>No App Found</>;
  }

  return (
    <div
      className="relative w-full h-full bg-gray-900 overflow-auto"
      style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
    >
      <iframe
        src={previewUrl.toString()}
        className="relative w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
