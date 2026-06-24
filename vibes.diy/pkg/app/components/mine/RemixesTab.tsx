import React from "react";
import { Link } from "react-router-dom";
import type { NotificationRow } from "@vibes.diy/api-types";
import { useNotifications } from "../../hooks/useNotifications.js";
import { pathForNotification } from "../../hooks/useBuildCompletionNotifications.js";

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function remixerLabel(row: NotificationRow): string {
  // Prefer the structured actor handle; fall back to the self-contained body.
  if (row.actorHandle) return `@${row.actorHandle}`;
  return row.body;
}

/**
 * "Who remixed my vibe" list for a single vibe, backed by the durable
 * notification store: listNotifications filtered to
 * { notificationType: "vibe-remixed", appSlug }. One row per remix (dedupeKey),
 * forward-only (pre-feature remixes do not appear). Each row links to the
 * published remix via targetRef.
 */
export function RemixesTab({ appSlug }: { ownerHandle: string; appSlug: string }) {
  const { items, loading, error, nextCursor, loadMore } = useNotifications({
    notificationType: "vibe-remixed",
    appSlug,
  });

  if (loading && items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading remixes…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 font-medium">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No one has remixed this vibe yet. Remixes published after this feature shipped will appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {items.map((row) => {
          const path = pathForNotification(row);
          const label = remixerLabel(row);
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                {path ? (
                  <Link to={path} className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{label}</span>
                )}
                <p className="text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
                  {row.body}
                </p>
              </div>
              <span className="shrink-0 text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
                {relativeDate(row.created)}
              </span>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-3 self-center text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
