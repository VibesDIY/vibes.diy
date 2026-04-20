import { useAuth } from "@clerk/react";
import type { ResListUserSlugAppSlugItem } from "@vibes.diy/api-types";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVibesDiy } from "../vibes-diy-provider.js";

interface RecentVibesProps {
  onNavigate?: () => void;
}

interface RecentVibeItem {
  userSlug: string;
  appSlug: string;
}

function VibeIconThumb({ userSlug, appSlug }: { userSlug: string; appSlug: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="h-6 w-6 flex-shrink-0 rounded-sm bg-black/10 dark:bg-white/10" aria-hidden />;
  return (
    <img
      src={`/vibes-icon/${userSlug}/${appSlug}`}
      alt=""
      className="h-6 w-6 flex-shrink-0 rounded-sm bg-black/5 dark:bg-white/5"
      onError={() => setFailed(true)}
    />
  );
}

export function toRecentVibes(items: ResListUserSlugAppSlugItem[], limit: number): RecentVibeItem[] {
  if (limit <= 0) return [];
  const out: RecentVibeItem[] = [];
  for (const item of items) {
    for (const appSlug of item.appSlugs) {
      out.push({ userSlug: item.userSlug, appSlug });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function RecentVibes({ onNavigate }: RecentVibesProps) {
  const { isSignedIn } = useAuth();
  const { vibeDiyApi } = useVibesDiy();
  const [vibeItems, setVibeItems] = useState<ResListUserSlugAppSlugItem[]>([]);
  const [loading, setLoading] = useState(true);

  const items = useMemo(() => toRecentVibes(vibeItems, 20), [vibeItems]);

  useEffect(() => {
    let cancelled = false;

    if (!isSignedIn) {
      setVibeItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    vibeDiyApi
      .listUserSlugAppSlug({})
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) setVibeItems(res.Ok().items);
        else setVibeItems([]);
      })
      .catch(() => {
        if (!cancelled) setVibeItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, vibeDiyApi]);

  if (!isSignedIn) return null;

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
        </div>
      ) : items.length > 0 ? (
        <>
          <h3 className="sticky -top-3 bg-light-background-00 dark:bg-dark-background-00 px-4 pt-7 pb-2 text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 z-10">
            My Recent Vibes
          </h3>
          <ul className="ml-3">
            {items.map((item) => (
              <li key={`${item.userSlug}/${item.appSlug}`}>
                <Link
                  to={`/chat/${item.userSlug}/${item.appSlug}`}
                  onClick={onNavigate}
                  className="flex items-center gap-2 pl-2 pr-4 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5"
                >
                  <VibeIconThumb userSlug={item.userSlug} appSlug={item.appSlug} />
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{item.appSlug}</span>
                    <span className="text-xs truncate opacity-50">{item.userSlug}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/vibes/mine"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium opacity-60 transition-colors hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>See all vibes</span>
          </Link>
        </>
      ) : (
        <div className="px-4 pb-1 text-xs opacity-60">No recent vibes yet.</div>
      )}
    </div>
  );
}
