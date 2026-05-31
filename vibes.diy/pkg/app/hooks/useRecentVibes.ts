import { useAuth, useUser } from "@clerk/react";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

export interface UseRecentVibes {
  items: ResRecentVibesItem[];
  nextCursor?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  // Local-only setter so callers can optimistically update items
  // (pin/rename/soft-delete) before the server confirms; the next refresh
  // overwrites with authoritative data.
  mutate: (updater: (prev: ResRecentVibesItem[]) => ResRecentVibesItem[]) => void;
}

export interface RecentVibesChange {
  ownerHandle?: string;
  appSlug?: string;
  title?: string;
}

type RecentVibesListener = (change?: RecentVibesChange) => void;

const recentVibesListeners = new Set<RecentVibesListener>();

export function subscribeRecentVibesChanged(fn: RecentVibesListener): () => void {
  recentVibesListeners.add(fn);
  return () => {
    recentVibesListeners.delete(fn);
  };
}

export function notifyRecentVibesChanged(change?: RecentVibesChange): void {
  for (const fn of recentVibesListeners) fn(change);
}

export function useRecentVibes(limit: number): UseRecentVibes {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { vibeDiyApi } = useVibesDiy();

  const [items, setItems] = useState<ResRecentVibesItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const refresh = useCallback(async () => {
    if (!isSignedInRef.current) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    const res = await vibeDiyApi.listRecentVibes({ limit });
    if (token !== fetchTokenRef.current) return;
    if (res.isOk()) {
      const ok = res.Ok();
      setItems(ok.items);
      setNextCursor(ok.nextCursor);
    } else {
      setError(res.Err().message);
    }
    setLoading(false);
  }, [vibeDiyApi, limit]);

  const loadMore = useCallback(async () => {
    if (!isSignedInRef.current || !nextCursor) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    const res = await vibeDiyApi.listRecentVibes({ limit, cursor: nextCursor });
    if (token !== fetchTokenRef.current) return;
    if (res.isOk()) {
      const ok = res.Ok();
      setItems((prev) => [...prev, ...ok.items]);
      setNextCursor(ok.nextCursor);
    } else {
      setError(res.Err().message);
    }
    setLoading(false);
  }, [vibeDiyApi, limit, nextCursor]);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }
    if (!isSignedIn) {
      fetchTokenRef.current++;
      setItems([]);
      setNextCursor(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [isLoaded, isSignedIn, user?.id, refresh]);

  useEffect(() => {
    const listener = () => {
      void refresh();
    };
    return subscribeRecentVibesChanged(listener);
  }, [refresh]);

  const mutate = useCallback((updater: (prev: ResRecentVibesItem[]) => ResRecentVibesItem[]) => {
    setItems(updater);
  }, []);

  return { items, nextCursor, loading, error, refresh, loadMore, mutate };
}
