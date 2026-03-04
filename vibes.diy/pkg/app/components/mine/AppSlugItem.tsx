import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";
import { PromptsTab } from "./PromptsTab.js";
import { AppChatsTab } from "./AppChatsTab.js";

interface AppSlugItemProps {
  userSlug: string;
  appSlug: string;
  isSelected: boolean;
  isLoadingThis: boolean;
  headInfo?: { screenshot?: MetaScreenShot; mode?: string };
  chatDetails: ResGetChatDetails | null;
  screenshots: Map<string, { screenshot?: MetaScreenShot; mode?: string }>;
}

export function AppSlugItem({
  userSlug,
  appSlug,
  isSelected,
  isLoadingThis,
  headInfo,
  chatDetails,
  screenshots,
}: AppSlugItemProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"prompts" | "chats">("prompts");

  useEffect(() => {
    if (!isSelected) setActiveTab("prompts");
  }, [isSelected]);

  return (
    <div
      className={`rounded-lg border transition-all ${isSelected ? "border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30" : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-400"}`}
    >
      <button
        onClick={() =>
          isSelected
            ? navigate("/vibes/mine", { replace: true, preventScrollReset: true })
            : navigate(`/vibes/mine/${userSlug}/${appSlug}`, { replace: true, preventScrollReset: true })
        }
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {headInfo?.screenshot ? (
          <img
            src={`/assets/cid/?url=${encodeURIComponent(headInfo.screenshot.assetUrl)}&mime=${encodeURIComponent(headInfo.screenshot.mime)}`}
            alt=""
            className="h-10 w-16 flex-shrink-0 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-16 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-700" />
        )}
        <span className="flex flex-1 items-center gap-2 min-w-0">
          <span
            className={`truncate font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}
          >
            {appSlug}
          </span>
          {headInfo?.mode && (
            <span
              className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${headInfo.mode === "production" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"}`}
            >
              {headInfo.mode}
            </span>
          )}
        </span>
        {isLoadingThis ? (
          <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
        ) : (
          <span className={`flex-shrink-0 text-sm text-gray-400 transition-transform ${isSelected ? "rotate-180" : ""}`}>▼</span>
        )}
      </button>
      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-600">
          <div className="flex gap-1 px-4 pt-2 pb-2 border-b border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab("prompts")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${activeTab === "prompts" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
              Prompts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chats")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${activeTab === "chats" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
              Application Chats
            </button>
          </div>
          <div className="px-4 py-3">
            {activeTab === "prompts" ? (
              <PromptsTab isLoading={isLoadingThis} chatDetails={chatDetails} screenshots={screenshots} />
            ) : (
              <AppChatsTab userSlug={userSlug} appSlug={appSlug} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
