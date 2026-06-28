import React, { useState } from "react";

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
  readonly onNewHandle?: () => void;
  /** Disables every row while a switch/create is in flight. */
  readonly busy?: boolean;
  /** Which way the menu opens relative to its anchor. Default "down" (the card
   *  header tag sits at the top, so the menu drops below it). */
  readonly placement?: "up" | "down";
  readonly style?: React.CSSProperties;
}

export function HandlePickerMenu({
  handles,
  activeSlug,
  onSelect,
  onNewHandle,
  busy,
  placement = "down",
  style,
}: HandlePickerMenuProps): React.ReactElement {
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
      <div style={{ height: 1, background: "var(--color-light-decorative-00, #eee)", margin: "6px 0" }} />
      <HandleRow icon={<span style={{ fontSize: 15 }}>＋</span>} label="New handle" disabled={busy} onClick={onNewHandle} />
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
