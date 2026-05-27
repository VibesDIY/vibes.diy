import type { ReactElement } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { VibesGrid, type GridHeadInfo } from "../../components/mine/VibesGrid.js";
import { VibesSearchBar } from "../../components/mine/VibesSearchBar.js";
import { useMemberships } from "../../hooks/useMemberships.js";
import { useVibesDiy } from "../../vibes-diy-provider.js";

export function meta() {
  return [{ title: "Memberships - Vibes DIY" }, { name: "description", content: "Apps you've joined as a member in Vibes DIY" }];
}

const PAGE_SIZE = 30;

export default function VibesMemberships(): ReactElement {
  const navigate = useNavigate();
  const { userSlug: paramUserSlug, appSlug: paramAppSlug } = useParams<{ userSlug?: string; appSlug?: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  const { vibeDiyApi } = useVibesDiy();
  const { items: rawItems, loading, nextCursor, loadMore } = useMemberships(PAGE_SIZE);

  // Map ResMembershipItem → ResRecentVibesItem for VibesGrid (activityAt drives updated display).
  const items: ResRecentVibesItem[] = useMemo(
    () => rawItems.map((m) => ({ userSlug: m.userSlug, appSlug: m.appSlug, updated: m.activityAt, title: m.title, icon: m.icon })),
    [rawItems]
  );

  const [appHeadInfo, setAppHeadInfo] = useState<Map<string, GridHeadInfo>>(new Map());
  const requestedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    for (const item of items) {
      const key = `${item.userSlug}/${item.appSlug}`;
      if (requestedKeysRef.current.has(key)) continue;
      requestedKeysRef.current.add(key);
      vibeDiyApi.getAppByFsId({ userSlug: item.userSlug, appSlug: item.appSlug }).then((res) => {
        setAppHeadInfo((prev) => {
          if (res.isErr()) return new Map(prev).set(key, {});
          const app = res.Ok();
          return new Map(prev).set(key, { screenshot: app.meta.find(isMetaScreenShot) });
        });
      });
    }
  }, [items, vibeDiyApi]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const title = (item.title ?? "").toLowerCase();
      const slug = item.appSlug.toLowerCase();
      const user = item.userSlug.toLowerCase();
      return title.includes(q) || slug.includes(q) || user.includes(q);
    });
  }, [items, searchQuery]);

  const isPanelOpen = !!(paramUserSlug && paramAppSlug);
  const selectedKey = isPanelOpen ? `${paramUserSlug}/${paramAppSlug}` : "";
  const selectedItem = isPanelOpen ? items.find((v) => v.userSlug === paramUserSlug && v.appSlug === paramAppSlug) : undefined;

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
          headInfoMap={appHeadInfo}
          selectedKey={selectedKey}
          onOpen={openTile}
          isLoading={loading}
          nextCursor={searchQuery ? undefined : nextCursor}
          onLoadMore={searchQuery ? undefined : loadMore}
          emptyState={{
            message: searchQuery ? `No memberships match "${searchQuery}"` : "You haven't joined any apps yet.",
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
            <div
              className="w-full flex items-center justify-center border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)]"
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
                  @{item.userSlug}
                </p>
              </div>

              <div className="flex flex-col gap-3 mt-auto pt-4">
                <Link
                  to={`/vibe/${item.userSlug}/${item.appSlug}`}
                  onClick={onClose}
                  className="flex items-center justify-center px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold uppercase tracking-widest border-2 border-[var(--vibes-near-black)] rounded-md shadow-[4px_4px_0_0_var(--vibes-near-black)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--vibes-near-black)] transition-all duration-150"
                >
                  Enter
                </Link>
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
