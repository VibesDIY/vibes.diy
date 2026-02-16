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
  readonly size: number;
}

export interface AssetBackend {
  readonly protocol: string;
  put(stream: ReadableStream<Uint8Array>, size: number): Promise<Result<AssetPutRow, Error>>;
  get(url: string): Promise<Result<Option<AssetGetRow>, Error>>;
}

export interface AssetBackendSelector<TBackend extends AssetBackend = AssetBackend> {
  select(writeSize: number): TBackend;
}

export class AssetProvider<TBackend extends AssetBackend = AssetBackend> {
  private readonly backendByProtocol: Map<string, TBackend>;
  private readonly selector: AssetBackendSelector<TBackend>;

  constructor(backends: readonly TBackend[], selector: AssetBackendSelector<TBackend>) {
    const backendByProtocol = new Map<string, TBackend>();
    for (const backend of backends) {
      backendByProtocol.set(backend.protocol, backend);
    }
    this.backendByProtocol = backendByProtocol;
    this.selector = selector;
  }

  async puts(items: readonly AssetPutInput[]): Promise<Result<AssetPutRow, Error>[]> {
    const out: Result<AssetPutRow, Error>[] = [];
    for (const item of items) {
      const backend = this.selector.select(item.size);
      out.push(await backend.put(item.stream, item.size));
    }
    return out;
  }

  async gets(urls: readonly string[]): Promise<Result<Option<AssetGetRow>, Error>[]> {
    const out: Result<Option<AssetGetRow>, Error>[] = [];
    for (const url of urls) {
      const protocol = URI.from(url).protocol;
      const backend = this.backendByProtocol.get(protocol);
      if (backend === undefined) {
        out.push(Result.Err(new Error(`unsupported asset url protocol=${protocol}`)));
        continue;
      }
      out.push(await backend.get(url));
    }
    return out;
  }
}
