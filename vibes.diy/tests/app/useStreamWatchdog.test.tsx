import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStreamWatchdog, STREAM_WATCHDOG_TIMEOUT_MS } from "~/vibes.diy/app/hooks/useStreamWatchdog.js";

describe("useStreamWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onSilent after the timeout while running on a live connection", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: true, connection: "live", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS);
    expect(onSilent).toHaveBeenCalledTimes(1);
  });

  it("does not fire when not running", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: false, connection: "live", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });

  it("does not fire while already reconnecting", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: true, connection: "reconnecting", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });

  it("resets the timer when activityKey changes", () => {
    const onSilent = vi.fn();
    const { rerender } = renderHook(
      ({ key }) => useStreamWatchdog({ running: true, connection: "live", activityKey: key, onSilent }),
      {
        initialProps: { key: [1] as unknown },
      }
    );
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS - 1000);
    rerender({ key: [2] as unknown });
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS - 1000);
    expect(onSilent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSilent).toHaveBeenCalledTimes(1);
  });

  it("disarms on unmount", () => {
    const onSilent = vi.fn();
    const { unmount } = renderHook(() => useStreamWatchdog({ running: true, connection: "live", activityKey: [], onSilent }));
    unmount();
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });
});
