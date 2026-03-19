import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { getCodeBlock } from "@vibes.diy/vibe-srv-sandbox";

interface ChatItem {
  chatId: string;
  appSlug: string;
  userSlug: string;
  created: string;
}

interface ChatDetail {
  userPrompt: string;
  code: string;
}

interface AppChatsTabProps {
  userSlug: string;
  appSlug: string;
}

export function AppChatsTab({ userSlug, appSlug }: AppChatsTabProps) {
  const { vibeDiyApi } = useVibesDiy();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ChatDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const selectChat = (chatId: string) => {
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
      setChatDetail(null);
      return;
    }
    setSelectedChatId(chatId);
    setChatDetail(null);
    setDetailLoading(true);
    void vibeDiyApi.openChat({ chatId, mode: "application" }).then((rChat) => {
      if (rChat.isErr()) {
        setDetailLoading(false);
        return;
      }
      void getCodeBlock(rChat.Ok().sectionStream).then((res) => {
        const userPrompt = res.promptReq.request.messages
          .filter((m) => m.role === "user")
          .flatMap((m) => m.content.map((c) => c.text))
          .join("\n");
        setChatDetail({ userPrompt, code: res.code });
        setDetailLoading(false);
      });
    });
  };

  useEffect(() => {
    setChats([]);
    setNextCursor(undefined);
    setLoading(true);
    setSelectedChatId(null);
    setChatDetail(null);
    void vibeDiyApi
      .listApplicationChats({})
      .then((res) => {
        if (res.isErr()) {
          setError(String(res.Err()));
          return;
        }
        setChats(res.Ok().items.filter((c) => c.userSlug === userSlug && c.appSlug === appSlug));
        setNextCursor(res.Ok().nextCursor);
      })
      .finally(() => setLoading(false));
  }, [vibeDiyApi, userSlug, appSlug]);

  const loadMore = () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    void vibeDiyApi
      .listApplicationChats({ cursor: nextCursor })
      .then((res) => {
        if (res.isErr()) {
          setError(String(res.Err()));
          return;
        }
        setChats((prev) => [...prev, ...res.Ok().items.filter((c) => c.userSlug === userSlug && c.appSlug === appSlug)]);
        setNextCursor(res.Ok().nextCursor);
      })
      .finally(() => setLoading(false));
  };

  if (loading && chats.length === 0) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (error) {
    return <p className="text-red-600 text-sm font-medium">{error}</p>;
  }
  if (chats.length === 0) {
    return <p className="text-sm text-gray-500">No application chats yet.</p>;
  }

  return (
    <div className="space-y-1 overflow-hidden">
      {chats.map((c) => (
        <div key={c.chatId}>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => selectChat(c.chatId)}
              className={`font-mono text-left hover:underline cursor-pointer ${selectedChatId === c.chatId ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}
            >
              {c.chatId}
            </button>
            <span className="text-gray-400">
              {new Date(c.created).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          {selectedChatId === c.chatId && (
            <div className="mt-1 text-xs space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 overflow-hidden">
              {detailLoading ? (
                <span className="text-gray-400">Loading...</span>
              ) : chatDetail ? (
                <>
                  <div className="pt-1">
                    <div className="font-semibold mb-0.5 text-gray-500 dark:text-gray-400">User prompt</div>
                    <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{chatDetail.userPrompt}</div>
                  </div>
                  <div className="pb-1">
                    <div className="font-semibold mb-0.5 text-gray-500 dark:text-gray-400">Code</div>
                    <pre className="max-w-full overflow-x-auto max-h-48 overflow-y-auto text-xs text-gray-800 dark:text-gray-200">
                      {chatDetail.code}
                    </pre>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      ))}
      {(nextCursor || loading) && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
