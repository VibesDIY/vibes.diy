import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { ResGetChatDetails, MetaScreenShot, ResRecentVibesItem } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { toast } from "react-hot-toast";
import { useRecentVibes } from "../../hooks/useRecentVibes.js";
import { MineDetailPanel, toMineDetailTab } from "../../components/mine/MineDetailPanel.js";
import { VibesGrid, type GridHeadInfo } from "../../components/mine/VibesGrid.js";

export function meta() {
  return [{ title: "My Vibes - Vibes DIY" }, { name: "description", content: "Your created vibes in Vibes DIY" }];
}

export default function VibesMine(): ReactElement {
  const navigate = useNavigate();
  const {
    userSlug: paramUserSlug,
    appSlug: paramAppSlug,
    tab: paramTab,
  } = useParams<{ userSlug?: string; appSlug?: string; tab?: string }>();
  const { vibeDiyApi } = useVibesDiy();
  const { items: vibeItems, loading: isLoading, nextCursor, loadMore } = useRecentVibes(100);

  const [chatDetails, setChatDetails] = useState<ResGetChatDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Map<string, GridHeadInfo>>(new Map());
  const [appHeadInfo, setAppHeadInfo] = useState<Map<string, GridHeadInfo>>(new Map());
  const cancelledRef = useRef(false);

  const isPanelOpen = !!(paramUserSlug && paramAppSlug);
  const activeTab = toMineDetailTab(paramTab);
  const selectedKey = isPanelOpen ? `${paramUserSlug}/${paramAppSlug}` : "";
  const selectedItem = isPanelOpen
    ? vibeItems.find((v) => v.userSlug === paramUserSlug && v.appSlug === paramAppSlug)
    : undefined;
  const selectedHead = selectedKey ? appHeadInfo.get(selectedKey) : undefined;

  async function onToggleMode(fsId: string, appSlug: string, userSlug: string, currentMode: string | undefined) {
    const nextMode = currentMode === "production" ? "dev" : "production";
    const res = await vibeDiyApi.setSetModeFs({ fsId, appSlug, userSlug, mode: nextMode });
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
    vibeDiyApi
      .getChatDetails({ userSlug: paramUserSlug, appSlug: paramAppSlug })
      .then((res) => {
        if (!cancelledRef.current && res.isOk()) setChatDetails(res.Ok());
      })
      .finally(() => {
        if (!cancelledRef.current) setLoadingDetails(null);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [paramUserSlug, paramAppSlug, vibeDiyApi]);

  // Per-prompt screenshots for the Prompts tab.
  useEffect(() => {
    if (!chatDetails) {
      setScreenshots(new Map());
      return;
    }
    setScreenshots(new Map());
    for (const p of chatDetails.prompts) {
      vibeDiyApi
        .getAppByFsId({ fsId: p.fsId, appSlug: chatDetails.appSlug, userSlug: chatDetails.userSlug })
        .then((res) => {
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
  }, [chatDetails, vibeDiyApi]);

  // Head screenshot for each tile in the grid.
  useEffect(() => {
    setAppHeadInfo(new Map());
    for (const item of vibeItems) {
      vibeDiyApi.getAppByFsId({ userSlug: item.userSlug, appSlug: item.appSlug }).then((res) => {
        if (res.isErr()) return;
        const app = res.Ok();
        setAppHeadInfo((prev) =>
          new Map(prev).set(`${item.userSlug}/${item.appSlug}`, {
            screenshot: app.meta.find(isMetaScreenShot),
            mode: app.mode,
          })
        );
      });
    }
  }, [vibeItems, vibeDiyApi]);

  const openTile = (item: ResRecentVibesItem) =>
    navigate(`/vibes/mine/${item.userSlug}/${item.appSlug}/prompts`, { replace: false, preventScrollReset: true });
  const closePanel = () => navigate("/vibes/mine", { replace: false, preventScrollReset: true });
  const changeTab = (tab: string) => {
    if (!paramUserSlug || !paramAppSlug) return;
    navigate(`/vibes/mine/${paramUserSlug}/${paramAppSlug}/${tab}`, { replace: true, preventScrollReset: true });
  };

  return (
    <BrutalistLayout title="My Vibes" subtitle="Your created vibes">
      <VibesGrid
        items={vibeItems}
        headInfoMap={appHeadInfo}
        selectedKey={selectedKey}
        onOpen={openTile}
        isLoading={isLoading}
        nextCursor={nextCursor}
        onLoadMore={() => void loadMore()}
        emptyState={{
          message: "You don't have any vibes yet",
          cta: (
            <VibesButton variant="blue" onClick={() => navigate("/")}>
              Create a Vibe
            </VibesButton>
          ),
        }}
      />

      <MineDetailPanel
        userSlug={paramUserSlug}
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
    </BrutalistLayout>
  );
}
