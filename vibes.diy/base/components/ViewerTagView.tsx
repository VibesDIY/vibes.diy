import React, { useEffect, useRef, useState } from "react";

/**
 * Presentational viewer tag — the shared shell behind the runtime ViewerTag and the
 * platform chrome's handle display. Pure presentation + the click-the-avatar-to-edit
 * interaction (hidden file input, camera affordance, scoped to one handle). All actions
 * are INJECTED: the runtime wires `onPickFile`/`onSignIn` to the iframe host bridge
 * (getRegisteredVibeApi), the chrome wires them to the platform APIs (sharedApi upload /
 * Clerk login). The `trailing` slot carries extras like a handle-picker caret.
 */

function CameraGlyph({ size }: { readonly size: number }): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "block" }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h4l2-2h4l2 2h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

export interface ViewerTagViewProps {
  /** The handle the avatar initial is drawn from. */
  readonly slug: string;
  /** Optional display text (defaults to `slug`). The avatar initial always comes from `slug`. */
  readonly displayName?: string;
  readonly avatarUrl?: string;
  /** "me mode": show the click-to-edit camera affordance + file input. */
  readonly editable?: boolean;
  /** Anonymous viewer: render a sign-in button instead of the pill. */
  readonly anonymous?: boolean;
  readonly onSignIn?: () => void;
  /** Called with the chosen file when the avatar is edited. May be async; the view shows
   *  an uploading state until it resolves. */
  readonly onPickFile?: (file: File) => void | Promise<void>;
  /** Slot rendered at the trailing edge of the pill (e.g. a handle-picker caret). */
  readonly trailing?: React.ReactNode;
  readonly style?: React.CSSProperties;
}

export function ViewerTagView({
  slug,
  displayName,
  avatarUrl,
  editable,
  anonymous,
  onSignIn,
  onPickFile,
  trailing,
  style,
}: ViewerTagViewProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  if (anonymous) {
    return (
      <button
        onClick={onSignIn}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "1px solid var(--accent, #6366f1)",
          borderRadius: 999,
          padding: "5px 14px",
          fontSize: 14,
          color: "var(--accent, #6366f1)",
          cursor: "pointer",
          fontWeight: 500,
          ...style,
        }}
      >
        Sign in
      </button>
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onPickFile) return;
    setUploading(true);
    try {
      await onPickFile(file);
    } finally {
      setUploading(false);
      // Reset so the same file can be selected again.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initial = slug.charAt(0).toUpperCase();
  const hasAvatarImage = Boolean(avatarUrl && !avatarError);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "var(--card-bg, rgba(255,255,255,0.07))",
        border: "1px solid var(--border, rgba(255,255,255,0.15))",
        borderRadius: 999,
        padding: "5px 14px 5px 5px",
        fontSize: 14,
        color: "var(--text, #e0e0e0)",
        ...style,
      }}
    >
      <span style={{ position: "relative", flexShrink: 0 }}>
        <span
          onClick={editable ? () => fileRef.current?.click() : undefined}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--accent, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "white",
            overflow: "hidden",
            cursor: editable ? "pointer" : "default",
            opacity: uploading ? 0.5 : 1,
            ...(editable ? { outline: "2px dashed var(--accent, #818cf8)", outlineOffset: 2 } : {}),
          }}
        >
          {hasAvatarImage ? (
            <img
              src={avatarUrl}
              alt={slug}
              onError={() => setAvatarError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
            />
          ) : (
            initial
          )}
          {editable && !hasAvatarImage && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(15,12,40,0.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-text, var(--accent, #a5b4fc))",
                borderRadius: "50%",
              }}
            >
              <CameraGlyph size={13} />
            </span>
          )}
        </span>
        {editable && hasAvatarImage && (
          <span
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "rgba(15,12,40,0.9)",
              border: "1px solid var(--border, rgba(255,255,255,0.25))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              color: "var(--accent-text, var(--accent, #a5b4fc))",
              pointerEvents: "none",
            }}
          >
            <CameraGlyph size={9} />
          </span>
        )}
      </span>
      <span style={{ fontWeight: 500 }}>{displayName ?? slug}</span>
      {trailing}
      {editable && <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />}
    </span>
  );
}

export default ViewerTagView;
