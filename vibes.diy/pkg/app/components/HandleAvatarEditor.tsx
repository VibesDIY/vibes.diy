import React, { useEffect, useState } from "react";
import { VibesButton } from "@vibes.diy/base";
import type { Conn } from "@vibes.diy/api-types";
import { uploadHandleAvatar } from "../lib/upload-avatar.js";

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
  readonly sharedApi: Conn<"shared">;
  readonly handle: string;
}

export function HandleAvatarEditor({ sharedApi, handle }: HandleAvatarEditorProps): React.ReactElement {
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
    const result = await uploadHandleAvatar({ sharedApi, handle, file });
    setUploading(false);
    if (!result.ok) {
      if (!result.cancelled) setError(result.error);
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
