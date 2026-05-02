import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { string2stream, URI } from "@adviser/cement";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { StubS3Api } from "./stub-s3-api.js";

const TIMEOUT_MARKER = Symbol("storage-routing-timeout");

async function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_MARKER> {
  return Promise.race([p, new Promise<typeof TIMEOUT_MARKER>((resolve) => setTimeout(() => resolve(TIMEOUT_MARKER), ms))]);
}

// The "cement-bug canary" cases (C, D) are expected to fail until the cement
// teeWriter peerTimeout patch lands (plan Part 2). Set RUN_CEMENT_CANARY=1 to
// run them locally and confirm the bug status; CI keeps them off by default so
// the suite stays green while Part 2 work is in flight.
const RUN_CANARY = process.env.RUN_CEMENT_CANARY === "1";
const canaryIt = RUN_CANARY ? it : it.skip;

describe("storage routing — 4 KB SQL cutoff with S3 fallthrough", () => {
  function content(size: number, marker = "A"): string {
    return marker.repeat(size);
  }

  it("Case A: small (1 KB) routes to SQL, S3 store untouched", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const stub = new StubS3Api();
    const { vibesCtx } = await createVibeDiyTestCtx(sthis, deviceCA, { s3: stub });

    const [r] = await vibesCtx.storage.ensure(string2stream(content(1024)));
    expect(r.isOk()).toBe(true);
    const url = r.Ok().getURL;
    expect(url).toMatch(/^(pg|sqlite):\/\/Assets\//);
    // S3 may have started a temp upload but it should not have committed.
    expect(stub.store.size).toBe(0);
  });

  it("Case B: large (8 KB) routes to S3, persisted under the CID", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const stub = new StubS3Api();
    const { vibesCtx } = await createVibeDiyTestCtx(sthis, deviceCA, { s3: stub });

    const [r] = await vibesCtx.storage.ensure(string2stream(content(8192)));
    expect(r.isOk()).toBe(true);
    const url = r.Ok().getURL;
    expect(url).toMatch(/^s3:\/\/r2\//);
    const key = URI.from(url).pathname.replace(/^\/+/, "");
    expect(stub.store.has(key)).toBe(true);
  });

  canaryIt(
    "Case C (cement-bug canary): large + hung S3 should fail fast — without the cement patch this hangs",
    async () => {
      const sthis = ensureSuperThis();
      const deviceCA = await createTestDeviceCA(sthis);
      const stub = new StubS3Api();
      stub.hangPut = true;
      const { vibesCtx } = await createVibeDiyTestCtx(sthis, deviceCA, { s3: stub });

      const winner = await withDeadline(vibesCtx.storage.ensure(string2stream(content(8192))), 1500);
      if (winner === TIMEOUT_MARKER) {
        throw new Error(
          "CEMENT-BUG-DETECTED (Case C): storage.ensure() did not resolve within 1.5s on hung S3. " +
            "teeWriter has no per-operation timeout. Trigger Part 2 of the plan."
        );
      }
      // With the cement patch (peerTimeout fires), expect Result.Err — both peers gone.
      expect(winner[0].isErr()).toBe(true);
    },
    3000
  );

  canaryIt(
    "Case D (cement-bug canary): small (1 KB) + hung S3 should succeed via SQL — without the cement patch this hangs",
    async () => {
      const sthis = ensureSuperThis();
      const deviceCA = await createTestDeviceCA(sthis);
      const stub = new StubS3Api();
      stub.hangPut = true;
      const { vibesCtx } = await createVibeDiyTestCtx(sthis, deviceCA, { s3: stub });

      const winner = await withDeadline(vibesCtx.storage.ensure(string2stream(content(1024))), 1500);
      if (winner === TIMEOUT_MARKER) {
        throw new Error(
          "CEMENT-BUG-DETECTED (Case D): small payload with hung S3 should succeed via SQL within 1.5s. " +
            "Even non-S3-bound writes are blocked when S3 hangs. Trigger Part 2 of the plan."
        );
      }
      expect(winner[0].isOk()).toBe(true);
      const url = winner[0].Ok().getURL;
      expect(url).toMatch(/^(pg|sqlite):\/\/Assets\//);
    },
    3000
  );
});
