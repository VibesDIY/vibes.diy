import { exception2Result, Option, Result } from "@adviser/cement";

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

export type AssetPutItemResult = Result<AssetPutRow, Error>;
export type AssetGetItemResult = Result<Option<AssetGetRow>, Error>;

export class AssetProvider<TBackend extends AssetBackend = AssetBackend> {
  private readonly backend: TBackend | undefined;

  constructor(backend: TBackend | undefined) {
    this.backend = backend;
  }

  async puts(items: readonly AssetPutInput[]): Promise<Result<AssetPutItemResult[], Error>> {
    if (this.backend === undefined) {
      return Result.Err(new Error("no asset backend configured"));
    }
    if (items.length === 0) {
      return Result.Ok([]);
    }
    const pending: Promise<AssetPutItemResult>[] = [];
    for (const item of items) {
      pending.push(this.backend.put(item.stream));
    }
    return exception2Result(function waitForAllPuts() {
      return Promise.all(pending);
    });
  }

  async gets(urls: readonly string[]): Promise<Result<AssetGetItemResult[], Error>> {
    if (this.backend === undefined) {
      return Result.Err(new Error("no asset backend configured"));
    }
    if (urls.length === 0) {
      return Result.Ok([]);
    }
    const pending: Promise<AssetGetItemResult>[] = [];
    for (const url of urls) {
      pending.push(this.backend.get(url));
    }
    return exception2Result(function waitForAllGets() {
      return Promise.all(pending);
    });
  }
}
