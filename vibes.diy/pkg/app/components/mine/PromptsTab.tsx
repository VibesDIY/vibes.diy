import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ResGetChatDetails, MetaScreenShot } from "@vibes.diy/api-types";

interface PromptsTabProps {
  isLoading: boolean;
  chatDetails?: ResGetChatDetails;
  screenshots: Map<string, { screenshot?: MetaScreenShot; mode?: string }>;
  onToggleMode: (fsId: string, appSlug: string, userSlug: string, currentMode: string | undefined) => Promise<void>;
}

export function PromptsTab({ isLoading, chatDetails, screenshots, onToggleMode }: PromptsTabProps) {
  const navigate = useNavigate();
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(fsId: string, appSlug: string, userSlug: string, currentMode: string | undefined) {
    setToggling(fsId);
    try {
      await onToggleMode(fsId, appSlug, userSlug, currentMode);
    } finally {
      setToggling(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (!chatDetails) return null;
  if (chatDetails.prompts.length === 0) {
    return <p className="text-sm text-gray-500">No prompts yet</p>;
  }
  return (
    <div className="space-y-3">
      {chatDetails.prompts.map((p, i) => {
        const info = screenshots.get(p.fsId);
        const shot = info?.screenshot;
        const mode = info?.mode;
        const appUrl = `/vibe/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`;
        const isToggling = toggling === p.fsId;
        const isProd = mode === "production";
        const dateLabel = new Date(p.created).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <div
            key={i}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 flex flex-col gap-3"
          >
            {/* Top row: prompt body + date pinned right */}
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 min-w-0 leading-snug">
                {p.prompt || <span className="italic text-gray-400 dark:text-gray-500">User edited code</span>}
              </p>
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {dateLabel}
              </span>
            </div>

            {/* Action row: compact thumbnail + buttons, never wraps */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
              >
                {shot ? (
                  <img
                    src={`/assets/cid/?url=${encodeURIComponent(shot.assetUrl)}&mime=${encodeURIComponent(shot.mime)}`}
                    alt=""
                    className="h-8 w-12 object-cover block"
                  />
                ) : (
                  <div className="h-8 w-12 bg-gray-100 dark:bg-gray-700" />
                )}
              </a>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors whitespace-nowrap"
              >
                Open ↗
              </a>
              <button
                type="button"
                onClick={() => navigate(`/chat/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`)}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
              >
                Continue chat
              </button>
              {/* Mode pill — clickable to toggle. The label is "dev" / "production"
                  and clicking flips it. Shows a "→" hint on hover so the toggle
                  affordance is discoverable. */}
              <button
                type="button"
                disabled={isToggling || !mode}
                onClick={() => void handleToggle(p.fsId, chatDetails.appSlug, chatDetails.userSlug, mode)}
                className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isProd
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-800/50"
                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-800/50"
                }`}
                aria-label={`Mode ${mode ?? "unknown"} — click to switch to ${isProd ? "dev" : "production"}`}
                title={mode ? `Switch to ${isProd ? "dev" : "production"}` : undefined}
              >
                {isToggling ? "…" : mode ?? "—"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
