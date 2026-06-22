import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  armGrace,
  isGraceDegraded,
  subscribeGrace,
  setGraceMsForTest,
  __resetGraceForTest,
} from "@vibes.diy/vibe-runtime";

beforeEach(() => {
  __resetGraceForTest();
  setGraceMsForTest(20);
});
afterEach(() => __resetGraceForTest());

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("grace registry", () => {
  it("marks a cid degraded after the grace window", async () => {
    expect(isGraceDegraded("cidA")).toBe(false);
    const cancel = armGrace("cidA");
    await wait(40);
    expect(isGraceDegraded("cidA")).toBe(true);
    cancel();
  });

  it("shares one timer across instances — both see degraded together", async () => {
    const c1 = armGrace("cidB");
    const c2 = armGrace("cidB");
    let notified = 0;
    const unsub = subscribeGrace(() => (notified += 1));
    await wait(40);
    expect(isGraceDegraded("cidB")).toBe(true);
    expect(notified).toBeGreaterThan(0);
    c1();
    c2();
    unsub();
  });

  it("cancelling all arms before expiry prevents degradation (cleanup)", async () => {
    const cancel = armGrace("cidC");
    cancel();
    await wait(40);
    expect(isGraceDegraded("cidC")).toBe(false);
  });

  it("a second arm after one cancel keeps the timer alive (refcount)", async () => {
    const c1 = armGrace("cidD");
    const c2 = armGrace("cidD");
    c1(); // one instance unmounts; timer must survive
    await wait(40);
    expect(isGraceDegraded("cidD")).toBe(true);
    c2();
  });
});
