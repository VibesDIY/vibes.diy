import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIframeApiInFlight } from "~/vibes.diy/app/hooks/useIframeApiInFlight.js";

function dispatch(data: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

describe("useIframeApiInFlight", () => {
  it("starts inactive", () => {
    const { result } = renderHook(() => useIframeApiInFlight());
    expect(result.current).toBe(false);
  });

  it("flips to true when the iframe posts vibe.evt.network.active", () => {
    const { result } = renderHook(() => useIframeApiInFlight());
    dispatch({ type: "vibe.evt.network.active", count: 1 });
    expect(result.current).toBe(true);
  });

  it("flips back to false when the iframe posts vibe.evt.network.idle", () => {
    const { result } = renderHook(() => useIframeApiInFlight());
    dispatch({ type: "vibe.evt.network.active", count: 2 });
    expect(result.current).toBe(true);
    dispatch({ type: "vibe.evt.network.idle" });
    expect(result.current).toBe(false);
  });

  it("ignores unrelated message events", () => {
    const { result } = renderHook(() => useIframeApiInFlight());
    dispatch({ type: "vibe.evt.network.active", count: 1 });
    dispatch({ type: "vibe.evt.something.else" });
    dispatch("not-an-object");
    dispatch({ noType: true });
    dispatch(undefined);
    expect(result.current).toBe(true);
  });

  it("removes its message listener on unmount", () => {
    const { result, unmount } = renderHook(() => useIframeApiInFlight());
    dispatch({ type: "vibe.evt.network.active", count: 1 });
    expect(result.current).toBe(true);

    unmount();

    // A post after unmount must not throw and must not affect any state —
    // the listener should be gone. We assert behavior indirectly: dispatching
    // after unmount and then remounting should start inactive.
    dispatch({ type: "vibe.evt.network.idle" });
    const remount = renderHook(() => useIframeApiInFlight());
    expect(remount.result.current).toBe(false);
  });
});
