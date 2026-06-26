import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import { processStream } from "@adviser/cement";
import { type } from "arktype";
import { sectionEvent } from "@vibes.diy/api-types";
import type { LLMChat, VibesDiyApiIface } from "@vibes.diy/api-types";
import { getThemeBySlug } from "@vibes.diy/prompts";
import { useStreamWatchdog } from "./useStreamWatchdog.js";
import { useReconnectLoop } from "./useReconnectLoop.js";
import { isSectionTheme, sectionThemeActions } from "./section-theme-actions.js";
import { notifyRecentVibesChanged } from "./useRecentVibes.js";
import type { PromptState, PromptAction } from "../routes/chat/prompt-state.js";
import type { ChatNavigation } from "./useChatNavigation.js";

export interface ChatSessionOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly inConstruction: boolean;
  readonly chatApi: VibesDiyApiIface;
  readonly sharedApi: VibesDiyApiIface;
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
          if (isSectionTheme(block)) {
            for (const action of sectionThemeActions(block)) dispatch(action);
            continue;
          }
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
    const r = await chatApi.openChat({ ownerHandle, appSlug, mode: "chat" });
    if (r.isErr()) {
      console.error("reconnect openChat failed", r.Err());
      return null;
    }
    return r.Ok();
  }, [chatApi, ownerHandle, appSlug]);

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
    },
    [attachSectionStream, refreshAppSettings, dispatch]
  );

  const handleReconnectGiveUp = useCallback(() => dispatch({ type: "reconnectFailed" }), [dispatch]);

  useReconnectLoop({
    connection: promptState.connection,
    openChat: openChatForReconnect,
    onAttempt: handleReconnectAttempt,
    onGiveUp: handleReconnectGiveUp,
  });

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
        // Show the prompt instantly as an optimistic bubble (see #2352). The
        // server echo clears it; a failed send drops it.
        dispatch({ type: "setOptimisticPrompt", text: sentPrompt });
        chat
          .prompt({
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: sentPrompt }],
              },
            ],
          })
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Err());
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
      }
      return; // Already opened or opening
    }
    openingRef.current = true;
    chatApi.openChat({ ownerHandle, appSlug, mode: "chat" }).then((rChat) => {
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
    // Dep array preserved verbatim from the route — the self-referential `chat`
    // dependency is what flips this effect from the open path to the fire path.
    // `onSendSettled` is identity-stable in the route (memoized), so listing it
    // here does not re-fire the effect.
  }, [ownerHandle, appSlug, chat, openingRef, chatApi, sharedApi, promptToSend, onSendSettled]);

  return { chat };
}
