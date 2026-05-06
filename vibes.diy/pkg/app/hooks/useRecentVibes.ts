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
}

const recentVibesListeners = new Set<() => void>();

export function notifyRecentVibesChanged(): void {
  for (const fn of recentVibesListeners) fn();
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
    try {
      const res = await vibeDiyApi.listRecentVibes({ limit });
      if (token !== fetchTokenRef.current) return;
      if (res.isOk()) {
        const ok = res.Ok();
        setItems(ok.items);
        setNextCursor(ok.nextCursor);
      } else {
        setError(res.Err().message);
      }
    } catch (e) {
      if (token !== fetchTokenRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === fetchTokenRef.current) setLoading(false);
    }
  }, [vibeDiyApi, limit]);

  const loadMore = useCallback(async () => {
    if (!isSignedInRef.current || !nextCursor) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await vibeDiyApi.listRecentVibes({ limit, cursor: nextCursor });
      if (token !== fetchTokenRef.current) return;
      if (res.isOk()) {
        const ok = res.Ok();
        setItems((prev) => [...prev, ...ok.items]);
        setNextCursor(ok.nextCursor);
      } else {
        setError(res.Err().message);
      }
    } catch (e) {
      if (token !== fetchTokenRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === fetchTokenRef.current) setLoading(false);
    }
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
    recentVibesListeners.add(listener);
    return () => {
      recentVibesListeners.delete(listener);
    };
  }, [refresh]);

  return { items, nextCursor, loading, error, refresh, loadMore };
}
