import {
  CoerceBinaryInput,
  exception2Result,
  Result,
  to_uint8,
} from "@adviser/cement";
import { StorageResult } from "../api.js";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/assets-fs.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";

export interface CalcCidResult {
  cid: string;
  data: Uint8Array;
  dataStr(): string;
}
export async function calcCid(
  { sthis }: { sthis: SuperThis },
  content: CoerceBinaryInput,
): Promise<CalcCidResult> {
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
): (
  ...items: { cid: string; data: Uint8Array }[]
) => Promise<Result<StorageResult[]>> {
  return async (
    ...items: { cid: string; data: Uint8Array }[]
  ): Promise<Result<StorageResult[]>> => {
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
          })),
        )
        .onConflictDoNothing()
        .run(),
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
      })),
    );
  };
}
