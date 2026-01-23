import { CoerceBinaryInput, exception2Result, Result, to_uint8, URI } from "@adviser/cement";
import { AssetStorage, StorageResult } from "../api.js";
import { eq } from "drizzle-orm";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";

export interface R2If {
  put(data: ReadableStream<Uint8Array>): Promise<void>;
  get(): Promise<ReadableStream<Uint8Array> | null>;
}

export interface CalcCidResult {
  cid: string;
  data: Uint8Array;
  dataStr(): string;
}
export async function calcCid({ sthis }: { sthis: SuperThis }, content: CoerceBinaryInput): Promise<CalcCidResult> {
  const uint8Content = to_uint8(content);
  const hash = await sha256.digest(uint8Content);
  return {
    cid: base58btc.encode(hash.digest),
    data: uint8Content,
    dataStr: () => {
      if (typeof content === "string") {
        return content;
      } else {
        return sthis.txt.decode(uint8Content);
      }
    },
  };
}

export function ensureStorage(
  db: VibesSqlite,
  r2ForCid?: (cid: string) => R2If,
  sizeThreshold = 4096
): (...items: { cid: string; data: Uint8Array }[]) => Promise<Result<StorageResult[]>> {
  return async (...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>> => {
    const now = new Date();
    const created = now.toISOString();
    const sqlItems = r2ForCid ? items.filter((i) => i.data.byteLength <= sizeThreshold) : items;
    const r2Items = r2ForCid ? items.filter((i) => i.data.byteLength > sizeThreshold) : [];
    const res = await exception2Result(() =>
      db
        .insert(sqlAssets)
        .values(
          sqlItems.map((item) => ({
            assetId: item.cid,
            content: item.data,
            created,
          }))
        )
        .onConflictDoNothing()
        .run()
    );
    if (res.isErr()) {
      return Result.Err(res);
    }
    if (r2ForCid && r2Items.length) {
      await Promise.all(r2Items.map((i) => r2ForCid(i.cid).put(new ReadableStream({ start(c) { c.enqueue(i.data); c.close(); } }))));
    }
    return Result.Ok(
      items.map((item) => ({
        cid: item.cid,
        getURL: r2ForCid && item.data.byteLength > sizeThreshold ? `r2://Assets/${item.cid}` : `sql://Assets/${item.cid}`,
        mode: "existing",
        created: now,
        size: item.data.byteLength,
      }))
    );
  };
}

export function createAssetStorage(db: VibesSqlite, r2ForCid?: (cid: string) => R2If, sizeThreshold = 4096): AssetStorage {
  return {
    ensureAsset: ensureStorage(db, r2ForCid, sizeThreshold),
    async fetchAssets(...urls: string[]): Promise<Result<{ url: string; asset: Uint8Array }>[]> {
      return Promise.all(
        urls.map(async (url): Promise<Result<{ url: string; asset: Uint8Array }>> => {
          const uri = URI.from(url);
          const cid = uri.pathname.split("/").pop();
          if (!cid) {
            return Result.Err(new Error(`Invalid asset URL: ${url}`));
          }
          if (uri.protocol === "sql:") {
            const a = await db.select().from(sqlAssets).where(eq(sqlAssets.assetId, cid)).get();
            return a ? Result.Ok({ url, asset: a.content as Uint8Array }) : Result.Err(new Error("Not found"));
          }
          if (uri.protocol === "r2:" && r2ForCid) {
            const s = await r2ForCid(cid).get();
            return s
              ? Result.Ok({ url, asset: new Uint8Array(await new Response(s).arrayBuffer()) })
              : Result.Err(new Error("Not found"));
          }
          return Result.Err(new Error(`Unsupported: ${uri.protocol}`));
        })
      );
    },
  };
}
