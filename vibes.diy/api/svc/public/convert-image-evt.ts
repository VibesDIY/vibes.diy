import { Result, exception2Result } from "@adviser/cement";
import type { BlockImageMsg } from "@vibes.diy/call-ai-v2";
import { storeAndAuditAsset } from "./store-and-audit-asset.js";
import type { VibesApiSQLCtx } from "../types.js";

export interface ConvertImageEvtParams {
  readonly evt: BlockImageMsg;
  readonly userId: string;
  readonly userSlug: string;
  readonly appSlug: string;
  // DI seam — defaults to global fetch. Tests inject a fake.
  readonly fetchFn?: typeof fetch;
}

// Converts a `block.image` event with a `url` field into the file-ref
// shape (`{uploadId, cid, mimeType, size}` and no `url`) by routing the
// bytes through `storeAndAuditAsset`. Handles both `data:` URLs and
// remote `http(s):` URLs. Events without a `url` pass through as-is.
//
// Returns `Result.Err` if the URL is malformed, the fetch fails, or
// the audit insert fails. Callers decide whether to log+fall-through
// or abort the prompt.
export async function convertImageEvtToFileRef(
  vctx: VibesApiSQLCtx,
  params: ConvertImageEvtParams
): Promise<Result<BlockImageMsg>> {
  const { evt, userId, userSlug, appSlug } = params;
  const url = evt.url;
  if (url === undefined) {
    return Result.Ok(evt);
  }

  // Drop the `url` key from the eventually-returned shape. The destructure
  // here removes it; the rebind below fills in the file-ref fields.
  const { url: _drop, ...rest } = evt;
  void _drop;

  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return Result.Err(`malformed data: URL`);
    }
    const mime = match[1];
    const rDecoded = exception2Result(() => Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)));
    if (rDecoded.isErr()) {
      return Result.Err(`base64 decode failed: ${rDecoded.Err().message}`);
    }
    const rStored = await storeAndAuditAsset(vctx, {
      bytes: rDecoded.Ok(),
      userId,
      userSlug,
      appSlug,
      mimeType: mime,
    });
    if (rStored.isErr()) {
      return Result.Err(rStored);
    }
    const stored = rStored.Ok();
    return Result.Ok({
      ...rest,
      uploadId: stored.uploadId,
      cid: stored.cid,
      mimeType: stored.mimeType ?? mime,
      size: stored.size,
    });
  }

  // Remote URL — fetch bytes server-side. The producer in
  // `call-ai/v2/block-stream.ts` (`delta.image` handler) emits these for
  // image-gen providers that return a URL rather than inlining base64.
  const fetchFn = params.fetchFn ?? fetch;
  const rRes = await exception2Result(() => fetchFn(url));
  if (rRes.isErr()) {
    return Result.Err(`fetch failed: ${rRes.Err().message}`);
  }
  const res = rRes.Ok();
  if (!res.ok) {
    return Result.Err(`fetch failed: status ${res.status}`);
  }
  const rBuf = await exception2Result(() => res.arrayBuffer());
  if (rBuf.isErr()) {
    return Result.Err(`read body failed: ${rBuf.Err().message}`);
  }
  const bytes = new Uint8Array(rBuf.Ok());
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const rStored = await storeAndAuditAsset(vctx, {
    bytes,
    userId,
    userSlug,
    appSlug,
    mimeType,
  });
  if (rStored.isErr()) {
    return Result.Err(rStored);
  }
  const stored = rStored.Ok();
  return Result.Ok({
    ...rest,
    uploadId: stored.uploadId,
    cid: stored.cid,
    mimeType: stored.mimeType ?? mimeType,
    size: stored.size,
  });
}
