import { describe, it, expect, vi } from "vitest";
import { createEphemeralCoalescer } from "../../vibe/runtime/merge-coalescer.js";

describe("ephemeral coalescer (#1756)", () => {
  it("collapses a burst per _id to one flush with the latest snapshot", () => {
    vi.useFakeTimers();
    const sent: { id: string; doc: Record<string, unknown> }[] = [];
    const c = createEphemeralCoalescer((id, doc) => sent.push({ id, doc }), 16);
    c.push("cursor-a", { _id: "cursor-a", curX: 1 });
    c.push("cursor-a", { _id: "cursor-a", curX: 2 });
    c.push("cursor-a", { _id: "cursor-a", curX: 3 });
    expect(sent).toHaveLength(0); // nothing sent synchronously
    vi.advanceTimersByTime(16);
    expect(sent).toEqual([{ id: "cursor-a", doc: { _id: "cursor-a", curX: 3 } }]);
    vi.useRealTimers();
  });

  it("does not collapse distinct _ids together", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const c = createEphemeralCoalescer((id) => sent.push(id), 16);
    c.push("a", { _id: "a" });
    c.push("b", { _id: "b" });
    vi.advanceTimersByTime(16);
    expect(sent.sort()).toEqual(["a", "b"]);
    vi.useRealTimers();
  });

  it("schedules a fresh flush after the previous one drained", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const c = createEphemeralCoalescer((id) => sent.push(id), 16);
    c.push("a", { _id: "a" });
    vi.advanceTimersByTime(16);
    c.push("a", { _id: "a" });
    vi.advanceTimersByTime(16);
    expect(sent).toEqual(["a", "a"]);
    vi.useRealTimers();
  });

  it("cancel() prevents a pending flush", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const c = createEphemeralCoalescer((id) => sent.push(id), 16);
    c.push("a", { _id: "a" });
    c.cancel();
    vi.advanceTimersByTime(100);
    expect(sent).toEqual([]);
    vi.useRealTimers();
  });
});
