import React from "react";
import { ViewerTagView } from "./ViewerTagView.js";

/**
 * Presentational share dialogue — the simplified in-group model from
 * notes/2026-06-26-agent-in-vibe-ux-epic.md §2 ("Share dialogue: the simplified in-group
 * model"). Scoped to people who can already SEE the vibe, with three classes whose contents
 * stack additively:
 *
 *   - anonymous visitor → Copy URL + the access copy
 *   - granted member    → + the member roster ("who you're in there with") on grant-gated
 *                         vibes only (a public vibe has open membership, so no list)
 *   - author            → the access TOGGLE (replaces the copy) + the roster (always, even
 *                         on a public vibe, so the owner can see who's been granted)
 *
 * The access slot is a toggle by role: the owner gets the Public/grant-required buttons (the
 * source of truth), everyone else gets a read-only sentence describing the same thing.
 *
 * Built as a real `@vibes.diy/base` component so it can be iterated in Storybook (the same
 * single-source-of-truth loop the unified card used). All actions are INJECTED.
 *
 * Deferred, NOT modelled here: (1) the `remixable-without-access` author setting
 * ("can't see it, but can remix it"), (2) the request-access screen a *not-yet-granted*
 * user hits on a grant-required vibe, (3) the per-member manage menu (viewer / editor /
 * remove) reached by an author tapping a roster tag. Groundwork for #2680 (#2232 cluster).
 */

export type ShareViewer = "anonymous" | "member" | "author";
export type ShareAccess = "public" | "request";

export interface ShareMember {
  readonly handle: string;
  readonly role?: "owner" | "editor" | "viewer" | "submitter";
  readonly avatarUrl?: string;
}

export interface SharePanelViewProps {
  /** The shareable app URL. */
  readonly url: string;
  /** When true, the Copy button reads "Copied". */
  readonly copied?: boolean;
  readonly onCopy?: () => void;
  /** Opens the live published app (link-first: copy URL + inline "View live", #2234). */
  readonly onViewLive?: () => void;
  /** Which of the three in-vibe classes is viewing. */
  readonly viewer: ShareViewer;
  /** The people in the vibe — shown to member + author (the roster). Owner lists first. */
  readonly members?: readonly ShareMember[];
  /** Who can open the vibe. Public = anyone with the link; request = grant-required. The
   *  author edits it via the toggle; everyone else sees it as read-only copy. */
  readonly access?: ShareAccess;
  readonly onChangeAccess?: (access: ShareAccess) => void;
  /** Author-only: disables the access toggle while the authoritative setting is still
   *  loading (or a write is in flight). Prevents acting on the loader's `isWorldReadable`
   *  fallback before the real `publicAccess` value resolves — otherwise a click in that
   *  window can be silently dropped or clobbered by the late read. */
  readonly accessPending?: boolean;
  /** Author-only: tapping a member's roster tag opens that member's access controls
   *  (viewer / editor / remove) — the manage flow, not yet designed. */
  readonly onSelectMember?: (member: ShareMember) => void;
  readonly className?: string;
}

// Read-only role label shown in each roster tag. Mirrors the legacy MembersSection
// convention (a "viewer" grant reads as "reader"). A "submitter" can write but not
// read others' entries (canWrite, db-acl-eval) — the role for filling out forms
// (contact requests, sign-ups, etc.) — and is labeled with its own name.
function roleLabel(role: NonNullable<ShareMember["role"]>): string {
  switch (role) {
    case "viewer":
      return "reader";
    case "submitter":
      return "submitter";
    default:
      return role; // owner / editor
  }
}

const ROSTER_TAG_STYLE: React.CSSProperties = {
  background: "var(--color-light-background-01, #eee)",
  border: "1px solid var(--color-light-decorative-01, #ddd)",
  color: "var(--color-light-primary, #333)",
  fontSize: 13,
  padding: "3px 10px 3px 4px",
};

export function SharePanelView({
  url,
  copied,
  onCopy,
  onViewLive,
  viewer,
  members = [],
  access = "public",
  onChangeAccess,
  accessPending,
  onSelectMember,
  className,
}: SharePanelViewProps) {
  const isAuthor = viewer === "author";
  // The roster only makes sense on a grant-gated vibe — a curated list worth browsing.
  // On a public ("anyone with the link") vibe membership is open, so members don't see a
  // list. The owner is the exception (new decision): they always see who's been granted.
  const showRoster = isAuthor || (viewer === "member" && access === "request");
  // Owner(s) always list first; everyone else keeps their given order (stable sort).
  const roster = [...members].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));

  return (
    <div
      className={`text-light-primary dark:text-dark-primary ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Link — everyone who can see the vibe. */}
      <div>
        <div
          className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 py-1.5 pl-3 pr-1.5"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span className="flex-1 truncate text-sm">{url}</span>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy link"
            className="shrink-0 rounded-[5px] border-2 border-[#1a1a1a] bg-blue-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-blue-600 active:translate-x-[2px] active:translate-y-[2px]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={onViewLive}
          className="mt-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View live ↗
        </button>
      </div>

      {/* Access slot — a toggle by role, directly above the roster. The owner gets the
          buttons (the source of truth for who can open the vibe); everyone else gets the
          read-only sentence describing the same thing. */}
      {isAuthor ? (
        <div>
          <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
            Who can open it
          </p>
          <div role="radiogroup" aria-label="Who can open it" style={{ display: "flex", gap: 6 }}>
            {(
              [
                { value: "public", label: "Anyone with the link" },
                { value: "request", label: "People you approve" },
              ] as const
            ).map((opt) => {
              // While the authoritative setting is still loading (accessPending), neither
              // button is selected — `access` is only the loader's `isWorldReadable` fallback
              // at this point, so honouring it would flash a button as selected before the
              // real `publicAccess` value resolves. Both stay unselected until it lands.
              const active = !accessPending && opt.value === access;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={accessPending}
                  onClick={() => onChangeAccess?.(opt.value)}
                  className={
                    "flex-1 rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors " +
                    (accessPending ? "cursor-default opacity-60 " : "") +
                    (active
                      ? "border-[#1a1a1a] bg-light-background-01 dark:bg-dark-background-01"
                      : "border-light-decorative-01 dark:border-dark-decorative-01 hover:bg-light-background-01 dark:hover:bg-dark-background-01")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-light-secondary dark:text-dark-secondary">
          {access === "public" ? "Anyone with the link can open this vibe." : "Only approved members can access this vibe."}
        </p>
      )}

      {/* Member roster — granted members and the author. ViewerTag tags flow inline (wrap),
          like a list of tags. Each tag carries the member's role read-only (owner / editor /
          reader), mirroring the legacy MembersSection. Role *changes* still live in the (TBD)
          manage flow, which the author reaches by tapping a tag. */}
      {showRoster && (
        <div>
          <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
            In this vibe
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {roster.map((m) => {
              const tag = (
                <ViewerTagView
                  slug={m.handle}
                  displayName={`@${m.handle}`}
                  avatarUrl={m.avatarUrl}
                  trailing={
                    m.role ? <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 2 }}>{roleLabel(m.role)}</span> : undefined
                  }
                  style={ROSTER_TAG_STYLE}
                />
              );
              return isAuthor ? (
                <button
                  key={m.handle}
                  type="button"
                  aria-label={`Manage @${m.handle}`}
                  onClick={() => onSelectMember?.(m)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  {tag}
                </button>
              ) : (
                <span key={m.handle}>{tag}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SharePanelView;
