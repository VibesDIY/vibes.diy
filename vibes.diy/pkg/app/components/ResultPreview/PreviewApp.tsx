import { useSearchParams } from "react-router";
import { PromptState } from "../../routes/chat.$userSlug.$appSlug.js";
import React from "react";
import { isBlockEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { useVibeDiy } from "../../vibe-diy-provider.js";

function findApp(promptState: PromptState, _sectionId?: string | null) {
  for (const block of [...promptState.blocks].reverse()) {
    for (const msg of [...block.msgs].reverse()) {
      if (isBlockEnd(msg)) {
        return msg;
      }
    }
  }
  return undefined;
}

export function PreviewApp({ promptState }: { promptState: PromptState }) {
  const [searchParams] = useSearchParams();
  const { vibeDiyApi } = useVibeDiy();

  const sectionId = searchParams.get("sectionId");
  const endBlock = findApp(promptState, sectionId);
  // console.log(`endblock`, endBlock)
  if (!endBlock || !endBlock.fsRef) {
    return <>No App Found</>;
  }

  const myUrl = URI.from(window.location.href);
  const previewUrl = BuildURI.from(endBlock.fsRef.entryPointUrl)
    .port(myUrl.port)
    .setParam("npmUrl", vibeDiyApi.cfg.npmUrl)
    .toString();
  console.log(`iframe src=`, previewUrl);

  return (
    <div
      className="relative w-full h-full bg-gray-900 overflow-auto"
      style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
    >
      {/* <pre>{JSON.stringify({ sectionId, ends: findApp(promptState)}, null, 2)}</pre> */}
      <iframe
        src={previewUrl}
        className="relative w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
