import { useAuth } from "@clerk/react";
import type { ResListUserSlugAppSlugItem } from "@vibes.diy/api-types";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRecentVibesData } from "../contexts/RecentVibesContext.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";

function VibeIconThumb({ userSlug, appSlug }: { userSlug: string; appSlug: string }) {
  const { vibeDiyApi } = useVibesDiy();
  const [icon, setIcon] = useState<{ cid: string; mime: string } | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    vibeDiyApi.ensureAppSettings({ userSlug, appSlug }).then((rS) => {
      if (cancelled) return;
      if (rS.isOk()) {
        const i = rS.Ok().settings.entry.settings.icon;
        if (i) setIcon(i);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userSlug, appSlug, vibeDiyApi]);
  if (!icon) return <span className="h-6 w-6 shrink-0" aria-hidden="true" />;
  return (
    <img
      src={cidAssetUrl(icon.cid, icon.mime, getAppHostBaseUrl())}
      alt=""
      className="h-6 w-6 shrink-0 rounded-full"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

interface RecentVibesProps {
  onNavigate?: () => void;
}

interface RecentVibeItem {
  userSlug: string;
  appSlug: string;
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
  const { items: vibeItems, loading, error, refresh } = useRecentVibesData();

  const items = useMemo(() => toRecentVibes(vibeItems, 20), [vibeItems]);

  if (!isSignedIn) return null;

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
        </div>
      ) : error && items.length === 0 ? (
        <div className="px-4 pb-1 text-xs">
          <p className="opacity-60">Couldn&apos;t load recent vibes.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-1 underline opacity-80 hover:opacity-100"
          >
            Retry
          </button>
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
