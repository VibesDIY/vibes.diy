import { useAuth, useUser } from "@clerk/react";
import type { NotificationRow, NotificationType } from "@vibes.diy/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

export interface UseNotificationsFilters {
  // Restrict to one notification type (e.g. "vibe-remixed" for a per-vibe
  // "who remixed my vibe" view).
  notificationType?: NotificationType;
  // Restrict to one subject vibe.
  appSlug?: string;
  // Page size (server clamps to 1..100, defaults to 30).
  limit?: number;
}

export interface UseNotifications {
  items: NotificationRow[];
  // Total unread for the caller — NOT the filtered subset — so a bell badge is
  // stable regardless of which filtered view requested it (matches the server).
  unreadCount: number;
  nextCursor?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  // Mark rows read. Omit `ids` to mark ALL of the caller's unread rows read.
  // Refreshes afterward so `items`/`unreadCount` reflect the new state.
  markRead: (ids?: string[]) => Promise<void>;
}

// Data hook for the notification inbox + bell. Modeled on useRecentVibes: auth-
// gated, fetches via the shared-plane API, supports pagination and an optional
// type/appSlug filter. The base list renders straight from each row's stored
// `body` (no second query).
export function useNotifications(filters: UseNotificationsFilters = {}): UseNotifications {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { sharedApi } = useVibesDiy();

  const { notificationType, appSlug, limit } = filters;

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;
  // Keep the latest cursor available to markRead's refresh without re-binding.
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;

  const baseReq = useCallback(
    () => ({
      ...(notificationType ? { notificationType } : {}),
      ...(appSlug ? { appSlug } : {}),
      ...(limit ? { limit } : {}),
    }),
    [notificationType, appSlug, limit]
  );

  const refresh = useCallback(async () => {
    if (!isSignedInRef.current) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    const res = await sharedApi.listNotifications(baseReq());
    if (token !== fetchTokenRef.current) return;
    if (res.isOk()) {
      const ok = res.Ok();
      setItems(ok.items);
      setUnreadCount(ok.unreadCount);
      setNextCursor(ok.nextCursor);
    } else {
      setError(res.Err().message);
    }
    setLoading(false);
  }, [sharedApi, baseReq]);

  const loadMore = useCallback(async () => {
    if (!isSignedInRef.current || !nextCursorRef.current) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    const res = await sharedApi.listNotifications({ ...baseReq(), cursor: nextCursorRef.current });
    if (token !== fetchTokenRef.current) return;
    if (res.isOk()) {
      const ok = res.Ok();
      setItems((prev) => [...prev, ...ok.items]);
      setUnreadCount(ok.unreadCount);
      setNextCursor(ok.nextCursor);
    } else {
      setError(res.Err().message);
    }
    setLoading(false);
  }, [sharedApi, baseReq]);

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!isSignedInRef.current) return;
      const res = await sharedApi.markNotificationsRead(ids ? { ids } : {});
      if (res.isErr()) {
        setError(res.Err().message);
        return;
      }
      await refresh();
    },
    [sharedApi, refresh]
  );

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }
    if (!isSignedIn) {
      fetchTokenRef.current++;
      setItems([]);
      setUnreadCount(0);
      setNextCursor(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [isLoaded, isSignedIn, user?.id, refresh]);

  return { items, unreadCount, nextCursor, loading, error, refresh, loadMore, markRead };
}
