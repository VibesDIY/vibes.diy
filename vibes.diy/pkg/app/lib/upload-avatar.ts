import { isResAssetUploadGrant } from "@vibes.diy/api-types";
import type { Conn } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { avatarConfirmController } from "./avatar-confirm.js";

// Shared per-handle avatar upload flow (#2434 / #1968), extracted so every
// platform-side entry point goes through the SAME four steps and the SAME
// preview/confirm consent overlay (`avatarConfirmController` → AvatarConfirmModal):
//   1. mint a short-lived upload grant,
//   2. POST the bytes,
//   3. run the preview/confirm gate (the consent overlay),
//   4. persist per-handle (the server re-validates ownership of `handle`).
//
// Callers: Settings' HandleAvatarEditor and the agent-in-vibe card's viewer tag.
// The in-vibe (runtime) ViewerTag reaches the same consent overlay through the
// srv-sandbox bridge instead; this is the host-side equivalent.

export type UploadAvatarResult =
  | { readonly ok: true }
  /** The user dismissed the consent overlay — not an error, no toast. */
  | { readonly ok: false; readonly cancelled: true }
  | { readonly ok: false; readonly cancelled?: false; readonly error: string };

export async function uploadHandleAvatar({
  sharedApi,
  handle,
  file,
}: {
  readonly sharedApi: Conn<"shared">;
  readonly handle: string;
  readonly file: File;
}): Promise<UploadAvatarResult> {
  // 1. Mint a short-lived upload grant.
  const rGrant = await sharedApi.requestAssetUploadGrant({
    ownerHandle: handle,
    appSlug: "_profile",
    mimeType: file.type || "application/octet-stream",
  });
  if (rGrant.isErr()) return { ok: false, error: `Upload failed: ${rGrant.Err().message}` };
  const grantRes = rGrant.Ok();
  if (!isResAssetUploadGrant(grantRes)) return { ok: false, error: "Upload failed: unexpected grant response shape" };

  // 2. POST the bytes.
  const uploadUrl = /^https?:\/\//i.test(grantRes.uploadUrl)
    ? grantRes.uploadUrl
    : `${window.location.origin}${grantRes.uploadUrl}`;
  const rUpload = await exception2Result(() =>
    fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Asset-Grant": grantRes.grant,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    })
  );
  if (rUpload.isErr()) return { ok: false, error: `Upload failed: ${rUpload.Err().message}` };
  const res = rUpload.Ok();
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Upload failed: POST /assets returned ${res.status}: ${text}` };
  }
  const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };

  // 3. Preview/confirm gate (#1968) — getURL is the trusted server response.
  const confirmed = await avatarConfirmController.request({ cid: body.cid, mimeType: file.type, getURL: body.getURL });
  if (!confirmed) return { ok: false, cancelled: true };

  // 4. Write per-handle; the server re-validates ownership of `handle`.
  const rSave = await sharedApi.ensureHandleAvatar({ handle, cid: body.cid, mime: file.type });
  if (rSave.isErr()) return { ok: false, error: `Failed to save avatar: ${rSave.Err()}` };
  return { ok: true };
}
