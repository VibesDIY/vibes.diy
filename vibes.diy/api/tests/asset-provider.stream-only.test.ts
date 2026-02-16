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

function sizeOf(value: string): number {
  return to_uint8(value).byteLength;
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

  async put(stream: ReadableStream<Uint8Array>, size: number): Promise<Result<PutRow, Error>> {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const cid = `${this.seq++}`;
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

class TestSelector {
  private readonly small: TestImpl;
  private readonly big: TestImpl;

  constructor(small: TestImpl, big: TestImpl) {
    this.small = small;
    this.big = big;
  }

  select(writeSize: number): TestImpl {
    switch (true) {
      case writeSize <= 16:
        return this.small;
      default:
        return this.big;
    }
  }
}

describe("AssetProvider", () => {
  it("routes by size and round-trips stream content", async () => {
    const ti1 = new TestImpl("small:");
    const ti2 = new TestImpl("big:");
    const selector = new TestSelector(ti1, ti2);

    const ap = new AssetProvider([ti1, ti2], selector);

    const putResults = await ap.puts([
      { stream: string2stream("smallString"), size: sizeOf("smallString") },
      { stream: string2stream("longString........."), size: sizeOf("longString.........") },
    ]);

    expect(putResults).toHaveLength(2);
    expect(putResults[0].isOk()).toBe(true);
    expect(putResults[1].isOk()).toBe(true);

    const put0 = putResults[0].Ok();
    const put1 = putResults[1].Ok();
    expect(URI.from(put0.url).protocol).toBe("small:");
    expect(URI.from(put0.url).getParam("cid")).toBe(put0.cid);
    expect(URI.from(put1.url).protocol).toBe("big:");
    expect(URI.from(put1.url).getParam("cid")).toBe(put1.cid);
    expect(put0.size).toBe(sizeOf("smallString"));
    expect(put1.size).toBe(sizeOf("longString........."));

    const getResults = await ap.gets([put0.url, put1.url]);
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
});
