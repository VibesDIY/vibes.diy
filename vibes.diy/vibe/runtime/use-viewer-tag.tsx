import React, { useRef, useState } from "react";
import type { ViewerEnv } from "./vibe.js";
import { getRegisteredVibeApi } from "./register-dependencies.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;

export type ViewerTagProps =
  | { userSlug?: never; user?: never }
  | { userSlug: string; user?: never }
  | { user: { userSlug: string; displayName?: string; avatarUrl?: string }; userSlug?: never };

type ViewerTagImplProps = ViewerTagProps & { _viewer: ViewerPayload | null };

export function ViewerTagImpl({ _viewer, ...props }: ViewerTagImplProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Undefined / empty guard — key present but value falsy
  const slugFromProp = "user" in props && props.user ? props.user.userSlug : "userSlug" in props ? props.userSlug : undefined;

  if (("userSlug" in props || "user" in props) && !slugFromProp) {
    return <span style={{ opacity: 0.4, fontStyle: "italic", fontSize: 13 }}>no user handle provided</span>;
  }

  // Resolve final slug and avatar URL
  const resolvedSlug = slugFromProp ?? _viewer?.userSlug ?? "";
  const resolvedAvatarUrl =
    "user" in props && props.user?.avatarUrl
      ? props.user.avatarUrl
      : resolvedSlug
        ? `/u/${encodeURIComponent(resolvedSlug)}/avatar`
        : undefined;

  // Self: no slug/user prop given, OR resolved slug matches the viewer.
  // Never self if viewer is anonymous — guards the undefined === undefined case.
  const isSelf = _viewer !== null && ((!("userSlug" in props) && !("user" in props)) || resolvedSlug === _viewer?.userSlug);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const api = getRegisteredVibeApi();
    if (!api) return;
    setUploading(true);
    try {
      const rUpload = await api.putAsset(file, file.type);
      if (rUpload.isErr()) return;
      const uploadRes = rUpload.Ok();
      if (uploadRes.status !== "ok") return;
      await api.updateAvatarCid(uploadRes.cid);
    } finally {
      setUploading(false);
      // Reset so the same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initial = resolvedSlug.charAt(0).toUpperCase();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999,
        padding: "5px 14px 5px 5px",
        fontSize: 14,
        color: "#e0e0e0",
      }}
    >
      <span
        onClick={isSelf ? () => fileRef.current?.click() : undefined}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "white",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
          cursor: isSelf ? "pointer" : "default",
          opacity: uploading ? 0.5 : 1,
          ...(isSelf ? { outline: "2px dashed #818cf8", outlineOffset: 2 } : {}),
        }}
      >
        {resolvedAvatarUrl ? (
          <img
            src={resolvedAvatarUrl}
            alt={resolvedSlug}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : (
          initial
        )}
        {isSelf && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15,12,40,0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#a5b4fc",
              borderRadius: "50%",
            }}
          >
            ✎
          </span>
        )}
      </span>
      <span style={{ fontWeight: 500 }}>{resolvedSlug}</span>
      {isSelf && <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />}
    </span>
  );
}
