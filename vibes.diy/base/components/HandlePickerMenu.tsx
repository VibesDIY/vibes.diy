import React, { useState } from "react";
import { toRFC2822_32ByteLength } from "@vibes.diy/vibe-types";

/**
 * Presentational handle-picker dropdown — the active-handle switcher (#2275 / #2678).
 *
 * You join shared vibes *per handle*, so you must always be able to see which handle
 * you're acting as and switch it. This is the menu that the unified card's header
 * `ViewerTagView` caret opens. Pure presentation: the handle list and the
 * select / new-handle actions are INJECTED by the host (the runtime wires them to
 * `sharedApi.ensureUserSettings({ defaultHandle })` + `createHandleBinding`).
 *
 * Photo editing is deliberately NOT a row here — it's done by clicking the avatar
 * (scoped to the shown handle, the `ViewerTagView` me-mode). We tried and removed a
 * "Edit photo" menu item in #2666.
 */

export interface HandleOption {
  /** The handle slug (drives the avatar initial and the select callback). */
  readonly slug: string;
  /** Optional display text (defaults to `@slug`). */
  readonly displayName?: string;
  /** Optional avatar URL; falls back to the slug initial on load error. */
  readonly avatarUrl?: string;
}

export interface HandlePickerMenuProps {
  readonly handles: readonly HandleOption[];
  /** The handle currently acted as — rendered checked/highlighted. */
  readonly activeSlug?: string;
  readonly onSelect?: (slug: string) => void;
  /** Create a new handle. Called with the user's chosen slug (the inline form),
   *  or with no argument to let the server mint a random one ("surprise me"). */
  readonly onNewHandle?: (handle?: string) => void;
  /** Disables every row while a switch/create is in flight. */
  readonly busy?: boolean;
  /** Which way the menu opens relative to its anchor. Default "down" (the card
   *  header tag sits at the top, so the menu drops below it). */
  readonly placement?: "up" | "down";
  /** Sign the account out. When provided, a "Log out" row is pinned to the bottom
   *  of the menu (below the handle list + "New handle"). Omit to hide it. */
  readonly onLogout?: () => void;
  readonly style?: React.CSSProperties;
}

/** Sanitize a typed handle to the slug the binding will be created with. This is
 *  the SAME `toRFC2822_32ByteLength` the server applies on write (single source of
 *  truth in @vibes.diy/vibe-types), so the inline preview can't drift from the
 *  persisted handle — the function is idempotent, so the server's re-sanitize is a
 *  no-op (#2825). Kept as a named re-export under a UI-friendly alias. */
export const sanitizeHandle = toRFC2822_32ByteLength;

export function HandlePickerMenu({
  handles,
  activeSlug,
  onSelect,
  onNewHandle,
  busy,
  placement = "down",
  onLogout,
  style,
}: HandlePickerMenuProps): React.ReactElement {
  // Clicking "New handle" reveals an inline form so you can make one up (#vibe-switch),
  // rather than the server picking a random slug for you outright. "Surprise me" still
  // mints a random one for anyone who doesn't care.
  const [creating, setCreating] = useState(false);
  const vertical = placement === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" };
  return (
    <div
      role="menu"
      aria-label="Acting as"
      style={{
        position: "absolute",
        right: 0,
        width: 230,
        maxWidth: "calc(100vw - 48px)",
        background: "var(--color-light-background-00, #fff)",
        border: "1px solid var(--color-light-decorative-01, #ddd)",
        borderRadius: 12,
        boxShadow: "0 10px 36px rgba(0,0,0,0.28)",
        padding: 6,
        zIndex: 10,
        ...vertical,
        ...style,
      }}
      className="text-light-primary dark:text-dark-primary"
    >
      <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
        Acting as
      </div>
      {/* The handle list scrolls on its own so a long roster can't push the
          "New handle" / "Log out" rows off-screen (vibe-handles-menu-scroll).
          Capped to the viewport (minus room for the header + pinned footer rows)
          so the footer stays visible when the menu floats near the top of the
          screen — even on short viewports. */}
      <div style={{ maxHeight: "min(40vh, calc(100vh - 280px))", overflowY: "auto" }}>
        {handles.map((h) => (
          <HandleRow
            key={h.slug}
            slug={h.slug}
            label={h.displayName ?? `@${h.slug}`}
            avatarUrl={h.avatarUrl}
            active={h.slug === activeSlug}
            disabled={busy}
            onClick={() => onSelect?.(h.slug)}
          />
        ))}
      </div>
      <div style={{ height: 1, background: "var(--color-light-decorative-00, #eee)", margin: "6px 0" }} />
      {creating ? (
        <NewHandleForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onCreate={(slug) => onNewHandle?.(slug)}
          onRandom={() => onNewHandle?.()}
        />
      ) : (
        <HandleRow
          icon={<span style={{ fontSize: 15 }}>＋</span>}
          label="New handle"
          disabled={busy}
          onClick={() => setCreating(true)}
        />
      )}
      {onLogout && (
        <>
          <div style={{ height: 1, background: "var(--color-light-decorative-00, #eee)", margin: "6px 0" }} />
          <HandleRow icon={<span style={{ fontSize: 14 }}>⎋</span>} label="Log out" disabled={busy} onClick={onLogout} />
        </>
      )}
    </div>
  );
}

/** Inline "make up a handle" form revealed under the picker (#vibe-switch). Submitting
 *  with text creates that handle; "Surprise me" mints a random one. The live preview
 *  mirrors the server's slug sanitization so what you see is what you get. */
function NewHandleForm({
  busy,
  onCancel,
  onCreate,
  onRandom,
}: {
  readonly busy?: boolean;
  readonly onCancel: () => void;
  readonly onCreate: (slug: string) => void;
  readonly onRandom: () => void;
}) {
  const [draft, setDraft] = useState("");
  const sanitized = sanitizeHandle(draft);
  const valid = sanitized.length > 0;
  const submit = () => {
    if (valid && !busy) onCreate(sanitized);
  };
  return (
    <div style={{ padding: "2px 4px 4px" }}>
      <input
        autoFocus
        type="text"
        value={draft}
        disabled={busy}
        placeholder="your-handle"
        aria-label="New handle name"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="text-sm text-light-primary dark:text-dark-primary"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          borderRadius: 8,
          border: "1px solid var(--color-light-decorative-01, #ddd)",
          background: "var(--color-light-background-00, #fff)",
          outline: "none",
        }}
      />
      <div
        className="text-light-secondary dark:text-dark-secondary"
        aria-live="polite"
        style={{ fontSize: 11, padding: "4px 4px 6px", minHeight: 15 }}
      >
        {valid ? `@${sanitized}` : "letters, numbers, and dashes"}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={submit}
          className="text-sm"
          style={{
            flex: 1,
            padding: "6px 8px",
            borderRadius: 8,
            border: "none",
            cursor: !valid || busy ? "default" : "pointer",
            opacity: !valid || busy ? 0.5 : 1,
            background: "#6366f1",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Create
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="text-sm text-light-primary dark:text-dark-primary"
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--color-light-decorative-01, #ddd)",
            background: "transparent",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRandom}
        className="text-light-secondary dark:text-dark-secondary"
        style={{
          width: "100%",
          marginTop: 6,
          padding: 4,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.5 : 1,
          fontSize: 11,
        }}
      >
        Surprise me with a random one
      </button>
    </div>
  );
}

/** One row in the handle dropdown — a handle to act as, or an action. */
function HandleRow({
  slug,
  icon,
  label,
  avatarUrl,
  active,
  disabled,
  onClick,
}: {
  readonly slug?: string;
  readonly icon?: React.ReactNode;
  readonly label: string;
  readonly avatarUrl?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-current={active ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "7px 8px",
        borderRadius: 8,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: active ? "var(--color-light-background-01, #eee)" : "transparent",
      }}
      className="text-light-primary dark:text-dark-primary"
    >
      <RowAvatar slug={slug} icon={icon} avatarUrl={avatarUrl} />
      <span className="text-sm" style={{ flex: 1 }}>
        {label}
      </span>
      {active && (
        <span aria-hidden style={{ fontSize: 12 }}>
          ✓
        </span>
      )}
    </button>
  );
}

function RowAvatar({
  slug,
  icon,
  avatarUrl,
}: {
  readonly slug?: string;
  readonly icon?: React.ReactNode;
  readonly avatarUrl?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = slug ? slug.charAt(0).toUpperCase() : undefined;
  const showImage = Boolean(avatarUrl && !broken);
  return (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        overflow: "hidden",
        background: initial ? "#6366f1" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: initial ? "#fff" : "inherit",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {showImage ? (
        <img src={avatarUrl} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        (initial ?? icon)
      )}
    </span>
  );
}

export default HandlePickerMenu;
