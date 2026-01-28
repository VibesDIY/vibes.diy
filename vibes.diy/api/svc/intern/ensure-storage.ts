import { BuildURI, CoerceBinaryInput, exception2Result, Result, to_uint8, URI } from "@adviser/cement";
import { eq } from "drizzle-orm";
import { StorageResult } from "../api.js";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";

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

export class StorageNotFoundError extends Error {
  constructor(public readonly cid: string) {
    super(`Asset not found: ${cid}`);
    this.name = "StorageNotFoundError";
  }
}

export interface R2If {
  put(cid: string, data: Uint8Array): Promise<Result<void>>;
  get(cid: string): ReadableStream<Uint8Array>; // Returns stream directly
}

export function ensureStorage(
  db: VibesSqlite,
  r2?: R2If,
  sizeThreshold = 4096
): (...items: { cid: string; data: Uint8Array }[]) => Promise<Result<StorageResult[]>> {
  return async (...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>> => {
    const now = new Date();
    const created = now.toISOString();
    const results: StorageResult[] = [];

    for (const item of items) {
      const useR2 = r2 && item.data.byteLength > sizeThreshold;
      if (useR2) {
        const res = await r2.put(item.cid, item.data);
        if (res.isErr()) return Result.Err(res.Err());
        results.push({
          cid: item.cid,
          getURL: BuildURI.from("r2:").setParam("cid", item.cid).toString(),
          mode: "existing",
          created: now,
          size: item.data.byteLength,
        });
      } else {
        const res = await exception2Result(() =>
          db.insert(sqlAssets).values({ assetId: item.cid, content: item.data, created: created }).onConflictDoNothing().run()
        );
        if (res.isErr()) return Result.Err(res);
        results.push({
          cid: item.cid,
          getURL: BuildURI.from("sql:").setParam("cid", item.cid).toString(),
          mode: "existing",
          created: now,
          size: item.data.byteLength,
        });
      }
    }
    return Result.Ok(results);
  };
}

export function fetchStorage(
  db: VibesSqlite,
  r2?: R2If
): (url: string) => ReadableStream<Uint8Array> {
  return (url: string): ReadableStream<Uint8Array> => {
    const rUri = exception2Result(() => URI.from(url));
    if (rUri.isErr()) {
      return new ReadableStream({
        start(controller) {
          controller.error(rUri.Err());
        },
      });
    }
    const uri = rUri.Ok();
    const cid = uri.getParam("cid");

    if (!cid) {
      return new ReadableStream({
        start(controller) {
          controller.error(new Error(`Missing cid param in URL: ${url}`));
        },
      });
    }

    switch (uri.protocol) {
      case "sql:": {
        return new ReadableStream({
          async start(controller) {
            const rAsset = await exception2Result(() =>
              db.select().from(sqlAssets).where(eq(sqlAssets.assetId, cid)).get()
            );
            if (rAsset.isErr()) {
              // Non-recoverable error - emit into stream
              controller.error(rAsset.Err());
              return;
            }
            const asset = rAsset.Ok();
            if (!asset) {
              // Not found - distinguishable error type
              controller.error(new StorageNotFoundError(cid));
              return;
            }
            controller.enqueue(asset.content as Uint8Array);
            controller.close();
          },
        });
      }
      case "r2:": {
        if (!r2) {
          return new ReadableStream({
            start(controller) {
              controller.error(new Error("R2 not configured"));
            },
          });
        }
        return r2.get(cid); // R2 returns stream directly
      }
      default:
        return new ReadableStream({
          start(controller) {
            controller.error(new Error(`Unsupported protocol: ${uri.protocol}`));
          },
        });
    }
  };
}
