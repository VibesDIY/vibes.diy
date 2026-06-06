import { useAuth, useUser } from "@clerk/react";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

export interface UseRecentVibes {
  items: ResRecentVibesItem[];
  nextCursor?: string;
  loading: boolean;
  isLoadingAll: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  ensureAllLoaded: () => Promise<void>;
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
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
  const loadAllPromiseRef = useRef<Promise<void> | null>(null);
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const refresh = useCallback(async () => {
    if (!isSignedInRef.current) return;
    loadAllPromiseRef.current = null;
    setIsLoadingAll(false);
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
    loadAllPromiseRef.current = null;
    setIsLoadingAll(false);
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

  const ensureAllLoaded = useCallback(async () => {
    if (loadAllPromiseRef.current) return loadAllPromiseRef.current;
    if (!isSignedInRef.current || !nextCursor) return;

    const token = ++fetchTokenRef.current;
    setIsLoadingAll(true);
    setError(null);

    const promise = (async () => {
      let cursor: string | undefined = nextCursor;
      while (cursor) {
        const res = await vibeDiyApi.listRecentVibes({ limit, cursor });
        if (token !== fetchTokenRef.current) return;
        if (res.isErr()) {
          setError(res.Err().message);
          return;
        }
        const ok = res.Ok();
        setItems((prev) => [...prev, ...ok.items]);
        cursor = ok.nextCursor;
        setNextCursor(ok.nextCursor);
      }
    })().finally(() => {
      if (loadAllPromiseRef.current === promise) {
        loadAllPromiseRef.current = null;
        setIsLoadingAll(false);
      }
    });

    loadAllPromiseRef.current = promise;
    return promise;
  }, [vibeDiyApi, limit, nextCursor]);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }
    if (!isSignedIn) {
      fetchTokenRef.current++;
      loadAllPromiseRef.current = null;
      setItems([]);
      setNextCursor(undefined);
      setError(null);
      setLoading(false);
      setIsLoadingAll(false);
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

  return { items, nextCursor, loading, isLoadingAll, error, refresh, loadMore, ensureAllLoaded, mutate };
}
