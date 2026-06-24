import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { useNotifications } from "../hooks/useNotifications.js";

interface NotificationBellProps {
  // Called when the bell link is clicked (e.g. to close the sidebar).
  onNavigate?: () => void;
  className?: string;
}

/**
 * Global bell + unread-count badge, fed by useNotifications().unreadCount.
 *
 * Live updates ride the EXISTING user-notification WebSocket rather than
 * polling: the same `onUserNotification` fan-out that drives the browser-push
 * hook (useBuildCompletionNotifications) also pings this bell to re-fetch the
 * unread count. We prefer the vibeApi (AppSessions) connection when present,
 * else the shared-plane connection — mirroring the build-notifications hook so
 * the bell rides whichever connection the current page already has.
 */
export function NotificationBell({ onNavigate, className }: NotificationBellProps) {
  const { vibeApi, sharedApi } = useVibesDiy();
  const api = vibeApi ?? sharedApi;
  const { unreadCount, refresh } = useNotifications();

  useEffect(() => {
    if (!api?.onUserNotification) return;
    // Best-effort subscribe; the reconnect loop re-subscribes once the
    // userNotificationSubscribed flag is set (same pattern as the push hook).
    void api.subscribeUserNotifications?.({}).catch((_e: unknown) => {
      /* best-effort — reconnect loop will retry */
    });
    return api.onUserNotification(() => {
      void refresh();
    });
  }, [api, refresh]);

  const label = unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications";

  return (
    <Link
      to="/notifications"
      onClick={onNavigate}
      aria-label={label}
      className={
        className ??
        "flex items-center px-4 py-3 text-sm font-medium tracking-wide transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 border-t border-black/10 dark:border-white/10"
      }
    >
      <span className="relative mr-3 flex h-5 w-5 items-center justify-center">
        <svg
          className="text-accent-01 h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white"
            style={{ height: 16 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
      <span>Notifications</span>
    </Link>
  );
}
