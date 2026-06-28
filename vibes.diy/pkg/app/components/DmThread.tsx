import React, { useEffect, useRef, useState } from "react";
import { directChannelUserSlug } from "@vibes.diy/api-types";
import type { Conn } from "@vibes.diy/api-types";

interface DmThreadProps {
  myUserSlug: string;
  otherUserSlug: string;
  vibeRef?: { ownerHandle: string; appSlug: string };
  // DM doc ops (queryDocs/putDoc/markDmRead) are VIBE_ONLY → an AppSessions
  // connection (appApiFor(`<channel>--dm`)). (#2714)
  dmApi?: Conn<"vibe"> | null;
}

interface MsgDoc {
  _id: string;
  _seq?: number;
  body?: string;
  authorHandle?: string;
  createdAt?: string;
}

export function DmThread({ myUserSlug, otherUserSlug, vibeRef, dmApi }: DmThreadProps) {
  const channelUserSlug = directChannelUserSlug(myUserSlug, otherUserSlug);
  const [messages, setMessages] = useState<MsgDoc[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dmApi) return;
    dmApi.queryDocs({ ownerHandle: channelUserSlug, appSlug: "dm", dbName: "messages" }).then((res) => {
      if (res.isErr()) return;
      setMessages(res.Ok().docs as unknown as MsgDoc[]);
    });
  }, [dmApi, channelUserSlug]);

  useEffect(() => {
    if (!messages.length || !dmApi) return;
    const latestSeq = Math.max(...messages.map((m) => m._seq ?? 0));
    void dmApi.markDmRead({ channelUserSlug, lastSeenSeq: latestSeq });
  }, [messages, channelUserSlug, dmApi]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!body.trim() || !dmApi) return;
    setSending(true);
    await dmApi.putDoc({
      ownerHandle: channelUserSlug,
      appSlug: "dm",
      dbName: "messages",
      doc: {
        body: body.trim(),
        authorHandle: myUserSlug,
        createdAt: new Date().toISOString(),
        ...(vibeRef ? { vibeRef } : {}),
      },
    });
    setBody("");
    setSending(false);
    dmApi.queryDocs({ ownerHandle: channelUserSlug, appSlug: "dm", dbName: "messages" }).then((res) => {
      if (!res.isErr()) setMessages(res.Ok().docs as unknown as MsgDoc[]);
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m._id} className={`flex flex-col ${m.authorHandle === myUserSlug ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                m.authorHandle === myUserSlug
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              }`}
            >
              {m.body}
            </div>
            <span className="text-xs text-gray-400 mt-1">
              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 flex gap-2">
        <input
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Message ${otherUserSlug}…`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={sending}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!body.trim() || sending}
          className="rounded-full px-4 py-2 text-sm font-medium bg-blue-500 text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
