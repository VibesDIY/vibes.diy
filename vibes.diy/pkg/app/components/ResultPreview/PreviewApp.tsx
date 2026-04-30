import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { toast } from "react-hot-toast";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { getCode } from "./CodeEditor.js";

export function PreviewApp({ promptState }: { promptState: PromptState }) {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars, srvVibeSandbox } = useVibesDiy();

  // Pin the iframe URL once per (userSlug,appSlug) for the lifetime of the
  // mount. Two valid initial states:
  //   1. URL has fsId at mount → pin to it; iframe loads that fsId.
  //   2. URL has no fsId at mount → pinnedFsId stays undefined; iframe loads
  //      the server's "pending" shell. Subsequent fsId arrivals (autosave) do
  //      NOT update pinnedFsId — hot-swap has already mounted content into
  //      the pending iframe, so reloading to the autosave fsId would discard
  //      everything streamed in.
  // Only cross-vibe navigation (different slug pair) re-pins.
  const [pinnedFsId, setPinnedFsId] = useState<string | undefined>(fsId);
  const [pinnedKey, setPinnedKey] = useState<string>(`${userSlug}/${appSlug}`);
  useEffect(() => {
    const key = `${userSlug}/${appSlug}`;
    if (pinnedKey !== key) {
      setPinnedFsId(fsId);
      setPinnedKey(key);
    }
  }, [fsId, userSlug, appSlug, pinnedKey]);

  // Build the iframe URL as soon as we have slugs, even before any fsId. The
  // server returns a "pending" entry shell when no apps row exists yet — the
  // iframe loads, registerDependencies runs, the hot-swap listener registers
  // BEFORE the first code streams. First pushSource then hits a live listener
  // and the scaffold renders immediately.
  const previewUrl = useMemo(() => {
    if (!appSlug || !userSlug) return null;
    const myUrl = URI.from(window.location.href);
    const baseUrl = calcEntryPointUrl({
      hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
      protocol: myUrl.protocol as "http" | "",
      port: myUrl.port,
      bindings: { appSlug, userSlug, ...(pinnedFsId ? { fsId: pinnedFsId } : {}) },
    });
    const url = BuildURI.from(baseUrl).setParam("npmUrl", svcVars.pkgRepos.workspace).setParam("preview", "yes");
    console.log("[hot-swap] previewUrl computed", { pinnedFsId, urlFsId: fsId, url: url.toString() });
    return url;
  }, [pinnedFsId, userSlug, appSlug, fsId]);

  // Track last-seen code.end seq per blockId so we push exactly once per
  // code.end. seq counters reset per block, so a single global "must increase"
  // check would skip pushes from later blocks whose seq < previous block's max.
  const seenByBlockIdRef = useRef<Map<string, number>>(new Map());
  // Cumulative count of failed fence sections seen via window.__aiderEditsDebug.
  // We toast when this strictly increases — i.e., a fresh streamed block had
  // an apply/parse failure — so the user knows the preview may be stale even
  // though the resolver kept advancing.
  const lastFailedSectionCountRef = useRef(0);
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

    // Surface resolver-side apply/parse errors as a toast. getCode populates
    // window.__aiderEditsDebug.failedSectionCount on every walk; we react
    // only to a strict increase so we don't re-toast a steady-state count.
    const dbg = (
      window as unknown as {
        __aiderEditsDebug?: { failedSectionCount?: number };
      }
    ).__aiderEditsDebug;
    if (dbg && typeof dbg.failedSectionCount === "number" && dbg.failedSectionCount > lastFailedSectionCountRef.current) {
      const newFailed = dbg.failedSectionCount - lastFailedSectionCountRef.current;
      lastFailedSectionCountRef.current = dbg.failedSectionCount;
      // Warning, not error — the iframe keeps showing the prior good state
      // and subsequent edits keep flowing. The user just needs to know that
      // the preview may be a step behind the latest stream.
      toast(`${newFailed} edit${newFailed === 1 ? "" : "s"} couldn't apply — preview may be stale`, {
        id: "aider-resolve-error",
        icon: "⚠️",
      });
    }

    if (resolved.length === 0) return;
    // The aider parser occasionally emits tiny phantom sections when the
    // model outputs the path-line + fence as standalone text. Those resolve
    // to a few bytes and never form a valid module — skip pushes that
    // obviously can't be a React component.
    if (resolved.length < 200 || !resolved.includes("export default")) {
      console.log("[hot-swap] pushSource skipped (size/export gate)", {
        len: resolved.length,
        hasExport: resolved.includes("export default"),
      });
      return;
    }
    const ok = srvVibeSandbox.pushSource(resolved);
    console.log("[hot-swap] pushSource", { ok, len: resolved.length, blockId: latestBlockId });
  }, [promptState.blocks, srvVibeSandbox]);

  // Builder always edits the user's own vibe — release Firefly immediately so
  // useFireproof hooks inside the iframe resolve as soon as the runtime boots.
  // Buffered by srv-sandbox if iframeSource isn't captured yet; replayed on
  // runtime.ready capture.
  useEffect(() => {
    if (srvVibeSandbox === undefined) return;
    srvVibeSandbox.sendAccessDecision(true);
  }, [srvVibeSandbox, previewUrl]);

  // Toast when the iframe rejects a hot-swap source (sucrase transform fail,
  // dynamic import fail, mountVibe throw). The iframe keeps showing the
  // previously-committed DOM — without this signal the user sees the preview
  // silently stop updating mid-stream and assumes the app broke.
  useEffect(() => {
    if (srvVibeSandbox === undefined) return;
    const unsubscribe = srvVibeSandbox.onHotSwapError(({ message }) => {
      const firstLine = message.split("\n")[0];
      // Warning, not error — mountVibe re-uses the React root, so the iframe
      // keeps the previously-committed DOM. This is a "heads up the latest
      // edit didn't paint", not a hard failure.
      toast(`Hot-swap failed: ${firstLine}`, { id: "hot-swap-error", icon: "⚠️" });
    }) as () => void;
    return unsubscribe;
  }, [srvVibeSandbox]);

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
