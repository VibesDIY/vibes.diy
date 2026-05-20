import type { ReactElement } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { VibesGrid, type GridHeadInfo } from "../../components/mine/VibesGrid.js";
import { VibesSearchBar } from "../../components/mine/VibesSearchBar.js";

export function meta() {
  return [{ title: "Memberships - Vibes DIY" }, { name: "description", content: "Apps you've joined as a member in Vibes DIY" }];
}

// TEMP: mock memberships — replace with real subscription data when wired up.
// Padded out so the lazy-load + search experience is visible during preview.
const MOCK_MEMBERSHIPS: ResRecentVibesItem[] = [
  { userSlug: "jchris", appSlug: "fireproof-todo", title: "Fireproof Todo", updated: "2026-05-12T10:00:00Z" },
  { userSlug: "jchris", appSlug: "vibe-radio", title: "Vibe Radio", updated: "2026-05-10T14:30:00Z" },
  { userSlug: "anya", appSlug: "color-lab", title: "Color Lab", updated: "2026-05-08T09:15:00Z" },
  { userSlug: "mabels", appSlug: "habit-streaks", title: "Habit Streaks", updated: "2026-05-05T18:42:00Z" },
  { userSlug: "selem", appSlug: "moodboard", title: "Moodboard", updated: "2026-04-30T12:00:00Z" },
  { userSlug: "team", appSlug: "shared-recipes", title: "Shared Recipes", updated: "2026-04-22T08:00:00Z" },
  { userSlug: "lila", appSlug: "story-maker", title: "Story Maker", updated: "2026-04-18T11:20:00Z" },
  { userSlug: "noor", appSlug: "trip-log", title: "Trip Log", updated: "2026-04-15T16:45:00Z" },
  { userSlug: "kai", appSlug: "plant-care", title: "Plant Care", updated: "2026-04-12T08:10:00Z" },
  { userSlug: "remy", appSlug: "voice-memo", title: "Voice Memo", updated: "2026-04-09T14:00:00Z" },
  { userSlug: "sun", appSlug: "card-deck", title: "Card Deck", updated: "2026-04-05T19:30:00Z" },
  { userSlug: "amir", appSlug: "dice-roller", title: "Dice Roller", updated: "2026-04-01T07:45:00Z" },
  { userSlug: "vee", appSlug: "polls-now", title: "Polls Now", updated: "2026-03-28T13:15:00Z" },
  { userSlug: "oki", appSlug: "idea-box", title: "Idea Box", updated: "2026-03-22T10:20:00Z" },
  { userSlug: "zeke", appSlug: "bookmark-tower", title: "Bookmark Tower", updated: "2026-03-18T18:00:00Z" },
  { userSlug: "noa", appSlug: "time-capsule", title: "Time Capsule", updated: "2026-03-15T09:35:00Z" },
  { userSlug: "ben", appSlug: "sound-bath", title: "Sound Bath", updated: "2026-03-11T22:00:00Z" },
  { userSlug: "izzy", appSlug: "snap-quiz", title: "Snap Quiz", updated: "2026-03-07T12:50:00Z" },
  { userSlug: "rena", appSlug: "money-map", title: "Money Map", updated: "2026-03-03T15:25:00Z" },
  { userSlug: "vik", appSlug: "stage-planner", title: "Stage Planner", updated: "2026-02-28T08:10:00Z" },
  { userSlug: "tess", appSlug: "quote-wall", title: "Quote Wall", updated: "2026-02-22T17:40:00Z" },
  { userSlug: "owen", appSlug: "workout-tracker", title: "Workout Tracker", updated: "2026-02-18T06:30:00Z" },
  { userSlug: "ana", appSlug: "recipe-vault", title: "Recipe Vault", updated: "2026-02-14T20:00:00Z" },
  { userSlug: "kim", appSlug: "mood-ring", title: "Mood Ring", updated: "2026-02-10T11:05:00Z" },
];

const PAGE_SIZE = 8;

export default function VibesMemberships(): ReactElement {
  const navigate = useNavigate();
  const { userSlug: paramUserSlug, appSlug: paramAppSlug } = useParams<{ userSlug?: string; appSlug?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [headInfoMap, setHeadInfoMap] = useState<Map<string, GridHeadInfo>>(new Map());

  // Simulated first-load delay so the skeleton rows are visible briefly.
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  // Simulated paginated load: start with PAGE_SIZE visible and append more
  // as the IntersectionObserver sentinel reaches the bottom.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // Per-item head info simulation: each membership "loads" with a small
  // random delay so we see the per-row thumbnail skeleton swap to placeholder.
  // Use a ref to track scheduled keys so re-renders don't restart timers.
  const scheduledKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const visible = MOCK_MEMBERSHIPS.slice(0, visibleCount);
    for (const item of visible) {
      const key = `${item.userSlug}/${item.appSlug}`;
      if (scheduledKeysRef.current.has(key)) continue;
      scheduledKeysRef.current.add(key);
      const delay = 250 + Math.random() * 700;
      setTimeout(() => {
        setHeadInfoMap((prev) => (prev.has(key) ? prev : new Map(prev).set(key, {})));
      }, delay);
    }
  }, [visibleCount]);

  const filteredItems = useMemo(() => {
    const visible = MOCK_MEMBERSHIPS.slice(0, visibleCount);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((item) => {
      const title = (item.title ?? "").toLowerCase();
      const slug = item.appSlug.toLowerCase();
      const user = item.userSlug.toLowerCase();
      return title.includes(q) || slug.includes(q) || user.includes(q);
    });
  }, [visibleCount, searchQuery]);

  const nextCursor: string | undefined = visibleCount < MOCK_MEMBERSHIPS.length ? "more" : undefined;
  const loadMore = useCallback(async () => {
    if (loadingMore || visibleCount >= MOCK_MEMBERSHIPS.length) return;
    setLoadingMore(true);
    await new Promise((r) => setTimeout(r, 400));
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, MOCK_MEMBERSHIPS.length));
    setLoadingMore(false);
  }, [loadingMore, visibleCount]);

  const isPanelOpen = !!(paramUserSlug && paramAppSlug);
  const selectedKey = isPanelOpen ? `${paramUserSlug}/${paramAppSlug}` : "";
  const selectedItem = isPanelOpen
    ? MOCK_MEMBERSHIPS.find((v) => v.userSlug === paramUserSlug && v.appSlug === paramAppSlug)
    : undefined;

  const openTile = (item: ResRecentVibesItem) =>
    navigate(`/memberships/${item.userSlug}/${item.appSlug}`, { replace: false, preventScrollReset: true });
  const closePanel = () => navigate("/memberships", { replace: false, preventScrollReset: true });

  return (
    <BrutalistLayout title="Memberships" subtitle="Apps you've joined">
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <VibesSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search your memberships…"
            ariaLabel="Search your memberships"
          />
        </div>
        <VibesGrid
          items={filteredItems}
          headInfoMap={headInfoMap}
          selectedKey={selectedKey}
          onOpen={openTile}
          isLoading={initialLoading || loadingMore}
          nextCursor={searchQuery ? undefined : nextCursor}
          onLoadMore={() => void loadMore()}
          emptyState={{
            message: searchQuery
              ? `No memberships match "${searchQuery}"`
              : "You haven't joined any apps yet.",
          }}
        />
      </div>

      <MembershipDetailPanel item={selectedItem ?? null} onClose={closePanel} />
    </BrutalistLayout>
  );
}

const PANEL_WIDTH = 420;

interface MembershipDetailPanelProps {
  item: ResRecentVibesItem | null;
  onClose: () => void;
}

function MembershipDetailPanel({ item, onClose }: MembershipDetailPanelProps) {
  const open = item !== null;
  const label = item?.title ?? item?.appSlug ?? "";
  // Mock data for now — wire up real fields later.
  const mockCreator = item ? `@${item.userSlug}` : "";
  const mockDescription = "Shared with you via Vibes DIY. A collaborative app you've joined as a member. (placeholder copy)";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
          width: PANEL_WIDTH,
          maxWidth: "100vw",
          transform: open ? "translateX(0)" : `translateX(${PANEL_WIDTH}px)`,
          transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3 right-3 z-[1] w-8 h-8 flex items-center justify-center rounded-full bg-light-background-00/80 dark:bg-dark-background-00/80 hover:bg-light-background-00 dark:hover:bg-dark-background-00 transition-colors"
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
          <div className="flex flex-col h-full">
            {/* Hero preview placeholder — memberships don't have real screenshots
                yet; using a colored block keyed off the slug for visual variety. */}
            <div
              className="w-full bg-light-background-01 dark:bg-dark-background-01 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] flex items-center justify-center"
              style={{
                height: 200,
                background: `linear-gradient(135deg, hsl(${hashHue(item.appSlug)} 60% 70%), hsl(${(hashHue(item.appSlug) + 60) % 360} 60% 60%))`,
              }}
            >
              <span className="text-white/90 text-2xl font-bold uppercase tracking-widest">{label.slice(0, 2)}</span>
            </div>

            <div className="flex flex-col gap-4 p-6 flex-1 overflow-y-auto">
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

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
