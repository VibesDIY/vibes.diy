import React from "react";

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
 * user hits on a grant-required vibe. Groundwork for #2680 (link-first Share, #2232 cluster).
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
  /** The people in the vibe — shown to member + author (the roster). */
  readonly members?: readonly ShareMember[];
  /** Author-only: who can open the vibe. Public = anyone with the link; request = grant-required. */
  readonly access?: ShareAccess;
  readonly onChangeAccess?: (access: ShareAccess) => void;
  /** Author-only: open the deeper member management (roles / approve). Stub for now. */
  readonly onManageMembers?: () => void;
  readonly className?: string;
}

function Avatar({ member }: { readonly member: ShareMember }) {
  const initial = member.handle.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "50%",
        background: "var(--vibes-blue, #3b82f6)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        overflow: "hidden",
      }}
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </span>
  );
}

export function SharePanelView({
  url,
  copied,
  onCopy,
  onViewLive,
  viewer,
  members = [],
  access = "public",
  onChangeAccess,
  onManageMembers,
  className,
}: SharePanelViewProps) {
  const isAuthor = viewer === "author";
  const showRoster = viewer === "member" || viewer === "author";

  return (
    <div
      className={`text-light-primary dark:text-dark-primary ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Copy URL — everyone who can see the vibe. */}
      <div>
        <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
          {access === "public" ? "Anyone with the link can open this vibe." : "Only the members listed here can open this vibe."}
        </p>
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

      {/* Member roster — granted members and the author. Contents differ by role: a member
          sees a read-only list; the author additionally gets the management entry. */}
      {showRoster && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <p className="text-xs text-light-secondary dark:text-dark-secondary">In this vibe · {members.length}</p>
            {isAuthor && (
              <button
                type="button"
                onClick={onManageMembers}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Manage →
              </button>
            )}
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
            {members.map((m) => (
              <li key={m.handle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar member={m} />
                <span className="flex-1 truncate text-sm">@{m.handle}</span>
                {m.role && <span className="text-xs capitalize text-light-secondary dark:text-dark-secondary">{m.role}</span>}
              </li>
            ))}
          </ul>
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
