import { BuildURI, Option, Result, string2stream, stream2string, to_uint8, URI } from "@adviser/cement";
import type { AssetBackend, AssetGetRow, AssetPutRow } from "@vibes.diy/api-svc/intern/asset-provider.js";

export { string2stream, stream2string };

export function bytes2stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export class InMemoryTestBackend implements AssetBackend {
  readonly protocol: string;
  private seq = 0;
  private byCid = new Map<string, Uint8Array>();

  constructor(protocol: string) {
    this.protocol = protocol;
  }

  async put(stream: ReadableStream<Uint8Array>): Promise<Result<AssetPutRow, Error>> {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    this.byCid.set(cid, bytes);
    return Result.Ok({ cid, url, size: bytes.byteLength });
  }

  async get(url: string): Promise<Result<Option<AssetGetRow>, Error>> {
    const parsed = URI.from(url);
    if (parsed.protocol !== this.protocol) {
      return Result.Err(`unsupported url for protocol=${this.protocol}: ${url}`);
    }
    const cid = parsed.getParam("cid");
    if (!cid) {
      return Result.Err(`missing cid in url: ${url}`);
    }
    const bytes = this.byCid.get(cid);
    if (!bytes) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ cid, stream: bytes2stream(bytes) }));
  }
}
