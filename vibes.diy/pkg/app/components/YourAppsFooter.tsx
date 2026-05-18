import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TexturedPattern } from "@vibes.diy/base";
import { useRecentVibes } from "../hooks/useRecentVibes.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";

interface YourAppsFooterProps {
  /** True while the SessionSidebar is open — the footer slides right so it
   *  doesn't sit under the sidebar's `w-64` rail. */
  sidebarOpen: boolean;
}

type AppItem = { userSlug: string; appSlug: string; title?: string; icon?: { cid: string; mime: string } };

const SIDEBAR_WIDTH = 256; // matches SessionSidebar w-64
const COLLAPSED_HEIGHT = 52;
const EXPANDED_HEIGHT_VH = 75;
const DETAIL_PANEL_WIDTH = 360;
// Card layout — used to compute how many cards fit per page so each page is
// filled before paginating instead of capping at a fixed PAGE_SIZE.
const GRID_GAP = 16; // gap-4
const COL_STEP = 140 + GRID_GAP; // minmax(140px, 1fr) + gap
const ROW_STEP = 96 + 8 + 20 + GRID_GAP; // card + items-gap-2 + label height + grid gap

export function YourAppsFooter({ sidebarOpen }: YourAppsFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailItem, setDetailItem] = useState<AppItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const { items } = useRecentVibes(80);

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        (item.title ?? "").toLowerCase().includes(q) ||
        item.appSlug.toLowerCase().includes(q) ||
        item.userSlug.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pagedItems = filteredItems.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Reset to first page whenever the search query changes.
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  // Horizontal swipe → page navigation. Threshold is ~60px and the gesture
  // must be horizontal-dominant so vertical scrolling within a long page isn't
  // hijacked. If a swipe is detected, suppress the click event that follows
  // so the card under the finger doesn't navigate to its chat route.
  const SWIPE_THRESHOLD = 60;
  const onSwipeStart = useCallback((e: React.PointerEvent) => {
    if (totalPages <= 1) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  }, [totalPages]);
  const onSwipeEnd = useCallback(
    (e: React.PointerEvent) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || totalPages <= 1) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressNextClickRef.current = true;
        setCurrentPage((p) =>
          dx < 0 ? Math.min(totalPages - 1, p + 1) : Math.max(0, p - 1)
        );
      }
    },
    [totalPages]
  );
  const onSwipeClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Compute pageSize dynamically from the grid container's measured inner
  // dimensions so every page fills the visible rows before paginating.
  useEffect(() => {
    if (!isExpanded) return;
    const el = gridScrollRef.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const cols = Math.max(1, Math.floor((w + GRID_GAP) / COL_STEP));
      const rows = Math.max(1, Math.floor((h + GRID_GAP) / ROW_STEP));
      setPageSize(cols * rows);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isExpanded]);

  // Close on Escape — collapses the detail panel first, then the footer.
  useEffect(() => {
    if (!isExpanded && !detailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailItem) setDetailItem(null);
      else setIsExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isExpanded, detailItem]);

  const toggle = useCallback(() => setIsExpanded((v) => !v), []);
  const close = useCallback(() => {
    setIsExpanded(false);
    setDetailItem(null);
  }, []);

  const appHostBaseUrl = getAppHostBaseUrl();

  return (
    <>
      {/* Backdrop — only when expanded, captures outside clicks. */}
      {isExpanded && (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/50 transition-opacity duration-300"
          style={{ opacity: isExpanded ? 1 : 0 }}
        />
      )}

      <div
        className={`fixed bottom-0 right-0 z-40 flex flex-col border-t border-black/10 dark:border-white/15 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] ${
          isExpanded ? "backdrop-blur-md" : ""
        }`}
        style={{
          left: sidebarOpen ? SIDEBAR_WIDTH : 0,
          height: isExpanded ? `${EXPANDED_HEIGHT_VH}vh` : `${COLLAPSED_HEIGHT}px`,
          transition: "height 0.35s cubic-bezier(0.34, 1.2, 0.64, 1), left 0.3s ease",
        }}
      >
        {/* Header bar (the "navbar"). */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Close your apps" : "Open your apps"}
          className={`flex shrink-0 items-center justify-between gap-3 px-6 transition-colors hover:bg-[#ebebd9] dark:hover:bg-[#2a2a2a] ${
            isExpanded ? "" : "bg-[var(--vibes-cream)] dark:bg-dark-background-00"
          }`}
          style={{ height: COLLAPSED_HEIGHT }}
        >
          <span className="text-light-primary dark:text-dark-primary text-sm font-bold tracking-[0.15em] uppercase">
            Your apps
          </span>
          <svg
            className="text-light-primary dark:text-dark-primary"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s ease",
            }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Search — top-center, only when there are items. */}
        {items.length > 0 && (
          <div className="shrink-0 flex items-center justify-center px-6 pt-4 pb-2">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        )}

        {/* Grid — transparent; outer wrapper provides the single blur layer.
            Extra px/py so the cards' overflowing info-buttons (-top-3 -right-3)
            don't get clipped by overflow-y-auto. */}
        <div
          ref={gridScrollRef}
          className="flex-1 overflow-y-auto px-8 pt-5 pb-3 touch-pan-y"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => {
            swipeStartRef.current = null;
          }}
          onClickCapture={onSwipeClickCapture}
        >
          {items.length === 0 ? (
            <div className="text-light-primary/60 dark:text-dark-primary/60 text-sm text-center py-8">
              No vibes yet — create your first one above.
            </div>
          ) : pagedItems.length === 0 ? (
            <div className="text-light-primary/60 dark:text-dark-primary/60 text-sm text-center py-8">
              No matches for "{searchQuery.trim()}".
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
            >
              {pagedItems.map((item) => (
                <AppCard
                  key={`${item.userSlug}/${item.appSlug}`}
                  item={item}
                  appHostBaseUrl={appHostBaseUrl}
                  onNavigate={close}
                  onOpenInfo={() => setDetailItem(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination — bottom, only when filtered results overflow one page. */}
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-center gap-1 px-6 py-3">
            <Pagination current={safePage} total={totalPages} onChange={setCurrentPage} />
          </div>
        )}
      </div>

      <AppDetailPanel
        item={detailItem}
        appHostBaseUrl={appHostBaseUrl}
        onClose={() => setDetailItem(null)}
      />
    </>
  );
}

interface AppCardProps {
  item: AppItem;
  appHostBaseUrl: string;
  onNavigate: () => void;
  onOpenInfo: () => void;
}

function AppCard({ item, appHostBaseUrl, onNavigate, onOpenInfo }: AppCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const label = item.title ?? item.appSlug;
  const iconUrl = item.icon ? cidAssetUrl(item.icon.cid, item.icon.mime, appHostBaseUrl) : undefined;
  const CARD_SIZE = 96;
  const CARD_RADIUS = 18;
  return (
    <div className="flex flex-col items-center gap-2 group">
      <div style={{ position: "relative", width: CARD_SIZE, height: CARD_SIZE }}>
        {/* Textured pattern shadow — peeks out behind the card on hover. */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: isHovered ? 6 : 4,
            width: CARD_SIZE,
            height: CARD_SIZE,
            borderRadius: CARD_RADIUS,
            overflow: "hidden",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.15s ease, left 0.2s ease",
            zIndex: 0,
          }}
          aria-hidden="true"
        >
          <TexturedPattern width={CARD_SIZE} height={CARD_SIZE} borderRadius={CARD_RADIUS} />
        </div>

        {/* Main card — the Link wraps just this surface so clicking elsewhere
            (e.g. the info button) doesn't navigate. */}
        <Link
          to={`/chat/${item.userSlug}/${item.appSlug}`}
          onClick={onNavigate}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="bg-[var(--vibes-cream)] dark:bg-dark-background-01 border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] overflow-hidden transition-transform duration-150 group-hover:-translate-y-0.5"
          style={{
            position: "relative",
            width: CARD_SIZE,
            height: CARD_SIZE,
            borderRadius: CARD_RADIUS,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
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
            <span className="text-light-primary/60 dark:text-dark-primary/60 text-xs font-bold uppercase tracking-wider px-2 text-center">
              {label.slice(0, 8)}
            </span>
          )}
        </Link>

        {/* Info button — top-right, fades in on hover (desktop). On touch
            devices `group-hover` won't fire, so the @media (hover: none)
            block below keeps it always visible at low opacity. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenInfo();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={`Info about ${label}`}
          className="absolute -top-2 -right-2 z-[2] flex items-center justify-center w-7 h-7 rounded-full bg-[var(--vibes-near-black)] text-[var(--vibes-cream)] dark:bg-[var(--vibes-cream)] dark:text-[var(--vibes-near-black)] border-2 border-[var(--vibes-cream)] dark:border-[var(--color-dark-decorative-01)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 [@media(hover:none)]:opacity-60"
        >
          <span className="text-xs font-bold italic leading-none" style={{ fontFamily: "Georgia, serif" }}>
            i
          </span>
        </button>
      </div>

      <span className="text-light-primary dark:text-dark-primary text-xs font-medium text-center w-full truncate px-1">
        {label}
      </span>
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
  // Mock data for now — wire up real fields later.
  const mockCreator = "@amber-macias";
  const mockDescription =
    "Generated with vibes.diy. A shareable mini-app you can remix, fork, and make your own. (placeholder copy)";

  return (
    <>
      {/* Backdrop — only when open. Click outside closes. */}
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
          transform: open ? "translateX(0)" : `translateX(${DETAIL_PANEL_WIDTH}px)`,
          transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        {/* Close button */}
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
            {/* Screenshot — uses the icon image stretched as a placeholder, or a neutral block. */}
            <div
              className="w-full bg-light-background-01 dark:bg-dark-background-01 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] flex items-center justify-center overflow-hidden"
              style={{ height: 200 }}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="" className="w-full h-full object-cover dark:invert" />
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
        aria-label="Search apps"
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

interface PaginationProps {
  current: number;
  total: number;
  onChange: (page: number) => void;
}

function Pagination({ current, total, onChange }: PaginationProps) {
  // Build page list with ellipsis when there are many pages. Always show first
  // and last, plus a window around the current page.
  const pages: (number | "…")[] = [];
  const windowSize = 1;
  for (let i = 0; i < total; i += 1) {
    if (i === 0 || i === total - 1 || (i >= current - windowSize && i <= current + windowSize)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const baseBtn =
    "min-w-8 h-8 px-2 flex items-center justify-center text-sm font-medium rounded-md border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] transition-colors";
  const inactive = "bg-[var(--vibes-cream)] dark:bg-dark-background-01 text-light-primary dark:text-dark-primary hover:bg-[#ebebd9] dark:hover:bg-[#2a2a2a]";
  const active = "bg-[var(--vibes-near-black)] dark:bg-[var(--vibes-cream)] text-[var(--vibes-cream)] dark:text-[var(--vibes-near-black)]";
  const disabled = "opacity-40 cursor-not-allowed";

  return (
    <>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={current === 0}
        aria-label="Previous page"
        className={`${baseBtn} ${inactive} ${current === 0 ? disabled : ""}`}
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`e-${idx}`} className="px-1 text-light-primary/60 dark:text-dark-primary/60 text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === current ? "page" : undefined}
            className={`${baseBtn} ${p === current ? active : inactive}`}
          >
            {p + 1}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        aria-label="Next page"
        className={`${baseBtn} ${inactive} ${current === total - 1 ? disabled : ""}`}
      >
        ›
      </button>
    </>
  );
}
