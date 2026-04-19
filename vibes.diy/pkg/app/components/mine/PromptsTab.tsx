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
        return (
          <div key={i} className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
            <p className="mb-2 text-sm text-gray-800 dark:text-gray-200">
              {p.prompt || <span className="italic text-gray-400 dark:text-gray-500">User edited code</span>}
            </p>
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
                  onClick={() => navigate(`/chat/${chatDetails.userSlug}/${chatDetails.appSlug}/${p.fsId}`)}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Continue Chat →
                </button>
                <button
                  disabled={isToggling}
                  onClick={() => void handleToggle(p.fsId, chatDetails.appSlug, chatDetails.userSlug, mode)}
                  className="inline-flex items-center gap-1 rounded-md bg-green-100 dark:bg-green-900/50 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors disabled:opacity-50"
                >
                  {isToggling ? "…" : mode === "production" ? "→ dev" : "→ prod"}
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
          </div>
        );
      })}
    </div>
  );
}
