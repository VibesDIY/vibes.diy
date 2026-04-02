import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import React, { useMemo } from "react";
import { BuildURI, URI } from "@adviser/cement";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { applyStableEntry } from "../../lib/stable-entry.js";

export function DataView({ promptState: _p }: { promptState: PromptState }) {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars } = useVibesDiy();

  const previewUrl = useMemo(() => {
    if (fsId && appSlug && userSlug) {
      const myUrl = URI.from(window.location.href);
      const baseUrl = calcEntryPointUrl({
        hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol as "http" | "",
        port: myUrl.port,
        bindings: { appSlug, userSlug },
      });
      const previewUrl = applyStableEntry(
        BuildURI.from(baseUrl)
          .appendRelative(".db-explorer")
          .setParam("npmUrl", svcVars.pkgRepos.workspace)
          .setParam("preview", "yes")
      );
      return previewUrl;
    }
    return null;
  }, [fsId, userSlug, appSlug]);

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
