import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { preAllocate } from "../svc/intern/pre-allocate.js";

// #2481: every outbound LLM/inference HTTP call must go through an injectable
// ctx seam. The test ctx installs a fail-closed `inferenceFetch` default so an
// un-mocked external request becomes a loud, deterministic error instead of a
// real network call (the cause of flaky `compile_test` on docs-only PRs).
describe("inferenceFetch seam (#2481)", () => {
  it("fails closed by default with an actionable, host-naming error", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    await expect(ctx.vibesCtx.inferenceFetch("https://inference.prodia.com/v2/job", { method: "POST" })).rejects.toThrow(
      /network request in test — inject a mock or add a fixture: https:\/\/inference\.prodia\.com\/v2\/job/
    );
  });

  it("honors an injected inferenceFetch override", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const calls: string[] = [];
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      inferenceFetch: (input) => {
        calls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    });

    const res = await ctx.vibesCtx.inferenceFetch("https://inference.prodia.com/v2/job");
    expect(res.status).toBe(200);
    expect(calls).toEqual(["https://inference.prodia.com/v2/job"]);
  });

  it("routes preAllocate's LLM network through inferenceFetch (no direct fetch)", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    let seamCalls = 0;
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      // Throw a sentinel so we can prove pre-alloc's wire request went through
      // the seam (and was caught) rather than reaching the real network.
      inferenceFetch: () => {
        seamCalls++;
        return Promise.reject(new Error("SENTINEL_SEAM_HIT"));
      },
    });

    const rPre = await preAllocate(ctx.vibesCtx, { prompt: "make a todo app" });
    // pre-alloc is best-effort: a failed seam call surfaces as Err and the
    // caller falls back to a random slug. The point here is that the network
    // went through the seam at least once.
    expect(seamCalls).toBeGreaterThan(0);
    expect(rPre.isErr()).toBe(true);
  });
});
