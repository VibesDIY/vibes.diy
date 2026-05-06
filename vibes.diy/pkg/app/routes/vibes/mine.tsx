import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { toast } from "react-hot-toast";
import { AppSlugItem } from "../../components/mine/AppSlugItem.js";
import { useRecentVibes } from "../../hooks/useRecentVibes.js";

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

  // Fetch chat details whenever the URL params change
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

  useEffect(() => {
    if (!chatDetails) {
      setScreenshots(new Map());
      return;
    }
    setScreenshots(new Map());
    for (const p of chatDetails.prompts) {
      vibeDiyApi.getAppByFsId({ fsId: p.fsId, appSlug: chatDetails.appSlug, userSlug: chatDetails.userSlug }).then((res) => {
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

  // Only show the full-page spinner on the very first load (no items yet).
  // During loadMore the hook flips `isLoading` true while keeping `items`
  // populated; we keep rendering the existing list and just dim the
  // "Load more" button so the page doesn't blank out mid-scroll.
  const showFirstLoadSpinner = isLoading && vibeItems.length === 0;

  return (
    <BrutalistLayout title="My Vibes" subtitle="Your created vibes">
      {showFirstLoadSpinner ? (
        <BrutalistCard size="md">
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
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
        <BrutalistCard size="md">
          <div className="grid gap-3">
            {vibeItems.map((item) => {
              const key = `${item.userSlug}/${item.appSlug}`;
              const isSelected = paramUserSlug === item.userSlug && paramAppSlug === item.appSlug;
              return (
                <AppSlugItem
                  key={key}
                  userSlug={item.userSlug}
                  appSlug={item.appSlug}
                  title={item.title}
                  isSelected={isSelected}
                  activeTab={isSelected ? paramTab : undefined}
                  isLoadingThis={loadingDetails === key}
                  headInfo={appHeadInfo.get(key)}
                  chatDetails={isSelected ? (chatDetails ?? undefined) : undefined}
                  screenshots={screenshots}
                  onToggleMode={onToggleMode}
                />
              );
            })}
          </div>
          {nextCursor && (
            <div className="mt-4 flex justify-center">
              <VibesButton variant="blue" onClick={() => void loadMore()} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load more"}
              </VibesButton>
            </div>
          )}
        </BrutalistCard>
      )}
    </BrutalistLayout>
  );
}
