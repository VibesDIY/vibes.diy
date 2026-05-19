import React from "react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
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
  const showFirstLoadSpinner = isLoading && items.length === 0;

  if (showFirstLoadSpinner) {
    return (
      <BrutalistCard size="md">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
        </div>
      </BrutalistCard>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const key = `${item.userSlug}/${item.appSlug}`;
          return (
            <VibeCard
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
        <div className="mt-6 flex justify-center">
          <VibesButton variant="blue" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load more"}
          </VibesButton>
        </div>
      )}
    </>
  );
}

interface VibeCardProps {
  item: ResRecentVibesItem;
  head?: GridHeadInfo;
  isSelected: boolean;
  onOpen: () => void;
}

function VibeCard({ item, head, isSelected, onOpen }: VibeCardProps) {
  const label = item.title ?? item.appSlug;
  const previewUrl = head?.screenshot
    ? `/assets/cid/?url=${encodeURIComponent(head.screenshot.assetUrl)}&mime=${encodeURIComponent(head.screenshot.mime)}`
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${label}`}
      className={`group flex flex-col text-left rounded-lg overflow-hidden border-2 bg-light-background-00 dark:bg-dark-background-01 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--vibes-near-black)] dark:hover:shadow-[4px_4px_0_0_var(--color-dark-decorative-01)] ${
        isSelected
          ? "border-blue-400 dark:border-blue-500 shadow-[4px_4px_0_0_var(--vibes-near-black)] dark:shadow-[4px_4px_0_0_var(--color-dark-decorative-01)]"
          : "border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)]"
      }`}
    >
      <div
        className="w-full bg-light-background-02 dark:bg-dark-background-02 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] overflow-hidden flex items-center justify-center"
        style={{ aspectRatio: "16 / 9" }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover block" />
        ) : (
          <span className="text-light-primary/40 dark:text-dark-primary/40 text-xs uppercase tracking-widest px-2 text-center">
            No preview
          </span>
        )}
      </div>

      <div className="px-3 py-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 text-sm font-semibold text-light-primary dark:text-dark-primary truncate">
            {label}
          </span>
          {head?.mode && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                head.mode === "production"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
              }`}
            >
              {head.mode}
            </span>
          )}
        </div>
        <span className="text-xs text-light-primary/60 dark:text-dark-primary/60 truncate">{item.userSlug}</span>
      </div>
    </button>
  );
}
