import { exception2Result, Result } from "@adviser/cement";
import { StorageResult } from "../api.js";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/assets-fs.js";

export function ensureStorage(
  db: VibesSqlite
): (
  ...items: { cid: string; data: Uint8Array }[]
) => Promise<Result<StorageResult[]>> {
  return async (
    ...items: { cid: string; data: Uint8Array }[]
  ): Promise<Result<StorageResult[]>> => {
    const now = new Date()
    const created = now.toISOString();
    const res = await exception2Result(() =>
      db
        .insert(sqlAssets)
        .values(
          items.map((item) => ({
            assetId: item.cid,
            content: item.data,
            created
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
  };
}
