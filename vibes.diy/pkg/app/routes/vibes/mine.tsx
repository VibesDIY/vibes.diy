import type { ReactElement } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { ResGetChatDetails, ResRecentVibesItem } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { toast } from "react-hot-toast";
import { useRecentVibes } from "../../hooks/useRecentVibes.js";
import { MineDetailPanel, toMineDetailTab } from "../../components/mine/MineDetailPanel.js";
import { VibesGrid, type GridHeadInfo } from "../../components/mine/VibesGrid.js";
import { VibesSearchBar } from "../../components/mine/VibesSearchBar.js";

export function meta() {
  return [{ title: "My Vibes - Vibes DIY" }, { name: "description", content: "Your created vibes in Vibes DIY" }];
}

export default function VibesMine(): ReactElement {
  const navigate = useNavigate();
  const {
    ownerHandle: paramUserSlug,
    appSlug: paramAppSlug,
    tab: paramTab,
  } = useParams<{ ownerHandle?: string; appSlug?: string; tab?: string }>();
  const { chatApi } = useVibesDiy();
  const { items: vibeItems, loading: isLoading, nextCursor, loadMore } = useRecentVibes(30);
  const [searchQuery, setSearchQuery] = useState("");

  const [chatDetails, setChatDetails] = useState<ResGetChatDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Map<string, GridHeadInfo>>(new Map());
  const [appHeadInfo, setAppHeadInfo] = useState<Map<string, GridHeadInfo>>(new Map());
  const requestedHeadKeysRef = useRef<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  const isPanelOpen = !!(paramUserSlug && paramAppSlug);
  const activeTab = toMineDetailTab(paramTab);
  const selectedKey = isPanelOpen ? `${paramUserSlug}/${paramAppSlug}` : "";
  const selectedItem = isPanelOpen
    ? vibeItems.find((v) => v.ownerHandle === paramUserSlug && v.appSlug === paramAppSlug)
    : undefined;
  const selectedHead = selectedKey ? appHeadInfo.get(selectedKey) : undefined;

  async function onToggleMode(fsId: string, appSlug: string, ownerHandle: string, currentMode: string | undefined) {
    const nextMode = currentMode === "production" ? "dev" : "production";
    const res = await chatApi.setSetModeFs({ fsId, appSlug, ownerHandle, mode: nextMode });
    if (res.isErr()) {
      toast.error(`Failed to set mode: ${res.Err().message}`);
      return;
    }
    const newMode = res.Ok().mode;
    setScreenshots((prev) => {
      const next = new Map(prev);
      if (newMode === "production") {
        for (const [id, info] of next) {
          if (info.mode === "production") next.set(id, { ...info, mode: "dev" });
        }
      }
      next.set(fsId, { ...next.get(fsId), mode: newMode });
      return next;
    });
  }

  // Fetch chat details whenever the selected vibe changes.
  useEffect(() => {
    if (!paramUserSlug || !paramAppSlug) {
      setChatDetails(null);
      setLoadingDetails(null);
      return;
    }
    const key = `${paramUserSlug}/${paramAppSlug}`;
    cancelledRef.current = false;
    setLoadingDetails(key);
    setChatDetails(null);
    chatApi
      .getChatDetails({ ownerHandle: paramUserSlug, appSlug: paramAppSlug })
      .then((res) => {
        if (!cancelledRef.current && res.isOk()) setChatDetails(res.Ok());
      })
      .finally(() => {
        if (!cancelledRef.current) setLoadingDetails(null);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [paramUserSlug, paramAppSlug, chatApi]);

  // Per-prompt screenshots for the Prompts tab.
  useEffect(() => {
    if (!chatDetails) {
      setScreenshots(new Map());
      return;
    }
    setScreenshots(new Map());
    for (const p of chatDetails.prompts) {
      chatApi.getAppByFsId({ fsId: p.fsId, appSlug: chatDetails.appSlug, ownerHandle: chatDetails.ownerHandle }).then((res) => {
        if (res.isErr()) return;
        const app = res.Ok();
        setScreenshots((prev) =>
          new Map(prev).set(p.fsId, {
            screenshot: app.meta.find(isMetaScreenShot),
            mode: app.mode,
          })
        );
      });
    }
  }, [chatDetails, chatApi]);

  // Head screenshot for each tile in the grid. We track requested keys in a
  // ref so subsequent `loadMore` pages only fetch the new items and the
  // already-resolved rows don't flash back to skeleton.
  useEffect(() => {
    for (const item of vibeItems) {
      const key = `${item.ownerHandle}/${item.appSlug}`;
      if (requestedHeadKeysRef.current.has(key)) continue;
      requestedHeadKeysRef.current.add(key);
      chatApi.getAppByFsId({ ownerHandle: item.ownerHandle, appSlug: item.appSlug }).then((res) => {
        setAppHeadInfo((prev) => {
          // Resolve the per-row skeleton even on failure by always seeding
          // an entry (empty object) — otherwise the row would stay pulsing.
          if (res.isErr()) return new Map(prev).set(key, {});
          const app = res.Ok();
          return new Map(prev).set(key, {
            screenshot: app.meta.find(isMetaScreenShot),
            mode: app.mode,
          });
        });
      });
    }
  }, [vibeItems, chatApi]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vibeItems;
    return vibeItems.filter((item) => {
      const title = (item.title ?? "").toLowerCase();
      const slug = item.appSlug.toLowerCase();
      const user = item.ownerHandle.toLowerCase();
      return title.includes(q) || slug.includes(q) || user.includes(q);
    });
  }, [vibeItems, searchQuery]);

  const openTile = (item: ResRecentVibesItem) =>
    navigate(`/vibes/mine/${item.ownerHandle}/${item.appSlug}/prompts`, { replace: false, preventScrollReset: true });
  const closePanel = () => navigate("/vibes/mine", { replace: false, preventScrollReset: true });
  const changeTab = (tab: string) => {
    if (!paramUserSlug || !paramAppSlug) return;
    navigate(`/vibes/mine/${paramUserSlug}/${paramAppSlug}/${tab}`, { replace: true, preventScrollReset: true });
  };

  return (
    <BrutalistLayout title="My Vibes" subtitle="Your created vibes">
      {isPanelOpen ? (
        <MineDetailPanel
          ownerHandle={paramUserSlug}
          appSlug={paramAppSlug}
          title={selectedItem?.title}
          headScreenshot={selectedHead?.screenshot}
          headMode={selectedHead?.mode}
          activeTab={activeTab}
          isLoading={loadingDetails === selectedKey}
          chatDetails={chatDetails}
          screenshots={screenshots}
          onToggleMode={onToggleMode}
          onTabChange={changeTab}
          onClose={closePanel}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <VibesSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search your vibes…"
              ariaLabel="Search your vibes"
            />
          </div>
          <VibesGrid
            items={filteredItems}
            headInfoMap={appHeadInfo}
            selectedKey={selectedKey}
            onOpen={openTile}
            isLoading={isLoading}
            nextCursor={searchQuery ? undefined : nextCursor}
            onLoadMore={() => void loadMore()}
            emptyState={{
              message: searchQuery ? `No vibes match "${searchQuery}"` : "You don't have any vibes yet",
              cta: searchQuery ? undefined : (
                <VibesButton variant="blue" onClick={() => navigate("/")}>
                  Create a Vibe
                </VibesButton>
              ),
            }}
          />
        </div>
      )}
    </BrutalistLayout>
  );
}
