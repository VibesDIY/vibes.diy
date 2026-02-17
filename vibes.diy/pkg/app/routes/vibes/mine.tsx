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
        <div className="flex w-full flex-col gap-4">
          {vibeItems.map((item) => (
            <BrutalistCard key={item.userSlug} size="md">
              <h3 className="mb-3 text-lg font-bold">{item.userSlug}</h3>
              {item.appSlugs.length === 0 ? (
                <p className="text-sm text-gray-500">No apps yet</p>
              ) : (
                <ul className="space-y-1">
                  {item.appSlugs.map((appSlug) => {
                    const key = `${item.userSlug}/${appSlug}`;
                    const isSelected = chatDetails?.userSlug === item.userSlug && chatDetails?.appSlug === appSlug;
                    const isLoadingThis = loadingDetails === key;
                    return (
                      <li key={appSlug}>
                        <button
                          onClick={() => fetchChatDetails(item.userSlug, appSlug)}
                          className={`text-sm hover:underline ${isSelected ? "font-bold text-blue-700" : "text-blue-500 hover:text-blue-600"}`}
                        >
                          {appSlug}
                        </button>
                        {isLoadingThis && (
                          <div className="ml-2 mt-1 inline-block h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
                        )}
                        {isSelected && chatDetails && (
                          <div className="mt-2 rounded border bg-gray-50 p-2">
                            <div className="mb-1 text-xs text-gray-500">chat: {chatDetails.chatId}</div>
                            {chatDetails.prompts.length === 0 ? (
                              <p className="text-sm text-gray-500">No prompts yet</p>
                            ) : (
                              <ul className="space-y-2">
                                {chatDetails.prompts.map((p, i) => (
                                  <li key={i} className="rounded border bg-white p-2">
                                    <p className="text-sm">{p.prompt}</p>
                                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                      <a
                                        href={`/vibe/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-600 hover:underline"
                                      >
                                        {p.fsId.slice(0, 12)}...
                                      </a>
                                      <pre>{p.prompt}</pre>
                                      <span>{p.created}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </BrutalistCard>
          ))}
        </div>
      )}
    </BrutalistLayout>
  );
}
