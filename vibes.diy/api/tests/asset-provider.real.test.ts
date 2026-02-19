import { BuildURI, URI } from "@adviser/cement";
import { describe, expect, it } from "vitest";
import { AssetProvider } from "@vibes.diy/api-svc/intern/asset-provider.js";
import {
  createRebufferedStream,
  createTestContent,
  createTieredBackends,
  getUrlContentAsString,
  stream2string,
  type ThresholdTestBackend,
} from "./asset-provider.test-utils.js";

interface BackendSnapshot {
  readonly putCalls: number;
  readonly storedCount: number;
  readonly thresholdAbortCount: number;
  readonly signalAbortCount: number;
}

function totalOutcomes(snapshot: BackendSnapshot): number {
  return snapshot.storedCount + snapshot.thresholdAbortCount + snapshot.signalAbortCount;
}

function captureSnapshot(backends: readonly ThresholdTestBackend[]): readonly BackendSnapshot[] {
  return backends.map(function toSnapshot(backend): BackendSnapshot {
    return {
      putCalls: backend.putCalls,
      storedCount: backend.storedCount,
      thresholdAbortCount: backend.thresholdAbortCount,
      signalAbortCount: backend.signalAbortCount,
    };
  });
}

async function waitForOutcomeSettles(args: {
  readonly backends: readonly ThresholdTestBackend[];
  readonly before: readonly BackendSnapshot[];
  readonly expectedDelta: number;
}): Promise<readonly BackendSnapshot[]> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const after = captureSnapshot(args.backends);
    const settled = after.every(function isSettled(snapshot, index): boolean {
      const delta = totalOutcomes(snapshot) - totalOutcomes(args.before[index]);
      return delta >= args.expectedDelta;
    });
    if (settled === true) {
      return after;
    }
    await new Promise<void>(function resolveAfterDelay(resolve) {
      setTimeout(resolve, 2);
    });
  }
  return captureSnapshot(args.backends);
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function nextRandom(): number {
    state = (1103515245 * state + 12345) >>> 0;
    return state;
  };
}

describe("AssetProvider real tests", () => {
  describe("trivial tier routing", () => {
    it("routes 10 monotonic thresholds, validates aborts, and round-trips via gets", async () => {
      const count = 10;
      const stepBytes = 10;
      const backends = createTieredBackends({
        count,
        stepBytes,
        delayByIndex(index) {
          return index + 1;
        },
      });
      const ap = new AssetProvider(backends);

      for (let winnerIndex = 0; winnerIndex < count; winnerIndex++) {
        const sizeBytes = 9 + winnerIndex * 10;
        const content = createTestContent({ sizeBytes });

        const before = captureSnapshot(backends);
        const rPuts = await ap.puts([
          {
            stream: createRebufferedStream({
              content,
              chunkSize: 4,
            }),
          },
        ]);
        expect(rPuts.isOk()).toBe(true);

        const putResult = rPuts.Ok()[0];
        expect(putResult.isOk()).toBe(true);
        const put = putResult.Ok();
        expect(URI.from(put.url).protocol).toBe(`tier${winnerIndex}:`);

        const after = await waitForOutcomeSettles({
          backends,
          before,
          expectedDelta: 1,
        });
        for (let backendIndex = 0; backendIndex < count; backendIndex++) {
          expect(after[backendIndex].putCalls - before[backendIndex].putCalls).toBe(1);
          switch (true) {
            case backendIndex < winnerIndex:
              expect(after[backendIndex].thresholdAbortCount - before[backendIndex].thresholdAbortCount).toBe(1);
              break;
            case backendIndex === winnerIndex:
              expect(after[backendIndex].storedCount - before[backendIndex].storedCount).toBe(1);
              break;
            default:
              expect(after[backendIndex].signalAbortCount - before[backendIndex].signalAbortCount).toBe(1);
              break;
          }
        }

        const rContent = await getUrlContentAsString({
          provider: ap,
          url: put.url,
        });
        expect(rContent.isOk()).toBe(true);
        expect(rContent.Ok()).toBe(content);
      }
    });

    it("propagates caller abort signal to all backends", async () => {
      const backends = createTieredBackends({
        count: 3,
        stepBytes: 100,
        delayByIndex() {
          return 5;
        },
      });
      const ap = new AssetProvider(backends);

      const controller = new AbortController();
      setTimeout(() => controller.abort("caller-canceled"), 10);

      const content = createTestContent({ sizeBytes: 50 });
      const rPuts = await ap.puts(
        [{ stream: createRebufferedStream({ content, chunkSize: 4 }) }],
        { signal: controller.signal },
      );
      expect(rPuts.isOk()).toBe(true);
      const putResult = rPuts.Ok()[0];

      // With 5ms delay per chunk and abort after 10ms, backends should get aborted
      // before they finish reading all chunks. At least some should report signal abort.
      const after = await waitForOutcomeSettles({
        backends,
        before: backends.map(() => ({
          putCalls: 0,
          storedCount: 0,
          thresholdAbortCount: 0,
          signalAbortCount: 0,
        })),
        expectedDelta: 1,
      });

      const totalSignalAborts = after.reduce((sum, s) => sum + s.signalAbortCount, 0);
      // Either the put finished before abort (stored) or got aborted (signal abort).
      // With 5ms per chunk and 13 chunks of 4 bytes for 50 bytes, ~65ms total vs 10ms abort.
      // All backends should be signal-aborted.
      expect(totalSignalAborts).toBeGreaterThan(0);

      // If it was aborted, we get an Err; if it raced through, we get Ok — either is valid
      // but the signal must have reached the backends
      if (putResult.isErr()) {
        expect(putResult.Err().message).toContain("declined");
      }
    });

    it("keeps gets per-item behavior for empty, missing, and invalid urls", async () => {
      const backends = createTieredBackends({
        count: 2,
        stepBytes: 10,
      });
      const ap = new AssetProvider(backends);

      const rEmptyGets = await ap.gets([]);
      expect(rEmptyGets.isOk()).toBe(true);
      expect(rEmptyGets.Ok()).toEqual([]);

      const rPuts = await ap.puts([
        {
          stream: createRebufferedStream({
            content: createTestContent({ sizeBytes: 9 }),
            chunkSize: 4,
          }),
        },
      ]);
      expect(rPuts.isOk()).toBe(true);
      const goodUrl = rPuts.Ok()[0].Ok().url;
      const missingUrl = BuildURI.from("tier0://").setParam("cid", "missing").toString();

      const rGets = await ap.gets([goodUrl, missingUrl, "not a valid url"]);
      expect(rGets.isOk()).toBe(true);
      const gets = rGets.Ok();
      expect(gets[0].isOk()).toBe(true);
      expect(gets[0].Ok().IsSome()).toBe(true);
      expect(gets[1].isOk()).toBe(true);
      expect(gets[1].Ok().IsSome()).toBe(false);
      expect(gets[2].isErr()).toBe(true);
      expect(gets[2].Err().message).toBe("No backend configured for protocol=file:");
    });
  });

  describe("complex parallel tier racing", () => {
    it("starts in parallel and completes faster than sequential timing", async () => {
      const count = 10;
      const stepBytes = 10;
      const backends = createTieredBackends({
        count,
        stepBytes,
        delayByIndex(index) {
          return (count - index) * 8;
        },
      });
      const ap = new AssetProvider(backends);

      const content = createTestContent({ sizeBytes: 99 });
      const startedAt = Date.now();
      const rPuts = await ap.puts([
        {
          stream: createRebufferedStream({
            content,
            chunkSize: 4,
          }),
        },
      ]);
      const elapsed = Date.now() - startedAt;

      expect(rPuts.isOk()).toBe(true);
      const putResult = rPuts.Ok()[0];
      expect(putResult.isOk()).toBe(true);
      const row = putResult.Ok();
      expect(URI.from(row.url).protocol).toBe("tier9:");

      const started = backends.map(function getStart(backend): number {
        return backend.startedAtValues[0] ?? 0;
      });
      const startedSpread = Math.max(...started) - Math.min(...started);
      expect(startedSpread).toBeLessThan(25);

      const slowFinish = backends[0].finishedAtValues[0] ?? 0;
      const fastFinish = backends[9].finishedAtValues[0] ?? 0;
      expect(slowFinish).toBeGreaterThan(fastFinish);

      let sequentialEstimate = 0;
      for (let index = 0; index < count; index++) {
        const maxBytes = stepBytes * (index + 1);
        const bytesToRead = 99 <= maxBytes ? 99 : maxBytes + 1;
        const chunks = Math.ceil(bytesToRead / 4);
        const delay = (count - index) * 8;
        sequentialEstimate += chunks * delay;
      }
      expect(elapsed).toBeLessThan(sequentialEstimate);

      const rContent = await getUrlContentAsString({ provider: ap, url: row.url });
      expect(rContent.isOk()).toBe(true);
      expect(rContent.Ok()).toBe(content);
    });
  });

  describe("throughput with flow control", () => {
    it("handles ten tiers and randomized payloads while preserving get integrity", async () => {
      const count = 10;
      const stepBytes = 100_000;
      const backends = createTieredBackends({
        count,
        stepBytes,
        delayByIndex() {
          return 1;
        },
        jitterByIndex(index) {
          return index % 3;
        },
        sleepEveryChunksByIndex() {
          return 32;
        },
        seedByIndex(index) {
          return 100 + index;
        },
      });
      const ap = new AssetProvider(backends);
      const random = createDeterministicRandom(42);

      const payloads: string[] = [];
      const sizes: number[] = [];
      for (let index = 0; index < count; index++) {
        const jitter = random() % 32_000;
        const size = index * stepBytes + 64_000 + jitter;
        sizes.push(size);
        payloads.push(createTestContent({ sizeBytes: size }));
      }

      const rPuts = await ap.puts(
        payloads.map(function toInput(content) {
          return {
            stream: createRebufferedStream({ content, chunkSize: 8_192 }),
          };
        }),
      );
      expect(rPuts.isOk()).toBe(true);

      const putResults = rPuts.Ok();
      expect(putResults).toHaveLength(count);

      const urls: string[] = [];
      for (let index = 0; index < count; index++) {
        const putResult = putResults[index];
        expect(putResult.isOk()).toBe(true);
        const row = putResult.Ok();
        urls.push(row.url);
        expect(URI.from(row.url).protocol).toBe(`tier${index}:`);
        expect(row.size).toBe(sizes[index]);
      }

      const rGets = await ap.gets(urls);
      expect(rGets.isOk()).toBe(true);
      const gets = rGets.Ok();
      expect(gets).toHaveLength(count);

      for (let index = 0; index < count; index++) {
        const getResult = gets[index];
        expect(getResult.isOk()).toBe(true);
        expect(getResult.Ok().IsSome()).toBe(true);
        const value = getResult.Ok().Unwrap();
        const content = await stream2string(value.stream);
        expect(content).toBe(payloads[index]);
      }

      for (let index = 0; index < count; index++) {
        const backend = backends[index];
        expect(backend.putCalls).toBe(count);
        expect(backend.thresholdAbortCount).toBe(count - (index + 1));
        expect(backend.storedCount).toBeGreaterThanOrEqual(1);
        expect(backend.storedCount + backend.signalAbortCount + backend.thresholdAbortCount).toBe(count);
      }
    });
  });
});
