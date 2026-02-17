import { exception2Result, Option, Result, URI } from "@adviser/cement";

export interface AssetPutRow {
  readonly cid: string;
  readonly url: string;
  readonly size: number;
}

export interface AssetGetRow {
  readonly cid: string;
  readonly stream: ReadableStream<Uint8Array>;
}

export interface AssetPutInput {
  readonly stream: ReadableStream<Uint8Array>;
}

export interface AssetPutOptions {
  readonly signal?: AbortSignal;
}

export interface AssetBackend {
  readonly protocol: string;
  put(stream: ReadableStream<Uint8Array>, options?: AssetPutOptions): Promise<Result<AssetPutRow, Error>>;
  get(url: string): Promise<Result<Option<AssetGetRow>, Error>>;
}

export type AssetPutItemResult = Result<AssetPutRow, Error>;
export type AssetGetItemResult = Result<Option<AssetGetRow>, Error>;

function validateProtocols(backends: readonly [AssetBackend, ...AssetBackend[]]): Error | undefined {
  const seen = new Set<string>();
  for (const backend of backends) {
    if (!backend.protocol.endsWith(":")) {
      return new Error(`AssetProvider misconfigured: protocol must end with ':' (${backend.protocol})`);
    }
    if (seen.has(backend.protocol)) {
      return new Error(`AssetProvider misconfigured: duplicate protocol=${backend.protocol}`);
    }
    seen.add(backend.protocol);
  }
  return undefined;
}

function splitPutStream(stream: ReadableStream<Uint8Array>, copies: number): readonly ReadableStream<Uint8Array>[] {
  if (copies === 1) {
    return [stream];
  }

  const branches: ReadableStream<Uint8Array>[] = [];
  let tail = stream;
  for (let index = 1; index < copies; index++) {
    const pair = tail.tee();
    branches.push(pair[0]);
    tail = pair[1];
  }
  branches.push(tail);
  return branches;
}

export class AssetProvider<TBackend extends AssetBackend = AssetBackend> {
  private readonly backends: readonly TBackend[];
  private readonly backendByProtocol: Map<string, TBackend>;
  private readonly setupError: Error | undefined;

  constructor(backends: readonly [TBackend, ...TBackend[]]) {
    this.backends = backends;
    this.setupError = validateProtocols(backends);

    const backendByProtocol = new Map<string, TBackend>();
    for (const item of backends) {
      backendByProtocol.set(item.protocol, item);
    }
    this.backendByProtocol = backendByProtocol;
  }

  private async putOne(item: AssetPutInput): Promise<AssetPutItemResult> {
    const branches = splitPutStream(item.stream, this.backends.length);
    const controllers: readonly (AbortController | undefined)[] = this.backends.map(function createController(
      _backend,
      index,
    ) {
      if (index === 0) {
        return undefined;
      }
      return new AbortController();
    });
    const pending: readonly Promise<AssetPutItemResult>[] = this.backends.map((backend, index) =>
      backend.put(branches[index], { signal: controllers[index]?.signal }),
    );
    const errorParts: string[] = [];
    for (let index = 0; index < pending.length; index++) {
      const result = await pending[index];
      if (result.isOk()) {
        const loserPending = pending.slice(index + 1);
        for (const controller of controllers.slice(index + 1)) {
          if (controller === undefined) {
            continue;
          }
          controller.abort({ type: "asset-provider-tier-abort", winnerIndex: index });
        }
        await Promise.allSettled(loserPending);
        return result;
      }
      const backend = this.backends[index];
      errorParts.push(`protocol=${backend.protocol} error=${result.Err().message}`);
    }
    return Result.Err(new Error(`all backends failed: ${errorParts.join("; ")}`));
  }

  async puts(items: readonly AssetPutInput[]): Promise<Result<AssetPutItemResult[], Error>> {
    if (this.setupError !== undefined) {
      return Result.Err(this.setupError);
    }
    const pending = items.map((item) => this.putOne(item));
    return exception2Result(function waitForAllPuts() {
      return Promise.all(pending);
    });
  }

  async gets(urls: readonly string[]): Promise<Result<AssetGetItemResult[], Error>> {
    if (this.setupError !== undefined) {
      return Result.Err(this.setupError);
    }
    const pending = urls.map(async (url): Promise<AssetGetItemResult> => {
      const protocol = URI.from(url).protocol;
      const backend = this.backendByProtocol.get(protocol);
      if (backend === undefined) {
        return Result.Err(new Error(`No backend configured for protocol=${protocol}`));
      }
      return backend.get(url);
    });
    return exception2Result(function waitForAllGets() {
      return Promise.all(pending);
    });
  }
}
