import type { ReactElement } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import type { ResListUserSlugAppSlugItem, ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";
import { isMetaScreenShot } from "@vibes.diy/api-types";

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
                    const isLoadingThis = loadingDetails === key;
                    return (
                      <div
                        key={appSlug}
                        className={`rounded-lg border transition-all ${isSelected ? "border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30" : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-400"}`}
                      >
                        <button
                          onClick={() =>
                            isSelected
                              ? navigate("/vibes/mine", { replace: true, preventScrollReset: true })
                              : navigate(`/vibes/mine/${item.userSlug}/${appSlug}`, { replace: true, preventScrollReset: true })
                          }
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          {(() => {
                            const info = appHeadInfo.get(key);
                            return info?.screenshot ? (
                              <img
                                src={`/assets/cid/?url=${encodeURIComponent(info.screenshot.assetUrl)}&mime=${encodeURIComponent(info.screenshot.mime)}`}
                                alt=""
                                className="h-10 w-16 flex-shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-16 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-700" />
                            );
                          })()}
                          <span className="flex flex-1 items-center gap-2 min-w-0">
                            <span
                              className={`truncate font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}
                            >
                              {appSlug}
                            </span>
                            {(() => {
                              const mode = appHeadInfo.get(key)?.mode;
                              if (!mode) return null;
                              return (
                                <span
                                  className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${mode === "production" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"}`}
                                >
                                  {mode}
                                </span>
                              );
                            })()}
                          </span>
                          {isLoadingThis ? (
                            <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
                          ) : (
                            <span
                              className={`flex-shrink-0 text-sm text-gray-400 transition-transform ${isSelected ? "rotate-180" : ""}`}
                            >
                              ▼
                            </span>
                          )}
                        </button>
                        {isSelected && chatDetails && (
                          <div className="border-t border-gray-200 dark:border-gray-600 px-4 py-3">
                            {chatDetails.prompts.length === 0 ? (
                              <p className="text-sm text-gray-500">No prompts yet</p>
                            ) : (
                              <div className="space-y-3">
                                {chatDetails.prompts.map((p, i) => (
                                  <div
                                    key={i}
                                    className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3"
                                  >
                                    <p className="mb-2 text-sm text-gray-800 dark:text-gray-200">{p.prompt}</p>
                                    {(() => {
                                      const info = screenshots.get(p.fsId);
                                      const shot = info?.screenshot;
                                      const mode = info?.mode;
                                      const appUrl = `/vibe/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`;
                                      return (
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <a
                                              href={appUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex-shrink-0 overflow-hidden rounded hover:opacity-80 transition-opacity"
                                            >
                                              {shot ? (
                                                <img
                                                  src={`/assets/cid/?url=${encodeURIComponent(shot.assetUrl)}&mime=${encodeURIComponent(shot.mime)}`}
                                                  alt="App screenshot"
                                                  className="h-10 w-16 object-cover"
                                                />
                                              ) : (
                                                <div className="h-10 w-16 bg-gray-100 dark:bg-gray-700" />
                                              )}
                                            </a>
                                            <a
                                              href={appUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                                            >
                                              Open App ↗
                                            </a>
                                            <button
                                              onClick={() =>
                                                navigate(`/chat/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`)
                                              }
                                              className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            >
                                              Continue Chat →
                                            </button>
                                            {mode && (
                                              <span
                                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${mode === "production" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"}`}
                                              >
                                                {mode}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-gray-400">
                                            {new Date(p.created).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
