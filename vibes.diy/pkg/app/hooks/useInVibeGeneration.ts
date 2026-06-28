import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Conn, LLMChatEntry } from "@vibes.diy/api-types";
import { isCodeEnd, isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import { promptReducer, type PromptState } from "../routes/chat/prompt-state.js";
import { useChatSession } from "./useChatSession.js";
import { getCode } from "../components/ResultPreview/get-code.js";
import { chipsFromNarration } from "./useLatestVibeChips.js";
import { shouldAcceptPrompt } from "../utils/submit-guard.js";

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
  readonly sendPrompt: (text: string) => void;
  // Open the codegen chat lazily, on the owner's first edit intent. The host
  // calls this when the edit UI (the UnifiedVibeCard) opens, so passive
  // browsing of one's own vibe never establishes a codegen connection — the
  // chat opens on first interaction, not on /vibe mount. Idempotent: a no-op
  // once already active. sendPrompt also activates, covering the fork
  // auto-fire path where the card never opens. (#2761)
  readonly activate: () => void;
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
  const [promptState, dispatch] = useReducer(promptReducer, undefined, () => initialState(appSlug));
  const [promptToSend, sendPromptState] = useState<string | null>(null);
  const [hotSwapCount, setHotSwapCount] = useState(0);
  const seenByBlockIdRef = useRef<Map<string, number>>(new Map());

  // Lazy codegen open (#2761): an owner merely VIEWING their vibe must not open
  // a codegen chat. We stay inert (inConstruction → true) until the owner opens
  // the edit UI (activate) or fires a prompt (sendPrompt also activates). The
  // `enabled` flag still hard-gates non-owners off independent of activation.
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);

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

  useChatSession({
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
    sendPromptState(null);
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
  inFlightRef.current = promptState.running || promptToSend !== null || promptState.optimisticPrompt !== undefined;
  const sendPrompt = useCallback((text: string) => {
    if (!shouldAcceptPrompt({ text, submitting: inFlightRef.current, running: false })) return;
    // A programmatic send (e.g. the fork auto-fire that never opens the edit UI)
    // must still bring the codegen chat up — opening is lazy now (#2761).
    setActive(true);
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

  return {
    phase,
    isGenerating,
    blocks: promptState.blocks,
    blurPx,
    counts,
    suggestionChips,
    sendPrompt,
    activate,
  };
}
