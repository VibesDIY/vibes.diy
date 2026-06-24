import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import type { NotificationRow } from "@vibes.diy/api-types";
import LoggedOutView from "../components/LoggedOutView.js";
import BrutalistLayout from "../components/BrutalistLayout.js";
import { useNotifications } from "../hooks/useNotifications.js";
import { pathForNotification } from "../hooks/useBuildCompletionNotifications.js";

export function meta() {
  return [{ title: "Notifications | Vibes DIY" }, { name: "description", content: "Your notification inbox" }];
}

// Relative timestamp matching the app's existing date copy (cf. VibesGrid).
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationRowItem({ row, onActivate }: { row: NotificationRow; onActivate: (row: NotificationRow) => void }) {
  const isUnread = !row.readAt;
  return (
    <button
      type="button"
      onClick={() => onActivate(row)}
      className={`flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/10 dark:border-white/10 last:border-b-0 ${
        isUnread ? "font-semibold" : "opacity-80"
      }`}
    >
      {/* Unread dot keeps the read/unread distinction legible without relying on weight alone. */}
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-blue-500" : "bg-transparent"}`} />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm">{row.body}</span>
        <span className="mt-0.5 block text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
          {relativeTime(row.created)}
        </span>
      </span>
    </button>
  );
}

function NotificationsContent() {
  const navigate = useNavigate();
  const { items, unreadCount, nextCursor, loading, error, loadMore, markRead } = useNotifications();

  const onActivate = (row: NotificationRow) => {
    if (!row.readAt) void markRead([row.id]);
    const path = pathForNotification(row);
    if (path) navigate(path);
  };

  return (
    <BrutalistLayout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
      headerActions={
        unreadCount > 0 ? (
          <VibesButton variant="blue" onClick={() => void markRead()}>
            Mark all read
          </VibesButton>
        ) : undefined
      }
    >
      {error && (
        <BrutalistCard size="md">
          <p className="text-red-600 font-medium">{error}</p>
        </BrutalistCard>
      )}

      {loading && items.length === 0 ? (
        <BrutalistCard size="md">
          <p className="text-center text-lg">Loading…</p>
        </BrutalistCard>
      ) : items.length === 0 ? (
        <BrutalistCard size="md">
          <p className="text-center text-lg">No notifications yet.</p>
        </BrutalistCard>
      ) : (
        <BrutalistCard size="md">
          <div className="flex flex-col">
            {items.map((row) => (
              <NotificationRowItem key={row.id} row={row} onActivate={onActivate} />
            ))}
          </div>
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <VibesButton variant="blue" onClick={() => void loadMore()} disabled={loading}>
                {loading ? "Loading…" : "Load more"}
              </VibesButton>
            </div>
          )}
        </BrutalistCard>
      )}
    </BrutalistLayout>
  );
}

export default function Notifications() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <NotificationsContent />;
}
