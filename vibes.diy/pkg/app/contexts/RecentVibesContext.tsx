import { useAuth, useUser } from "@clerk/react";
import type { ResListUserSlugAppSlugItem } from "@vibes.diy/api-types";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

interface RecentVibesContextType {
  items: ResListUserSlugAppSlugItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const RecentVibesContext = createContext<RecentVibesContextType | undefined>(undefined);

export function RecentVibesProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { vibeDiyApi } = useVibesDiy();

  const [items, setItems] = useState<ResListUserSlugAppSlugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const fetchItems = useCallback(async () => {
    if (!isSignedInRef.current) return;
    const token = ++fetchTokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await vibeDiyApi.listUserSlugAppSlug({});
      if (token !== fetchTokenRef.current) return;
      if (res.isOk()) {
        setItems(res.Ok().items);
      } else {
        setError(res.Err().message);
      }
    } catch (e) {
      if (token !== fetchTokenRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === fetchTokenRef.current) setLoading(false);
    }
  }, [vibeDiyApi]);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }
    if (!isSignedIn) {
      fetchTokenRef.current++;
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchItems();
  }, [isLoaded, isSignedIn, user?.id, fetchItems]);

  const value: RecentVibesContextType = { items, loading, error, refresh: fetchItems };

  return <RecentVibesContext.Provider value={value}>{children}</RecentVibesContext.Provider>;
}

export function useRecentVibesData(): RecentVibesContextType {
  const ctx = useContext(RecentVibesContext);
  if (ctx === undefined) {
    throw new Error("useRecentVibesData must be used within a RecentVibesProvider");
  }
  return ctx;
}
