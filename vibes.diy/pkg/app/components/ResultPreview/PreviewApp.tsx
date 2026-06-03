import { useParams } from "react-router";
import { PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isBlockEnd, isCodeEnd } from "@vibes.diy/call-ai-v2";
import { BuildURI, URI } from "@adviser/cement";
import { toast } from "react-hot-toast";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import { getCode } from "./get-code.js";
import type { EvtVibeViewerChanged } from "@vibes.diy/vibe-types";
import { RUNTIME_PREVIEW_IFRAME_ALLOW, RUNTIME_PREVIEW_IFRAME_SANDBOX } from "../../lib/iframe-policy.js";
import { adminModeStorageKey } from "../../lib/admin-mode.js";

export function PreviewApp({ promptState }: { promptState: PromptState }) {
  const { ownerHandle, appSlug, fsId } = useParams<{ ownerHandle: string; appSlug: string; fsId?: string }>();
  const { webVars: svcVars, srvVibeSandbox } = useVibesDiy();

  // Pin the iframe URL per (ownerHandle,appSlug). Two valid initial states:
  //   1. URL has fsId at mount → pin to it; iframe loads that fsId.
  //   2. URL has no fsId at mount → pinnedFsId stays undefined; iframe loads
  //      the server's "pending" shell, then hot-swap installs streamed code
  //      into the live DOM.
  // Mid-stream we deliberately do NOT touch pinnedFsId (it would reload the
  // iframe and discard the hot-swapped DOM). At end-of-stream we DO repoint
  // pinnedFsId for case (1) only — see the end-of-stream effect below — so
  // an iteration on an existing chat picks up the server's canonical bundle.
  // Cross-vibe navigation (different slug pair) re-pins from scratch.
  const [pinnedFsId, setPinnedFsId] = useState<string | undefined>(fsId);
  const [pinnedKey, setPinnedKey] = useState<string>(`${ownerHandle}/${appSlug}`);
  useEffect(() => {
    const key = `${ownerHandle}/${appSlug}`;
    if (pinnedKey !== key) {
      // Drop any cached hot-swap source from the prior vibe before pinning the
      // new context — otherwise runtime.ready of the about-to-reload iframe
      // would replay stale code on top of chat B's freshly-loaded entry URL.
      srvVibeSandbox?.clearPendingSource();
      setPinnedFsId(fsId);
      setPinnedKey(key);
    }
  }, [fsId, ownerHandle, appSlug, pinnedKey, srvVibeSandbox]);

  // Also clear on first mount: when ResultPreview swaps the welcome empty-div
  // for PreviewApp (showWelcome flips false during cross-chat nav), this is a
  // fresh component instance and any pendingSource left over by the previous
  // PreviewApp instance belongs to the previous vibe.
  useEffect(() => {
    srvVibeSandbox?.clearPendingSource();
  }, []);

  // Build the iframe URL as soon as we have slugs, even before any fsId. The
  // server returns a "pending" entry shell when no apps row exists yet — the
  // iframe loads, registerDependencies runs, the hot-swap listener registers
  // BEFORE the first code streams. First pushSource then hits a live listener
  // and the scaffold renders immediately.
  const previewUrl = useMemo(() => {
    if (!appSlug || !ownerHandle) return null;
    const myUrl = URI.from(window.location.href);
    const baseUrl = calcEntryPointUrl({
      hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
      protocol: myUrl.protocol as "http" | "",
      port: myUrl.port,
      bindings: { appSlug, ownerHandle, ...(pinnedFsId ? { fsId: pinnedFsId } : {}) },
    });
    const url = BuildURI.from(baseUrl).setParam("npmUrl", svcVars.pkgRepos.workspace).setParam("preview", "yes");
    return url;
  }, [pinnedFsId, ownerHandle, appSlug, fsId]);

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
      return;
    }
    const ok = srvVibeSandbox.pushSource(resolved);
    if (ok) setHotSwapCount((c) => c + 1);
  }, [promptState.blocks, srvVibeSandbox]);

  // Preview-blur ramp: only on the first codegen of a brand-new chat or
  // remix — i.e. the pinned chat mounted with no fsId in the URL. Starts at
  // 25px and multiplies by 2/3 per hot-swap (no floor, no rounding — can
  // decay below 1px). Once that first stream finishes, the overlay never
  // appears again for this pinning. Cross-vibe nav resets the gate.
  const [hotSwapCount, setHotSwapCount] = useState(0);
  const [firstStreamDone, setFirstStreamDone] = useState(false);
  const wasRunningRef = useRef(false);
  const lastPinnedKeyRef = useRef(pinnedKey);
  useEffect(() => {
    if (lastPinnedKeyRef.current !== pinnedKey) {
      lastPinnedKeyRef.current = pinnedKey;
      setHotSwapCount(0);
      setFirstStreamDone(false);
    }
  }, [pinnedKey]);
  useEffect(() => {
    if (!promptState.running && wasRunningRef.current && !firstStreamDone) {
      setFirstStreamDone(true);
    }
    wasRunningRef.current = promptState.running;
  }, [promptState.running, firstStreamDone]);

  // At end-of-stream, repoint the iframe at the server-side merged fsId — but
  // only when the iframe was already pinned to an fsId at mount (an iteration
  // on an existing chat). For a fresh-chat first codegen (pinnedFsId === undefined)
  // the iframe loaded the pending shell and has been hot-swapped with the
  // resolved buffer; reloading it to the new fsId here would cause a visible
  // flash to a blank iframe while the canonical bundle reloads cold. The URL
  // navigation in chat.tsx still records the new fsId so reload behaves
  // correctly. Mid-stream we always skip — a reload would discard the
  // in-progress hot-swapped DOM.
  const streamingRef = useRef(false);
  useEffect(() => {
    const justEnded = streamingRef.current && !promptState.running;
    streamingRef.current = promptState.running;
    if (!justEnded) return;
    if (pinnedFsId === undefined) return;
    for (let i = promptState.blocks.length - 1; i >= 0; i -= 1) {
      const block = promptState.blocks[i];
      for (const msg of block.msgs) {
        if (isBlockEnd(msg) && msg.fsRef && msg.fsRef.fsId !== pinnedFsId) {
          setPinnedFsId(msg.fsRef.fsId);
          return;
        }
      }
    }
  }, [promptState.running, promptState.blocks, pinnedFsId]);
  const blurPx = useMemo(() => {
    let b = 25;
    for (let i = 0; i < hotSwapCount; i++) b *= 2 / 3;
    return b;
  }, [hotSwapCount]);
  // 3 significant digits, e.g. "50.0", "36.5", "0.0200".
  const blurStr = blurPx.toPrecision(3);
  // The blur ramp only applies during the first codegen of a fresh chat.
  // The overlay itself (which captures clicks so the user can't interact
  // with a half-rendered app) renders whenever a stream is in flight —
  // ResultPreview hides the whole PreviewApp slot during the code-override
  // window, so this still no-ops when the iframe isn't actually visible.
  const showBlur = promptState.running && pinnedFsId === undefined && !firstStreamDone;
  const showOverlay = promptState.running;

  // Push owner identity into the iframe as soon as the runtime is ready.
  // render-vibe.ts omits viewerEnv for ?preview=yes (no Clerk session on the
  // HTTP path), so without this push can("write") would be false until the
  // bootstrapViewer WS roundtrip completes. Reads stored adminMode from
  // localStorage so a page reload with admin mode persisted sends the correct
  // access level immediately — "override" when admin on, "editor" when off.
  useEffect(() => {
    if (!srvVibeSandbox || !ownerHandle || !appSlug) return;
    return srvVibeSandbox.onRuntimeReady(() => {
      const storedAdmin = localStorage.getItem(adminModeStorageKey(ownerHandle, appSlug)) === "true";
      const msg: EvtVibeViewerChanged = {
        type: "vibe.evt.viewerChanged",
        viewer: null,
        access: storedAdmin ? "override" : "editor",
        isOwner: true,
      };
      srvVibeSandbox.pushViewerChanged(msg);
    }) as () => void;
  }, [srvVibeSandbox, ownerHandle, appSlug]);

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
        sandbox={RUNTIME_PREVIEW_IFRAME_SANDBOX}
        allow={RUNTIME_PREVIEW_IFRAME_ALLOW}
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
      {showOverlay && (
        <div
          aria-hidden="true"
          data-testid="preview-stream-overlay"
          className="absolute inset-0"
          style={
            showBlur && blurPx >= 0.01
              ? { backdropFilter: `blur(${blurStr}px)`, WebkitBackdropFilter: `blur(${blurStr}px)` }
              : {
                  // No active blur ramp (subsequent regens, or first codegen
                  // after the ramp decayed below 0.01px). Keep a faint
                  // animated stripe so the user still sees an "updating"
                  // affordance — fully transparent would land as silent
                  // unclickability and defeat the watermark intent.
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 12px, transparent 12px, transparent 24px)",
                  backgroundSize: "40px 40px",
                  animation: "moving-stripes 1s linear infinite",
                }
          }
        />
      )}
    </div>
  );
}
