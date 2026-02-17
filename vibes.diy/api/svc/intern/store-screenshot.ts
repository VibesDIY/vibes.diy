import { Result } from "@adviser/cement";
import { eq } from "drizzle-orm";
import { type } from "arktype";
import { VibesSqlite } from "../create-handler.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { isMetaScreenShot, MetaItem } from "@vibes.diy/api-types";
import { calcCid, ensureStorage } from "./ensure-storage.js";
import { SuperThis } from "@fireproof/core-types-base";

// Define MetaItem array type
export interface StoreScreenshotResult {
  readonly fsId: string;
  readonly assetId: string;
}

/**
 * Stores a screenshot for an app by fsId
 * 1. Checks if app with fsId exists in sqlApps
 * 2. Calculates CID for the screenshot
 * 3. Stores screenshot using ensureStorage
 * 4. Removes existing MetaScreenShot (if any) and adds new one
 */
export async function storeScreenshot(
  { sthis, db }: { sthis: SuperThis; db: VibesSqlite },
  fsId: string,
  screenshotData: Uint8Array
): Promise<Result<StoreScreenshotResult>> {
  // 1. Check if app with fsId exists
  const apps = await db.select().from(sqlApps).where(eq(sqlApps.fsId, fsId)).limit(1);

  if (apps.length === 0) {
    return Result.Err(`App with fsId ${fsId} not found`);
  }

  const app = apps[0];

  // Parse meta using arktype
  const meta = MetaItem.array()(app.meta);
  if (meta instanceof type.errors) {
    return Result.Err(`Invalid meta format: ${meta.summary}`);
  }

  // 2. Calculate CID for the screenshot
  const cidResult = await calcCid({ sthis }, screenshotData);

  // 3. Store screenshot using ensureStorage
  const storageResult = await ensureStorage(db)({ cid: cidResult.cid, data: cidResult.data });

  if (storageResult.isErr()) {
    return Result.Err(`Failed to store screenshot: ${storageResult.Err()}`);
  }
  // 4. Remove existing screenshot ref (if any)
  const existingIdx = meta.findIndex((item) => isMetaScreenShot(item));
  if (existingIdx >= 0) {
    meta.splice(existingIdx, 1);
  }

  // Push new screenshot ref
  meta.push({
    type: "screen-shot-ref",
    assetId: cidResult.cid,
  });

  // Update the app's meta in the database
  await db.update(sqlApps).set({ meta }).where(eq(sqlApps.fsId, fsId)).run();

  return Result.Ok({
    fsId,
    assetId: cidResult.cid,
  });
}
