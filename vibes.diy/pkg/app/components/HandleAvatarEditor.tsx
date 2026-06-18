import React, { useEffect, useState } from "react";
import { VibesButton } from "@vibes.diy/base";
import { isResAssetUploadGrant, type VibesDiyApiIface } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { avatarConfirmController } from "../lib/avatar-confirm.js";

// Platform Settings widget for editing ONE handle's avatar. A deliberate
// derivative of the avatar-edit flow — NOT the vibe-runtime ViewerTag, which is
// a sandbox-facing component scoped to the viewer's own handle. This one lets a
// signed-in user manage the avatar of any handle they own from Settings.
//
// Avatars are per-handle (#2434): each handle has its own image, served at
// /u/<handle>/avatar. We render that URL (cache-busted after upload) and fall
// back to "None" when the handle has no avatar yet (the URL 404s → onError).
// The write goes through the #2418 preview/confirm gate, then ensureHandleAvatar,
// which re-validates ownership server-side.

interface HandleAvatarEditorProps {
  readonly chatApi: VibesDiyApiIface;
  readonly handle: string;
}

export function HandleAvatarEditor({ chatApi, handle }: HandleAvatarEditorProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [broken, setBroken] = useState(false);
  const inputId = `avatar-upload-${handle}`;

  // Reset preview state when the selected handle changes so the editor reflects
  // the newly chosen handle (a different /u/<handle>/avatar).
  useEffect(() => {
    setBroken(false);
    setVersion(0);
    setError(null);
  }, [handle]);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    // 1. Mint a short-lived upload grant.
    const rGrant = await chatApi.requestAssetUploadGrant({
      ownerHandle: handle,
      appSlug: "_profile",
      mimeType: file.type || "application/octet-stream",
    });
    if (rGrant.isErr()) {
      setUploading(false);
      setError(`Upload failed: ${rGrant.Err().message}`);
      return;
    }
    const grantRes = rGrant.Ok();
    if (!isResAssetUploadGrant(grantRes)) {
      setUploading(false);
      setError("Upload failed: unexpected grant response shape");
      return;
    }

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
    setUploading(false);
    if (rUpload.isErr()) {
      setError(`Upload failed: ${rUpload.Err().message}`);
      return;
    }
    const res = rUpload.Ok();
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(`Upload failed: POST /assets returned ${res.status}: ${text}`);
      return;
    }
    const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };

    // 3. Preview/confirm gate (#1968) — getURL is the trusted server response.
    const confirmed = await avatarConfirmController.request({ cid: body.cid, mimeType: file.type, getURL: body.getURL });
    if (!confirmed) return;

    // 4. Write per-handle; the server re-validates ownership of `handle`.
    const rSave = await chatApi.ensureHandleAvatar({ handle, cid: body.cid, mime: file.type });
    if (rSave.isErr()) {
      setError(`Failed to save avatar: ${rSave.Err()}`);
      return;
    }
    setBroken(false);
    setVersion((v) => v + 1);
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        {!broken ? (
          <img
            src={`/u/${encodeURIComponent(handle)}/avatar?v=${version}`}
            alt={`Avatar for ${handle}`}
            className="h-16 w-16 rounded-full object-cover border-2"
            style={{ borderColor: "var(--vibes-border-primary)" }}
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-xs border-2"
            style={{
              borderColor: "var(--vibes-border-primary)",
              color: "var(--vibes-text-secondary)",
              background: "var(--vibes-bg-secondary, #f3f4f6)",
            }}
          >
            None
          </div>
        )}
        <div>
          <label className="cursor-pointer inline-block" htmlFor={inputId}>
            <VibesButton variant="blue" disabled={uploading} onClick={() => document.getElementById(inputId)?.click()}>
              {uploading ? "Uploading…" : "Upload image"}
            </VibesButton>
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <p className="text-xs mt-3" style={{ color: "var(--vibes-text-secondary)" }}>
            PNG, JPG, or WebP. Displayed at /u/{handle}/avatar
          </p>
        </div>
      </div>
      {error && <p className="text-red-600 font-medium mt-2 text-sm">{error}</p>}
    </div>
  );
}
