import { useParams, useSearchParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import React, { useMemo } from "react";
// import { BlockEndMsg, CodeEndMsg, isBlockEnd, isCodeEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";

// function findApp(promptState: PromptState, sectionId?: string | null) {
//   let lastBlock: BlockEndMsg | undefined;
//   let foundCodeSection: CodeEndMsg | undefined;
//   for (const block of promptState.blocks) {
//     for (const msg of block.msgs) {
//       if (isCodeEnd(msg)) {
//         if (msg.sectionId === sectionId) {
//           foundCodeSection = msg;
//         }
//       }
//       if (isBlockEnd(msg)) {
//         if (foundCodeSection) {
//           return msg;
//         }
//         lastBlock = msg;
//       }
//     }
//   }
//   return lastBlock;
// }

export function PreviewApp({ promptState: _p }: { promptState: PromptState }) {
  const { userSlug, appSlug } = useParams<{ userSlug: string; appSlug: string }>();
  const [searchParams] = useSearchParams();
  const { webVars: svcVars } = useVibeDiy();

  const previewUrl = useMemo(() => {
    const fsId = searchParams.get("fsId");
    if (fsId && appSlug && userSlug) {
      const myUrl = URI.from(window.location.href);
      const baseUrl = calcEntryPointUrl({
        hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol as "http" | "",
        port: myUrl.port,
        bindings: { appSlug, userSlug, fsId },
      });
      const previewUrl = BuildURI.from(baseUrl).setParam("npmUrl", svcVars.pkgRepos.workspace).setParam("preview", "yes");
      console.log(`iframe src=`, previewUrl.asObj());
      return previewUrl;
    }
    return null;
  }, [searchParams.get("fsId"), userSlug, appSlug]);

  if (!previewUrl) {
    return <>No App Found</>;
  }

  return (
    <div
      className="relative w-full h-full bg-gray-900 overflow-auto"
      style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
    >
      {/* <pre>{JSON.stringify({ sectionId, ends: findApp(promptState)}, null, 2)}</pre> */}
      <iframe
        src={previewUrl.toString()}
        className="relative w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
