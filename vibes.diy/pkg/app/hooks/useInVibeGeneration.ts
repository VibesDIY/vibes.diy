import { useCallback, useMemo, useReducer, useState } from "react";
import type { Conn, LLMChatEntry } from "@vibes.diy/api-types";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import { promptReducer, type PromptState } from "../routes/chat/prompt-state.js";
import { useChatSession } from "./useChatSession.js";

export type GenerationPhase = "idle" | "streaming" | "live";

export interface InVibeGeneration {
  readonly phase: GenerationPhase;
  readonly blocks: PromptState["blocks"];
  readonly blurPx: number;
  readonly counts: { readonly messages: number; readonly lines: number };
  readonly sendPrompt: (text: string) => void;
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

  // The /vibe iframe stays pinned to its own fsId and hot-swaps in place, so we
  // do NOT navigate on follow-ups (end-of-stream fsId settle is deferred). A
  // no-op keeps useChatSession's contract satisfied.
  const navigateToFsId = useCallback((_targetFsId?: string) => undefined, []);

  useChatSession({
    ownerHandle,
    appSlug,
    fsId,
    inConstruction: false,
    chatApi,
    sharedApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt: sendPromptState,
    navigateToFsId,
  });

  // 'streaming' once a turn is running and before any completed code block;
  // 'live' once the first code.end has landed (subsequent edits keep us 'live'
  // and hot-swap in place); else 'idle'.
  const firstCodeDone = useMemo(
    () => promptState.blocks.some((b) => b.msgs.some((m) => isCodeEnd(m))),
    [promptState.blocks]
  );
  const phase: GenerationPhase = firstCodeDone
    ? "live"
    : promptState.running || promptToSend !== null
      ? "streaming"
      : "idle";

  const sendPrompt = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) sendPromptState(trimmed);
  }, []);

  return {
    phase,
    blocks: promptState.blocks,
    blurPx: 0, // wired in a later task
    counts: { messages: promptState.blocks.length, lines: 0 }, // lines wired in a later task
    sendPrompt,
  };
}
