import { useAuth } from "@clerk/react";
import React from "react";
import { Link } from "react-router-dom";
import { useRecentVibes } from "../hooks/useRecentVibes.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";

function VibeIconThumb({ icon }: { icon?: { cid: string; mime: string } }) {
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

export function RecentVibes({ onNavigate }: RecentVibesProps) {
  const { isSignedIn } = useAuth();
  const { items, loading, error, refresh } = useRecentVibes(20);

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
                  <VibeIconThumb icon={item.icon} />
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{item.title || item.appSlug}</span>
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
