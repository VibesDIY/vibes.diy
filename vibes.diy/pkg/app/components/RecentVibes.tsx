import { useAuth } from "@clerk/react";
import type { ResListRecentVibesItem } from "@vibes.diy/api-types";
import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

export function RecentVibes() {
  const { isSignedIn } = useAuth();
  const { vibeDiyApi } = useVibesDiy();
  const [items, setItems] = useState<ResListRecentVibesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    vibeDiyApi
      .listRecentVibes({ limit: 10 })
      .then((res) => {
        if (res.isOk()) {
          setItems(res.Ok().items);
        }
      })
      .finally(() => setLoading(false));
  }, [isSignedIn, vibeDiyApi]);

  if (!isSignedIn) return null;

  return (
    <div className="pt-2">
      <a
        href="/"
        className="flex items-center rounded-xl px-4 py-3 mb-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
      >
        <svg className="text-accent-01 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span>New Vibe</span>
      </a>

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
                <a
                  href={`/chat/${item.userSlug}/${item.appSlug}`}
                  className="flex items-center rounded-lg px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{item.appSlug}</span>
                    <span className="text-xs truncate opacity-50">{item.userSlug}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
