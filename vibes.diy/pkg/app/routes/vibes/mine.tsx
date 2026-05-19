import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { ResGetChatDetails, MetaScreenShot, ResRecentVibesItem } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { toast } from "react-hot-toast";
import { useRecentVibes } from "../../hooks/useRecentVibes.js";
import { MineDetailPanel, toMineDetailTab } from "../../components/mine/MineDetailPanel.js";

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
  const [screenshots, setScreenshots] = useState<Map<string, { screenshot?: MetaScreenShot; mode?: string }>>(new Map());
  const [appHeadInfo, setAppHeadInfo] = useState<Map<string, { screenshot?: MetaScreenShot; mode?: string }>>(new Map());
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

  const showFirstLoadSpinner = isLoading && vibeItems.length === 0;

  const openTile = (item: ResRecentVibesItem) =>
    navigate(`/vibes/mine/${item.userSlug}/${item.appSlug}/prompts`, { replace: false, preventScrollReset: true });
  const closePanel = () => navigate("/vibes/mine", { replace: false, preventScrollReset: true });
  const changeTab = (tab: string) => {
    if (!paramUserSlug || !paramAppSlug) return;
    navigate(`/vibes/mine/${paramUserSlug}/${paramAppSlug}/${tab}`, { replace: true, preventScrollReset: true });
  };

  return (
    <BrutalistLayout title="My Vibes" subtitle="Your created vibes">
      {showFirstLoadSpinner ? (
        <BrutalistCard size="md">
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
          </div>
        </BrutalistCard>
      ) : vibeItems.length === 0 ? (
        <BrutalistCard size="md">
          <div className="text-center py-8">
            <p className="mb-4 text-lg">You don&apos;t have any vibes yet</p>
            <VibesButton variant="blue" onClick={() => navigate("/")}>
              Create a Vibe
            </VibesButton>
          </div>
        </BrutalistCard>
      ) : (
        <>
          {/* Uniform grid — 16:9 hero on top of each card, title + slug + mode
              underneath. Click opens the side panel with the 4 tabs. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {vibeItems.map((item) => {
              const key = `${item.userSlug}/${item.appSlug}`;
              const head = appHeadInfo.get(key);
              return (
                <VibeCard
                  key={key}
                  item={item}
                  head={head}
                  isSelected={selectedKey === key}
                  onOpen={() => openTile(item)}
                />
              );
            })}
          </div>
          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <VibesButton variant="blue" onClick={() => void loadMore()} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load more"}
              </VibesButton>
            </div>
          )}
        </>
      )}

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

interface VibeCardProps {
  item: ResRecentVibesItem;
  head?: { screenshot?: MetaScreenShot; mode?: string };
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
