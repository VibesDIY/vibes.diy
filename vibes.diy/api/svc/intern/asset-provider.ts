import { exception2Result, URI } from "@adviser/cement";
import { eq } from "drizzle-orm";
import type { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";

export class AssetNotFoundError extends Error {
  readonly name = "AssetNotFoundError";
  constructor(public readonly url: string) {
    super(`Asset not found: ${url}`);
  }
}

export interface AssetPutItem {
  cid: string;
  data: Uint8Array;
}

export interface AssetPutResult {
  url: string;
  cid: string;
}

export interface AssetGetResult {
  url: string;
  cid: string;
  data: Uint8Array;
}

export type AssetGetItemResult =
  | { ok: true; value: AssetGetResult }
  | { ok: false; notFound: true; url: string; cid?: string }
  | { ok: false; notFound: false; url: string; error: Error };

export type AssetPutItemResult = { ok: true; value: AssetPutResult } | { ok: false; cid: string; error: Error };

export interface AssetBackend {
  readonly protocol: string;
  put(item: AssetPutItem): Promise<AssetPutItemResult>;
  get(url: string): Promise<AssetGetItemResult>;
  canGet(url: string): boolean;
}

export interface AssetSelector {
  select(backends: AssetBackend[], item: AssetPutItem): AssetBackend;
}

export interface AssetProvider {
  puts(items: AssetPutItem[]): Promise<AssetPutItemResult[]>;
  gets(urls: string[]): Promise<AssetGetItemResult[]>;
}

export interface R2BucketIf {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export function createAssetProvider(backends: AssetBackend[], selector: AssetSelector): AssetProvider {
  if (backends.length === 0) {
    throw new Error("AssetProvider requires at least one backend");
  }
  return {
    async puts(items) {
      return Promise.all(
        items.map(async (item) => {
          try {
            const backend = selector.select(backends, item);
            return await backend.put(item);
          } catch (e) {
            return { ok: false, cid: item.cid, error: e instanceof Error ? e : new Error(String(e)) } as const;
          }
        })
      );
    },
    async gets(urls) {
      return Promise.all(
        urls.map(async (url) => {
          try {
            const backend = backends.find((b) => b.canGet(url));
            if (!backend) {
              return {
                ok: false,
                notFound: false,
                url,
                error: new Error(`No backend for URL: ${url}`),
              } as const;
            }
            return await backend.get(url);
          } catch (e) {
            return {
              ok: false,
              notFound: false,
              url,
              error: e instanceof Error ? e : new Error(String(e)),
            } as const;
          }
        })
      );
    },
  };
}

export function createSqliteBackend(db: VibesSqlite): AssetBackend {
  return {
    protocol: "sql",
    async put(item) {
      const created = new Date().toISOString();
      const r = await exception2Result(() =>
        db.insert(sqlAssets).values({ assetId: item.cid, content: item.data, created }).onConflictDoNothing().run()
      );
      if (r.isErr()) {
        return { ok: false, cid: item.cid, error: r.Err() };
      }
      return { ok: true, value: { url: `sql:?cid=${item.cid}`, cid: item.cid } };
    },
    canGet(url) {
      try {
        return URI.from(url).protocol === "sql:";
      } catch {
        return false;
      }
    },
    async get(url) {
      const cid = URI.from(url).getParam("cid");
      if (!cid) {
        return { ok: false, notFound: false, url, error: new Error(`Missing cid in URL: ${url}`) };
      }
      const r = await exception2Result(() => db.select().from(sqlAssets).where(eq(sqlAssets.assetId, cid)).get());
      if (r.isErr()) {
        return { ok: false, notFound: false, url, error: r.Err() };
      }
      const asset = r.Ok();
      if (!asset) {
        return { ok: false, notFound: true, url, cid };
      }
      return { ok: true, value: { url, cid, data: asset.content as Uint8Array } };
    },
  };
}

export function createR2Backend(bucket: R2BucketIf): AssetBackend {
  return {
    protocol: "r2",
    async put(item) {
      try {
        await bucket.put(item.cid, item.data);
        return { ok: true, value: { url: `r2:?cid=${item.cid}`, cid: item.cid } };
      } catch (e) {
        return { ok: false, cid: item.cid, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    canGet(url) {
      try {
        return URI.from(url).protocol === "r2:";
      } catch {
        return false;
      }
    },
    async get(url) {
      const cid = URI.from(url).getParam("cid");
      if (!cid) {
        return { ok: false, notFound: false, url, error: new Error(`Missing cid in URL: ${url}`) };
      }
      try {
        const obj = await bucket.get(cid);
        if (!obj) {
          return { ok: false, notFound: true, url, cid };
        }
        return { ok: true, value: { url, cid, data: new Uint8Array(await obj.arrayBuffer()) } };
      } catch (e) {
        return { ok: false, notFound: false, url, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  };
}

export function createFirstSelector(): AssetSelector {
  return {
    select(backends) {
      return backends[0];
    },
  };
}

export function createSizeSelector(threshold: number, allBackends: AssetBackend[]): AssetSelector {
  const largeBackend = allBackends.find((b) => b.protocol === "r2") ?? allBackends[0];
  const smallBackend = allBackends.find((b) => b.protocol === "sql") ?? allBackends[0];
  return {
    select(_backends, item) {
      return item.data.byteLength > threshold ? largeBackend : smallBackend;
    },
  };
}

export function parseAsSetup(
  asSetup: string,
  bindings: { db: VibesSqlite; r2Bucket?: R2BucketIf }
): { backends: AssetBackend[]; selector: AssetSelector } {
  const backends: AssetBackend[] = [];
  let sizeThreshold: number | undefined;
  for (const entry of asSetup.split(",").map((s) => s.trim()).filter(Boolean)) {
    const uri = URI.from(entry);
    switch (uri.protocol) {
      case "sqlite:":
        backends.push(createSqliteBackend(bindings.db));
        break;
      case "r2:":
        if (!bindings.r2Bucket) {
          throw new Error("AS_SETUP references r2: but no R2 bucket binding provided");
        }
        backends.push(createR2Backend(bindings.r2Bucket));
        {
          const t = uri.getParam("threshold");
          if (t) {
            sizeThreshold = parseInt(t, 10);
          }
        }
        break;
      default:
        throw new Error(`Unknown AS_SETUP backend protocol: ${uri.protocol}. Supported: sqlite:, r2:`);
    }
  }
  if (backends.length === 0) {
    throw new Error("AS_SETUP produced no backends");
  }
  const selector = sizeThreshold != null ? createSizeSelector(sizeThreshold, backends) : createFirstSelector();
  return { backends, selector };
}

export function createAssetProviderFromEnv(db: VibesSqlite, env: Record<string, string>, r2Bucket?: R2BucketIf): AssetProvider {
  const asSetup = env.AS_SETUP;
  if (asSetup) {
    const { backends, selector } = parseAsSetup(asSetup, { db, r2Bucket });
    return createAssetProvider(backends, selector);
  }
  return createAssetProvider([createSqliteBackend(db)], createFirstSelector());
}
