import { useAuth } from "@clerk/react";
import type { ResListApplicationChatsItem } from "@vibes.diy/api-types";
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

function toRecentVibes(items: ResListApplicationChatsItem[], limit: number): RecentVibeItem[] {
  const seen = new Set<string>();
  const out: RecentVibeItem[] = [];
  for (const item of items) {
    const key = `${item.userSlug}/${item.appSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userSlug: item.userSlug, appSlug: item.appSlug });
    if (out.length >= limit) break;
  }
  return out;
}

export function RecentVibes({ onNavigate }: RecentVibesProps) {
  const { isSignedIn } = useAuth();
  const { vibeDiyApi } = useVibesDiy();
  const [chats, setChats] = useState<ResListApplicationChatsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const items = useMemo(() => {
    const sorted = [...chats].sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
    return toRecentVibes(sorted, 10);
  }, [chats]);

  useEffect(() => {
    let cancelled = false;

    if (!isSignedIn) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    vibeDiyApi
      .listApplicationChats({ limit: 50 })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          setChats(res.Ok().items);
        }
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
    <div className="pt-2">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center rounded-xl px-4 py-3 mb-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
      >
        <svg className="text-accent-01 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span>New Vibe</span>
      </Link>

      {loading ? (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
        </div>
      ) : items.length > 0 ? (
        <>
          <h3 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider opacity-50">Recent</h3>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={`${item.userSlug}/${item.appSlug}`}>
                <Link
                  to={`/chat/${item.userSlug}/${item.appSlug}`}
                  onClick={onNavigate}
                  className="flex items-center rounded-lg px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{item.appSlug}</span>
                    <span className="text-xs truncate opacity-50">{item.userSlug}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="px-4 pb-1 text-xs opacity-60">No recent vibes yet.</div>
      )}
    </div>
  );
}
