import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import { processStream } from "@adviser/cement";
import { type } from "arktype";
import { sectionEvent, isResError, SHARD_OVERLOADED_CODE } from "@vibes.diy/api-types";
import type { Conn, LLMChat } from "@vibes.diy/api-types";
import { getThemeBySlug } from "@vibes.diy/prompts";
import { useStreamWatchdog } from "./useStreamWatchdog.js";
import { useReconnectLoop } from "./useReconnectLoop.js";
import { notifyRecentVibesChanged } from "./useRecentVibes.js";
import type { PromptState, PromptAction } from "../routes/chat/prompt-state.js";
import type { ChatNavigation } from "./useChatNavigation.js";

export interface ChatSessionOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly inConstruction: boolean;
  readonly chatApi: Conn<"codegen">;
  readonly sharedApi: Conn<"shared">;
  readonly promptState: PromptState;
  readonly dispatch: Dispatch<PromptAction>;
  readonly promptToSend: string | null;
  readonly sendPrompt: (value: string | null) => void;
  readonly navigateToFsId: ChatNavigation["navigateToFsId"];
  /**
   * Called when a fired prompt settles: `true` once the server accepts the
   * send, `false` on any failure path (open error, send error, throw). Lets
   * the route's submit guard release `submitting` / resolve the pending submit
   * promise so the composer never stays wedged on a failed send.
   */
  readonly onSendSettled?: (ok: boolean) => void;
}

export interface ChatSession {
  readonly chat: LLMChat | null;
  /**
   * Tear down the current chat handle and re-arm the open-once latch so a later
   * prompt re-opens a FRESH chat (whose open replay rebuilds `blocks` from the
   * persisted truth). Used by the edit-card Stop button to cancel an in-flight
   * turn without leaving a half-open codegen session: the section stream is
   * fenced (so its teardown can't drive the reducer) and the socket is closed.
   * The caller is expected to settle the reducer (`abortTurn`) and, when lazy,
   * flip itself inactive so the open effect doesn't eagerly re-open.
   */
  readonly resetChat: () => void;
}

/**
 * Single owner of the chat handle and its lifecycle: opening the chat, firing
 * queued prompts, the section-stream attach, app-settings refresh, the
 * reconnect/watchdog loops, and the loop-guard refs (openingRef/prevSlugsRef/
 * fsIdRef). Behavior-preserving extraction from the Chat component
 * (VibesDIY/vibes.diy#2015). See the design spec for the invariants and the
 * known unmount cleanup quirk (the live handle is intentionally NOT closed on
 * unmount — a latent leak preserved here and fixed in a follow-up).
 */
export function useChatSession(opts: ChatSessionOpts): ChatSession {
  const {
    ownerHandle,
    appSlug,
    fsId,
    inConstruction,
    chatApi,
    sharedApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt,
    navigateToFsId,
    onSendSettled,
  } = opts;

  const [chat, setChat] = useState<LLMChat | null>(null);

  // Open-once latch, reset when the slug pair changes so cross-vibe nav re-opens.
  const openingRef = useRef(false);
  const prevSlugsRef = useRef(`${ownerHandle}/${appSlug}`);
  if (`${ownerHandle}/${appSlug}` !== prevSlugsRef.current) {
    openingRef.current = false;
    prevSlugsRef.current = `${ownerHandle}/${appSlug}`;
  }

  // Hold latest fsId in a ref so the prompt-firing effect can preserve it in
  // the navigation URL without retriggering on every autosave fsId change
  // (which would re-fire the same prompt — classic loop).
  const fsIdRef = useRef<string | undefined>(fsId);
  fsIdRef.current = fsId;

  // The chat handle whose section stream is currently feeding the reducer.
  // Tracked so a reconnect can tear down the stream it supersedes (the
  // reconnect loop only closes its own prior *attempt*, not the original
  // pre-reconnect chat).
  const activeChatRef = useRef<LLMChat | null>(null);

  // Monotonic attach generation. Only the most-recently-attached section
  // stream may feed the reducer. The watchdog flips to "reconnecting" on a
  // *silent* turn even when the socket is still half-open (laggy connection);
  // the reconnect loop then attaches a fresh stream while the original is
  // still alive. If that original later flushes its buffered bytes — or the
  // server keeps emitting the in-flight turn on the old tid — its blocks would
  // interleave with the new stream's into the same reducer, with no dedup,
  // duplicating prompts, code lines, and option chips. Fencing on generation
  // makes that structurally impossible: a superseded stream's events are
  // dropped instead of merged.
  const streamGenerationRef = useRef(0);

  // Open epoch. Each `resetChat()` (cancel) bumps this; a pending `openChat()`
  // captures it at call time and bails (closing the just-opened socket) if it's
  // been superseded by then. Without this, a Stop clicked while a prompt-driven
  // open is still in flight would let the late `.then` attach a chat + section
  // stream we've already cancelled — leaking the socket and even feeding the
  // dead turn's stream back into the reducer.
  const openSeqRef = useRef(0);

  // Holds a prompt that hit `shard-overloaded` and was rolled to the next shard.
  // The reconnect loop reopens the chat on that shard, then re-fires this prompt
  // (handleReconnectAttempt) — NOT via promptToSend, which could race the old
  // (closed) chat handle before reconnect replaces it. (Charlie review, #2829)
  const retryPromptRef = useRef<string | null>(null);

  const attachSectionStream = useCallback(
    (chatHandle: LLMChat) => {
      const myGeneration = (streamGenerationRef.current += 1);
      const isActiveStream = () => myGeneration === streamGenerationRef.current;
      processStream(chatHandle.sectionStream, (msg) => {
        // A later attach has superseded this stream — drop its events so they
        // can't double up with the active stream's.
        if (!isActiveStream()) return;
        const se = sectionEvent(msg);
        if (se instanceof type.errors) {
          console.error(se.summary);
          return;
        }
        for (const block of se.blocks) {
          dispatch(block);
        }
      })
        .catch((err: unknown) => {
          console.error("section stream errored", err);
        })
        .finally(() => {
          // Stream ended (transport loss closes it as of #2334). The reducer
          // ignores this while idle; mid-prompt it starts the reconnect loop.
          // A superseded stream ending is not *our* disconnect — its successor
          // is already live — so don't let it (re)start the reconnect loop.
          if (!isActiveStream()) return;
          dispatch({ type: "streamDisconnected" });
        });
    },
    [dispatch]
  );

  const refreshAppSettings = useCallback(() => {
    sharedApi.ensureAppSettings({ ownerHandle, appSlug }).then((rS) => {
      if (rS.isOk()) {
        const s = rS.Ok().settings.entry.settings;
        if (s.title) dispatch({ type: "setTitle", title: s.title });
        if (s.icon) dispatch({ type: "setIcon", icon: s.icon });
        if (s.theme) {
          const t = getThemeBySlug(s.theme);
          if (t) dispatch({ type: "setTheme", theme: t });
        }
        if (s.colorTheme) {
          dispatch({ type: "setColorTheme", colorTheme: s.colorTheme });
        }
      }
    });
  }, [sharedApi, ownerHandle, appSlug, dispatch]);

  const handleStreamSilent = useCallback(() => dispatch({ type: "streamDisconnected" }), [dispatch]);
  useStreamWatchdog({
    running: promptState.running,
    connection: promptState.connection,
    activityKey: promptState.blocks,
    onSilent: handleStreamSilent,
  });

  const openChatForReconnect = useCallback(async () => {
    const r = await chatApi.openChat({ ownerHandle, appSlug, mode: "codegen" });
    if (r.isErr()) {
      console.error("reconnect openChat failed", r.Err());
      return null;
    }
    return r.Ok();
  }, [chatApi, ownerHandle, appSlug]);

  // Fire a prompt on a specific chat handle, with codegen admission-roll recovery.
  // On `shard-overloaded` the api has already rolled to the next shard in the
  // user's family (rollCodegenShard) and dropped the old socket; we stash the
  // prompt and force a reconnect so the chat reopens on the rolled shard and the
  // reconnect loop re-fires it. rollCodegenShard() returns false at MAX_ROLL_INDEX
  // (or when not rollable), so we then surface the error instead of looping.
  const firePrompt = useCallback(
    (chatHandle: LLMChat, text: string) => {
      dispatch({ type: "setOptimisticPrompt", text });
      chatHandle
        .prompt({ messages: [{ role: "user", content: [{ type: "text", text }] }] })
        .then((r) => {
          if (r.isErr()) {
            const err = r.Err();
            if (isResError(err) && err.error.code === SHARD_OVERLOADED_CODE && chatApi.rollCodegenShard()) {
              // Keep the optimistic bubble visible through the brief roll; the
              // retry replaces it. Leave `submitting` latched (no onSendSettled).
              retryPromptRef.current = text;
              dispatch({ type: "rollReconnect" });
              return;
            }
            console.error(`PromptSend failed`, err);
            dispatch({ type: "setOptimisticPrompt", text: undefined });
            onSendSettled?.(false);
          } else {
            dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
            notifyRecentVibesChanged();
            onSendSettled?.(true);
          }
        })
        .catch((err: unknown) => {
          console.error(`PromptSend threw`, err);
          dispatch({ type: "setOptimisticPrompt", text: undefined });
          onSendSettled?.(false);
        });
    },
    [chatApi, dispatch, onSendSettled]
  );

  const handleReconnectAttempt = useCallback(
    (newChat: LLMChat) => {
      // Tear down the stream we're superseding before replaying onto a fresh
      // one. Without this the original (possibly still-alive, just-silent)
      // chat keeps its socket subscription open and its processStream draining
      // forever. The generation fence already stops its events from reaching
      // the reducer; closing it stops the leak at the source.
      void activeChatRef.current?.close();
      activeChatRef.current = newChat;
      dispatch({ type: "replayReset" });
      setChat(newChat);
      dispatch({ type: "initChat", chat: newChat });
      attachSectionStream(newChat);
      refreshAppSettings();
      // Overload-roll retry: now that the chat is reopened on the rolled shard
      // (with chat context bound), fire the stashed prompt here — exactly once
      // (the ref is cleared), so later reconnect attempts replay rather than
      // re-send.
      const retry = retryPromptRef.current;
      if (retry !== null) {
        retryPromptRef.current = null;
        firePrompt(newChat, retry);
      }
    },
    [attachSectionStream, refreshAppSettings, dispatch, firePrompt]
  );

  const handleReconnectGiveUp = useCallback(() => {
    // If a rolled prompt was waiting to retry and reconnect gave up, release the
    // submit guard so the composer doesn't wedge (the retry never landed).
    if (retryPromptRef.current !== null) {
      retryPromptRef.current = null;
      onSendSettled?.(false);
    }
    dispatch({ type: "reconnectFailed" });
  }, [dispatch, onSendSettled]);

  useReconnectLoop({
    connection: promptState.connection,
    openChat: openChatForReconnect,
    onAttempt: handleReconnectAttempt,
    onGiveUp: handleReconnectGiveUp,
  });

  // Cancel the live chat: fence the current section stream (so its teardown +
  // any late events are dropped instead of reaching the reducer), close the
  // socket, and re-arm the open-once latch + drop the handle so the NEXT prompt
  // opens a fresh chat. Bumping the generation BEFORE close() means the stream's
  // `finally` sees itself superseded and won't dispatch `streamDisconnected`
  // (which would otherwise flip us into the reconnect loop we're trying to end).
  // Identity-stable: reads/writes only refs + setChat.
  const resetChat = useCallback(() => {
    streamGenerationRef.current += 1;
    // Invalidate any in-flight openChat() so its late `.then` closes + bails
    // instead of attaching a chat we've cancelled.
    openSeqRef.current += 1;
    void activeChatRef.current?.close();
    activeChatRef.current = null;
    retryPromptRef.current = null;
    openingRef.current = false;
    setChat(null);
  }, []);

  useEffect(() => {
    if (inConstruction) return;
    if (openingRef.current) {
      if (chat && promptToSend?.trim().length) {
        // Default to preview so the user sees the iframe hot-swap as edits
        // stream. Preserve fsId on follow-ups; read it from the ref so future
        // autosave-driven fsId changes don't re-trigger this effect with the
        // same promptToSend (loop bug).
        navigateToFsId(fsIdRef.current);
        const sentPrompt = promptToSend;
        // Clear promptToSend BEFORE firing so any re-render of this effect
        // (e.g. searchParams change) sees null and skips the branch.
        sendPrompt(null);
        // Fire on the current chat handle. firePrompt shows the optimistic bubble
        // (#2352), settles the submit guard, and handles shard-overloaded rolls.
        firePrompt(chat, sentPrompt);
      }
      return; // Already opened or opening
    }
    openingRef.current = true;
    const mySeq = openSeqRef.current;
    chatApi.openChat({ ownerHandle, appSlug, mode: "codegen" }).then((rChat) => {
      // A resetChat() (cancel) superseded this open while it was in flight — close
      // the freshly-opened socket and bail, so we neither leak it nor attach its
      // stream to the reducer after the turn was cancelled.
      if (openSeqRef.current !== mySeq) {
        if (rChat.isOk()) void rChat.Ok().close();
        return;
      }
      if (rChat.isErr()) {
        console.error("CHAT-Error", rChat.Err(), ownerHandle, appSlug);
        onSendSettled?.(false);
        return;
      }
      activeChatRef.current = rChat.Ok();
      setChat(rChat.Ok());
      dispatch({ type: "initChat", chat: rChat.Ok() });
      refreshAppSettings();
      attachSectionStream(rChat.Ok());
      // For CLI-pushed apps with no chat history, look up the latest fsId
      if (!fsId) {
        sharedApi.getAppByFsId({ appSlug, ownerHandle }).then((rApp) => {
          if (rApp.isOk() && rApp.Ok().fsId) {
            navigateToFsId(rApp.Ok().fsId);
          }
        });
      }
    });
    return () => {
      if (chat) {
        (chat as LLMChat).close();
      }
    };
    // The self-referential `chat` dependency is what flips this effect from the
    // open path to the fire path. `onSendSettled` is identity-stable in the
    // route (memoized), so listing it here does not re-fire the effect.
    // `inConstruction` is listed so a lazy host (useInVibeGeneration, #2761)
    // that flips it false on first edit re-runs this effect and opens the chat;
    // in the /chat route it's constant per mount, so it adds no extra runs.
  }, [ownerHandle, appSlug, chat, openingRef, chatApi, sharedApi, promptToSend, onSendSettled, inConstruction, firePrompt]);

  return { chat, resetChat };
}
