import { useEffect } from "react";
import type { StreamConnection } from "../routes/chat/prompt-state.js";

// LLM turns can have multi-second silent gaps, but the server's delta stream
// emits regularly while generating — 45s of total silence on a running prompt
// means the transport is gone (half-open TCP never fires onclose).
export const STREAM_WATCHDOG_TIMEOUT_MS = 45_000;

export interface StreamWatchdogOpts {
  readonly running: boolean;
  readonly connection: StreamConnection;
  // Any value whose identity changes on every received stream message
  // (promptState.blocks — the reducer replaces the array per message).
  readonly activityKey: unknown;
  readonly onSilent: () => void;
  readonly timeoutMs?: number;
}

export function useStreamWatchdog(opts: StreamWatchdogOpts): void {
  const { running, connection, activityKey, onSilent } = opts;
  const timeoutMs = opts.timeoutMs ?? STREAM_WATCHDOG_TIMEOUT_MS;
  useEffect(() => {
    if (!running || connection !== "live") return;
    const timer = setTimeout(onSilent, timeoutMs);
    return () => clearTimeout(timer);
  }, [running, connection, activityKey, onSilent, timeoutMs]);
}
