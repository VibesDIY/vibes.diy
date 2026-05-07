import React from "react";
import { CodeIcon, DataIcon, PreviewIcon, SettingsIcon } from "../HeaderContent/SvgIcons.js";
import { ViewType } from "@vibes.diy/prompts";

interface ViewControlsProps {
  viewControls: Record<
    string,
    {
      enabled: boolean;
      icon: string;
      label: string;
      loading?: boolean;
    }
  >;
  currentView: ViewType;
  onClick?: (view: ViewType) => void;
  onDoubleClick?: (view: ViewType) => void;
  onContextMenu?: (view: ViewType, e: React.MouseEvent) => void;
  onChatClick?: () => void;
  isChatActive?: boolean;
}

const NEUTRAL_BORDER = "#d4d4d8";
const NEUTRAL_BG = `linear-gradient(${NEUTRAL_BORDER}, ${NEUTRAL_BORDER})`;
const INNER_BG = "linear-gradient(var(--vibes-tab-bg), var(--vibes-tab-bg))";

const VIEW_COLOR: Record<string, string> = {
  chat: "var(--vibes-orange-neon, #fb923c)",
  preview: "var(--vibes-red, #DA291C)",
  code: "var(--vibes-yellow, #fedd00)",
  data: "var(--vibes-green, #22c55e)",
  settings: "var(--vibes-blue, #3b82f6)",
};

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

function tabBackground(accent: string, isActive: boolean) {
  const accentBar = `linear-gradient(${accent}, ${accent})`;
  return isActive
    ? `${INNER_BG} padding-box, ${accentBar} center bottom / 100% 3px no-repeat border-box, ${NEUTRAL_BG} border-box`
    : `${INNER_BG} padding-box, ${NEUTRAL_BG} border-box`;
}

export const ViewControls: React.FC<ViewControlsProps> = ({
  viewControls,
  currentView,
  onClick,
  onDoubleClick,
  onContextMenu,
  onChatClick,
  isChatActive,
}) => {
  return (
    <div className="flex w-full justify-center gap-1 p-1 [--vibes-tab-bg:var(--color-light-background-01,#eee)] dark:[--vibes-tab-bg:var(--color-dark-background-01,#222)]">
      {/* Chat tab — mobile only */}
      {onChatClick && (
        <button
          key="chat"
          type="button"
          onClick={onChatClick}
          aria-label="Switch to Chat"
          aria-pressed={!!isChatActive}
          className="text-light-primary dark:text-dark-primary flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors md:hidden"
          style={{
            border: "3px solid transparent",
            borderRadius: 8,
            background: tabBackground(VIEW_COLOR.chat, !!isChatActive),
          }}
        >
          <ChatIcon className="h-5 w-5 md:h-4 md:w-4" />
          <span className="inline">Chat</span>
        </button>
      )}

      {Object.entries(viewControls)
        .filter(([viewType]) => viewType !== "chat")
        .map(([viewType, control]) => {
          const viewTypeKey = viewType as ViewType;
          const isActive = !isChatActive && currentView === viewTypeKey;
          const accent = VIEW_COLOR[viewType] ?? NEUTRAL_BORDER;

          return (
            <button
              key={viewType}
              type="button"
              disabled={!control.enabled}
              onClick={() => onClick?.(viewTypeKey)}
              onDoubleClick={() => onDoubleClick?.(viewTypeKey)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu?.(viewTypeKey, e);
              }}
              aria-label={`Switch to ${control.label}`}
              aria-pressed={isActive}
              className={`text-light-primary dark:text-dark-primary flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors md:flex-initial md:px-4 ${
                !control.enabled ? "!pointer-events-none cursor-not-allowed opacity-50" : ""
              }`}
              style={{
                border: "3px solid transparent",
                borderRadius: 8,
                background: tabBackground(accent, isActive),
              }}
            >
              {viewTypeKey === "preview" && (
                <PreviewIcon
                  className="h-5 w-5 md:h-4 md:w-4"
                  isLoading={!!control.loading}
                  title={control.loading ? "App is fetching data" : "Preview icon"}
                />
              )}
              {viewTypeKey === "code" && (
                <CodeIcon className="h-5 w-5 md:h-4 md:w-4" isLoading={currentView === "preview" && !!control.loading} />
              )}
              {viewTypeKey === "data" && <DataIcon className="h-5 w-5 md:h-4 md:w-4" />}
              {viewTypeKey === "settings" && <SettingsIcon className="h-5 w-5 md:h-4 md:w-4" />}
              <span className="inline">{control.label}</span>
            </button>
          );
        })}
    </div>
  );
};
