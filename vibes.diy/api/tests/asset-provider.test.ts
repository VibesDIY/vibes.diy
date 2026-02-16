import { describe, expect, it } from "vitest";
import {
  AssetBackend,
  AssetGetResult,
  AssetPutItem,
  AssetPutItemResult,
  AssetProvider,
  buildAssetUrl,
  createAssetProvider,
  createFirstSelector,
  createSizeSelector,
  parseAsSetup,
  parseAssetUrl,
} from "@vibes.diy/api-svc/intern/asset-provider.js";
import { isReadableStreamContent } from "@vibes.diy/api-svc/intern/render-vibes.js";
import type { VibesSqlite } from "@vibes.diy/api-svc/create-handler.js";
import { Option, Result, stream2array, uint8array2stream } from "@adviser/cement";

async function contentToUint8(content: Uint8Array | ReadableStream<Uint8Array>): Promise<Uint8Array> {
  if (isReadableStreamContent(content)) {
    const chunks = await stream2array(content);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
  return content;
}

async function expectOkPuts(ap: AssetProvider, items: AssetPutItem[]): Promise<AssetPutItemResult[]> {
  const result = await ap.puts(items);
  expect(result.isOk()).toBe(true);
  return result.Ok();
}

async function expectOkGets(ap: AssetProvider, urls: string[]): Promise<AssetGetResult[]> {
  const result = await ap.gets(urls);
  expect(result.isOk()).toBe(true);
  return result.Ok();
}

function createMemoryBackend(protocol: "sql" | "r2"): AssetBackend {
  const store = new Map<string, Uint8Array>();
  return {
    protocol,
    async puts(items: AssetPutItem[]): Promise<AssetPutItemResult[]> {
      return items.map((item) => {
        store.set(item.cid, item.data);
        return { ok: true, value: { url: buildAssetUrl(protocol, item.cid) } };
      });
    },
    canGet(url: string): boolean {
      const parsed = parseAssetUrl(url);
      return parsed.IsSome() && parsed.unwrap().protocol === protocol;
    },
    async gets(urls: string[]): Promise<AssetGetResult[]> {
      return urls.map((url) => {
        const parsed = parseAssetUrl(url);
        const cid = parsed.IsSome() ? parsed.unwrap().cid : undefined;
        if (cid === undefined) return Result.Ok(Option.None());
        const found = store.get(cid);
        if (found === undefined) return Result.Ok(Option.None());
        if (protocol === "r2") {
          return Result.Ok(Option.Some(uint8array2stream(found)));
        }
        return Result.Ok(Option.Some(found));
      });
    },
  };
}

function createErrorBackend(protocol: string): AssetBackend {
  return {
    protocol,
    async puts(items: AssetPutItem[]): Promise<AssetPutItemResult[]> {
      return items.map(() => ({
        ok: false,
        error: new Error(`${protocol} put failed`),
      }));
    },
    canGet(url: string): boolean {
      const parsed = parseAssetUrl(url);
      return parsed.IsSome() && parsed.unwrap().protocol === protocol;
    },
    async gets(urls: string[]): Promise<AssetGetResult[]> {
      return urls.map(() => Result.Err(new Error(`${protocol} get failed`)));
    },
  };
}

describe("asset URL parsing", () => {
  it("buildAssetUrl produces canonical format with ://", () => {
    const sqlUrl = buildAssetUrl("sql", "zTestCid");
    expect(sqlUrl).toMatch(/^sql:\/\//);
    expect(sqlUrl).toContain("cid=zTestCid");

    const r2Url = buildAssetUrl("r2", "zTestCid");
    expect(r2Url).toMatch(/^r2:\/\//);
    expect(r2Url).toContain("cid=zTestCid");
  });

  it("buildAssetUrl round-trips through parseAssetUrl", () => {
    for (const protocol of ["sql", "r2"] as const) {
      const url = buildAssetUrl(protocol, "zTestCid123");
      const parsed = parseAssetUrl(url);
      expect(parsed.IsSome()).toBe(true);
      expect(parsed.unwrap().protocol).toBe(protocol);
      expect(parsed.unwrap().cid).toBe("zTestCid123");
    }
  });

  it("parseAssetUrl rejects URLs without ://", () => {
    expect(parseAssetUrl("sql:?cid=zFoo").IsNone()).toBe(true);
    expect(parseAssetUrl("r2:?cid=zBar").IsNone()).toBe(true);
  });

  it("parseAssetUrl accepts URLs with ://", () => {
    const sql = parseAssetUrl("sql://?cid=zFoo");
    expect(sql.IsSome()).toBe(true);
    expect(sql.unwrap().protocol).toBe("sql");
    const r2 = parseAssetUrl("r2://?cid=zBar");
    expect(r2.IsSome()).toBe(true);
    expect(r2.unwrap().protocol).toBe("r2");
  });
});

describe("AssetProvider", () => {
  it("puts and gets with multiple backends via selector", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const r2Backend = createMemoryBackend("r2");
    const selector = createSizeSelector(1024, [sqlBackend, r2Backend]);
    const ap = createAssetProvider([sqlBackend, r2Backend], selector);

    const small = { cid: "zSmall", data: new Uint8Array(100) };
    const large = { cid: "zLarge", data: new Uint8Array(2000) };

    const puts = await expectOkPuts(ap, [small, large]);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(true);
    if (puts[0]?.ok) expect(puts[0].value.url).toMatch(/^sql:/);
    if (puts[1]?.ok) expect(puts[1].value.url).toMatch(/^r2:/);

    const urls = puts.map((p) => (p.ok ? p.value.url : ""));
    const gets = await expectOkGets(ap, urls);
    expect(gets[0].isOk()).toBe(true);
    expect(gets[0].Ok().IsSome()).toBe(true);
    expect(gets[1].isOk()).toBe(true);
    expect(gets[1].Ok().IsSome()).toBe(true);
    expect(await contentToUint8(gets[0].Ok().unwrap())).toEqual(small.data);
    expect(await contentToUint8(gets[1].Ok().unwrap())).toEqual(large.data);
  });

  it("puts preserves order with interleaved backends", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const r2Backend = createMemoryBackend("r2");
    const selector = createSizeSelector(1024, [sqlBackend, r2Backend]);
    const ap = createAssetProvider([sqlBackend, r2Backend], selector);

    const items = [
      { cid: "zSmall1", data: new Uint8Array(100) },
      { cid: "zLarge1", data: new Uint8Array(2000) },
      { cid: "zSmall2", data: new Uint8Array(200) },
      { cid: "zLarge2", data: new Uint8Array(3000) },
      { cid: "zSmall3", data: new Uint8Array(300) },
    ];

    const puts = await expectOkPuts(ap, items);
    expect(puts).toHaveLength(5);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(true);
    expect(puts[2]?.ok).toBe(true);
    expect(puts[3]?.ok).toBe(true);
    expect(puts[4]?.ok).toBe(true);
  });

  it("gets returns None per-item without aborting batch", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const ap = createAssetProvider([sqlBackend], createFirstSelector());
    const gets = await expectOkGets(ap, [buildAssetUrl("sql", "nonexistent"), buildAssetUrl("sql", "alsoMissing")]);
    expect(gets).toHaveLength(2);
    expect(gets[0].isOk()).toBe(true);
    expect(gets[0].Ok().IsNone()).toBe(true);
    expect(gets[1].isOk()).toBe(true);
    expect(gets[1].Ok().IsNone()).toBe(true);
  });

  it("parseAsSetup creates backends from env string", () => {
    const mockDb = {} as VibesSqlite;
    const mockBucket = {
      put: async () => undefined,
      get: async () => null,
    };
    const result = parseAsSetup("sqlite://local,r2://bucket?threshold=4096", { db: mockDb, r2Bucket: mockBucket });
    expect(result.isOk()).toBe(true);
    const { backends } = result.Ok();
    expect(backends).toHaveLength(2);
    expect(backends[0]?.protocol).toBe("sql");
    expect(backends[1]?.protocol).toBe("r2");
  });

  it("parseAsSetup returns error on empty", () => {
    const mockDb = {} as VibesSqlite;
    const result = parseAsSetup("", { db: mockDb });
    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toContain("AS_SETUP produced no backends");
  });

  it("parseAsSetup returns error on unsupported protocol", () => {
    const mockDb = {} as VibesSqlite;
    const result = parseAsSetup("s3://bucket", { db: mockDb });
    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toContain("Unknown AS_SETUP backend protocol");
  });

  it("parseAsSetup returns error on invalid r2 threshold", () => {
    const mockDb = {} as VibesSqlite;
    const mockBucket = {
      put: async () => undefined,
      get: async () => null,
    };
    const r1 = parseAsSetup("sqlite://local,r2://bucket?threshold=abc", { db: mockDb, r2Bucket: mockBucket });
    expect(r1.isErr()).toBe(true);
    expect(r1.Err().message).toContain("Invalid r2 threshold");

    const r2 = parseAsSetup("sqlite://local,r2://bucket?threshold=-1", { db: mockDb, r2Bucket: mockBucket });
    expect(r2.isErr()).toBe(true);
    expect(r2.Err().message).toContain("Invalid r2 threshold");

    const r3 = parseAsSetup("sqlite://local,r2://bucket?threshold=1.5", { db: mockDb, r2Bucket: mockBucket });
    expect(r3.isErr()).toBe(true);
    expect(r3.Err().message).toContain("Invalid r2 threshold");
  });

  it("puts results match argument positions", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());
    const items = [
      { cid: "zFirst", data: new Uint8Array([1]) },
      { cid: "zSecond", data: new Uint8Array([2]) },
      { cid: "zThird", data: new Uint8Array([3]) },
    ];
    const puts = await expectOkPuts(ap, items);
    expect(puts).toHaveLength(3);
    for (let i = 0; i < items.length; i++) {
      const r = puts[i];
      expect(r?.ok).toBe(true);
      if (r?.ok) {
        const parsed = parseAssetUrl(r.value.url);
        expect(parsed.IsSome()).toBe(true);
        expect(parsed.unwrap().cid).toBe(items[i].cid);
      }
    }
  });

  it("gets results match argument positions", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());
    const items = [
      { cid: "zA", data: new Uint8Array([10]) },
      { cid: "zB", data: new Uint8Array([20]) },
    ];
    await expectOkPuts(ap, items);
    const gets = await expectOkGets(ap, [buildAssetUrl("sql", "zB"), buildAssetUrl("sql", "zA")]);
    expect(gets).toHaveLength(2);
    expect(await contentToUint8(gets[0].Ok().unwrap())).toEqual(new Uint8Array([20]));
    expect(await contentToUint8(gets[1].Ok().unwrap())).toEqual(new Uint8Array([10]));
  });

  it("error-only backend returns errors for all puts", async () => {
    const backend = createErrorBackend("fail");
    const ap = createAssetProvider([backend], createFirstSelector());
    const puts = await expectOkPuts(ap, [
      { cid: "z1", data: new Uint8Array(10) },
      { cid: "z2", data: new Uint8Array(20) },
    ]);
    expect(puts).toHaveLength(2);
    for (const r of puts) {
      expect(r.ok).toBe(false);
      if (r.ok === false) expect(r.error.message).toMatch(/fail put failed/);
    }
  });

  it("error-only backend returns Err for all gets", async () => {
    const backend = createErrorBackend("fail");
    const ap = createAssetProvider([backend], createFirstSelector());
    const gets = await expectOkGets(ap, [buildAssetUrl("fail", "z1"), buildAssetUrl("fail", "z2")]);
    expect(gets).toHaveLength(2);
    for (const r of gets) {
      expect(r.isErr()).toBe(true);
      expect(r.Err().message).toMatch(/fail get failed/);
    }
  });

  it("mixed results: some puts succeed, some fail", async () => {
    const good = createMemoryBackend("sql");
    const bad = createErrorBackend("r2");
    const selector = createSizeSelector(100, [good, bad]);
    const ap = createAssetProvider([good, bad], selector);

    const puts = await expectOkPuts(ap, [
      { cid: "zSmall", data: new Uint8Array(50) },
      { cid: "zBig", data: new Uint8Array(200) },
    ]);
    expect(puts).toHaveLength(2);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(false);
    if (puts[0]?.ok) expect(puts[0].value.url).toContain("zSmall");
    if (puts[1] && !puts[1].ok) expect(puts[1].error.message).toContain("r2 put failed");
  });

  it("gets with no matching backend returns per-item error", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());
    const result = await ap.gets([buildAssetUrl("unknown", "z1")]);
    expect(result.isOk()).toBe(true);
    const gets = result.Ok();
    expect(gets).toHaveLength(1);
    expect(gets[0].isErr()).toBe(true);
    expect(gets[0].Err().message).toContain("No backend configured to handle asset URL");
    expect(gets[0].Err().message).toContain("unknown://");
  });

  it("error results preserve positional puts and Err gets", async () => {
    const backend = createErrorBackend("err");
    const ap = createAssetProvider([backend], createFirstSelector());

    const puts = await expectOkPuts(ap, [{ cid: "zMyCid", data: new Uint8Array(1) }]);
    expect(puts[0]?.ok).toBe(false);

    const gets = await expectOkGets(ap, [buildAssetUrl("err", "zMyCid")]);
    expect(gets[0].isErr()).toBe(true);
  });

  it("puts preserves positional results for duplicate cids (no dedupe)", async () => {
    const backend: AssetBackend = {
      protocol: "track",
      async puts(items) {
        return items.map((item) => ({
          ok: true,
          value: { url: `track://${item.cid}-${item.data[0]}` },
        }));
      },
      canGet() {
        return false;
      },
      async gets() {
        return [];
      },
    };
    const ap = createAssetProvider([backend], createFirstSelector());
    const puts = await expectOkPuts(ap, [
      { cid: "zDup", data: new Uint8Array([1]) },
      { cid: "zOther", data: new Uint8Array([9]) },
      { cid: "zDup", data: new Uint8Array([2]) },
    ]);

    expect(puts).toHaveLength(3);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(true);
    expect(puts[2]?.ok).toBe(true);
    if (puts[0]?.ok) {
      expect(puts[0].value.url).toBe("track://zDup-1");
    }
    if (puts[2]?.ok) {
      expect(puts[2].value.url).toBe("track://zDup-2");
    }
  });

  it("gets preserves order with duplicate URLs", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());

    await expectOkPuts(ap, [
      { cid: "zDup", data: new Uint8Array([42]) },
      { cid: "zOther", data: new Uint8Array([99]) },
    ]);

    const dupUrl = buildAssetUrl("sql", "zDup");
    const otherUrl = buildAssetUrl("sql", "zOther");
    const gets = await expectOkGets(ap, [dupUrl, otherUrl, dupUrl]);

    expect(gets).toHaveLength(3);
    expect(gets[0].isOk()).toBe(true);
    expect(gets[1].isOk()).toBe(true);
    expect(gets[2].isOk()).toBe(true);
    expect(gets[0].Ok().IsSome()).toBe(true);
    expect(gets[2].Ok().IsSome()).toBe(true);

    const data0 = await contentToUint8(gets[0].Ok().unwrap());
    expect(data0).toEqual(new Uint8Array([42]));
  });

  it("gets duplicate streamed URLs provide independent consumable streams", async () => {
    const backend = createMemoryBackend("r2");
    const ap = createAssetProvider([backend], createFirstSelector());
    const expected = new Uint8Array([7, 8, 9]);
    await expectOkPuts(ap, [{ cid: "zDupStream", data: expected }]);

    const dupUrl = buildAssetUrl("r2", "zDupStream");
    const gets = await expectOkGets(ap, [dupUrl, dupUrl]);

    expect(gets).toHaveLength(2);
    expect(gets[0].isOk()).toBe(true);
    expect(gets[1].isOk()).toBe(true);
    expect(gets[0].Ok().IsSome()).toBe(true);
    expect(gets[1].Ok().IsSome()).toBe(true);

    const content0 = gets[0].Ok().unwrap();
    const content1 = gets[1].Ok().unwrap();
    expect(isReadableStreamContent(content0)).toBe(true);
    expect(isReadableStreamContent(content1)).toBe(true);
    expect(content0).not.toBe(content1);

    const [data0, data1] = await Promise.all([contentToUint8(content0), contentToUint8(content1)]);
    expect(data0).toEqual(expected);
    expect(data1).toEqual(expected);
  });

  it("puts returns fatal error on backend count mismatch", async () => {
    const badBackend: AssetBackend = {
      protocol: "bad",
      async puts(items) {
        return items.slice(0, -1).map((item) => ({
          ok: true,
          value: { url: buildAssetUrl("bad", item.cid) },
        }));
      },
      canGet() {
        return false;
      },
      async gets() {
        return [];
      },
    };

    const ap = createAssetProvider([badBackend], createFirstSelector());
    const result = await ap.puts([
      { cid: "z1", data: new Uint8Array(10) },
      { cid: "z2", data: new Uint8Array(20) },
    ]);

    expect(result.isErr()).toBe(true);
    const error = result.Err();
    expect(error.type).toBe("asset-provider-fatal");
    expect(error.code).toBe("BACKEND_PUT_RESULT_COUNT_MISMATCH");
    expect(error.message).toContain("returned 1 put results for 2 input items");
  });

  it("gets returns fatal error on backend count mismatch", async () => {
    const badBackend: AssetBackend = {
      protocol: "bad",
      async puts() {
        return [];
      },
      canGet(url) {
        return url.startsWith("bad://");
      },
      async gets(urls) {
        return urls.slice(0, -1).map(() => Result.Ok(Option.None()));
      },
    };

    const ap = createAssetProvider([badBackend], createFirstSelector());
    const result = await ap.gets([buildAssetUrl("bad", "z1"), buildAssetUrl("bad", "z2")]);

    expect(result.isErr()).toBe(true);
    const error = result.Err();
    expect(error.type).toBe("asset-provider-fatal");
    expect(error.code).toBe("BACKEND_GET_RESULT_COUNT_MISMATCH");
    expect(error.message).toContain("returned 1 get results for 2 input URLs");
  });

  it("gets preserves batch and returns per-item errors for unknown URLs", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const ap = createAssetProvider([sqlBackend], createFirstSelector());

    // Try to get URLs with invalid/unsupported protocols
    const result = await ap.gets(["http://example.com/foo", "https://example.com/bar", buildAssetUrl("r2", "validCid")]);

    expect(result.isOk()).toBe(true);
    const gets = result.Ok();
    expect(gets).toHaveLength(3);
    expect(gets[0].isErr()).toBe(true);
    expect(gets[1].isErr()).toBe(true);
    expect(gets[2].isErr()).toBe(true);
    expect(gets[0].Err().message).toContain("http://example.com/foo");
    expect(gets[1].Err().message).toContain("https://example.com/bar");
    expect(gets[2].Err().message).toContain("r2://");
  });
});
