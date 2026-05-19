import type { ReactElement } from "react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { VibesButton } from "@vibes.diy/base";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { VibesGrid, type GridHeadInfo } from "../../components/mine/VibesGrid.js";

export function meta() {
  return [
    { title: "Memberships - Vibes DIY" },
    { name: "description", content: "Apps you've joined as a member in Vibes DIY" },
  ];
}

// Mock memberships — placeholder until real subscription data is wired up.
const MOCK_MEMBERSHIPS: ResRecentVibesItem[] = [
  { userSlug: "jchris", appSlug: "fireproof-todo", title: "Fireproof Todo", updated: "2026-05-12T10:00:00Z" },
  { userSlug: "jchris", appSlug: "vibe-radio", title: "Vibe Radio", updated: "2026-05-10T14:30:00Z" },
  { userSlug: "anya", appSlug: "color-lab", title: "Color Lab", updated: "2026-05-08T09:15:00Z" },
  { userSlug: "mabels", appSlug: "habit-streaks", title: "Habit Streaks", updated: "2026-05-05T18:42:00Z" },
  { userSlug: "selem", appSlug: "moodboard", title: "Moodboard", updated: "2026-04-30T12:00:00Z" },
  { userSlug: "team", appSlug: "shared-recipes", title: "Shared Recipes", updated: "2026-04-22T08:00:00Z" },
];

export default function VibesMemberships(): ReactElement {
  const navigate = useNavigate();
  const { userSlug: paramUserSlug, appSlug: paramAppSlug } = useParams<{ userSlug?: string; appSlug?: string }>();
  const [headInfoMap] = useState<Map<string, GridHeadInfo>>(new Map());

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
      <VibesGrid
        items={MOCK_MEMBERSHIPS}
        headInfoMap={headInfoMap}
        selectedKey={selectedKey}
        onOpen={openTile}
        isLoading={false}
        emptyState={{ message: "You haven't joined any apps yet." }}
      />

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
  const mockDescription =
    "Shared with you via Vibes DIY. A collaborative app you've joined as a member. (placeholder copy)";

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
