import { exception2Result, stream2uint8array } from "@adviser/cement";
import { inArray } from "drizzle-orm/sql/expressions";
import { isFetchOkResult, isMetaScreenShot, MetaItem, parseArrayWarning } from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import type { VibesApiSQLCtx } from "../types.js";

export interface LatestScreenshot {
  /** The fsId (app version) the screenshot was captured for. */
  readonly fsId: string;
  /** A `data:<mime>;base64,<...>` URL ready to embed as an image_url part. */
  readonly dataUrl: string;
}

// Encode bytes to base64 without spreading the whole array into String.fromCharCode
// at once (large screenshots would overflow the argument list). btoa is available
// in the Cloudflare Workers runtime and Node 18+.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Find the most recent stored preview screenshot across a chat's version
 * history and return it as a base64 data URL.
 *
 * "Most recent" = the newest fsId (per the caller-supplied newest-first order)
 * whose app meta carries a `screen-shot-ref`. Screenshot capture lags behind
 * code generation, so the latest version may not have one yet — we walk back
 * until we find one rather than only checking the head (per issue #1743:
 * "use most recent, don't worry about history").
 *
 * We never trigger a fresh capture and never wait for one — only already-stored
 * screenshots are used. Best-effort throughout: returns undefined when no
 * screenshot exists or the asset can't be fetched, and never throws.
 */
export async function loadLatestScreenshotDataUrl(
  vctx: VibesApiSQLCtx,
  fsIdsNewestFirst: readonly string[]
): Promise<LatestScreenshot | undefined> {
  const logger = ensureLogger(vctx.sthis, "loadLatestScreenshotDataUrl");
  if (fsIdsNewestFirst.length === 0) return undefined;

  const rResult = await exception2Result(async (): Promise<LatestScreenshot | undefined> => {
    const rows = await vctx.sql.db
      .select({ fsId: vctx.sql.tables.apps.fsId, meta: vctx.sql.tables.apps.meta })
      .from(vctx.sql.tables.apps)
      .where(inArray(vctx.sql.tables.apps.fsId, [...fsIdsNewestFirst]));

    const metaByFsId = new Map<string, unknown>();
    for (const row of rows) {
      if (row.fsId) metaByFsId.set(row.fsId, row.meta);
    }

    for (const fsId of fsIdsNewestFirst) {
      const rawMeta = metaByFsId.get(fsId);
      if (rawMeta === undefined) continue;
      const { filtered: meta, warning } = parseArrayWarning(rawMeta, MetaItem);
      if (warning.length > 0) {
        logger.Warn().Any({ fsId, parseErrors: warning }).Msg("skip meta entries");
      }
      const shot = meta.find(isMetaScreenShot);
      if (!shot) continue;

      const fetched = await vctx.storage.fetch(shot.assetUrl);
      if (!isFetchOkResult(fetched)) {
        // The newest screenshot ref points at an asset we can't read — fall
        // back to the next-most-recent version rather than giving up.
        logger.Warn().Any({ fsId, assetUrl: shot.assetUrl }).Msg("screenshot asset fetch failed");
        continue;
      }
      const bytes = await stream2uint8array(fetched.data);
      return { fsId, dataUrl: `data:${shot.mime};base64,${bytesToBase64(bytes)}` };
    }
    return undefined;
  });

  if (rResult.isErr()) {
    logger.Warn().Err(rResult).Msg("failed to load latest screenshot");
    return undefined;
  }
  return rResult.Ok();
}
