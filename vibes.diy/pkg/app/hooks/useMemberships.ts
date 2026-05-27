import { useAuth, useUser } from "@clerk/react";
import type { ResMembershipItem } from "@vibes.diy/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

export interface UseMemberships {
  items: ResMembershipItem[];
  nextCursor?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useMemberships(limit: number): UseMemberships {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { vibeDiyApi } = useVibesDiy();

  const [items, setItems] = useState<ResMembershipItem[]>([]);
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
    const res = await vibeDiyApi.listMemberships({ limit });
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
    const res = await vibeDiyApi.listMemberships({ limit, cursor: nextCursor });
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

  return { items, nextCursor, loading, error, refresh, loadMore };
}
