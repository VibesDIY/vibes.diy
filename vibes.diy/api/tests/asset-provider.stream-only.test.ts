import { BuildURI, Option, Result, to_uint8, URI } from "@adviser/cement";
import { describe, expect, it } from "vitest";
import { AssetProvider, type AssetBackend, type AssetGetRow, type AssetPutRow } from "@vibes.diy/api-svc/intern/asset-provider.js";
import { InMemoryTestBackend, stream2string, string2stream } from "./asset-provider.test-utils.js";

class SlowPutBackend implements AssetBackend {
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

  async put(stream: ReadableStream<Uint8Array>): Promise<Result<AssetPutRow, Error>> {
    this.inflight += 1;
    this.maxInflight = Math.max(this.maxInflight, this.inflight);
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    this.inflight -= 1;
    const cid = `${this.seq++}`;
    const url = BuildURI.from(this.protocol + "//").setParam("cid", cid).toString();
    return Result.Ok({ cid, url, size: bytes.byteLength });
  }

  async get(_url: string): Promise<Result<Option<AssetGetRow>, Error>> {
    return Result.Ok(Option.None());
  }
}

describe("AssetProvider", () => {
  it("stores and round-trips stream content", async () => {
    const backend = new InMemoryTestBackend("small:");
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
    const backend = new SlowPutBackend("small:");
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
    const ap = new AssetProvider([new InMemoryTestBackend("small:")]);

    const rPutResults = await ap.puts([]);
    expect(rPutResults.isOk()).toBe(true);
    expect(rPutResults.Ok()).toEqual([]);

    const rGetResults = await ap.gets([]);
    expect(rGetResults.isOk()).toBe(true);
    expect(rGetResults.Ok()).toEqual([]);
  });
});
