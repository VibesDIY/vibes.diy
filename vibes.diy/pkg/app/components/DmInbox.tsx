import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DmThreadItem, VibesDiyApiIface } from "@vibes.diy/api-types";

interface DmInboxProps {
  chatApi?: VibesDiyApiIface | null;
  myUserSlug?: string;
}

export function DmInbox({ chatApi, myUserSlug }: DmInboxProps) {
  const [threads, setThreads] = useState<DmThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatApi) return;
    setLoading(true);
    chatApi.listDmThreads({}).then((res) => {
      if (res.isErr()) return;
      setThreads(res.Ok().items);
      setLoading(false);
    });
  }, [chatApi]);

  if (loading) return <div className="p-4 text-sm">Loading…</div>;

  if (threads.length === 0) {
    return <div className="p-8 text-center text-sm text-gray-500">No messages yet. Start a conversation from any vibe.</div>;
  }

  return (
    <ul className="divide-y">
      {threads.map((t) => {
        const slugA = myUserSlug ?? "";
        return (
          <li key={t.channelUserSlug}>
            <Link
              to={`/messages/${slugA}/${t.otherUserSlug}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{t.otherUserSlug}</span>
                  {t.latestMessage && (
                    <span className="text-xs text-gray-400 ml-2 shrink-0">
                      {new Date(t.latestMessage.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {t.latestMessage && <p className="text-xs text-gray-500 truncate">{t.latestMessage.body}</p>}
              </div>
              {t.unreadCount > 0 && (
                <span
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    borderRadius: 9999,
                    padding: "0 6px",
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {t.unreadCount > 99 ? "99+" : t.unreadCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
