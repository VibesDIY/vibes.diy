import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import React, { useEffect, useMemo, useRef } from "react";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { getCode } from "./CodeEditor.js";

export function PreviewApp({ promptState }: { promptState: PromptState }) {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars, srvVibeSandbox } = useVibesDiy();

  const previewUrl = useMemo(() => {
    if (fsId && appSlug && userSlug) {
      const myUrl = URI.from(window.location.href);
      const baseUrl = calcEntryPointUrl({
        hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol as "http" | "",
        port: myUrl.port,
        bindings: { appSlug, userSlug, fsId },
      });
      const previewUrl = BuildURI.from(baseUrl).setParam("npmUrl", svcVars.pkgRepos.workspace).setParam("preview", "yes");
      return previewUrl;
    }
    promptState.setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("view", "code");
      return newParams;
    });
    return null;
  }, [fsId, userSlug, appSlug]);

  const lastSeenSeqRef = useRef<number>(-1);
  useEffect(() => {
    if (!srvVibeSandbox) return;
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (!last) return;
    let latestCodeEndSeq = -1;
    for (const msg of last.msgs) {
      if (isCodeEnd(msg) && msg.seq > latestCodeEndSeq) {
        latestCodeEndSeq = msg.seq;
      }
    }
    if (latestCodeEndSeq <= lastSeenSeqRef.current) return;
    lastSeenSeqRef.current = latestCodeEndSeq;
    const resolved = getCode(promptState, fsId).code.join("\n");
    if (resolved.length === 0) return;
    srvVibeSandbox.pushSource(resolved);
  }, [promptState.blocks, fsId, srvVibeSandbox]);

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
        allow="camera; microphone"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
