import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { MetaScreenShot, ResRecentVibesItem } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { useRecentVibes } from "../hooks/useRecentVibes.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";

const FETCH_PAGE_SIZE = 30;
// Fixed height = approx 3 rows of icon cards + padding + gaps. Cards scale
// with viewport so this is a best-effort middle ground (3 rows on desktop,
// roughly 2 rows on phone).
const CONTAINER_HEIGHT = 420;
const DETAIL_PANEL_WIDTH = 360;

// Module-level cache so re-opening the detail panel for the same app skips
// the network round-trip.
const screenshotCache = new Map<string, MetaScreenShot | null>();

function screenshotSrc(shot: MetaScreenShot): string {
  return `/assets/cid/?url=${encodeURIComponent(shot.assetUrl)}&mime=${encodeURIComponent(shot.mime)}`;
}

type AppItem = Pick<ResRecentVibesItem, "userSlug" | "appSlug" | "title" | "icon">;

export function MyAppsSection() {
  const { items, loading, nextCursor, loadMore } = useRecentVibes(FETCH_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItem, setDetailItem] = useState<AppItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const appHostBaseUrl = getAppHostBaseUrl();

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        (item.title ?? "").toLowerCase().includes(q) ||
        item.appSlug.toLowerCase().includes(q) ||
        item.userSlug.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Infinite scroll — fire loadMore when the sentinel scrolls into the
  // container's viewport. We still feed the next page from the server even
  // while a search filter is active, so users can find older matches.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !nextCursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void loadMore();
      },
      { root, rootMargin: "200px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [nextCursor, loading, loadMore]);

  // ESC closes the detail panel.
  useEffect(() => {
    if (!detailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailItem]);

  return (
    <section className="mt-10">
      <h2 className="px-1 mb-3 text-sm font-bold uppercase tracking-[0.15em] text-light-primary dark:text-dark-primary">
        My Apps
      </h2>

      {/* Search — under the label, centered. */}
      <div className="mb-3 flex justify-center">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div
        ref={scrollContainerRef}
        className="rounded-lg border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] bg-[var(--vibes-cream)] dark:bg-dark-background-01 overflow-y-auto"
        style={{ height: CONTAINER_HEIGHT }}
      >
        {filteredItems.length === 0 && !loading ? (
          <div className="py-12 text-center text-sm text-light-primary/60 dark:text-dark-primary/60">
            {searchQuery.trim()
              ? `No matches for "${searchQuery.trim()}".`
              : "No vibes yet — describe one above to get started."}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 p-4">
            {filteredItems.map((item) => (
              <AppIconCard
                key={`${item.userSlug}/${item.appSlug}`}
                item={item}
                appHostBaseUrl={appHostBaseUrl}
                onOpenInfo={() => setDetailItem(item)}
              />
            ))}
            {nextCursor && <div ref={sentinelRef} className="col-span-full h-1" aria-hidden="true" />}
            {loading && filteredItems.length > 0 && (
              <div className="col-span-full flex justify-center py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
              </div>
            )}
          </div>
        )}
      </div>

      <AppDetailPanel item={detailItem} appHostBaseUrl={appHostBaseUrl} onClose={() => setDetailItem(null)} />
    </section>
  );
}

interface AppIconCardProps {
  item: AppItem;
  appHostBaseUrl: string;
  onOpenInfo: () => void;
}

function AppIconCard({ item, appHostBaseUrl, onOpenInfo }: AppIconCardProps) {
  const label = item.title ?? item.appSlug;
  const iconUrl = item.icon ? cidAssetUrl(item.icon.cid, item.icon.mime, appHostBaseUrl) : undefined;
  return (
    <div className="group relative flex flex-col items-center gap-1.5">
      <Link
        to={`/chat/${item.userSlug}/${item.appSlug}`}
        className="w-full aspect-square bg-light-background-00 dark:bg-dark-background-00 border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] rounded-xl overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:shadow-[3px_3px_0_0_var(--vibes-near-black)] dark:group-hover:shadow-[3px_3px_0_0_var(--color-dark-decorative-01)]"
        aria-label={`Open ${label}`}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            className="w-full h-full object-cover dark:invert"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="text-light-primary/60 dark:text-dark-primary/60 text-[10px] font-bold uppercase tracking-wider px-1 text-center">
            {item.appSlug.slice(0, 6)}
          </span>
        )}
      </Link>

      {/* Info button — top-right, fades in on hover; always faintly visible on
          touch (no hover). */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenInfo();
        }}
        aria-label={`Info about ${label}`}
        className="absolute -top-2 -right-2 z-[2] flex items-center justify-center w-6 h-6 rounded-full bg-[var(--vibes-near-black)] text-[var(--vibes-cream)] dark:bg-[var(--vibes-cream)] dark:text-[var(--vibes-near-black)] border-2 border-[var(--vibes-cream)] dark:border-[var(--color-dark-decorative-01)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 [@media(hover:none)]:opacity-60"
      >
        <span className="text-[11px] font-bold italic leading-none" style={{ fontFamily: "Georgia, serif" }}>
          i
        </span>
      </button>

      <span className="w-full text-xs font-medium text-light-primary dark:text-dark-primary text-center truncate">
        {label}
      </span>
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-md">
      <span
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-light-primary/50 dark:text-dark-primary/50 pointer-events-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your apps…"
        aria-label="Search your apps"
        className="w-full h-9 pl-9 pr-9 rounded-full bg-[var(--vibes-cream)] dark:bg-dark-background-01 border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] text-light-primary dark:text-dark-primary text-sm placeholder:text-light-primary/50 dark:placeholder:text-dark-primary/50 focus:outline-none focus:ring-2 focus:ring-[var(--vibes-blue,#3b82f6)]/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-primary dark:text-dark-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface AppDetailPanelProps {
  item: AppItem | null;
  appHostBaseUrl: string;
  onClose: () => void;
}

function AppDetailPanel({ item, appHostBaseUrl, onClose }: AppDetailPanelProps) {
  const open = item !== null;
  const label = item?.title ?? item?.appSlug ?? "";
  const iconUrl = item?.icon ? cidAssetUrl(item.icon.cid, item.icon.mime, appHostBaseUrl) : undefined;
  const cacheKey = item ? `${item.userSlug}/${item.appSlug}` : "";
  const [screenshot, setScreenshot] = useState<MetaScreenShot | null>(
    item ? (screenshotCache.get(cacheKey) ?? null) : null
  );
  const { vibeDiyApi } = useVibesDiy();
  const previewUrl = screenshot ? screenshotSrc(screenshot) : iconUrl;
  const mockCreator = "@amber-macias";
  const mockDescription =
    "Generated with vibes.diy. A shareable mini-app you can remix, fork, and make your own. (placeholder copy)";

  useEffect(() => {
    if (!item) return;
    const cached = screenshotCache.get(cacheKey);
    if (cached !== undefined) {
      setScreenshot(cached);
      return;
    }
    let cancelled = false;
    vibeDiyApi.getAppByFsId({ userSlug: item.userSlug, appSlug: item.appSlug }).then((res) => {
      if (cancelled) return;
      if (res.isErr()) {
        screenshotCache.set(cacheKey, null);
        return;
      }
      const shot = res.Ok().meta.find(isMetaScreenShot) ?? null;
      screenshotCache.set(cacheKey, shot);
      if (shot) setScreenshot(shot);
    });
    return () => {
      cancelled = true;
    };
  }, [item, cacheKey, vibeDiyApi]);

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/30 dark:bg-black/50 transition-opacity duration-300"
        />
      )}

      <aside
        aria-hidden={!open}
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-[var(--vibes-cream)] dark:bg-dark-background-00 border-l-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] shadow-[-8px_0_24px_rgba(0,0,0,0.2)]"
        style={{
          width: DETAIL_PANEL_WIDTH,
          maxWidth: "100vw",
          transform: open ? "translateX(0)" : `translateX(${DETAIL_PANEL_WIDTH}px)`,
          transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3 right-3 z-[1] w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <svg
            className="text-light-primary dark:text-dark-primary"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {item && (
          <div className="flex flex-col h-full overflow-y-auto">
            <div
              className="w-full bg-light-background-01 dark:bg-dark-background-01 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] flex items-center justify-center overflow-hidden"
              style={{ height: 200 }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className={`w-full h-full object-cover${screenshot ? "" : " dark:invert"}`}
                />
              ) : (
                <span className="text-light-primary/40 dark:text-dark-primary/40 text-xs uppercase tracking-widest">
                  No preview
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 p-6 flex-1">
              <div>
                <h3 className="text-light-primary dark:text-dark-primary text-xl font-bold">{label}</h3>
                <p className="text-light-primary/60 dark:text-dark-primary/60 text-xs uppercase tracking-widest mt-1">
                  Created by {mockCreator}
                </p>
              </div>

              <p className="text-light-primary dark:text-dark-primary text-sm leading-relaxed">{mockDescription}</p>

              <div className="flex flex-col gap-3 mt-auto pt-4">
                <Link
                  to={`/chat/${item.userSlug}/${item.appSlug}`}
                  onClick={onClose}
                  className="flex items-center justify-center px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold uppercase tracking-widest border-2 border-[var(--vibes-near-black)] rounded-md shadow-[4px_4px_0_0_var(--vibes-near-black)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--vibes-near-black)] transition-all duration-150"
                >
                  Enter
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    // TODO: wire to actual unsubscribe action.
                    onClose();
                  }}
                  className="flex items-center justify-center px-4 py-3 bg-light-background-01 dark:bg-dark-background-01 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold uppercase tracking-widest border-2 border-red-500 rounded-md transition-colors"
                >
                  Unsubscribe
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
