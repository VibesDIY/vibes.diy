import React, { useEffect } from "react";
import type { ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";
import { PromptsTab } from "./PromptsTab.js";
import { AppChatsTab } from "./AppChatsTab.js";
import { SharingTab } from "./sharing-tab/SharingTab.js";
import { SettingsTab } from "./settings-tab/index.js";

export type MineDetailTab = "prompts" | "chats" | "sharing" | "settings";

export function toMineDetailTab(s: string | undefined): MineDetailTab {
  if (s === "chats" || s === "sharing" || s === "settings") return s;
  return "prompts";
}

const TABS: { id: MineDetailTab; label: string }[] = [
  { id: "prompts", label: "Prompts" },
  { id: "chats", label: "Application Chats" },
  { id: "sharing", label: "Sharing" },
  { id: "settings", label: "Settings" },
];

interface MineDetailPanelProps {
  ownerHandle?: string;
  appSlug?: string;
  title?: string;
  headScreenshot?: MetaScreenShot;
  headMode?: string;
  activeTab: MineDetailTab;
  isLoading: boolean;
  chatDetails: ResGetChatDetails | null;
  screenshots: Map<string, { screenshot?: MetaScreenShot; mode?: string }>;
  onToggleMode: (fsId: string, appSlug: string, ownerHandle: string, currentMode: string | undefined) => Promise<void>;
  onTabChange: (tab: MineDetailTab) => void;
  onClose: () => void;
}

export function MineDetailPanel({
  ownerHandle,
  appSlug,
  title,
  headScreenshot,
  headMode,
  activeTab,
  isLoading,
  chatDetails,
  screenshots,
  onToggleMode,
  onTabChange,
  onClose,
}: MineDetailPanelProps) {
  const open = !!(ownerHandle && appSlug);
  const label = title ?? appSlug ?? "";
  const previewUrl = headScreenshot
    ? `/assets/cid/?url=${encodeURIComponent(headScreenshot.assetUrl)}&mime=${encodeURIComponent(headScreenshot.mime)}`
    : null;

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <section className="flex flex-col">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="self-start inline-flex items-center gap-1.5 mb-4 text-light-primary dark:text-dark-primary text-sm font-medium hover:opacity-70 transition-opacity"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to vibes
      </button>

      {/* Detail card */}
      <div className="flex flex-col rounded-lg border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] bg-light-background-00 dark:bg-dark-background-01 overflow-hidden">
        {/* Hero screenshot */}
        <div
          className="w-full bg-light-background-01 dark:bg-dark-background-01 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] flex items-center justify-center overflow-hidden"
          style={{ aspectRatio: "21 / 9", maxHeight: 320 }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-light-primary/40 dark:text-dark-primary/40 text-xs uppercase tracking-widest">No preview</span>
          )}
        </div>

        {/* Title + slug + mode strip */}
        <div className="px-6 pt-5 pb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-light-primary dark:text-dark-primary text-2xl font-bold truncate">{label}</h3>
            <p className="text-light-primary/60 dark:text-dark-primary/60 text-sm truncate">@{ownerHandle}</p>
          </div>
          {headMode && (
            <span
              className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                headMode === "production"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
              }`}
            >
              {headMode}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-2 pb-0 border-b border-black/10 dark:border-white/10 overflow-x-auto">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`shrink-0 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-blue-500 text-blue-700 dark:text-blue-300"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {activeTab === "prompts" ? (
            <PromptsTab
              isLoading={isLoading}
              chatDetails={chatDetails ?? undefined}
              screenshots={screenshots}
              onToggleMode={onToggleMode}
            />
          ) : activeTab === "chats" ? (
            <AppChatsTab ownerHandle={ownerHandle ?? ""} appSlug={appSlug ?? ""} />
          ) : activeTab === "sharing" ? (
            <SharingTab ownerHandle={ownerHandle ?? ""} appSlug={appSlug ?? ""} />
          ) : (
            <SettingsTab ownerHandle={ownerHandle ?? ""} appSlug={appSlug ?? ""} />
          )}
        </div>
      </div>
    </section>
  );
}
