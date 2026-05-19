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

const PANEL_WIDTH = 520;
const TABS: { id: MineDetailTab; label: string }[] = [
  { id: "prompts", label: "Prompts" },
  { id: "chats", label: "Application Chats" },
  { id: "sharing", label: "Sharing" },
  { id: "settings", label: "Settings" },
];

interface MineDetailPanelProps {
  userSlug?: string;
  appSlug?: string;
  title?: string;
  headScreenshot?: MetaScreenShot;
  headMode?: string;
  activeTab: MineDetailTab;
  isLoading: boolean;
  chatDetails: ResGetChatDetails | null;
  screenshots: Map<string, { screenshot?: MetaScreenShot; mode?: string }>;
  onToggleMode: (fsId: string, appSlug: string, userSlug: string, currentMode: string | undefined) => Promise<void>;
  onTabChange: (tab: MineDetailTab) => void;
  onClose: () => void;
}

export function MineDetailPanel({
  userSlug,
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
  const open = !!(userSlug && appSlug);
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

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/30 dark:bg-black/50 transition-opacity duration-300"
        />
      )}

      <aside
        aria-hidden={!open}
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-[var(--vibes-cream)] dark:bg-dark-background-00 border-l-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] shadow-[-8px_0_24px_rgba(0,0,0,0.2)]"
        style={{
          width: PANEL_WIDTH,
          maxWidth: "100vw",
          transform: open ? "translateX(0)" : `translateX(${PANEL_WIDTH}px)`,
          transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3 right-3 z-[1] w-8 h-8 flex items-center justify-center rounded-full bg-light-background-00/80 dark:bg-dark-background-00/80 hover:bg-light-background-00 dark:hover:bg-dark-background-00 transition-colors"
        >
          <svg
            className="text-light-primary dark:text-dark-primary"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {open && (
          <div className="flex flex-col h-full">
            {/* Hero screenshot */}
            <div
              className="w-full bg-light-background-01 dark:bg-dark-background-01 border-b-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] flex items-center justify-center overflow-hidden shrink-0"
              style={{ height: 180 }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-light-primary/40 dark:text-dark-primary/40 text-xs uppercase tracking-widest">
                  No preview
                </span>
              )}
            </div>

            {/* Title + slug + mode strip */}
            <div className="shrink-0 px-5 pt-4 pb-2 pr-12 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-light-primary dark:text-dark-primary text-lg font-bold truncate">{label}</h3>
                <p className="text-light-primary/60 dark:text-dark-primary/60 text-xs truncate">{userSlug}</p>
              </div>
              {headMode && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
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
            <div className="shrink-0 flex gap-1 px-5 pt-2 pb-2 border-b border-black/10 dark:border-white/10 overflow-x-auto">
              {TABS.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTabChange(t.id)}
                    className={`shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {activeTab === "prompts" ? (
                <PromptsTab
                  isLoading={isLoading}
                  chatDetails={chatDetails ?? undefined}
                  screenshots={screenshots}
                  onToggleMode={onToggleMode}
                />
              ) : activeTab === "chats" ? (
                <AppChatsTab userSlug={userSlug ?? ""} appSlug={appSlug ?? ""} />
              ) : activeTab === "sharing" ? (
                <SharingTab userSlug={userSlug ?? ""} appSlug={appSlug ?? ""} />
              ) : (
                <SettingsTab userSlug={userSlug ?? ""} appSlug={appSlug ?? ""} />
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
