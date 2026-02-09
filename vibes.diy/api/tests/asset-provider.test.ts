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
});
