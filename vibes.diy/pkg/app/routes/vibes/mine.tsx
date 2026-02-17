import type { ReactElement } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrutalistLayout from "../../components/BrutalistLayout.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import type { ResListUserSlugAppSlugItem, ResGetChatDetails } from "@vibes.diy/api-types";

export function meta() {
  return [{ title: "My Vibes - Vibes DIY" }, { name: "description", content: "Your created vibes in Vibes DIY" }];
}

export default function VibesMine(): ReactElement {
  const navigate = useNavigate();
  const { vibeDiyApi } = useVibeDiy();

  const [isLoading, setIsLoading] = useState(true);
  const [vibeItems, setVibeItems] = useState<ResListUserSlugAppSlugItem[]>([]);
  const [chatDetails, setChatDetails] = useState<ResGetChatDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const fetchChatDetails = useCallback(
    (userSlug: string, appSlug: string) => {
      const key = `${userSlug}/${appSlug}`;
      if (pendingRef.current === key) return;
      // Toggle off if clicking the same appSlug again
      if (chatDetails && chatDetails.userSlug === userSlug && chatDetails.appSlug === appSlug) {
        setChatDetails(null);
        setLoadingDetails(null);
        return;
      }
      pendingRef.current = key;
      setLoadingDetails(key);
      setChatDetails(null);
      vibeDiyApi
        .getChatDetails({ userSlug, appSlug })
        .then((res) => {
          if (res.isOk()) {
            setChatDetails(res.Ok());
          }
        })
        .finally(() => {
          setLoadingDetails(null);
          pendingRef.current = null;
        });
    },
    [vibeDiyApi, chatDetails]
  );

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
                    const isSelected = chatDetails?.userSlug === item.userSlug && chatDetails?.appSlug === appSlug;
                    const isLoadingThis = loadingDetails === key;
                    return (
                      <div
                        key={appSlug}
                        className={`rounded-lg border transition-all ${isSelected ? "border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30" : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-400"}`}
                      >
                        <button
                          onClick={() => fetchChatDetails(item.userSlug, appSlug)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                          <span
                            className={`font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}
                          >
                            {appSlug}
                          </span>
                          {isLoadingThis ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
                          ) : (
                            <span className={`text-sm text-gray-400 transition-transform ${isSelected ? "rotate-180" : ""}`}>
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
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={`/vibe/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                                        >
                                          Open App ↗
                                        </a>
                                        <button
                                          onClick={() =>
                                            navigate(`/chat/${chatDetails.userSlug}/${chatDetails.appSlug}?fsId=${p.fsId}`)
                                          }
                                          className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                          Continue Chat →
                                        </button>
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
