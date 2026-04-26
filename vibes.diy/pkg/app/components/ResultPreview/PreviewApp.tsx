import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { getCode } from "./CodeEditor.js";

export function PreviewApp({ promptState }: { promptState: PromptState }) {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars, srvVibeSandbox } = useVibesDiy();

  // Pin the iframe URL to the FIRST fsId we see for this (userSlug,appSlug)
  // pair. Subsequent fsId changes (autosave navigation after each turn) don't
  // re-render the iframe — hot-swap has already updated its contents in place,
  // so reloading would just produce a black flash for the same render. The
  // pinned URL becomes stale only when the user navigates to a different vibe
  // (different appSlug/userSlug) or reloads the page.
  const [pinnedFsId, setPinnedFsId] = useState<string | undefined>(fsId);
  const [pinnedKey, setPinnedKey] = useState<string | undefined>(
    fsId ? `${userSlug}/${appSlug}` : undefined
  );
  useEffect(() => {
    if (!fsId) return;
    const key = `${userSlug}/${appSlug}`;
    if (pinnedKey !== key || pinnedFsId === undefined) {
      setPinnedFsId(fsId);
      setPinnedKey(key);
    }
  }, [fsId, userSlug, appSlug, pinnedKey, pinnedFsId]);

  const previewUrl = useMemo(() => {
    if (pinnedFsId && appSlug && userSlug) {
      const myUrl = URI.from(window.location.href);
      const baseUrl = calcEntryPointUrl({
        hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
        protocol: myUrl.protocol as "http" | "",
        port: myUrl.port,
        bindings: { appSlug, userSlug, fsId: pinnedFsId },
      });
      return BuildURI.from(baseUrl).setParam("npmUrl", svcVars.pkgRepos.workspace).setParam("preview", "yes");
    }
    return null;
  }, [pinnedFsId, userSlug, appSlug]);

  // Track last-seen code.end seq per blockId so we push exactly once per
  // code.end. seq counters reset per block, so a single global "must increase"
  // check would skip pushes from later blocks whose seq < previous block's max.
  const seenByBlockIdRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (srvVibeSandbox === undefined) return;
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (last === undefined) return;
    // Find latest code.end in the latest block, keyed by blockId.
    let latestCodeEndSeq = -1;
    let latestBlockId: string | undefined;
    for (const msg of last.msgs) {
      if (isCodeEnd(msg) && msg.seq > latestCodeEndSeq) {
        latestCodeEndSeq = msg.seq;
        latestBlockId = msg.blockId;
      }
    }
    if (latestBlockId === undefined) return;
    const seenSeq = seenByBlockIdRef.current.get(latestBlockId) ?? -1;
    if (latestCodeEndSeq <= seenSeq) return;
    seenByBlockIdRef.current.set(latestBlockId, latestCodeEndSeq);
    const resolved = getCode(promptState).code.join("\n");
    if (resolved.length === 0) return;
    // The aider parser occasionally emits tiny phantom sections when the
    // model outputs the path-line + fence as standalone text. Those resolve
    // to a few bytes and never form a valid module — skip pushes that
    // obviously can't be a React component.
    if (resolved.length < 200 || !resolved.includes("export default")) return;
    srvVibeSandbox.pushSource(resolved);
  }, [promptState.blocks, srvVibeSandbox]);

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
