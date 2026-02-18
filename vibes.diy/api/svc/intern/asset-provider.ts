import { Option, Result, URI } from "@adviser/cement";

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

export interface AssetPutStored {
  readonly type: "stored";
  readonly row: AssetPutRow;
}

export interface AssetPutAborted {
  readonly type: "aborted";
  readonly protocol: string;
  readonly reason: string;
}

export type AssetBackendPutOutcome = AssetPutStored | AssetPutAborted;

export interface AssetBackend {
  readonly protocol: string;
  put(stream: ReadableStream<Uint8Array>, options?: AssetPutOptions): Promise<Result<AssetBackendPutOutcome, Error>>;
  get(url: string): Promise<Result<Option<AssetGetRow>, Error>>;
}

export type AssetPutItemResult = Result<AssetPutRow, Error>;
export type AssetGetItemResult = Result<Option<AssetGetRow>, Error>;

function splitPutStream(stream: ReadableStream<Uint8Array>, copies: number): ReadableStream<Uint8Array>[] {
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
  private backends: TBackend[];
  private backendByProtocol = new Map<string, TBackend>();
  private setupError?: Error;

  constructor(backends: [TBackend, ...TBackend[]]) {
    this.backends = backends;

    for (const backend of backends) {
      const protocol = URI.from(backend.protocol + "//").protocol;
      if (this.backendByProtocol.has(protocol)) {
        this.setupError = new Error(`AssetProvider misconfigured: duplicate protocol=${protocol}`);
        return;
      }
      this.backendByProtocol.set(protocol, backend);
    }
  }

  private async putOne(item: AssetPutInput): Promise<AssetPutItemResult> {
    const branches = splitPutStream(item.stream, this.backends.length);
    const controllers = this.backends.map(() => new AbortController());
    const pending = this.backends.map((backend, index) =>
      backend.put(branches[index], { signal: controllers[index].signal }),
    );

    const errorParts: string[] = [];
    const abortParts: string[] = [];

    for (let index = 0; index < pending.length; index++) {
      const result = await pending[index];
      const backend = this.backends[index];

      if (result.isErr()) {
        errorParts.push(`protocol=${backend.protocol} error=${result.Err().message}`);
        continue;
      }

      const outcome = result.Ok();
      if (outcome.type === "stored") {
        for (let i = index + 1; i < controllers.length; i++) {
          controllers[i].abort({ type: "asset-provider-tier-abort", winnerIndex: index });
        }
        await Promise.allSettled(pending.slice(index + 1));
        return Result.Ok(outcome.row);
      }

      abortParts.push(`protocol=${outcome.protocol} reason=${outcome.reason}`);
    }

    switch (true) {
      case errorParts.length === 0:
        return Result.Err(new Error(`all backends declined: ${abortParts.join("; ")}`));
      case abortParts.length === 0:
        return Result.Err(new Error(`all backends failed: ${errorParts.join("; ")}`));
      default:
        return Result.Err(
          new Error(`no backend stored item: aborts=[${abortParts.join("; ")}] errors=[${errorParts.join("; ")}]`),
        );
    }
  }

  private async getOne(url: string): Promise<AssetGetItemResult> {
    try {
      const protocol = URI.from(url).protocol;
      const backend = this.backendByProtocol.get(protocol);
      if (!backend) {
        return Result.Err(new Error(`No backend configured for protocol=${protocol}`));
      }
      return backend.get(url);
    } catch {
      return Result.Err(new Error(`invalid url: ${url}`));
    }
  }

  async puts(items: AssetPutInput[]): Promise<Result<AssetPutItemResult[], Error>> {
    if (this.setupError) {
      return Result.Err(this.setupError);
    }
    const pending = items.map((item) => this.putOne(item));
    const results = await Promise.allSettled(pending);
    return Result.Ok(
      results.map((r) => (r.status === "fulfilled" ? r.value : Result.Err(r.reason))),
    );
  }

  async gets(urls: string[]): Promise<Result<AssetGetItemResult[], Error>> {
    if (this.setupError) {
      return Result.Err(this.setupError);
    }
    const pending = urls.map((url) => this.getOne(url));
    const results = await Promise.allSettled(pending);
    return Result.Ok(
      results.map((r) => (r.status === "fulfilled" ? r.value : Result.Err(r.reason))),
    );
  }
}
