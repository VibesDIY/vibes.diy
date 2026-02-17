import { BuildURI, Option, Result, to_uint8, URI } from "@adviser/cement";

export function string2stream(value: string): ReadableStream<Uint8Array> {
  const data = to_uint8(value);
  return bytes2stream(data);
}

export function bytes2stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function stream2string(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

export interface TestPutRow {
  readonly cid: string;
  readonly url: string;
  readonly size: number;
}

export interface TestGetRow {
  readonly cid: string;
  readonly stream: ReadableStream<Uint8Array>;
}

export class InMemoryTestBackend {
  readonly protocol: string;
  private seq = 0;
  private readonly byCid = new Map<string, Uint8Array>();

  constructor(protocol: string) {
    this.protocol = protocol;
  }

  async put(stream: ReadableStream<Uint8Array>): Promise<Result<TestPutRow, Error>> {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    this.byCid.set(cid, bytes);
    return Result.Ok({ cid, url, size: bytes.byteLength });
  }

  async get(url: string): Promise<Result<Option<TestGetRow>, Error>> {
    const parsed = URI.from(url);
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
    return Result.Ok(Option.Some({ cid, stream: bytes2stream(bytes) }));
  }
}
