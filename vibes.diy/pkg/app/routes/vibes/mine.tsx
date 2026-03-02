import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import type { ResListUserSlugAppSlugItem, ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";
import { AppSlugItem } from "../../components/mine/AppSlugItem.js";

export function meta() {
  return [{ title: "My Vibes - Vibes DIY" }, { name: "description", content: "Your created vibes in Vibes DIY" }];
}

export default function VibesMine(): ReactElement {
  const navigate = useNavigate();
  const { userSlug: paramUserSlug, appSlug: paramAppSlug } = useParams<{ userSlug?: string; appSlug?: string }>();
  const { vibeDiyApi } = useVibeDiy();

  const [isLoading, setIsLoading] = useState(true);
  const [vibeItems, setVibeItems] = useState<ResListUserSlugAppSlugItem[]>([]);
  const [chatDetails, setChatDetails] = useState<ResGetChatDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Map<string, { screenshot?: MetaScreenShot; mode?: string }>>(new Map());
  const [appHeadInfo, setAppHeadInfo] = useState<Map<string, { screenshot?: MetaScreenShot; mode?: string }>>(new Map());
  const cancelledRef = useRef(false);

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
      vibeDiyApi.getAppByFsId({ fsId: p.fsId }).then((res) => {
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
    vibeDiyApi
      .listUserSlugAppSlug({})
      .then((res) => {
        if (res.isOk()) {
          setVibeItems(res.Ok().items);
        }
      })
      .finally(() => setIsLoading(false));
  }, [vibeDiyApi]);

  useEffect(() => {
    setAppHeadInfo(new Map());
    for (const item of vibeItems) {
      for (const appSlug of item.appSlugs) {
        vibeDiyApi.getAppByAppSlug({ userSlug: item.userSlug, appSlug }).then((res) => {
          if (res.isErr()) return;
          const app = res.Ok();
          setAppHeadInfo((prev) =>
            new Map(prev).set(`${item.userSlug}/${appSlug}`, {
              screenshot: app.meta.find(isMetaScreenShot),
              mode: app.mode,
            })
          );
        });
      }
    }
  }, [vibeItems, vibeDiyApi]);

  return (
    <BrutalistLayout title="My Vibes" subtitle="Your created vibes">
      {isLoading ? (
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
        <div className="flex w-full flex-col gap-6">
          {vibeItems.map((item) => (
            <BrutalistCard key={item.userSlug} size="md">
              <h3 className="mb-4 text-lg font-bold">{item.userSlug}</h3>
              {item.appSlugs.length === 0 ? (
                <p className="text-sm text-gray-500">No apps yet</p>
              ) : (
                <div className="grid gap-3">
                  {item.appSlugs.map((appSlug) => {
                    const key = `${item.userSlug}/${appSlug}`;
                    const isSelected = paramUserSlug === item.userSlug && paramAppSlug === appSlug;
                    return (
                      <AppSlugItem
                        key={appSlug}
                        userSlug={item.userSlug}
                        appSlug={appSlug}
                        isSelected={isSelected}
                        isLoadingThis={loadingDetails === key}
                        headInfo={appHeadInfo.get(key)}
                        chatDetails={isSelected ? chatDetails : null}
                        screenshots={screenshots}
                      />
                    );
                  })}
                </div>
              )}
            </BrutalistCard>
          ))}
        </div>
      )}
    </BrutalistLayout>
  );
}
