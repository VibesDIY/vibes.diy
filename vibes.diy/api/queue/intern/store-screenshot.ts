import { Result, uint8array2stream } from "@adviser/cement";
import { eq } from "drizzle-orm/sql/expressions";
import { type } from "arktype";
// import { VibesSqlite } from "@vibes.diy/api-svc/create-handler.ts";
import { createSQLPeer } from "@vibes.diy/api-sql";
import { isMetaScreenShot, MetaItem } from "@vibes.diy/api-types";
import { ensureStorage } from "@vibes.diy/api-pkg";
import { QueueCtx } from "../queue-ctx.js";
// import { ensureStorage } from "@vibes.diy/api-svc/intern/ensure-storage.ts";
// import { DBFlavour } from "@vibes.diy/api-svc/sql/tables.ts";

// Define MetaItem array type
export interface StoreScreenshotResult {
  readonly fsId: string;
  readonly assetUrl: string;
}

/**
 * Stores a screenshot for an app by fsId
 * 1. Checks if app with fsId exists in apps
 * 2. Calculates CID for the screenshot
 * 3. Stores screenshot using ensureStorage
 * 4. Removes existing MetaScreenShot (if any) and adds new one
 */
export async function storeScreenshot(
  qctx: QueueCtx,
  fsId: string,
  screenshotData: Uint8Array
): Promise<Result<StoreScreenshotResult>> {
  const { db, tables } = qctx.sql;
  // 1. Check if app with fsId exists
  const found = await db.select().from(tables.apps).where(eq(tables.apps.fsId, fsId)).limit(1);

  if (found.length === 0) {
    return Result.Err(`App with fsId ${fsId} not found`);
  }

  const app = found[0];

  // Parse meta using arktype
  const meta = MetaItem.array()(app.meta);
  if (meta instanceof type.errors) {
    return Result.Err(`Invalid meta format: ${meta.summary}`);
  }

  // 2. Calculate CID for the screenshot
  // const cidResult = await calcCid({ sthis }, screenshotData);

  // 3. Store screenshot using ensureStorage
  const [storageResult] = await ensureStorage(createSQLPeer(qctx.storageSystems.sql)).ensure(uint8array2stream(screenshotData));
  if (!storageResult || storageResult.isErr()) {
    return Result.Err(`Failed to store screenshot: ${storageResult?.Err()}`);
  }
  // 4. Remove existing screenshot ref (if any)
  const existingIdx = meta.findIndex((item) => isMetaScreenShot(item));
  if (existingIdx >= 0) {
    meta.splice(existingIdx, 1);
  }

  // Push new screenshot ref
  meta.push({
    type: "screen-shot-ref",
    mime: "image/jpeg",
    assetUrl: storageResult.Ok().getURL,
  });

  // Update the app's meta in the database
  await db.update(tables.apps).set({ meta }).where(eq(tables.apps.fsId, fsId));

  return Result.Ok({
    fsId,
    assetUrl: storageResult.Ok().getURL,
  });
}
