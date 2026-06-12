import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReconnectLoop } from "~/vibes.diy/app/hooks/useReconnectLoop.js";
import type { LLMChat } from "@vibes.diy/api-types";
import type { StreamConnection } from "~/vibes.diy/app/routes/chat/prompt-state.js";

function fakeChat(): LLMChat {
  return { close: vi.fn(async () => undefined) } as unknown as LLMChat;
}

describe("useReconnectLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing while connection is live", async () => {
    const openChat = vi.fn(async () => fakeChat());
    renderHook(() =>
      useReconnectLoop({ connection: "live", openChat, onAttempt: vi.fn(), onGiveUp: vi.fn() })
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(openChat).not.toHaveBeenCalled();
  });

  it("opens a chat and calls onAttempt, then retries on the interval until connection leaves reconnecting", async () => {
    const chats: LLMChat[] = [];
    const openChat = vi.fn(async () => {
      const c = fakeChat();
      chats.push(c);
      return c;
    });
    const onAttempt = vi.fn();
    const { rerender } = renderHook(
      ({ connection }: { connection: StreamConnection }) =>
        useReconnectLoop({ connection, openChat, onAttempt, onGiveUp: vi.fn(), attemptIntervalMs: 1000, maxTotalMs: 60_000 }),
      { initialProps: { connection: "reconnecting" as StreamConnection } }
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledTimes(2);
    // The stale first attempt's handle was closed before re-opening.
    expect(chats[0].close).toHaveBeenCalled();

    // Reducer converged: connection back to live — loop stops, keeps the last chat open.
    rerender({ connection: "live" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(chats[1].close).not.toHaveBeenCalled();
  });

  it("keeps retrying when openChat fails, then gives up after maxTotalMs", async () => {
    const openChat = vi.fn(async () => null);
    const onGiveUp = vi.fn();
    renderHook(() =>
      useReconnectLoop({
        connection: "reconnecting",
        openChat,
        onAttempt: vi.fn(),
        onGiveUp,
        attemptIntervalMs: 1000,
        maxTotalMs: 3500,
      })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(openChat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    const callsAtGiveUp = openChat.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(openChat).toHaveBeenCalledTimes(callsAtGiveUp);
  });

  it("cancels cleanly on unmount", async () => {
    const openChat = vi.fn(async () => fakeChat());
    const onAttempt = vi.fn();
    const { unmount } = renderHook(() =>
      useReconnectLoop({ connection: "reconnecting", openChat, onAttempt, onGiveUp: vi.fn(), attemptIntervalMs: 1000 })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    unmount();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
});
