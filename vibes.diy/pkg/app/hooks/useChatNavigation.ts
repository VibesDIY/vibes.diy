import { useCallback, useEffect, useRef } from "react";
import type { NavigateFunction } from "react-router";
import { isBlockEnd } from "@vibes.diy/call-ai-v2";
import type { PromptState } from "../routes/chat/prompt-state.js";

export interface ChatNavigationOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly promptState: PromptState;
  readonly searchParams: URLSearchParams;
  readonly navigate: NavigateFunction;
}

export interface ChatNavigation {
  // Single owner of "navigate to fsId": rebuilds the search params, defaults
  // the view to preview (so the user sees the iframe hot-swap as edits stream),
  // and replace-navigates. Pass `ensureView: false` to leave the view param
  // untouched. A nullish fsId targets the slug root (used while a brand-new
  // vibe has no fsId yet).
  readonly navigateToFsId: (targetFsId: string | undefined, opts?: { ensureView?: boolean }) => void;
  // Record the promptId of an in-flight manual code save. When its block.end
  // arrives the post-save effect navigates to the freshly-created fsId.
  readonly onSaveQueued: (promptId: string) => void;
}

/**
 * Owns every "navigate to fsId" path on the chat route. Centralizes the four
 * previously-duplicated `navigate(..., { replace: true })` call sites behind a
 * single `navigateToFsId` helper, and hosts the two block-scanning navigation
 * effects (post-save and first-paint) plus their guard refs so the navigation
 * behavior lives in one testable place.
 *
 * Behavior-preserving extraction of the logic formerly inlined in the Chat
 * component — see VibesDIY/vibes.diy#2015.
 */
export function useChatNavigation(opts: ChatNavigationOpts): ChatNavigation {
  const { ownerHandle, appSlug, fsId, promptState, searchParams, navigate } = opts;

  // Pending manual-save promptId — set when a code save is queued, consumed by
  // the post-save effect once the matching block.end (with fsRef) arrives.
  const pendingSavePromptIdRef = useRef<string | null>(null);
  // First-paint dedupe latch + running-edge detector. lastNavigatedFsIdRef
  // seeds from the URL fsId so reloading an old chat doesn't re-navigate.
  const lastNavigatedFsIdRef = useRef<string | undefined>(fsId);
  const navWasRunningRef = useRef(false);
  // Armed by the running:true→false edge of a LIVE turn; consumed when that
  // turn's fsRef arrives. Decouples "generation done" from "fsId persisted":
  // `running` now flips on the early prompt.block-end, before the canonical
  // block.end (with fsRef) lands (VibesDIY/vibes.diy#2472).
  const navArmedRef = useRef(false);

  // NOTE: intentionally NOT memoized. Each render captures the current
  // searchParams/navigate, matching the former inline `new URLSearchParams(
  // searchParams)` closures exactly. Callers in effects depend on
  // searchParams/navigate themselves, so they re-run (and re-capture) when
  // those change; the prompt-fire effect deliberately does not, preserving the
  // prior stale-searchParams-on-fire behavior.
  const navigateToFsId = (targetFsId: string | undefined, { ensureView = true }: { ensureView?: boolean } = {}) => {
    const sp = new URLSearchParams(searchParams);
    if (ensureView && !sp.has("view")) {
      sp.set("view", "preview");
    }
    const pathname = targetFsId ? `/chat/${ownerHandle}/${appSlug}/${targetFsId}` : `/chat/${ownerHandle}/${appSlug}`;
    navigate({ pathname, search: sp.toString() }, { replace: true });
  };

  const onSaveQueued = useCallback((promptId: string) => {
    pendingSavePromptIdRef.current = promptId;
  }, []);

  // Navigate to the new fsId after a manual save by watching promptState for
  // the block.end matching the save's promptId.
  useEffect(() => {
    if (!pendingSavePromptIdRef.current) return;
    const targetPromptId = pendingSavePromptIdRef.current;
    for (const block of [...promptState.blocks].reverse()) {
      for (const msg of block.msgs) {
        if (isBlockEnd(msg) && msg.streamId === targetPromptId && msg.fsRef) {
          pendingSavePromptIdRef.current = null;
          console.log(`[CodeSave] navigating to new fsId: ${msg.fsRef.fsId} (promptId: ${targetPromptId})`);
          navigateToFsId(msg.fsRef.fsId);
          return;
        }
      }
    }
    // Dep array matches the original inline effect; navigateToFsId is a
    // per-render closure capturing the current searchParams/navigate.
  }, [promptState.blocks, searchParams, navigate, ownerHandle, appSlug, fsId]);

  // Clear the pending save when switching chats so a stale promptId can't
  // hijack the next chat's navigation.
  useEffect(() => {
    pendingSavePromptIdRef.current = null;
  }, [ownerHandle, appSlug]);

  // Brand-new app first-paint: when the server persists the first (create-only)
  // scaffold block it emits block.end with fsRef.fsId. If we still have no fsId
  // in the URL, navigate to it so the iframe can load immediately rather than
  // waiting for end-of-turn autosave (which only fires for SEARCH/REPLACE
  // turns). The server-side resolver merges and persists App.jsx on each LLM
  // turn's block.end and stamps fsRef on that block, so at end-of-stream we
  // point the URL at the most recent fsRef.
  //
  // The running:true→false edge ARMS navigation; we navigate when the in-flight
  // turn's fsRef arrives — which, since prompt.block-end is emitted early, is
  // typically a render or two AFTER the edge (#2472). Arming (rather than firing
  // on the edge) preserves the historical-fsId guard: the initial server-replay
  // of an old chat carries block.end-with-fsRef but NO prompt.block-end, so
  // `running` never goes true→false on replay → never armed → no navigation
  // (#1972). lastNavigatedFsIdRef (seeded from the URL fsId) dedupes, so a stale
  // fsRef from a prior turn doesn't consume the arm — we wait for the new one.
  useEffect(() => {
    const justEnded = navWasRunningRef.current && !promptState.running;
    navWasRunningRef.current = promptState.running;
    if (justEnded) navArmedRef.current = true;
    if (!navArmedRef.current) return;
    for (let i = promptState.blocks.length - 1; i >= 0; i -= 1) {
      const block = promptState.blocks[i];
      for (const msg of block.msgs) {
        if (isBlockEnd(msg) && msg.fsRef) {
          // Most-recent fsRef. If it's stale (already navigated) stay armed and
          // wait for the new turn's; otherwise navigate and consume the arm.
          const newFsId = msg.fsRef.fsId;
          if (newFsId !== lastNavigatedFsIdRef.current) {
            lastNavigatedFsIdRef.current = newFsId;
            navArmedRef.current = false;
            navigateToFsId(newFsId);
          }
          return;
        }
      }
    }
    // Dep array matches the original inline effect; navigateToFsId is a
    // per-render closure capturing the current searchParams/navigate.
  }, [promptState.running, promptState.blocks, searchParams, navigate, ownerHandle, appSlug]);

  return { navigateToFsId, onSaveQueued };
}
