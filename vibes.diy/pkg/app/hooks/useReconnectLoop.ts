import { useEffect, useRef } from "react";
import type { LLMChat } from "@vibes.diy/api-types";
import type { StreamConnection } from "../routes/chat/prompt-state.js";

export const RECONNECT_ATTEMPT_INTERVAL_MS = 5_000;
export const RECONNECT_MAX_TOTAL_MS = 120_000;

export interface ReconnectLoopOpts {
  readonly connection: StreamConnection;
  // Re-open the chat; resolve null when the open itself fails (counts as a retry).
  readonly openChat: () => Promise<LLMChat | null>;
  // Hand a freshly-opened chat to the route: replayReset + initChat + attach
  // the section stream + refresh app settings. The replayed blocks flow
  // through the reducer; a block-end matching inFlightStreamId flips
  // connection back to "live", which ends this loop.
  readonly onAttempt: (chat: LLMChat) => void;
  readonly onGiveUp: () => void;
  readonly attemptIntervalMs?: number;
  readonly maxTotalMs?: number;
}

export function useReconnectLoop(opts: ReconnectLoopOpts): void {
  const { connection } = opts;
  const attemptIntervalMs = opts.attemptIntervalMs ?? RECONNECT_ATTEMPT_INTERVAL_MS;
  const maxTotalMs = opts.maxTotalMs ?? RECONNECT_MAX_TOTAL_MS;
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const cbRef = useRef({ openChat: opts.openChat, onAttempt: opts.onAttempt, onGiveUp: opts.onGiveUp });
  cbRef.current = { openChat: opts.openChat, onAttempt: opts.onAttempt, onGiveUp: opts.onGiveUp };

  useEffect(() => {
    if (connection !== "reconnecting") return;
    let cancelled = false;
    let prevAttempt: LLMChat | null = null;
    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    void (async () => {
      while (!cancelled && connectionRef.current === "reconnecting") {
        if (Date.now() - startedAt >= maxTotalMs) {
          cbRef.current.onGiveUp();
          return;
        }
        // The previous attempt didn't converge — its replay is stale. Drop it
        // before opening a fresh one. Once converged the loop exits without
        // closing, leaving the last attempt as the route's active chat.
        void prevAttempt?.close();
        prevAttempt = null;
        const chat = await cbRef.current.openChat();
        if (cancelled) {
          void chat?.close();
          return;
        }
        if (chat) {
          prevAttempt = chat;
          cbRef.current.onAttempt(chat);
        }
        await sleep(attemptIntervalMs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, attemptIntervalMs, maxTotalMs]);
}
