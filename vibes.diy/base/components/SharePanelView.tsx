import React from "react";
import { ViewerTagView } from "./ViewerTagView.js";

/**
 * Presentational share dialogue — the simplified in-group model from
 * notes/2026-06-26-agent-in-vibe-ux-epic.md §2 ("Share dialogue: the simplified in-group
 * model"). Scoped to people who can already SEE the vibe, with three classes whose contents
 * stack additively:
 *
 *   - anonymous visitor → Copy URL
 *   - granted member    → Copy URL + the member roster ("who you're in there with")
 *   - author            → Copy URL + roster + the access setting (Public vs grant-required)
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
  readonly role?: "owner" | "editor" | "viewer";
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
  /** Author-only: who can open the vibe. Public = anyone with the link; request = grant-required. */
  readonly access?: ShareAccess;
  readonly onChangeAccess?: (access: ShareAccess) => void;
  /** Author-only: tapping a member's roster tag opens that member's access controls
   *  (viewer / editor / remove) — the manage flow, not yet designed. */
  readonly onSelectMember?: (member: ShareMember) => void;
  readonly className?: string;
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
  onSelectMember,
  className,
}: SharePanelViewProps) {
  const isAuthor = viewer === "author";
  const showRoster = viewer === "member" || viewer === "author";
  // Owner(s) always list first; everyone else keeps their given order (stable sort).
  const roster = [...members].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));

  return (
    <div
      className={`text-light-primary dark:text-dark-primary ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Link — everyone who can see the vibe. The access-state copy sits BELOW it. */}
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
        <p className="mt-1.5 text-xs text-light-secondary dark:text-dark-secondary">
          {access === "public" ? "Anyone with the link can open this vibe." : "Only approved members can access this vibe."}
        </p>
      </div>

      {/* Member roster — granted members and the author. ViewerTag tags flow inline (wrap),
          like a list of tags. No roles here — role changes live in the (TBD) manage flow,
          which the author reaches by tapping a tag. */}
      {showRoster && (
        <div>
          <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
            In this vibe
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {roster.map((m) => {
              const tag = (
                <ViewerTagView slug={m.handle} displayName={`@${m.handle}`} avatarUrl={m.avatarUrl} style={ROSTER_TAG_STYLE} />
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

      {/* Access setting — author only. The one surviving owner control: who can READ it. */}
      {isAuthor && (
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
              const active = opt.value === access;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChangeAccess?.(opt.value)}
                  className={
                    "flex-1 rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors " +
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
      )}
    </div>
  );
}

export default SharePanelView;
