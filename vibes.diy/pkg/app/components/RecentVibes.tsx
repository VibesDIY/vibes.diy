import { useAuth } from "@clerk/react";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useRecentVibes, notifyRecentVibesChanged } from "../hooks/useRecentVibes.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";
import { RecentVibeRowMenu } from "./RecentVibeRowMenu.js";

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

function rowKey(item: { userSlug: string; appSlug: string }): string {
  return `${item.userSlug}/${item.appSlug}`;
}

interface RecentVibesProps {
  onNavigate?: () => void;
}

export function RecentVibes({ onNavigate }: RecentVibesProps) {
  const { isSignedIn } = useAuth();
  const { items, loading, error, refresh, mutate } = useRecentVibes(20);
  const { vibeDiyApi } = useVibesDiy();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");

  if (!isSignedIn) return null;

  async function handlePinToggle(item: ResRecentVibesItem) {
    const key = rowKey(item);
    const wasPinned = !!item.pinnedAt;
    const nextPinnedAt = wasPinned ? "" : new Date().toISOString();
    mutate((prev) => {
      const updated = prev.map((row) => (rowKey(row) === key ? { ...row, pinnedAt: nextPinnedAt || undefined } : row));
      // Re-sort to mirror server order: pinnedAt desc, then updated desc.
      return [...updated].sort((a, b) => {
        const ap = a.pinnedAt ?? "";
        const bp = b.pinnedAt ?? "";
        if (ap !== bp) return ap < bp ? 1 : -1;
        if (a.updated !== b.updated) return a.updated < b.updated ? 1 : -1;
        return 0;
      });
    });
    const res = await vibeDiyApi.pinRecentVibe({
      userSlug: item.userSlug,
      appSlug: item.appSlug,
      pin: !wasPinned,
    });
    if (res.isErr()) {
      void refresh();
      return;
    }
    notifyRecentVibesChanged();
  }

  async function commitRename(item: ResRecentVibesItem) {
    const key = rowKey(item);
    const trimmed = pendingTitle.trim();
    setEditingId(null);
    if (!trimmed || trimmed === (item.title ?? "")) return;
    mutate((prev) => prev.map((row) => (rowKey(row) === key ? { ...row, title: trimmed } : row)));
    const res = await vibeDiyApi.ensureAppSettings({
      userSlug: item.userSlug,
      appSlug: item.appSlug,
      title: trimmed,
    });
    if (res.isErr()) {
      void refresh();
      return;
    }
    notifyRecentVibesChanged();
  }

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
            {items.map((item) => {
              const key = rowKey(item);
              const isEditing = editingId === key;
              const menuOpen = openMenuId === key;
              return (
                <li key={key} className="group relative border-b border-black/5 dark:border-white/5">
                  <Link
                    to={`/chat/${item.userSlug}/${item.appSlug}`}
                    onClick={(e) => {
                      if (isEditing) {
                        e.preventDefault();
                        return;
                      }
                      onNavigate?.();
                    }}
                    className="flex items-center gap-2 pl-2 pr-10 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <VibeIconThumb icon={item.icon} />
                    <span className="flex flex-col min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={pendingTitle}
                          autoFocus
                          onClick={(e) => e.preventDefault()}
                          onChange={(e) => setPendingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitRename(item);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => void commitRename(item)}
                          className="w-full rounded border border-black/20 bg-white px-1 text-sm dark:border-white/20 dark:bg-black"
                        />
                      ) : (
                        <span className="truncate">
                          {item.pinnedAt ? (
                            <svg
                              aria-hidden="true"
                              className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px opacity-70"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M14 2.5a1 1 0 0 1 .7 1.7L13.4 5.5l4.6 4.6 1.3-1.3a1 1 0 0 1 1.4 1.4l-6.4 6.4a1 1 0 0 1-1.4-1.4l1.3-1.3-3.5-3.5-4.5 4.5L4 17l1.6-2.6 4.5-4.5L6.5 6.4 5.2 7.7a1 1 0 0 1-1.4-1.4l6.4-6.4a1 1 0 0 1 1.4 0z" />
                            </svg>
                          ) : null}
                          {item.title || item.appSlug}
                        </span>
                      )}
                      <span className="text-xs truncate opacity-50">{item.userSlug}</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Vibe actions"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuId(menuOpen ? null : key);
                    }}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded text-black/60 hover:bg-black/10 dark:text-white/60 dark:hover:bg-white/10 transition-opacity sm:h-7 sm:w-7 ${
                      menuOpen
                        ? "opacity-100"
                        : "opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:focus-within:opacity-100"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </button>
                  <RecentVibeRowMenu
                    isPinned={!!item.pinnedAt}
                    open={menuOpen}
                    onClose={() => setOpenMenuId(null)}
                    onPinToggle={() => void handlePinToggle(item)}
                    onRenameStart={() => {
                      setPendingTitle(item.title ?? "");
                      setEditingId(key);
                    }}
                  />
                </li>
              );
            })}
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
