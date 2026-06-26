import React from "react";
import { ViewerTagView } from "@vibes.diy/base";
import type { ViewerEnv } from "./vibe.js";
import { getRegisteredVibeApi } from "./register-dependencies.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;

export type ViewerTagProps = { style?: React.CSSProperties } & (
  | { userHandle?: never; user?: never }
  | { userHandle: string; user?: never }
  | { user: { userHandle: string; displayName?: string; avatarUrl?: string }; userHandle?: never }
);

type ViewerTagImplProps = ViewerTagProps & { _viewer: ViewerPayload | null };

/**
 * Runtime viewer tag — resolves the viewer/handle/avatar from runtime state, then renders
 * the shared presentational `ViewerTagView` (@vibes.diy/base), injecting the iframe
 * host-bridge actions (getRegisteredVibeApi): avatar upload and sign-in. The platform
 * chrome reuses the same `ViewerTagView` with its own injected actions.
 */
export function ViewerTagImpl({ _viewer, style, ...props }: ViewerTagImplProps): React.ReactElement {
  const slugFromProp = "user" in props && props.user ? props.user.userHandle : "userHandle" in props ? props.userHandle : undefined;
  const resolvedSlug = slugFromProp ?? _viewer?.userHandle ?? "";
  const resolvedAvatarUrl =
    "user" in props && props.user?.avatarUrl
      ? props.user.avatarUrl
      : resolvedSlug
        ? `/u/${encodeURIComponent(resolvedSlug)}/avatar`
        : undefined;

  if (("userHandle" in props || "user" in props) && !slugFromProp) {
    return <span style={{ color: "var(--muted, #888)", fontStyle: "italic", fontSize: 13 }}>no user handle provided</span>;
  }

  // Anonymous viewer with no explicit slug prop: show a login button.
  const isAnonymousSelf = _viewer === null && !("userHandle" in props) && !("user" in props);

  // Editing your own avatar is only offered in the "me" shape: no handle/user
  // prop was provided, so the tag resolves to the logged-in viewer. An explicit
  // handle prop is a profile reference (even when it happens to match the
  // viewer) and is never editable. The _viewer !== null guard requires a
  // logged-in viewer to have a handle to write to.
  const isSelf = _viewer !== null && !("userHandle" in props) && !("user" in props);

  async function handlePickFile(file: File): Promise<void> {
    const api = getRegisteredVibeApi();
    if (!api) return;
    // Target the VIEWER's own handle (self-edit), never the app owner's.
    // Without a viewer identity there's no handle to write to.
    const viewerHandle = _viewer?.userHandle;
    if (!viewerHandle) return;
    const rUpload = await api.putAsset(file, file.type);
    if (rUpload.isErr()) return;
    const uploadRes = rUpload.Ok();
    if (uploadRes.status !== "ok") return;
    // Pass the upload's mime as a hint. The host previews the trusted getURL it
    // recorded for this CID when it proxied the putAsset above, so this only
    // labels the Content-Type.
    await api.updateAvatarCid(uploadRes.cid, viewerHandle, file.type);
  }

  return (
    <ViewerTagView
      slug={resolvedSlug}
      avatarUrl={resolvedAvatarUrl}
      editable={isSelf}
      anonymous={isAnonymousSelf}
      onSignIn={() => getRegisteredVibeApi()?.requestLogin()}
      onPickFile={handlePickFile}
      style={style}
    />
  );
}
