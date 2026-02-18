import {
  BuildURI,
  Option,
  Result,
  exception2Result,
  rebuffer,
  stream2string,
  string2stream,
  URI,
} from "@adviser/cement";
import { AssetProvider, type AssetBackend, type AssetBackendPutOutcome, type AssetGetRow } from "@vibes.diy/api-svc/intern/asset-provider.js";

export { rebuffer, stream2string, string2stream };

export interface ThresholdBackendArgs {
  readonly protocol: string;
  readonly maxBytes?: number;
  readonly delayMs?: number;
  readonly jitterMs?: number;
  readonly sleepEveryChunks?: number;
  readonly seed?: number;
}

export interface TieredBackendArgs {
  readonly count: number;
  readonly stepBytes: number;
  readonly unboundedLast?: boolean;
  readonly protocolPrefix?: string;
  readonly delayByIndex?: (index: number) => number;
  readonly jitterByIndex?: (index: number) => number;
  readonly sleepEveryChunksByIndex?: (index: number) => number;
  readonly seedByIndex?: (index: number) => number;
}

function waitMs(ms: number): Promise<void> {
  return new Promise<void>(function resolveAfterDelay(resolve) {
    setTimeout(resolve, ms);
  });
}

function concatParts(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce(function addPartSize(acc, part) {
    return acc + part.byteLength;
  }, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function bytes2stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function nextRandom(): number {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
}

export class ThresholdTestBackend implements AssetBackend {
  readonly protocol: string;

  private readonly maxBytes: number | undefined;
  private readonly delayMs: number;
  private readonly jitterMs: number;
  private readonly sleepEveryChunks: number;
  private readonly random: () => number;

  private seq = 0;
  private readonly byCid = new Map<string, Uint8Array>();

  private putCallsCount = 0;
  private storedCountValue = 0;
  private thresholdAbortCountValue = 0;
  private signalAbortCountValue = 0;
  private bytesReadTotalValue = 0;

  private readonly startedAtValuesRef: number[] = [];
  private readonly finishedAtValuesRef: number[] = [];

  constructor(args: ThresholdBackendArgs) {
    this.protocol = args.protocol;
    this.maxBytes = args.maxBytes;
    this.delayMs = args.delayMs ?? 0;
    this.jitterMs = args.jitterMs ?? 0;
    this.sleepEveryChunks = args.sleepEveryChunks ?? 1;
    this.random = createSeededRandom(args.seed ?? 1);
  }

  get putCalls(): number {
    return this.putCallsCount;
  }

  get storedCount(): number {
    return this.storedCountValue;
  }

  get thresholdAbortCount(): number {
    return this.thresholdAbortCountValue;
  }

  get signalAbortCount(): number {
    return this.signalAbortCountValue;
  }

  get bytesReadTotal(): number {
    return this.bytesReadTotalValue;
  }

  get startedAtValues(): readonly number[] {
    return this.startedAtValuesRef;
  }

  get finishedAtValues(): readonly number[] {
    return this.finishedAtValuesRef;
  }

  private nextDelay(): number {
    if (this.jitterMs === 0) {
      return this.delayMs;
    }
    return this.delayMs + (this.random() % (this.jitterMs + 1));
  }

  async put(
    stream: ReadableStream<Uint8Array>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Result<AssetBackendPutOutcome, Error>> {
    this.putCallsCount += 1;
    this.startedAtValuesRef.push(Date.now());

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let seen = 0;
    let chunkCount = 0;

    while (true) {
      if (options?.signal?.aborted === true) {
        this.signalAbortCountValue += 1;
        await reader.cancel(options.signal.reason);
        this.finishedAtValuesRef.push(Date.now());
        return Result.Ok({
          type: "aborted",
          protocol: this.protocol,
          reason: `signal:${String(options.signal.reason ?? "aborted")}`,
        });
      }

      const next = await reader.read();
      if (next.done) {
        break;
      }

      const value = next.value;
      seen += value.byteLength;
      chunkCount += 1;
      this.bytesReadTotalValue += value.byteLength;
      chunks.push(value.slice());

      if (this.maxBytes !== undefined && seen > this.maxBytes) {
        this.thresholdAbortCountValue += 1;
        await reader.cancel({
          type: "threshold_exceeded",
          protocol: this.protocol,
          seen,
          maxBytes: this.maxBytes,
        });
        this.finishedAtValuesRef.push(Date.now());
        return Result.Ok({
          type: "aborted",
          protocol: this.protocol,
          reason: `threshold>${this.maxBytes}`,
        });
      }

      const delay = this.nextDelay();
      if (delay > 0 && chunkCount % this.sleepEveryChunks === 0) {
        await waitMs(delay);
      }
    }

    const bytes = concatParts(chunks);
    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    this.byCid.set(cid, bytes);
    this.storedCountValue += 1;
    this.finishedAtValuesRef.push(Date.now());
    return Result.Ok({
      type: "stored",
      row: {
        cid,
        url,
        size: bytes.byteLength,
      },
    });
  }

  async get(url: string): Promise<Result<Option<AssetGetRow>, Error>> {
    const rParsed = await exception2Result(async function parseUrl() {
      return URI.from(url);
    });
    if (rParsed.isErr()) {
      return Result.Err(new Error(`invalid url: ${url}`));
    }

    const parsed = rParsed.Ok();
    if (parsed.protocol !== this.protocol) {
      return Result.Err(new Error(`unsupported url for protocol=${this.protocol}: ${url}`));
    }

    const cid = parsed.getParam("cid");
    if (cid === undefined) {
      return Result.Err(new Error(`missing cid in url: ${url}`));
    }

    const bytes = this.byCid.get(cid);
    if (bytes === undefined) {
      return Result.Ok(Option.None());
    }

    return Result.Ok(
      Option.Some({
        cid,
        stream: bytes2stream(bytes),
      }),
    );
  }
}

export function createTieredBackends(args: TieredBackendArgs): readonly [ThresholdTestBackend, ...ThresholdTestBackend[]] {
  const count = args.count < 1 ? 1 : args.count;
  const prefix = args.protocolPrefix ?? "tier";
  const unboundedLast = args.unboundedLast ?? false;

  function makeBackend(index: number): ThresholdTestBackend {
    const delayMs = args.delayByIndex ? args.delayByIndex(index) : 0;
    const jitterMs = args.jitterByIndex ? args.jitterByIndex(index) : 0;
    const sleepEveryChunks = args.sleepEveryChunksByIndex ? args.sleepEveryChunksByIndex(index) : 1;
    const seed = args.seedByIndex ? args.seedByIndex(index) : index + 1;
    const maxBytes = unboundedLast && index === count - 1 ? undefined : args.stepBytes * (index + 1);
    return new ThresholdTestBackend({
      protocol: `${prefix}${index}:`,
      maxBytes,
      delayMs,
      jitterMs,
      sleepEveryChunks,
      seed,
    });
  }

  const first = makeBackend(0);
  const rest: ThresholdTestBackend[] = [];
  for (let index = 1; index < count; index++) {
    rest.push(makeBackend(index));
  }
  return [first, ...rest];
}

export function createTestContent(args: { readonly sizeBytes: number }): string {
  const size = args.sizeBytes < 0 ? 0 : args.sizeBytes;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const fullRepeats = Math.floor(size / chars.length);
  const remainder = size % chars.length;
  return chars.repeat(fullRepeats) + chars.slice(0, remainder);
}

export function createRebufferedStream(args: {
  readonly content: string;
  readonly chunkSize: number;
}): ReadableStream<Uint8Array> {
  return rebuffer(string2stream(args.content), args.chunkSize);
}

export async function getUrlContentAsString(args: {
  readonly provider: AssetProvider;
  readonly url: string;
}): Promise<Result<string, Error>> {
  const rGets = await args.provider.gets([args.url]);
  if (rGets.isErr()) {
    return Result.Err(rGets.Err());
  }

  const item = rGets.Ok()[0];
  if (item.isErr()) {
    return Result.Err(item.Err());
  }

  const opt = item.Ok();
  if (opt.IsSome() === false) {
    return Result.Err(new Error(`missing content for url=${args.url}`));
  }

  return exception2Result(async function readContent() {
    return stream2string(opt.Unwrap().stream);
  });
}
