import { CoerceBinaryInput, exception2Result, Result, to_uint8, uint8array2stream, URI } from "@adviser/cement";
import { StorageResult } from "../types.js";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";
import { eq } from "drizzle-orm";

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

export function ensureStorage(db: VibesSqlite): {
  fetch: (url: string) => Promise<Result<ReadableStream<Uint8Array>>>;
  ensure: (...items: { cid: string; data: Uint8Array }[]) => Promise<Result<StorageResult[]>>;
} {
  return {
    fetch: async (iurl: string): Promise<Result<ReadableStream<Uint8Array>>> => {
      const url = URI.from(iurl);
      if (url.protocol === "sql:") {
        const assetId = url.pathname.slice("Assets/".length);
        console.log("Fetching asset with ID from SQL storage:", assetId, "from URL:", url.pathname);
        const asset = await db.select().from(sqlAssets).where(eq(sqlAssets.assetId, assetId)).get();
        if (!asset) {
          return Result.Err(`Asset with CID ${assetId} not found in storage`);
        }
        return Result.Ok(uint8array2stream(asset.content as Uint8Array));
      }
      return Result.Err(`Unsupported URL protocol for storage fetch: ${url.protocol}`);
    },
    ensure: async (...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>> => {
      const now = new Date();
      const created = now.toISOString();
      const res = await exception2Result(() =>
        db
          .insert(sqlAssets)
          .values(
            items.map((item) => ({
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
      return Result.Ok(
        items.map((item) => ({
          cid: item.cid,
          getURL: `sql://Assets/${item.cid}`,
          mode: "existing",
          created: now,
          size: item.data.byteLength,
        }))
      );
    },
  };
}
