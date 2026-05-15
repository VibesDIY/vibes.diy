import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { beginNetworkActivity, endNetworkActivity } from "@vibes.diy/vibe-runtime";

// The counter is module-level state shared across tests in the runtime
// package. Drain it (clamp at 0) before each test, then flush microtasks so
// the drain-time messages settle before we attach a fresh listener.
async function drainCounter(): Promise<void> {
  for (let i = 0; i < 100; i++) endNetworkActivity();
  await new Promise((r) => setTimeout(r, 0));
}

interface NetworkEvent {
  type: "vibe.evt.network.active" | "vibe.evt.network.idle";
  count?: number;
}

function collectNetworkEvents(): { events: NetworkEvent[]; stop: () => void } {
  const events: NetworkEvent[] = [];
  const handler = (e: MessageEvent) => {
    const data = e.data as { type?: string } | undefined;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "vibe.evt.network.active" || data.type === "vibe.evt.network.idle") {
      events.push(data as NetworkEvent);
    }
  };
  window.addEventListener("message", handler);
  return {
    events,
    stop: () => window.removeEventListener("message", handler),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("network activity signal", () => {
  let probe: ReturnType<typeof collectNetworkEvents>;

  beforeEach(async () => {
    await drainCounter();
    probe = collectNetworkEvents();
  });

  afterEach(async () => {
    probe.stop();
    await drainCounter();
  });

  it("posts vibe.evt.network.active with count=1 on first beginNetworkActivity", async () => {
    beginNetworkActivity();
    await flush();

    expect(probe.events).toHaveLength(1);
    expect(probe.events[0].type).toBe("vibe.evt.network.active");
    expect(probe.events[0].count).toBe(1);
  });

  it("increments count for concurrent activity", async () => {
    beginNetworkActivity();
    beginNetworkActivity();
    beginNetworkActivity();
    await flush();

    expect(probe.events.map((e) => e.type)).toEqual([
      "vibe.evt.network.active",
      "vibe.evt.network.active",
      "vibe.evt.network.active",
    ]);
    expect(probe.events.map((e) => e.count)).toEqual([1, 2, 3]);
  });

  it("keeps emitting active until the counter returns to 0", async () => {
    beginNetworkActivity();
    beginNetworkActivity();
    endNetworkActivity(); // 2 → 1, still active
    await flush();

    const last = probe.events.at(-1);
    expect(last?.type).toBe("vibe.evt.network.active");
  });

  it("emits vibe.evt.network.idle only when the last in-flight request settles", async () => {
    beginNetworkActivity();
    beginNetworkActivity();
    endNetworkActivity();
    endNetworkActivity();
    await flush();

    const idleEvents = probe.events.filter((e) => e.type === "vibe.evt.network.idle");
    expect(idleEvents).toHaveLength(1);
    expect(probe.events.at(-1)?.type).toBe("vibe.evt.network.idle");
  });

  it("does not drive the counter negative on extra endNetworkActivity calls", async () => {
    // Clamp behavior: end-without-begin must not corrupt the counter so that
    // a future begin/end pair still produces a clean active→idle pair.
    endNetworkActivity();
    endNetworkActivity();
    endNetworkActivity();
    await flush();
    probe.events.length = 0;

    beginNetworkActivity();
    endNetworkActivity();
    await flush();

    expect(probe.events.map((e) => e.type)).toEqual(["vibe.evt.network.active", "vibe.evt.network.idle"]);
  });
});
