import { Result, exception2Result, uint8array2stream } from "@adviser/cement";
import { eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";

// Shared helper for both `POST /assets` (user upload) and the server-side
// image-gen path (Prodia / OpenAI). Writes bytes through
// `vctx.storage.ensure` (SQL peer ≤4KB, R2 above) and inserts an
// `AssetUploads` audit/quota row keyed by uploadId.
//
// Two callsites share this:
//   - `put-asset.ts` passes `uploadId = claims.jti` (grant-issued).
//   - Server-side image-gen mints a fresh uploadId via `sthis.nextId`.
//
// The shape of the audit row must remain identical to what `put-asset`
// wrote pre-refactor — `put-asset.test.ts` asserts that contract.

export interface StoreAndAuditAssetParams {
  readonly bytes: ReadableStream<Uint8Array> | Uint8Array;
  readonly userId: string;
  readonly userSlug: string;
  readonly appSlug: string;
  // mimeType is optional in the audit row (the WS asset-upload-grant
  // claim makes it advisory). Image-gen always supplies it; user uploads
  // pass through whatever the grant carried.
  readonly mimeType?: string | null;
  // Optional: `put-asset` passes the grant's jti so client-side replays
  // remain idempotent. Server-generated assets (image-gen) leave this
  // undefined and the helper mints a fresh id.
  readonly uploadId?: string;
}

export interface StoreAndAuditAssetResult {
  readonly uploadId: string;
  readonly cid: string;
  readonly assetURI: string;
  readonly size: number;
  readonly mimeType: string | null;
}

export async function storeAndAuditAsset(
  vctx: VibesApiSQLCtx,
  params: StoreAndAuditAssetParams
): Promise<Result<StoreAndAuditAssetResult>> {
  const stream = params.bytes instanceof Uint8Array ? uint8array2stream(params.bytes) : params.bytes;
  const rEnsure = await exception2Result(() => vctx.storage.ensure(stream));
  if (rEnsure.isErr()) {
    return Result.Err(`storage.ensure failed: ${rEnsure.Err().message}`);
  }
  const results = rEnsure.Ok();
  if (results.length === 0 || results[0].isErr()) {
    return Result.Err(`storage.ensure failed: ${results[0]?.Err()?.message ?? "no result"}`);
  }
  const stored = results[0].Ok();

  const uploadId = params.uploadId ?? vctx.sthis.nextId(16).str;
  const mimeType = params.mimeType ?? null;
  const uploadsTable = vctx.sql.tables.assetUploads;
  const rInsert = await exception2Result(() =>
    vctx.sql.db.insert(uploadsTable).values({
      uploadId,
      userId: params.userId,
      userSlug: params.userSlug,
      appSlug: params.appSlug,
      cid: stored.cid,
      assetURI: stored.getURL,
      size: stored.size,
      mimeType,
      created: new Date().toISOString(),
    })
  );
  if (rInsert.isErr()) {
    return Result.Err(`audit insert failed: ${rInsert.Err().message}`);
  }

  // Verify the full read path is ready before we ack: fetch the asset
  // by its cid-keyed URL and re-read the audit row by uploadId. We
  // already await `storage.ensure` (which awaits commit → rename →
  // dest HEAD) and the audit insert, so this is belt-and-suspenders —
  // but it pins the contract: when this helper returns Ok, both the
  // cid'd bytes and the audit pointer that resolves them are visible
  // to a fresh read. Anything less and we'd risk acking the client
  // for an asset that 404s on its first GET.
  const rFetch = await exception2Result(() => vctx.storage.fetch(stored.getURL));
  if (rFetch.isErr()) {
    return Result.Err(`asset readback failed: ${rFetch.Err().message}`);
  }
  const fetched = rFetch.Ok();
  if (fetched.type !== "fetch.ok") {
    return Result.Err(`asset readback returned ${fetched.type} for ${stored.getURL}`);
  }
  // Drain and discard the body so the underlying stream is released
  // promptly; we only needed to confirm fetchability.
  if (fetched.data) {
    const reader = fetched.data.getReader();
    while (true) {
      const r = await reader.read();
      if (r.done) break;
    }
  }

  const rAudit = await exception2Result(() =>
    vctx.sql.db
      .select({ uploadId: uploadsTable.uploadId })
      .from(uploadsTable)
      .where(eq(uploadsTable.uploadId, uploadId))
      .limit(1)
      .then((rows) => rows[0])
  );
  if (rAudit.isErr() || !rAudit.Ok()) {
    return Result.Err(`audit readback failed for uploadId ${uploadId}`);
  }

  return Result.Ok({
    uploadId,
    cid: stored.cid,
    assetURI: stored.getURL,
    size: stored.size,
    mimeType,
  });
}
