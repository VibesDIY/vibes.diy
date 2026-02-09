import { describe, expect, it } from "vitest";
import {
  AssetBackend,
  AssetGetItemResult,
  AssetPutItem,
  AssetPutItemResult,
  createAssetProvider,
  createFirstSelector,
  createSizeSelector,
  parseAsSetup,
} from "@vibes.diy/api-svc/intern/asset-provider.js";
import type { VibesSqlite } from "@vibes.diy/api-svc/create-handler.js";

function createMemoryBackend(protocol: "sql" | "r2"): AssetBackend {
  const store = new Map<string, Uint8Array>();
  return {
    protocol,
    async put(item: AssetPutItem): Promise<AssetPutItemResult> {
      store.set(item.cid, item.data);
      return { ok: true, value: { cid: item.cid, url: `${protocol}:?cid=${item.cid}` } };
    },
    canGet(url: string): boolean {
      return url.startsWith(`${protocol}:`);
    },
    async get(url: string): Promise<AssetGetItemResult> {
      const match = /[?&]cid=([^&]+)/.exec(url);
      const cid = match?.[1];
      if (!cid) {
        return { ok: false, notFound: false, url, error: new Error(`Missing cid in URL: ${url}`) };
      }
      const found = store.get(cid);
      if (!found) {
        return { ok: false, notFound: true, url, cid };
      }
      return { ok: true, value: { url, cid, data: found } };
    },
  };
}

function createErrorBackend(protocol: string): AssetBackend {
  return {
    protocol,
    async put(item: AssetPutItem): Promise<AssetPutItemResult> {
      return { ok: false, cid: item.cid, error: new Error(`${protocol} put failed`) };
    },
    canGet(url: string): boolean {
      return url.startsWith(`${protocol}:`);
    },
    async get(url: string): Promise<AssetGetItemResult> {
      return { ok: false, notFound: false, url, error: new Error(`${protocol} get failed`) };
    },
  };
}

describe("AssetProvider", () => {
  it("puts and gets with multiple backends via selector", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const r2Backend = createMemoryBackend("r2");
    const selector = createSizeSelector(1024, [sqlBackend, r2Backend]);
    const ap = createAssetProvider([sqlBackend, r2Backend], selector);

    const small = { cid: "zSmall", data: new Uint8Array(100) };
    const large = { cid: "zLarge", data: new Uint8Array(2000) };

    const puts = await ap.puts([small, large]);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(true);
    if (puts[0]?.ok) {
      expect(puts[0].value.url).toMatch(/^sql:/);
    }
    if (puts[1]?.ok) {
      expect(puts[1].value.url).toMatch(/^r2:/);
    }

    const urls = puts.map((p) => (p.ok ? p.value.url : ""));
    const gets = await ap.gets(urls);
    expect(gets[0]?.ok).toBe(true);
    expect(gets[1]?.ok).toBe(true);
    if (gets[0]?.ok) {
      expect(gets[0].value.data).toEqual(small.data);
    }
    if (gets[1]?.ok) {
      expect(gets[1].value.data).toEqual(large.data);
    }
  });

  it("gets returns NotFound per-item without aborting batch", async () => {
    const sqlBackend = createMemoryBackend("sql");
    const ap = createAssetProvider([sqlBackend], createFirstSelector());
    const gets = await ap.gets(["sql:?cid=nonexistent", "sql:?cid=alsoMissing"]);
    expect(gets).toHaveLength(2);
    expect(gets[0]?.ok).toBe(false);
    if (gets[0] && !gets[0].ok) {
      expect(gets[0].notFound).toBe(true);
    }
    expect(gets[1]?.ok).toBe(false);
    if (gets[1] && !gets[1].ok) {
      expect(gets[1].notFound).toBe(true);
    }
  });

  it("parseAsSetup creates backends from env string", () => {
    const mockDb = {} as VibesSqlite;
    const mockBucket = {
      put: async () => {
        return undefined;
      },
      get: async () => null,
    };
    const { backends } = parseAsSetup("sqlite://local,r2://bucket?threshold=4096", {
      db: mockDb,
      r2Bucket: mockBucket,
    });
    expect(backends).toHaveLength(2);
    expect(backends[0]?.protocol).toBe("sql");
    expect(backends[1]?.protocol).toBe("r2");
  });

  it("parseAsSetup throws on empty", () => {
    const mockDb = {} as VibesSqlite;
    expect(() => parseAsSetup("", { db: mockDb })).toThrow("AS_SETUP produced no backends");
  });

  it("parseAsSetup throws on unsupported protocol", () => {
    const mockDb = {} as VibesSqlite;
    expect(() => parseAsSetup("s3://bucket", { db: mockDb })).toThrow("Unknown AS_SETUP backend protocol");
  });

  it("parseAsSetup throws on invalid r2 threshold", () => {
    const mockDb = {} as VibesSqlite;
    const mockBucket = {
      put: async () => {
        return undefined;
      },
      get: async () => null,
    };
    expect(() => parseAsSetup("sqlite://local,r2://bucket?threshold=abc", { db: mockDb, r2Bucket: mockBucket })).toThrow(
      "Invalid r2 threshold"
    );
    expect(() => parseAsSetup("sqlite://local,r2://bucket?threshold=-1", { db: mockDb, r2Bucket: mockBucket })).toThrow(
      "Invalid r2 threshold"
    );
    expect(() => parseAsSetup("sqlite://local,r2://bucket?threshold=1.5", { db: mockDb, r2Bucket: mockBucket })).toThrow(
      "Invalid r2 threshold"
    );
  });

  it("puts results match argument positions", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());
    const items = [
      { cid: "zFirst", data: new Uint8Array([1]) },
      { cid: "zSecond", data: new Uint8Array([2]) },
      { cid: "zThird", data: new Uint8Array([3]) },
    ];
    const puts = await ap.puts(items);
    expect(puts).toHaveLength(3);
    for (let i = 0; i < items.length; i++) {
      const r = puts[i];
      expect(r?.ok).toBe(true);
      if (r?.ok) {
        expect(r.value.cid).toBe(items[i].cid);
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
    await ap.puts(items);
    // request in reverse order
    const gets = await ap.gets(["sql:?cid=zB", "sql:?cid=zA"]);
    expect(gets).toHaveLength(2);
    if (gets[0]?.ok) expect(gets[0].value.data).toEqual(new Uint8Array([20]));
    if (gets[1]?.ok) expect(gets[1].value.data).toEqual(new Uint8Array([10]));
  });

  it("error-only backend returns errors for all puts", async () => {
    const backend = createErrorBackend("fail");
    const ap = createAssetProvider([backend], createFirstSelector());
    const puts = await ap.puts([
      { cid: "z1", data: new Uint8Array(10) },
      { cid: "z2", data: new Uint8Array(20) },
    ]);
    expect(puts).toHaveLength(2);
    for (const r of puts) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.message).toMatch(/fail put failed/);
      }
    }
  });

  it("error-only backend returns errors for all gets", async () => {
    const backend = createErrorBackend("fail");
    const ap = createAssetProvider([backend], createFirstSelector());
    const gets = await ap.gets(["fail:?cid=z1", "fail:?cid=z2"]);
    expect(gets).toHaveLength(2);
    for (const r of gets) {
      expect(r.ok).toBe(false);
      if (!r.ok && !r.notFound) {
        expect(r.error.message).toMatch(/fail get failed/);
      }
    }
  });

  it("mixed results: some puts succeed, some fail", async () => {
    const good = createMemoryBackend("sql");
    const bad = createErrorBackend("r2");
    const selector = createSizeSelector(100, [good, bad]);
    const ap = createAssetProvider([good, bad], selector);

    const puts = await ap.puts([
      { cid: "zSmall", data: new Uint8Array(50) },  // → sql (good)
      { cid: "zBig", data: new Uint8Array(200) },    // → r2 (bad)
    ]);
    expect(puts).toHaveLength(2);
    expect(puts[0]?.ok).toBe(true);
    expect(puts[1]?.ok).toBe(false);
    if (puts[0]?.ok) expect(puts[0].value.cid).toBe("zSmall");
    if (puts[1] && !puts[1].ok) expect(puts[1].cid).toBe("zBig");
  });

  it("gets with no matching backend returns error, not notFound", async () => {
    const backend = createMemoryBackend("sql");
    const ap = createAssetProvider([backend], createFirstSelector());
    const gets = await ap.gets(["unknown:?cid=z1"]);
    expect(gets).toHaveLength(1);
    expect(gets[0]?.ok).toBe(false);
    if (gets[0] && !gets[0].ok && !gets[0].notFound) {
      expect(gets[0].error.message).toMatch(/No backend for URL/);
    }
  });

  it("error results carry cid on puts and url on gets", async () => {
    const backend = createErrorBackend("err");
    const ap = createAssetProvider([backend], createFirstSelector());

    const puts = await ap.puts([{ cid: "zMyCid", data: new Uint8Array(1) }]);
    if (puts[0] && !puts[0].ok) {
      expect(puts[0].cid).toBe("zMyCid");
    }

    const gets = await ap.gets(["err:?cid=zMyCid"]);
    if (gets[0] && !gets[0].ok && !gets[0].notFound) {
      expect(gets[0].url).toBe("err:?cid=zMyCid");
      expect(gets[0].error).toBeInstanceOf(Error);
    }
  });
});
