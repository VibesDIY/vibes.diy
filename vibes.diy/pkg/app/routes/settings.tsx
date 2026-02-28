import React, { useEffect, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { Link, useNavigate } from "react-router-dom";
import LoggedOutView from "../components/LoggedOutView.js";
import BrutalistLayout from "../components/BrutalistLayout.js";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { isUserSettingSharing } from "@vibes.diy/api-types";
import type { UserSettingItem } from "@vibes.diy/api-types";
import { getCodeBlock } from "@vibes.diy/vibe-srv-sandbox";

export function meta() {
  return [{ title: "Settings - Vibes DIY" }, { name: "description", content: "Settings for AI App Builder" }];
}

type SharingGrant = UserSettingItem["grants"][number];

function GrantsList() {
  const { vibeDiyApi } = useVibeDiy();
  const [grants, setGrants] = useState<SharingGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    void vibeDiyApi.ensureUserSettings({ settings: [] }).then((res) => {
      setLoading(false);
      if (res.isErr()) {
        setError(`Failed to load grants: ${res.Err()}`);
        return;
      }
      const sharing = res.Ok().settings.find(isUserSettingSharing);
      setGrants(sharing?.grants ?? []);
    });
  }, [vibeDiyApi]);

  const toggleGrant = (index: number) => {
    const updated = grants.map((g, i) =>
      i === index ? { ...g, grant: g.grant === "allow" ? ("deny" as const) : ("allow" as const) } : g
    );
    setGrants(updated);
    setSavingIndex(index);
    void vibeDiyApi.ensureUserSettings({ settings: [{ type: "sharing", grants: updated }] }).then((res) => {
      setSavingIndex(null);
      if (res.isErr()) {
        setError(`Failed to save: ${res.Err()}`);
        setGrants(grants); // revert on error
      }
    });
  };

  if (loading) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>Loading grants...</p>;
  }

  if (error) {
    return <p className="text-red-600 font-medium">{error}</p>;
  }

  if (grants.length === 0) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>No sharing grants yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b-2" style={{ borderColor: "var(--vibes-border-primary)" }}>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 pr-4 font-semibold">User / App</th>
            <th className="pb-2 font-semibold">Database</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((g, i) => (
            <tr key={i} className="border-b" style={{ borderColor: "var(--vibes-border-primary)" }}>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  disabled={savingIndex !== null}
                  onClick={() => toggleGrant(i)}
                  title={`Click to ${g.grant === "allow" ? "deny" : "allow"}`}
                  className={`inline-block rounded px-2 py-0.5 text-xs font-bold transition-opacity cursor-pointer hover:opacity-70 disabled:cursor-wait disabled:opacity-50 ${
                    g.grant === "allow"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }`}
                >
                  {savingIndex === i ? "…" : g.grant}
                </button>
              </td>
              <td className="py-2 pr-4 font-mono">
                <Link to={`/chat/${g.userSlug}/${g.appSlug}`} className="hover:underline">
                  {g.userSlug}/{g.appSlug}
                </Link>
              </td>
              <td className="py-2 font-mono">{g.dbName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function ApplicationChatsSection() {
  const { vibeDiyApi } = useVibeDiy();
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
        console.error("openChat error", rChat.Err(), chatId);
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
    void vibeDiyApi
      .listApplicationChats({})
      .then((res) => {
        if (res.isErr()) {
          setError(String(res.Err()));
          return;
        }
        setChats(res.Ok().items);
        setNextCursor(res.Ok().nextCursor);
      })
      .finally(() => setLoading(false));
  }, [vibeDiyApi]);

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
        setChats(res.Ok().items);
        setNextCursor(res.Ok().nextCursor);
      })
      .finally(() => setLoading(false));
  };

  if (loading && chats.length === 0) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>Loading...</p>;
  }
  if (error) {
    return <p className="text-red-600 font-medium text-sm">{error}</p>;
  }
  if (chats.length === 0) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>No application chats yet.</p>;
  }

  // group by userSlug → appSlug, preserving insertion order (already newest-first)
  const groups = new Map<string, Map<string, ChatItem[]>>();
  for (const c of chats) {
    if (!groups.has(c.userSlug)) groups.set(c.userSlug, new Map());
    const apps = groups.get(c.userSlug) ?? new Map<string, ChatItem[]>();
    if (!apps.has(c.appSlug)) apps.set(c.appSlug, []);
    const items = apps.get(c.appSlug) ?? [];
    items.push(c);
    apps.set(c.appSlug, items);
    groups.set(c.userSlug, apps);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([userSlug, apps]) => (
        <div key={userSlug}>
          <h4 className="mb-3 text-base font-bold">{userSlug}</h4>
          <div className="grid gap-2">
            {[...apps.entries()].map(([appSlug, items]) => (
              <div key={appSlug} className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                <div className="px-4 py-2 font-medium text-sm border-b border-gray-200 dark:border-gray-600">
                  <Link to={`/chat/${userSlug}/${appSlug}`} className="hover:underline text-gray-800 dark:text-gray-200">
                    {appSlug}
                  </Link>
                </div>
                <div className="px-4 py-2 pb-3 space-y-1">
                  {items.map((c) => (
                    <div key={c.chatId}>
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => selectChat(c.chatId)}
                          className={`font-mono text-left hover:underline cursor-pointer ${selectedChatId === c.chatId ? "text-blue-600 dark:text-blue-400" : ""}`}
                          style={selectedChatId === c.chatId ? {} : { color: "var(--vibes-text-primary)" }}
                        >
                          {c.chatId}
                        </button>
                        <span style={{ color: "var(--vibes-text-secondary)" }}>
                          {new Date(c.created).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {selectedChatId === c.chatId && (
                        <div
                          className="mt-1 ml-2 pl-2 border-l-2 border-gray-300 dark:border-gray-600 text-xs space-y-2"
                          style={{ background: "var(--vibes-bg-secondary)" }}
                        >
                          {detailLoading ? (
                            <span style={{ color: "var(--vibes-text-secondary)" }}>Loading...</span>
                          ) : chatDetail ? (
                            <>
                              <div className="pt-1">
                                <div className="font-semibold mb-0.5" style={{ color: "var(--vibes-text-secondary)" }}>
                                  User prompt
                                </div>
                                <div className="whitespace-pre-wrap" style={{ color: "var(--vibes-text-primary)" }}>
                                  {chatDetail.userPrompt}
                                </div>
                              </div>
                              <div className="pb-1">
                                <div className="font-semibold mb-0.5" style={{ color: "var(--vibes-text-secondary)" }}>
                                  Code
                                </div>
                                <pre
                                  className="overflow-x-auto max-h-48 overflow-y-auto text-xs"
                                  style={{ color: "var(--vibes-text-primary)" }}
                                >
                                  {chatDetail.code}
                                </pre>
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {(nextCursor || loading) && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="rounded border-2 px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-wait self-center"
          style={{
            borderColor: "var(--vibes-border-primary)",
            background: "var(--vibes-bg-secondary)",
            color: "var(--vibes-text-primary)",
          }}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function SettingsContent() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <BrutalistLayout title="Settings" subtitle="Manage your account and data sharing">
      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Application Chats</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Browse chat history for your apps
        </p>
        <ApplicationChatsSection />
      </BrutalistCard>

      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Data Sharing Grants</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Apps that have been allowed or denied access to share your data
        </p>
        <GrantsList />
      </BrutalistCard>

      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Account</h3>
        <div className="flex items-center justify-between">
          <p style={{ color: "var(--vibes-text-secondary)" }}>
            Sign out from your account. Your vibes will still be in browser storage.
          </p>
          <VibesButton variant="red" onClick={handleLogout}>
            Logout
          </VibesButton>
        </div>
      </BrutalistCard>
    </BrutalistLayout>
  );
}

export default function Settings() {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <SettingsContent />;
}
