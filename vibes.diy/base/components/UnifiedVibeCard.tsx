import React, { useEffect, useRef, useState } from "react";
import { VibesSwitch } from "./VibesSwitch.js";
import { OptionButtons } from "./OptionButtons.js";
import { ViewerTagView } from "./ViewerTagView.js";
import { HandlePickerMenu, type HandleOption } from "./HandlePickerMenu.js";

export interface UnifiedVibeCardProps {
  appTitle: string;
  appSlug?: string;
  appIconUrl?: string;
  chips?: readonly string[];
  onSelectChip?: (chip: string) => void;
  onSubmitOther?: (text: string) => void;
  /** Reserved for the verb-collapse work (#2679); not yet wired to any behavior. */
  isOwner?: boolean;
  handleSlug?: string;
  handleAvatarUrl?: string;
  /** The handles this account can act as (the active-handle switcher, #2278/#2275).
   *  When provided, the header tag's caret becomes interactive and opens the
   *  HandlePickerMenu. Omit to keep the tag's caret static (legacy behavior). */
  handles?: readonly HandleOption[];
  /** Switch the active handle (the host persists it via the `defaultHandle` setting). */
  onSelectHandle?: (slug: string) => void;
  /** Create a new handle ("New handle" row). */
  onNewHandle?: () => void;
  /** Disables the picker rows while a switch/create is in flight. */
  handlePickerBusy?: boolean;
  /** Controlled open state for the handle picker (defaults to internal state). */
  handlePickerOpen?: boolean;
  onHandlePickerOpenChange?: (open: boolean) => void;
  /** Viewer-mode indicator (#2178): "author" shows a shield, a read-only "member"
   *  shows a lock, "visitor" shows nothing. Per the epic §2 grant→surface table. */
  viewerMode?: "author" | "member" | "visitor";
  /** For a member viewer: true when they have no write grant (viewer/submitter) —
   *  drives the lock glyph. Ignored for author/visitor. */
  memberReadOnly?: boolean;
  /** Owner has admin mode on (full access-fn bypass, #2178) — shows a highlighted
   *  shield, taking precedence over the plain author shield. The toggle itself lives
   *  in the Share controls; this is just the indicator. */
  adminMode?: boolean;
  /** Draft/published indicator (#2772). "draft" shows a compact "Draft · unpublished"
   *  badge in the header — the owner is viewing their latest unpublished in-place
   *  generation. "published" / undefined shows nothing. Only the owner ever sees a
   *  draft (the route re-pins to the latest dev fsId for them); everyone else stays on
   *  production, so this is owner-only chrome. */
  publishState?: "draft" | "published";
  /** Publish the current draft (#2772 D2). When provided AND `publishState` is "draft"
   *  AND the Edit view is active, an in-card "unpublished changes · Publish" banner
   *  shows above the body. The host gates this (only a real publishable draft, not
   *  mid-generation); clicking calls `onPublish`. Omit to hide the banner (e.g. D1,
   *  or while streaming). */
  onPublish?: () => void;
  /** Disables the Publish button + shows a pending label while a publish is in flight. */
  publishing?: boolean;
  onHome?: () => void;
  /** Selects the edit affordance (switches the body back to chips/Other). */
  onEdit?: () => void;
  onShare?: () => void;
  /** Ref attached to the Share nav button so an external popover (the ShareModal) can anchor to it. */
  shareButtonRef?: React.Ref<HTMLButtonElement>;
  onSignIn?: () => void;
  isTwinkling?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Overrides the card's middle (chips + Other) — e.g. the SharePanelView when the
   *  Share view is active. Header and bottom nav stay. */
  body?: React.ReactNode;
  /** The in-place codegen stream view. Unlike `body` (a full replace), this LAYERS
   *  over the chips+Other region: the chips stay mounted (hidden, inert) to reserve
   *  their height, and the stream is absolutely positioned on top. So the panel
   *  shows the streaming chat without resizing as a turn runs, and the old
   *  suggestion chips don't sit visible behind it. Ignored while `body` is set
   *  (Share view wins). (vibe-tour-chips-edit) */
  streamBody?: React.ReactNode;
  /** Which bottom-nav affordance reads as selected. Defaults to "edit". */
  selectedNav?: "edit" | "share";
  className?: string;
}

export function UnifiedVibeCard(props: UnifiedVibeCardProps) {
  const { appTitle, appSlug, isTwinkling, open: controlledOpen, onOpenChange } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Handle picker (the active-handle switcher) — opened from the header tag's
  // caret. The picker is interactive only when the host supplies `handles`.
  const pickerInteractive = props.handles !== undefined;
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  const pickerOpen = props.handlePickerOpen ?? internalPickerOpen;
  const setPickerOpen = (next: boolean) => {
    if (props.handlePickerOpen === undefined) setInternalPickerOpen(next);
    props.onHandlePickerOpenChange?.(next);
  };
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  // Click-away: close the picker when a pointer-down lands outside its anchor.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  // Animation: the OUTER card scales from the toggle's lower-right corner
  // (`grown`), and the inner content fades in only after the grow. `mounted`
  // keeps the card in the DOM through the shrink so the exit animates.
  // Initialize from `open` so a controlled open-on-mount shows instantly; the
  // grow-from-corner entrance only plays on a subsequent toggle (by design).
  const [mounted, setMounted] = useState(open);
  const [grown, setGrown] = useState(open);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (open) {
      setMounted(true);
      t = setTimeout(() => setGrown(true), 10);
    } else {
      setGrown(false);
      t = setTimeout(() => setMounted(false), 240);
    }
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {/* Click-away backdrop: while the card is open, a transparent full-viewport
          layer sits above the running app (which lives in an iframe, so a
          document-level mousedown listener can't see clicks landing on it) and
          below the card + toggle. Clicking it dismisses the expansion. Rendered
          only while `open` so the exit animation isn't click-blocking. */}
      {open && (
        <div
          aria-hidden
          data-testid="vibe-menu-backdrop"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "auto" }}
        />
      )}
      {mounted && (
        <div
          role="dialog"
          aria-label="Vibe menu"
          className={props.className}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 2,
            borderRadius: 16,
            maxHeight: "82%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-light-background-00, #fff)",
            border: "1px solid var(--vibes-near-black, #1a1a1a)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            transformOrigin: "bottom right",
            transform: grown ? "scale(1)" : "scale(0)",
            transition: "transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)",
            pointerEvents: grown ? "auto" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              opacity: grown ? 1 : 0,
              transition: grown ? "opacity 0.18s ease 0.14s" : "opacity 0.1s ease",
            }}
            className="text-light-primary dark:text-dark-primary"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 8px" }}>
              <div
                aria-hidden
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "linear-gradient(160deg,#312e81,#4c1d95)",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                {props.appIconUrl && (
                  <img src={props.appIconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <strong className="text-sm">{appTitle}</strong>
                {appSlug && (
                  <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 12 }}>
                    {appSlug}
                  </div>
                )}
              </div>
              {props.publishState === "draft" && <DraftBadge />}
              {/* Handle picker / viewer tag lives at the TOP of the card — the
                  bottom row is tight now that the persistent logo occupies its
                  right end. */}
              <div style={{ flex: 1 }} />
              <ModeIndicator viewerMode={props.viewerMode} memberReadOnly={props.memberReadOnly} adminMode={props.adminMode} />
              {props.handleSlug ? (
                <div ref={pickerWrapRef} style={{ position: "relative", flexShrink: 0 }}>
                  <ViewerTagView
                    slug={props.handleSlug}
                    displayName={`@${props.handleSlug}`}
                    avatarUrl={props.handleAvatarUrl}
                    trailing={
                      pickerInteractive ? (
                        <button
                          type="button"
                          aria-label="Switch handle"
                          aria-haspopup="menu"
                          aria-expanded={pickerOpen}
                          onClick={() => setPickerOpen(!pickerOpen)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: "none",
                            border: "none",
                            padding: "0 2px",
                            marginLeft: 1,
                            fontSize: 11,
                            lineHeight: 1,
                            opacity: 0.6,
                            cursor: "pointer",
                            color: "inherit",
                          }}
                        >
                          ▾
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 1 }}>▾</span>
                      )
                    }
                    style={{
                      background: "var(--color-light-background-01, #eee)",
                      border: "1px solid var(--color-light-decorative-01, #ddd)",
                      color: "var(--color-light-primary, #333)",
                      fontSize: 13,
                      padding: "3px 8px 3px 4px",
                      flexShrink: 0,
                    }}
                  />
                  {pickerInteractive && pickerOpen && (
                    <HandlePickerMenu
                      handles={props.handles ?? []}
                      activeSlug={props.handleSlug}
                      busy={props.handlePickerBusy}
                      placement="down"
                      onSelect={(slug) => {
                        props.onSelectHandle?.(slug);
                        setPickerOpen(false);
                      }}
                      onNewHandle={() => {
                        props.onNewHandle?.();
                        setPickerOpen(false);
                      }}
                    />
                  )}
                </div>
              ) : (
                <ViewerTagView slug="?" anonymous onSignIn={props.onSignIn} />
              )}
            </div>
            <div style={{ padding: "0 14px 12px", overflowY: "auto" }}>
              {props.publishState === "draft" && props.onPublish && props.selectedNav !== "share" && (
                <PublishBanner onPublish={props.onPublish} publishing={props.publishing} />
              )}
              {props.body ?? (
                // The chips+Other region. While a turn streams (`streamBody` set),
                // it stays mounted but hidden+inert so it reserves its height, and
                // the stream view layers on top — the panel shows the streaming
                // chat without resizing and the old chips don't sit visible.
                <div
                  style={{
                    position: "relative",
                    // While streaming, reserve a readable minimum so a text-input-only
                    // card (no chips) doesn't crush the overlaid narration into the
                    // lone input row's height. Harmless when chips are present — they
                    // already reserve more, so the panel still doesn't resize.
                    ...(props.streamBody ? { minHeight: 128 } : null),
                  }}
                >
                  <div
                    aria-hidden={props.streamBody ? true : undefined}
                    inert={props.streamBody ? true : undefined}
                    style={props.streamBody ? { visibility: "hidden" } : undefined}
                  >
                    {props.chips && props.chips.length > 0 && (
                      <OptionButtons
                        options={props.chips}
                        isFirst
                        firstMessage="Describe a change to edit this app live:"
                        onSelect={(o) => {
                          props.onSelectChip?.(o);
                          // Return false so OptionButtons clears the press and the chips stay
                          // clickable — the chip click hands off to in-place codegen, which the
                          // host surfaces via streamBody; we don't want the button to lock.
                          return false;
                        }}
                      />
                    )}
                    <OtherRow onSubmitOther={props.onSubmitOther} />
                  </div>
                  {props.streamBody && <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>{props.streamBody}</div>}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 12px 6px",
                borderTop: "1px solid var(--color-light-decorative-00, #e5e5e5)",
              }}
            >
              <NavIcon label="Home" color="#3b82f6" onClick={props.onHome}>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 12l9-9 9 9" />
                  <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
                </svg>
              </NavIcon>
              <NavIcon label="Edit" color="#fb923c" selected={(props.selectedNav ?? "edit") === "edit"} onClick={props.onEdit}>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </NavIcon>
              <NavIcon
                label="Share"
                color="#22c55e"
                selected={props.selectedNav === "share"}
                onClick={props.onShare}
                buttonRef={props.shareButtonRef}
              >
                ↗
              </NavIcon>
              {/* Invisible placeholder matching the persistent logo's footprint
                  (size 60 → 120×60) so the bottom row flows AROUND the logo, which
                  floats over this slot at the lower-right — the row never sits under
                  it, and the card keeps its original bottom-anchored position. */}
              <div aria-hidden style={{ width: 120, height: 60, flexShrink: 0, marginLeft: "auto" }} />
            </div>
          </div>
        </div>
      )}

      {/* The VibesSwitch logo is ALWAYS rendered at a fixed size and position
          (lower-right), like production: it persists before / during / after the
          card opens — never remounting, resizing, or moving — and runs its own
          open/close morph via `isActive`. The card floats above it; the logo is
          the single toggle. */}
      <div style={{ position: "absolute", right: 16, bottom: 28, zIndex: 3, pointerEvents: "auto" }}>
        <button
          type="button"
          aria-label={open ? "Close vibe menu" : "Open vibe menu"}
          onClick={() => setOpen(!open)}
          style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <VibesSwitch size={60} isActive={!open} isTwinkling={!open && isTwinkling} />
        </button>
      </div>
    </>
  );
}

// Viewer-mode indicator (#2178) — a small glyph next to the handle tag. Admin →
// highlighted (filled, amber) shield = full access-fn bypass; author → muted outline
// shield; read-only member → lock; everyone else (writer member, visitor) → nothing.
// Settled in the epic §2 grant→surface table; admin is the #2178 owner-bypass state
// (the toggle lives in the Share controls — this only reflects the state).
function ModeIndicator({
  viewerMode,
  memberReadOnly,
  adminMode,
}: {
  readonly viewerMode?: "author" | "member" | "visitor";
  readonly memberReadOnly?: boolean;
  readonly adminMode?: boolean;
}) {
  // Admin mode only applies to the owner (the server gates it on isOwner in whoAmI),
  // so require the author viewer state — a stale adminMode flag must not relabel a
  // member/visitor session as admin or hide their lock (Codex P2).
  const show =
    adminMode && viewerMode === "author"
      ? "admin"
      : viewerMode === "author"
        ? "shield"
        : viewerMode === "member" && memberReadOnly
          ? "lock"
          : null;
  if (!show) return null;
  const isAdmin = show === "admin";
  const isShield = isAdmin || show === "shield";
  const label = isAdmin ? "Admin mode" : show === "shield" ? "Owner" : "Read-only";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={isAdmin ? undefined : "text-light-secondary dark:text-dark-secondary"}
      style={{ display: "inline-flex", flexShrink: 0, opacity: isAdmin ? 1 : 0.75, ...(isAdmin ? { color: "#d97706" } : {}) }}
    >
      {isShield ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isAdmin ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
    </span>
  );
}

// Draft indicator (#2772) — a compact "Draft · unpublished" pill shown in the card
// header when the owner is viewing their latest unpublished in-place generation. The
// route only re-pins to the draft fsId for the owner, so this badge is owner-only by
// construction; non-owners always see published and never get this prop. Publishing
// (D2) clears the draft so the badge disappears.
function DraftBadge() {
  return (
    <span
      role="status"
      aria-label="Draft — unpublished changes"
      title="You're viewing your latest unpublished draft"
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        color: "#b45309",
        background: "rgba(245,158,11,0.14)",
        border: "1px solid rgba(245,158,11,0.45)",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
      Draft · unpublished
    </span>
  );
}

// Publish control (#2772 D2) — an in-card banner pairing the draft state with the
// action ("unpublished changes · Publish"), shown above the Edit body when the owner
// has a publishable draft. Clicking calls publishApp; on success the host clears the
// draft so this and the header badge disappear ("up to date").
function PublishBanner({ onPublish, publishing }: { readonly onPublish: () => void; readonly publishing?: boolean }) {
  return (
    <div
      className="rounded-md"
      style={{
        background: "rgba(245,158,11,0.10)",
        border: "1px solid rgba(245,158,11,0.4)",
        padding: "8px 10px",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span className="text-sm" style={{ color: "#92400e", lineHeight: 1.3 }}>
        <strong>Unpublished changes.</strong> <span style={{ opacity: 0.8 }}>Only you can see this draft.</span>
      </span>
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing}
        className="rounded-md px-3 py-1.5 text-sm font-semibold"
        style={{
          flexShrink: 0,
          background: "var(--vibes-near-black, #1a1a1a)",
          color: "#fff",
          border: "none",
          cursor: publishing ? "default" : "pointer",
          opacity: publishing ? 0.6 : 1,
        }}
      >
        {publishing ? "Publishing…" : "Publish"}
      </button>
    </div>
  );
}

function NavIcon({
  label,
  color,
  selected,
  onClick,
  buttonRef,
  children,
}: {
  readonly label: string;
  readonly color: string;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly buttonRef?: React.Ref<HTMLButtonElement>;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 16,
        cursor: "pointer",
        border: "1px solid var(--vibes-near-black, #1a1a1a)",
        boxShadow: selected ? "0 0 0 3px var(--vibes-near-black, #1a1a1a)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function OtherRow({ onSubmitOther }: { readonly onSubmitOther?: (text: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (text) onSubmitOther?.(text);
        setValue("");
      }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
      className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 py-1.5 pl-3 pr-2.5"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Make it your own…"
        className="flex-1 bg-transparent text-sm text-light-primary dark:text-dark-primary outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary"
      />
      {/* Round submit button mirroring the homepage / chat composer's send
          button (circular, near-black, white up-arrow) — scaled down to fit
          the one-line edit field. See NewSessionContent.styles getSubmitButtonStyle. */}
      <button
        type="submit"
        aria-label="Submit change"
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: "50%",
          border: "none",
          background: "var(--vibes-blue, #3b82f6)",
          color: "#fff",
          fontSize: 17,
          fontWeight: "bold",
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </form>
  );
}

export default UnifiedVibeCard;
