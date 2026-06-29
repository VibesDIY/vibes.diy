import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Conn, LLMChatEntry } from "@vibes.diy/api-types";
import { isBlockEnd, isCodeEnd, isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import { promptReducer, type PromptState } from "../routes/chat/prompt-state.js";
import { useChatSession } from "./useChatSession.js";
import { getCode } from "../components/ResultPreview/get-code.js";
import { chipsFromNarration } from "./useLatestVibeChips.js";
import { shouldAcceptPrompt } from "../utils/submit-guard.js";
import { nextSaveState, isSaving as isSavingState, type SaveState } from "./save-state.js";
import { normalizeCodeViewPath, inferCodeViewLanguage } from "../components/ResultPreview/code-view-files.js";

export type GenerationPhase = "idle" | "streaming" | "live";

export interface InVibeGeneration {
  readonly phase: GenerationPhase;
  // True while a prompt turn is in flight and NOT yet settled — i.e. from
  // sendPrompt until block-end, which is LATER than `phase` leaving "streaming"
  // (phase flips to "live" at the first code.end, but the turn keeps running).
  // Publish must gate on this, not on phase, so an owner can't ship a partial
  // turn (later dev writes from the same runId would be dropped). (#2772 D2)
  readonly isGenerating: boolean;
  readonly blocks: PromptState["blocks"];
  readonly blurPx: number;
  readonly counts: { readonly messages: number; readonly lines: number };
  // The trailing `▸` suggestion chips parsed from the LATEST streamed block —
  // the model's fresh follow-up options for the edit just made. Empty until a
  // turn has produced narration. The /vibe card prefers these over the stale
  // persisted-chat chips once an in-place edit has run, so the card never
  // re-shows the pre-edit suggestions after a generation. (vibe-tour-chips-edit)
  readonly suggestionChips: readonly string[];
  // True once a prompt has been sent LOCALLY this session for the current vibe
  // (reset on vibe change). Distinct from `blocks.length > 0`, which also goes
  // true from replayed chat history on open — so the card gates "prefer the
  // streamed chips" on this, not on the mere presence of blocks, to avoid
  // overriding fsId-scoped persisted chips on a versioned view. (Charlie review)
  readonly hasLocalEdit: boolean;
  // The vibe-scoped fsRef carried by the latest canonical POST-PERSIST `block.end`
  // (BlockEndMsg with an fsRef). This is the durable signal an in-place edit has
  // settled server-side — distinct from `isGenerating` falling, which is driven by the
  // EARLY `prompt.block-end` (before the R2/DB persist; prompt-state.ts §block-end).
  // Re-resolving owner-draft state on this (not on the early flag) avoids reading a
  // stale `ownerLatest` row before the new draft is durable (#2839 review). Carries the
  // FULL identity (ownerHandle/appSlug/fsId) — not just fsId — because storage is
  // content-addressed and a fork SHARES the source's fsId (fork-app.ts), so fsId alone
  // can't tell two vibes apart. undefined until a turn produces a persisted block.end.
  readonly persistedFsRef: { readonly ownerHandle: string; readonly appSlug: string; readonly fsId: string } | undefined;
  readonly sendPrompt: (text: string) => void;
  // Open the codegen chat lazily, on the owner's first edit intent. The host
  // calls this when the edit UI (the UnifiedVibeCard) opens, so passive
  // browsing of one's own vibe never establishes a codegen connection — the
  // chat opens on first interaction, not on /vibe mount. Idempotent: a no-op
  // once already active. sendPrompt also activates, covering the fork
  // auto-fire path where the card never opens. (#2761)
  readonly activate: () => void;
  // Persist a hand-edited code buffer (Phase 2, #2518). Mirrors the /chat
  // Monaco save loop but RE-PINS instead of navigating: the new fsId is
  // resolved from the canonical post-persist block.end (persistedFsRef) and
  // reported via the host's onSavedFsId so the running app reloads to the saved
  // version with the URL unchanged. Queues until the lazy chat handle exists
  // and holds while a codegen turn is in flight (no interleaved promptFS).
  readonly saveCode: (args: { buffer: string; filePath: string; lang: string }) => void;
  // The manual-save lifecycle: idle | queued | saving | rebuilt | error.
  readonly saveState: SaveState;
  // True while a save is queued or in flight (queued | saving).
  readonly isSaving: boolean;
}

export interface UseInVibeGenerationOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly chatApi: Conn<"codegen">;
  readonly sharedApi: Conn<"shared">;
  // The hook only needs pushSource from the sandbox; accept the structural
  // subset so we don't depend on the concrete sandbox type. undefined-safe.
  readonly srvVibeSandbox: { pushSource(source: string): boolean } | undefined;
  // When false, the hook stays inert — no codegen chat is opened, regardless of
  // activation. Non-owners pass false to stay gated off. Owners pass true, but
  // even then the chat opens lazily (see `activate`), not on mount. Defaults to
  // treating an omitted flag as enabled.
  readonly enabled?: boolean;
  // Called when a manual save settles server-side, with the new fsId resolved
  // from the canonical post-persist block.end. The host wires this to
  // setDraftFsId so the running app re-pins (reloads) to the saved version
  // without navigating (the /vibe URL stays put — Phase 2, #2518). Memoize it.
  readonly onSavedFsId?: (fsId: string) => void;
}

function initialState(appSlug: string): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug,
    blocks: [],
    searchParams: new URLSearchParams(),
    // PromptState carries setSearchParams as structural baggage; the hook's
    // embedded context never navigates, so a no-op cast is safe.
    setSearchParams: (() => undefined) as never,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
  };
}

export function useInVibeGeneration(opts: UseInVibeGenerationOpts): InVibeGeneration {
  const { ownerHandle, appSlug, fsId, chatApi, sharedApi } = opts;
  const onSavedFsId = opts.onSavedFsId;
  const [promptState, dispatch] = useReducer(promptReducer, undefined, () => initialState(appSlug));
  const [promptToSend, sendPromptState] = useState<string | null>(null);
  const [hotSwapCount, setHotSwapCount] = useState(0);
  // Whether the user has started an in-place edit this session for this vibe.
  // Reset on vibe change alongside the reducer. Drives `hasLocalEdit`.
  const [hasLocalEdit, setHasLocalEdit] = useState(false);
  const seenByBlockIdRef = useRef<Map<string, number>>(new Map());

  // Lazy codegen open (#2761): an owner merely VIEWING their vibe must not open
  // a codegen chat. We stay inert (inConstruction → true) until the owner opens
  // the edit UI (activate) or fires a prompt (sendPrompt also activates). The
  // `enabled` flag still hard-gates non-owners off independent of activation.
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);

  // Manual code-save lifecycle (Phase 2, #2518). The pure machine lives in
  // save-state.ts; the refs below carry the async plumbing the reducer must not.
  const [saveState, dispatchSave] = useReducer(nextSaveState, "idle" as SaveState);
  // The buffer awaiting persistence — held until the lazy chat handle exists and
  // any in-flight codegen turn settles. Kept across an `error` so Retry resubmits
  // the SAME edit (no silent loss). Cleared only on a settled save.
  const pendingSaveRef = useRef<{ buffer: string; filePath: string; lang: string } | null>(null);
  // Re-entrancy latch so the flush effect submits a queued save exactly once.
  const submitInFlightRef = useRef(false);
  // promptId of the in-flight save, and whether its inFlightStreamId has reached
  // the reducer yet (so a not-yet-propagated id can't be mistaken for completion).
  const savePromptIdRef = useRef<string | null>(null);
  const sawSaveInflightRef = useRef(false);
  // persistedFsRef.fsId captured at submit time; a save completes when the
  // canonical post-persist block.end advances persistedFsRef PAST this baseline.
  const saveBaselineFsIdRef = useRef<string | undefined>(undefined);

  // Re-arm the lazy gate SYNCHRONOUSLY on a vibe-key change, mirroring
  // useChatSession's own render-phase slug guard. The slug-keyed reset effect
  // below also flips `active` false, but effects run after commit — and
  // useChatSession's open effect (registered before that reset effect) would
  // fire once on the first render of the newly-navigated vibe while `active` is
  // still the stale `true`, eagerly opening codegen on a passive cross-vibe
  // view. Setting state during render makes React restart this render with
  // `active=false` before committing, so the open effect sees inConstruction
  // true and stays inert until the owner edits the new vibe. (#2761, Codex P2)
  const activeVibeKeyRef = useRef(`${ownerHandle}/${appSlug}`);
  if (activeVibeKeyRef.current !== `${ownerHandle}/${appSlug}`) {
    activeVibeKeyRef.current = `${ownerHandle}/${appSlug}`;
    setActive(false);
  }

  // The /vibe iframe stays pinned to its own fsId and hot-swaps in place, so we
  // do NOT navigate on follow-ups (end-of-stream fsId settle is deferred). A
  // no-op keeps useChatSession's contract satisfied.
  const navigateToFsId = useCallback((_targetFsId?: string) => undefined, []);

  const { chat } = useChatSession({
    ownerHandle,
    appSlug,
    fsId,
    inConstruction: opts.enabled === false || !active,
    chatApi,
    sharedApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt: sendPromptState,
    navigateToFsId,
  });

  // Hot-swap the iframe whenever a new code.end lands in the latest block.
  // Mirrors PreviewApp's push effect (PreviewApp.tsx:77-126).
  useEffect(() => {
    if (opts.srvVibeSandbox === undefined) return;
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (last === undefined) return;
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
    // A manual code-save (promptFS) streams its saved file back as a code block
    // too, but a hand-edited full-file save must RELOAD via re-pin (setDraftFsId),
    // not hot-swap — Charlie's guardrail: never pushSource + re-pin on the same
    // manual-save event (#2866). Mark the block seen (above) so it can't push
    // later, but skip the push now; the save's block.end advances persistedFsRef
    // and the host re-pins. A non-null savePromptIdRef = a save is in flight.
    if (savePromptIdRef.current !== null) return;
    const resolved = getCode(promptState).code.join("\n");
    if (resolved.length < 200 || !resolved.includes("export default")) return;
    const ok = opts.srvVibeSandbox.pushSource(resolved);
    if (ok) setHotSwapCount((c) => c + 1);
  }, [promptState.blocks, opts.srvVibeSandbox]);

  // Reset all generation state when the route is reused for a different vibe
  // (client-side nav between /vibe pages). The reducer initializer runs only on
  // first mount, so without this the reducer keeps the previous vibe's blocks —
  // firstCodeDone/getCode would resolve against the old app and the next edit
  // could push stale source into the freshly-loaded iframe. Mirrors the chat
  // route's slug-keyed clearChat effect, plus the hook's own hot-swap/blur state.
  const prevVibeKeyRef = useRef(`${ownerHandle}/${appSlug}`);
  useEffect(() => {
    const key = `${ownerHandle}/${appSlug}`;
    if (key === prevVibeKeyRef.current) return;
    prevVibeKeyRef.current = key;
    dispatch({ type: "clearChat", appSlug });
    seenByBlockIdRef.current.clear();
    setHotSwapCount(0);
    setHasLocalEdit(false);
    sendPromptState(null);
    // Drop any pending or in-flight manual save so it can't settle against the
    // newly-loaded vibe (re-pinning the wrong app to a stale fsId).
    dispatchSave({ type: "reset" });
    pendingSaveRef.current = null;
    submitInFlightRef.current = false;
    savePromptIdRef.current = null;
    sawSaveInflightRef.current = false;
    saveBaselineFsIdRef.current = undefined;
    // Note: re-arming the lazy `active` gate happens synchronously during render
    // (the activeVibeKeyRef guard above), not here — an effect would run too late
    // to stop useChatSession's open effect firing once on the new vibe. (#2761)
  }, [ownerHandle, appSlug]);

  // 'streaming' once a turn is running and before any completed code block;
  // 'live' once the first code.end has landed (subsequent edits keep us 'live'
  // and hot-swap in place); else 'idle'.
  const firstCodeDone = useMemo(() => promptState.blocks.some((b) => b.msgs.some((m) => isCodeEnd(m))), [promptState.blocks]);
  const phase: GenerationPhase = firstCodeDone ? "live" : promptState.running || promptToSend !== null ? "streaming" : "idle";

  // Reject a new prompt while a turn is already in flight. Chips/Other re-enable
  // at phase "live" (first code.end), but the previous turn can still be running
  // until block-end — a second chat.prompt() would interleave into the single
  // reducer block. Mirrors the chat surface's shouldAcceptPrompt guard. Read via
  // a ref so sendPrompt stays referentially stable (no callback churn).
  const inFlightRef = useRef(false);
  inFlightRef.current =
    promptState.running || promptToSend !== null || promptState.optimisticPrompt !== undefined || isSavingState(saveState);
  const sendPrompt = useCallback((text: string) => {
    if (!shouldAcceptPrompt({ text, submitting: inFlightRef.current, running: false })) return;
    // A programmatic send (e.g. the fork auto-fire that never opens the edit UI)
    // must still bring the codegen chat up — opening is lazy now (#2761).
    setActive(true);
    setHasLocalEdit(true);
    sendPromptState(text.trim());
  }, []);

  // A turn is in flight until block-end settles the reducer (running back to
  // false). This is the same predicate the in-flight guard + blur ramp use; it
  // stays true through the "live" phase, so publish can wait for full settle.
  const isGenerating = promptState.running || promptToSend !== null || promptState.optimisticPrompt !== undefined;

  const blurPx = useMemo(() => {
    let b = 25;
    for (let i = 0; i < hotSwapCount; i++) b *= 2 / 3;
    return isGenerating ? b : 0;
  }, [hotSwapCount, isGenerating]);

  const counts = useMemo(() => ({ messages: promptState.blocks.length, lines: getCode(promptState).code.length }), [promptState]);

  // Fresh follow-up chips for THIS edit: parse the trailing `▸` options out of
  // the latest streamed block's toplevel narration (same shaping the chat read
  // applies). Source from the in-memory block, so there's no server re-read race
  // after the turn settles.
  const suggestionChips = useMemo(() => {
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (last === undefined) return [];
    const text = last.msgs
      .filter((m): m is ToplevelLineMsg => isToplevelLine(m))
      .map((m) => m.line)
      .join("\n");
    return chipsFromNarration(text);
  }, [promptState.blocks]);

  // The vibe-scoped fsRef of the most recent canonical post-persist `block.end` (the
  // convergence event that carries fsRef once the server has persisted the turn).
  // Scanning newest-first stops at the latest settled edit. Used by the host to
  // re-resolve the owner-draft badge AFTER the persist, sidestepping the
  // early-`prompt.block-end` race the in-flight flag would otherwise expose. Returns
  // the full identity so the host can distinguish vibes that share an fsId (forks).
  const persistedFsRef = useMemo(() => {
    for (let i = promptState.blocks.length - 1; i >= 0; i--) {
      const msgs = promptState.blocks[i].msgs;
      for (let j = msgs.length - 1; j >= 0; j--) {
        const msg = msgs[j];
        if (isBlockEnd(msg) && msg.fsRef) {
          return { ownerHandle: msg.fsRef.ownerHandle, appSlug: msg.fsRef.appSlug, fsId: msg.fsRef.fsId };
        }
      }
    }
    return undefined;
  }, [promptState.blocks]);

  // Record a save intent and bring up the lazy chat. The actual promptFS is
  // deferred to the flush effect — `activate()` only flips state; useChatSession
  // opens the LLMChat in a later effect, so `chat` is null in this same tick
  // (Codex #2). Stash the buffer and let the flush effect submit it once the
  // handle exists. Referentially stable (dispatchSave/setActive are stable).
  const saveCode = useCallback((args: { buffer: string; filePath: string; lang: string }) => {
    pendingSaveRef.current = args;
    dispatchSave({ type: "request" });
    setActive(true);
  }, []);

  // Flush a queued save once the chat handle exists and no codegen turn is in
  // flight (interleaving guard — a manual save never races a generation's
  // promptFS into the single reducer block). Submits exactly once via the
  // re-entrancy latch; on submit we register the promptId so the matching
  // post-persist block.end settles connection in the reducer (parity with /chat).
  useEffect(() => {
    if (saveState !== "queued" || submitInFlightRef.current) return;
    const pending = pendingSaveRef.current;
    if (!pending || chat === null || isGenerating) return;
    submitInFlightRef.current = true;
    const filename = normalizeCodeViewPath(pending.filePath || "/App.jsx");
    const lang = pending.lang || inferCodeViewLanguage(filename, "text/javascript");
    saveBaselineFsIdRef.current = persistedFsRef?.fsId;
    sawSaveInflightRef.current = false;
    chat
      .promptFS({ update: [{ type: "code-block", filename, lang, content: pending.buffer }], remove: [] })
      .then((r) => {
        submitInFlightRef.current = false;
        if (r.isErr()) {
          console.error("saveCode promptFS failed", r.Err());
          dispatchSave({ type: "failed" });
          return;
        }
        savePromptIdRef.current = r.Ok().promptId;
        dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
        dispatchSave({ type: "submitted" });
      })
      .catch((err: unknown) => {
        submitInFlightRef.current = false;
        console.error("saveCode promptFS threw", err);
        dispatchSave({ type: "failed" });
      });
  }, [saveState, chat, isGenerating, persistedFsRef]);

  // Settle a submitted save. Success = the canonical post-persist block.end
  // advances persistedFsRef PAST the pre-save baseline → re-pin via onSavedFsId
  // (the host's setDraftFsId). If inFlightStreamId instead clears with no new
  // fsId (a stream error, or a no-op same-content save), fall back to `error` so
  // the UI never wedges on "Saving…" and the buffer is kept for Retry.
  useEffect(() => {
    if (saveState !== "saving" || savePromptIdRef.current === null) return;
    if (persistedFsRef?.fsId && persistedFsRef.fsId !== saveBaselineFsIdRef.current) {
      const settledFsId = persistedFsRef.fsId;
      dispatchSave({ type: "settled" });
      pendingSaveRef.current = null;
      savePromptIdRef.current = null;
      sawSaveInflightRef.current = false;
      onSavedFsId?.(settledFsId);
      return;
    }
    // Note our promptId reached the reducer before reading a cleared id as done.
    if (promptState.inFlightStreamId === savePromptIdRef.current) {
      sawSaveInflightRef.current = true;
      return;
    }
    if (sawSaveInflightRef.current && promptState.inFlightStreamId === undefined) {
      dispatchSave({ type: "failed" }); // keep pendingSaveRef for Retry
      savePromptIdRef.current = null;
      sawSaveInflightRef.current = false;
    }
  }, [saveState, persistedFsRef, promptState.inFlightStreamId, onSavedFsId]);

  return {
    phase,
    isGenerating,
    blocks: promptState.blocks,
    blurPx,
    counts,
    suggestionChips,
    hasLocalEdit,
    persistedFsRef,
    sendPrompt,
    activate,
    saveCode,
    saveState,
    isSaving: isSavingState(saveState),
  };
}
