import { BuildURI, Option, Result, URI, to_uint8 } from "@adviser/cement";
import { describe, expect, it } from "vitest";
import {
  AssetProvider,
  type AssetBackend,
  type AssetPutOptions,
  type AssetGetRow,
  type AssetPutRow,
} from "@vibes.diy/api-svc/intern/asset-provider.js";
import { string2stream } from "./asset-provider.test-utils.js";

class ThresholdCancelBackend implements AssetBackend {
  readonly protocol: string;

  private seq = 0;
  private maxBytes: number | undefined;
  private putCallsCount = 0;
  private cancelCallsCount = 0;

  constructor(protocol: string, maxBytes?: number) {
    this.protocol = protocol;
    this.maxBytes = maxBytes;
  }

  get putCalls(): number {
    return this.putCallsCount;
  }

  get cancelCalls(): number {
    return this.cancelCallsCount;
  }

  async put(stream: ReadableStream<Uint8Array>, _options?: AssetPutOptions): Promise<Result<AssetPutRow, Error>> {
    this.putCallsCount += 1;

    const reader = stream.getReader();
    let seen = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      seen += next.value.byteLength;
      if (this.maxBytes !== undefined && seen > this.maxBytes) {
        this.cancelCallsCount += 1;
        await reader.cancel({
          type: "backend_threshold_exceeded",
          protocol: this.protocol,
          seen,
          maxBytes: this.maxBytes,
        });
        return Result.Err(`max-bytes exceeded protocol=${this.protocol}`);
      }
    }

    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    return Result.Ok({ cid, url, size: seen });
  }

  async get(_url: string): Promise<Result<Option<AssetGetRow>, Error>> {
    return Result.Ok(Option.None());
  }
}

class SlowDrainBackend implements AssetBackend {
  readonly protocol: string;

  private seq = 0;
  private delayMs: number;
  private bytesReadCount = 0;

  constructor(protocol: string, delayMs: number) {
    this.protocol = protocol;
    this.delayMs = delayMs;
  }

  get bytesRead(): number {
    return this.bytesReadCount;
  }

  async put(stream: ReadableStream<Uint8Array>, options?: AssetPutOptions): Promise<Result<AssetPutRow, Error>> {
    const reader = stream.getReader();
    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel(options.signal.reason);
        return Result.Err(`aborted protocol=${this.protocol}`);
      }
      const next = await reader.read();
      if (next.done) {
        break;
      }
      this.bytesReadCount += next.value.byteLength;
      await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    }

    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    return Result.Ok({ cid, url, size: this.bytesReadCount });
  }

  async get(_url: string): Promise<Result<Option<AssetGetRow>, Error>> {
    return Result.Ok(Option.None());
  }
}

function createChunkedStream(chunk: string, count: number): {
  stream: ReadableStream<Uint8Array>;
  totalBytes: number;
} {
  const bytes = to_uint8(chunk);
  const totalBytes = bytes.byteLength * count;
  let emitted = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitted >= count) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice());
      emitted += 1;
    },
  });
  return { stream, totalBytes };
}

describe("AssetProvider threshold-abort", () => {
  it("runs both backends for small payloads and returns small tier result", async () => {
    const small = new ThresholdCancelBackend("small:", 16);
    const big = new ThresholdCancelBackend("big:");
    const ap = new AssetProvider([small, big]);

    const rPuts = await ap.puts([{ stream: string2stream("small") }]);

    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts).toHaveLength(1);
    expect(puts[0].isOk()).toBe(true);

    const put = puts[0].Ok();
    expect(URI.from(put.url).protocol).toBe("small:");

    expect(small.putCalls).toBe(1);
    expect(big.putCalls).toBe(1);
  });

  it("lets small tier self-cancel on threshold and returns overflow result", async () => {
    const small = new ThresholdCancelBackend("small:", 16);
    const big = new ThresholdCancelBackend("big:");
    const ap = new AssetProvider([small, big]);

    const rPuts = await ap.puts([{ stream: string2stream("longString.........") }]);

    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts).toHaveLength(1);
    expect(puts[0].isOk()).toBe(true);

    const put = puts[0].Ok();
    expect(URI.from(put.url).protocol).toBe("big:");

    expect(small.putCalls).toBe(1);
    expect(small.cancelCalls).toBe(1);
    expect(big.putCalls).toBe(1);
  });

  it("supports three backends with monotonic thresholds", async () => {
    const small = new ThresholdCancelBackend("small:", 8);
    const medium = new ThresholdCancelBackend("medium:", 16);
    const big = new ThresholdCancelBackend("big:");
    const ap = new AssetProvider([small, medium, big]);

    const rPuts = await ap.puts([{ stream: string2stream("longString.........over-medium-threshold") }]);
    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts[0].isOk()).toBe(true);
    expect(URI.from(puts[0].Ok().url).protocol).toBe("big:");
    expect(small.putCalls).toBe(1);
    expect(medium.putCalls).toBe(1);
    expect(big.putCalls).toBe(1);
    expect(small.cancelCalls).toBe(1);
    expect(medium.cancelCalls).toBe(1);
    expect(big.cancelCalls).toBe(0);
  });

  it("cancels larger backend when smallest tier fits payload", async () => {
    const small = new ThresholdCancelBackend("small:");
    const big = new SlowDrainBackend("big:", 2);
    const ap = new AssetProvider([small, big]);

    const payload = createChunkedStream("abcdefgh", 64);
    const rPuts = await ap.puts([{ stream: payload.stream }]);

    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts[0].isOk()).toBe(true);
    expect(URI.from(puts[0].Ok().url).protocol).toBe("small:");

    expect(big.bytesRead).toBeLessThan(payload.totalBytes);
  });

  it("cancels larger backend when medium tier is the winner", async () => {
    const small = new ThresholdCancelBackend("small:", 8);
    const medium = new ThresholdCancelBackend("medium:", 80);
    const large = new SlowDrainBackend("large:", 2);
    const ap = new AssetProvider([small, medium, large]);

    const payload = createChunkedStream("abcdefgh", 8);
    const rPuts = await ap.puts([{ stream: payload.stream }]);

    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts[0].isOk()).toBe(true);
    expect(URI.from(puts[0].Ok().url).protocol).toBe("medium:");
    expect(small.cancelCalls).toBe(1);

    expect(large.bytesRead).toBeLessThan(payload.totalBytes);
  });
});
