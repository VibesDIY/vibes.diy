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

export interface AssetBackend {
  readonly protocol: string;
  put(stream: ReadableStream<Uint8Array>): Promise<Result<AssetPutRow, Error>>;
  get(url: string): Promise<Result<Option<AssetGetRow>, Error>>;
}

export class AssetProvider<TBackend extends AssetBackend = AssetBackend> {
  private readonly backendByProtocol: Map<string, TBackend>;
  private readonly putBackend: TBackend | undefined;

  constructor(backends: readonly TBackend[]) {
    const backendByProtocol = new Map<string, TBackend>();
    let putBackend: TBackend | undefined;
    for (const backend of backends) {
      backendByProtocol.set(backend.protocol, backend);
      if (putBackend === undefined) {
        putBackend = backend;
      }
    }
    this.backendByProtocol = backendByProtocol;
    this.putBackend = putBackend;
  }

  async puts(items: readonly AssetPutInput[]): Promise<Result<AssetPutRow, Error>[]> {
    if (this.putBackend === undefined) {
      return items.map(function noBackend() {
        return Result.Err(new Error("no asset backend configured"));
      });
    }
    const pending: Promise<Result<AssetPutRow, Error>>[] = [];
    for (const item of items) {
      pending.push(this.putBackend.put(item.stream));
    }
    return Promise.all(pending);
  }

  async gets(urls: readonly string[]): Promise<Result<Option<AssetGetRow>, Error>[]> {
    const pending: Promise<Result<Option<AssetGetRow>, Error>>[] = [];
    for (const url of urls) {
      const protocol = URI.from(url).protocol;
      const backend = this.backendByProtocol.get(protocol);
      if (backend === undefined) {
        pending.push(Promise.resolve(Result.Err(new Error(`unsupported asset url protocol=${protocol}`))));
        continue;
      }
      pending.push(backend.get(url));
    }
    return Promise.all(pending);
  }
}
