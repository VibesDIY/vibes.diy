import { BuildURI, Option, Result, to_uint8, URI } from "@adviser/cement";
import { describe, expect, it } from "vitest";
import { AssetProvider } from "@vibes.diy/api-svc/intern/asset-provider.js";

function string2stream(value: string): ReadableStream<Uint8Array> {
  const data = to_uint8(value);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

async function stream2string(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

interface PutRow {
  readonly cid: string;
  readonly url: string;
  readonly size: number;
}

interface GetRow {
  readonly cid: string;
  readonly stream: ReadableStream<Uint8Array>;
}

class TestImpl {
  readonly protocol: string;
  private seq = 0;
  private readonly byCid = new Map<string, Uint8Array>();

  constructor(protocol: string) {
    this.protocol = protocol;
  }

  async put(stream: ReadableStream<Uint8Array>): Promise<Result<PutRow, Error>> {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const cid = `${this.seq++}`;
    const size = bytes.byteLength;
    this.byCid.set(cid, bytes);
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    return Result.Ok({ cid, url, size });
  }

  async get(url: string): Promise<Result<Option<GetRow>, Error>> {
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
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return Result.Ok(Option.Some({ cid, stream }));
  }
}

class SlowPutImpl {
  readonly protocol: string;
  private seq = 0;
  private inflight = 0;
  private maxInflight = 0;

  constructor(protocol: string) {
    this.protocol = protocol;
  }

  get peakInflight(): number {
    return this.maxInflight;
  }

  async put(stream: ReadableStream<Uint8Array>): Promise<Result<PutRow, Error>> {
    this.inflight += 1;
    this.maxInflight = Math.max(this.maxInflight, this.inflight);
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    await new Promise<void>(function resolveAfterDelay(resolve) {
      setTimeout(resolve, 10);
    });
    this.inflight -= 1;
    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    return Result.Ok({ cid, url, size: bytes.byteLength });
  }

  async get(_url: string): Promise<Result<Option<GetRow>, Error>> {
    return Result.Ok(Option.None());
  }
}

describe("AssetProvider", () => {
  it("stores and round-trips stream content", async () => {
    const backend = new TestImpl("small:");
    const ap = new AssetProvider([backend]);

    const rPutResults = await ap.puts([
      { stream: string2stream("smallString") },
      { stream: string2stream("longString.........") },
    ]);
    expect(rPutResults.isOk()).toBe(true);
    const putResults = rPutResults.Ok();

    expect(putResults).toHaveLength(2);
    expect(putResults[0].isOk()).toBe(true);
    expect(putResults[1].isOk()).toBe(true);

    const put0 = putResults[0].Ok();
    const put1 = putResults[1].Ok();
    expect(URI.from(put0.url).protocol).toBe("small:");
    expect(URI.from(put0.url).getParam("cid")).toBe(put0.cid);
    expect(URI.from(put1.url).protocol).toBe("small:");
    expect(URI.from(put1.url).getParam("cid")).toBe(put1.cid);
    expect(put0.size).toBe(to_uint8("smallString").byteLength);
    expect(put1.size).toBe(to_uint8("longString.........").byteLength);

    const rGetResults = await ap.gets([put0.url, put1.url]);
    expect(rGetResults.isOk()).toBe(true);
    const getResults = rGetResults.Ok();
    expect(getResults).toHaveLength(2);
    expect(getResults[0].isOk()).toBe(true);
    expect(getResults[1].isOk()).toBe(true);

    expect(getResults[0].Ok().IsSome()).toBe(true);
    expect(getResults[1].Ok().IsSome()).toBe(true);
    const get0 = getResults[0].Ok().Unwrap();
    const get1 = getResults[1].Ok().Unwrap();

    expect(get0.cid).toBe(put0.cid);
    expect(get1.cid).toBe(put1.cid);
    expect(await stream2string(get0.stream)).toBe("smallString");
    expect(await stream2string(get1.stream)).toBe("longString.........");
  });

  it("runs puts in parallel", async () => {
    const backend = new SlowPutImpl("small:");
    const ap = new AssetProvider([backend]);

    const rPutResults = await ap.puts([
      { stream: string2stream("one") },
      { stream: string2stream("two") },
      { stream: string2stream("three") },
    ]);
    expect(rPutResults.isOk()).toBe(true);
    const putResults = rPutResults.Ok();

    expect(putResults[0].isOk()).toBe(true);
    expect(putResults[1].isOk()).toBe(true);
    expect(putResults[2].isOk()).toBe(true);
    expect(backend.peakInflight).toBeGreaterThan(1);
  });

  it("returns empty ok for empty batches with backend", async () => {
    const ap = new AssetProvider([new TestImpl("small:")]);

    const rPutResults = await ap.puts([]);
    expect(rPutResults.isOk()).toBe(true);
    expect(rPutResults.Ok()).toEqual([]);

    const rGetResults = await ap.gets([]);
    expect(rGetResults.isOk()).toBe(true);
    expect(rGetResults.Ok()).toEqual([]);
  });
});
