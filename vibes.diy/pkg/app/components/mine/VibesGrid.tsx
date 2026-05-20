import React, { useEffect, useRef } from "react";
import { BrutalistCard } from "@vibes.diy/base";
import type { MetaScreenShot, ResRecentVibesItem } from "@vibes.diy/api-types";

export interface GridHeadInfo {
  screenshot?: MetaScreenShot;
  mode?: string;
}

export interface VibesGridProps {
  items: ResRecentVibesItem[];
  headInfoMap: Map<string, GridHeadInfo>;
  selectedKey: string;
  onOpen: (item: ResRecentVibesItem) => void;
  isLoading: boolean;
  nextCursor?: string;
  onLoadMore?: () => void;
  /** Action shown in the empty state (e.g. "Create a Vibe" linking to /). */
  emptyState?: { message: string; cta?: React.ReactNode };
}

export function VibesGrid({
  items,
  headInfoMap,
  selectedKey,
  onOpen,
  isLoading,
  nextCursor,
  onLoadMore,
  emptyState,
}: VibesGridProps) {
  const showFirstLoadSkeleton = isLoading && items.length === 0;

  if (showFirstLoadSkeleton) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <VibeRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <BrutalistCard size="md">
        <div className="text-center py-8">
          <p className="mb-4 text-lg">{emptyState?.message ?? "Nothing here yet."}</p>
          {emptyState?.cta}
        </div>
      </BrutalistCard>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const key = `${item.userSlug}/${item.appSlug}`;
          return (
            <VibeRow
              key={key}
              item={item}
              head={headInfoMap.get(key)}
              isSelected={selectedKey === key}
              onOpen={() => onOpen(item)}
            />
          );
        })}
      </div>
      {nextCursor && onLoadMore && (
        <LoadMoreSentinel onLoadMore={onLoadMore} isLoading={isLoading} />
      )}
    </>
  );
}

interface LoadMoreSentinelProps {
  onLoadMore: () => void;
  isLoading: boolean;
}

function LoadMoreSentinel({ onLoadMore, isLoading }: LoadMoreSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isLoading) onLoadMore();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onLoadMore, isLoading]);

  return (
    <div ref={sentinelRef} className="mt-3 flex flex-col gap-3" aria-hidden="true">
      {isLoading && <VibeRowSkeleton />}
    </div>
  );
}

function VibeRowSkeleton() {
  return (
    <div className="flex flex-row items-stretch gap-4 p-3 rounded-lg border-2 border-[var(--vibes-near-black)]/30 dark:border-[var(--color-dark-decorative-01)]/40 bg-light-background-00 dark:bg-dark-background-01">
      <div
        className="shrink-0 w-32 sm:w-44 md:w-56 bg-light-background-02 dark:bg-dark-background-02 rounded-md animate-pulse"
        style={{ aspectRatio: "16 / 9" }}
      />
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
        <div className="h-5 w-2/3 rounded bg-light-background-02 dark:bg-dark-background-02 animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-light-background-02 dark:bg-dark-background-02 animate-pulse" />
        <div className="h-3 w-1/4 rounded bg-light-background-02 dark:bg-dark-background-02 animate-pulse" />
      </div>
    </div>
  );
}

interface VibeRowProps {
  item: ResRecentVibesItem;
  head?: GridHeadInfo;
  isSelected: boolean;
  onOpen: () => void;
}

function VibeRow({ item, head, isSelected, onOpen }: VibeRowProps) {
  const label = item.title ?? item.appSlug;
  const headLoaded = head !== undefined;
  const previewUrl = head?.screenshot
    ? `/assets/cid/?url=${encodeURIComponent(head.screenshot.assetUrl)}&mime=${encodeURIComponent(head.screenshot.mime)}`
    : null;
  const updatedLabel = formatUpdated(item.updated);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${label}`}
      className={`group flex flex-row items-stretch text-left gap-4 p-3 rounded-lg border-2 bg-light-background-00 dark:bg-dark-background-01 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--vibes-near-black)] dark:hover:shadow-[4px_4px_0_0_var(--color-dark-decorative-01)] ${
        isSelected
          ? "border-blue-400 dark:border-blue-500 shadow-[4px_4px_0_0_var(--vibes-near-black)] dark:shadow-[4px_4px_0_0_var(--color-dark-decorative-01)]"
          : "border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)]"
      }`}
    >
      {headLoaded ? (
        <div
          className="shrink-0 w-32 sm:w-44 md:w-56 bg-light-background-02 dark:bg-dark-background-02 border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] rounded-md overflow-hidden flex items-center justify-center"
          style={{ aspectRatio: "16 / 9" }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover block" />
          ) : (
            <span className="text-light-primary/40 dark:text-dark-primary/40 text-[10px] uppercase tracking-widest px-2 text-center">
              No preview
            </span>
          )}
        </div>
      ) : (
        <div
          className="shrink-0 w-32 sm:w-44 md:w-56 bg-light-background-02 dark:bg-dark-background-02 rounded-md animate-pulse"
          style={{ aspectRatio: "16 / 9" }}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 min-w-0 text-base sm:text-lg font-bold text-light-primary dark:text-dark-primary truncate">
            {label}
          </h3>
          {headLoaded ? (
            head?.mode && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  head.mode === "production"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                }`}
              >
                {head.mode}
              </span>
            )
          ) : (
            <span
              className="shrink-0 h-4 w-12 rounded bg-light-background-02 dark:bg-dark-background-02 animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>
        <span className="text-xs text-light-primary/60 dark:text-dark-primary/60 truncate">@{item.userSlug}</span>
        {updatedLabel && (
          <span className="text-[11px] uppercase tracking-widest text-light-primary/40 dark:text-dark-primary/40">
            Updated {updatedLabel}
          </span>
        )}
      </div>
    </button>
  );
}

function formatUpdated(updated: string | undefined): string | null {
  if (!updated) return null;
  const d = new Date(updated);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
