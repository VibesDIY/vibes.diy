import React, { useState, useRef, useEffect, Fragment } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer, useVibe } from "use-vibes";

const DB = "teamChannels";
const URL_RE = /(https?:\/\/[^\s]+)/g;

function LinkedText({ text }) {
  const parts = text.split(URL_RE);
  return (
    <span>
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[oklch(0.79_0.18_75)] underline break-all"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}

function ChannelPreview({ channel, onPick }) {
  const { useLiveQuery } = useFireproof(DB);
  const { docs } = useLiveQuery((d) => (d.type === "message" ? [d.channelId, d.timestamp] : undefined), {
    prefix: [channel._id],
    descending: true,
    limit: 5,
  });
  const last = docs[0];
  const avatars = [
    ...new Map(docs.filter((m) => m.authorAvatarUrl).map((m) => [m.authorHandle, m.authorAvatarUrl])).values(),
  ].slice(0, 4);

  return (
    <button
      onClick={() => onPick(channel._id)}
      className="w-full text-left px-5 py-4 border-b border-[oklch(0.31_0.005_285)] hover:bg-[oklch(0.28_0.005_285)] flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[oklch(1_0_0)]"># {channel.name}</span>
        <div className="flex items-center gap-1">
          {avatars.map((url) => (
            <img key={url} src={url} alt="" className="w-6 h-6 rounded-full ring-1 ring-[oklch(0.31_0.005_285)]" />
          ))}
          {last?.timestamp && (
            <span className="text-xs text-[oklch(0.55_0.02_261)] ml-2">
              {new Date(last.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
      {last ? (
        <p className="text-sm text-[oklch(0.71_0.02_261)] truncate">
          <span className="text-[oklch(0.87_0.01_258)]">{last.authorDisplayName || last.authorHandle || "someone"}: </span>
          {last._files?.image ? "📷 image" : last.text}
        </p>
      ) : (
        <p className="text-sm text-[oklch(0.55_0.02_261)] italic">No messages yet</p>
      )}
    </button>
  );
}

function ChannelHome({ channels, onPick }) {
  if (channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[oklch(0.55_0.02_261)] text-sm italic">
        No channels yet — the owner can add one in the sidebar.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      {channels.map((ch) => (
        <ChannelPreview key={ch._id} channel={ch} onPick={onPick} />
      ))}
    </div>
  );
}

function ChannelView({ channel, viewer }) {
  const { useLiveQuery, database } = useFireproof(DB);
  const { can, ready, me } = useVibe(DB);
  const { docs: messages } = useLiveQuery((d) => (d.type === "message" ? [d.channelId, d.timestamp] : undefined), {
    prefix: [channel._id],
    descending: false,
    limit: 200,
  });
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const fileRef = useRef(null);
  const prevCountRef = useRef(messages.length);
  const bottomRef = useRef(null);

  // useVibe().can previews the access function — the same gate the server runs.
  const writeVerdict = ready ? can.create({ type: "message", channelId: channel._id, authorHandle: me?.userHandle }) : null;

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Browser notifications for new messages while tab is hidden
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const last = messages[messages.length - 1];
      if (document.hidden && Notification.permission === "granted" && last?.authorHandle !== viewer?.userHandle) {
        new Notification(`#${channel.name}`, {
          body: `${last.authorDisplayName || "someone"}: ${last._files?.image ? "📷 sent an image" : last.text}`,
          icon: last.authorAvatarUrl || undefined,
        });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || !me) return;
    const entry = {
      type: "message",
      channelId: channel._id,
      text: trimmed || "",
      timestamp: Date.now(),
      authorHandle: me.userHandle,
      authorDisplayName: viewer?.displayName || me.userHandle,
      authorAvatarUrl: viewer?.avatarUrl,
    };
    if (pendingImage) entry._files = { image: pendingImage };
    setText("");
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = "";
    await database.put(entry);
  }

  async function remove(doc) {
    await database.del(doc._id);
  }

  return (
    <>
      <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 ? (
          <li className="text-sm text-[oklch(0.71_0.02_261)] italic">No messages yet. Be the first.</li>
        ) : (
          messages.map((m) => (
            <li key={m._id} className="text-sm text-[oklch(0.87_0.01_258)] flex gap-3 group">
              {m.authorAvatarUrl && <img src={m.authorAvatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />}
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-[oklch(1_0_0)]">{m.authorDisplayName || m.authorHandle || "anonymous"}</span>
                <span className="ml-2 text-xs text-[oklch(0.71_0.02_261)]">
                  {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ""}
                </span>
                {m._files?.image?.url && (
                  <div className="mt-1 max-w-xs">
                    <img src={m._files.image.url} alt="uploaded image" className="rounded max-h-48 object-contain" />
                  </div>
                )}
                {m.text && (
                  <p className="whitespace-pre-wrap break-words">
                    <LinkedText text={m.text} />
                  </p>
                )}
              </div>
              {ready && can.delete(m).ok && (
                <button
                  onClick={() => remove(m)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-[oklch(0.71_0.02_261)] hover:text-[oklch(0.7_0.18_25)] shrink-0"
                >
                  delete
                </button>
              )}
            </li>
          ))
        )}
        <li ref={bottomRef} />
      </ul>
      {!ready ? (
        <div className="px-6 py-4 border-t border-[oklch(0.31_0.005_285)] text-sm text-[oklch(0.71_0.02_261)] italic">Loading…</div>
      ) : !writeVerdict.ok ? (
        <div className="px-6 py-4 border-t border-[oklch(0.31_0.005_285)] text-sm text-[oklch(0.71_0.02_261)] italic">
          {writeVerdict.reason || "Read-only — contact the owner for write access."}
        </div>
      ) : (
        <div className="border-t border-[oklch(0.31_0.005_285)]">
          {pendingImage && (
            <div className="px-6 pt-3 flex items-center gap-2">
              <img src={URL.createObjectURL(pendingImage)} alt="preview" className="h-16 rounded object-cover" />
              <button
                onClick={() => {
                  setPendingImage(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs text-[oklch(0.71_0.02_261)] hover:text-[oklch(1_0_0)]"
              >
                ✕ remove
              </button>
            </div>
          )}
          <div className="px-6 pt-2 text-xs text-[oklch(0.71_0.02_261)]">
            Posting as <span className="text-[oklch(0.79_0.18_75)] font-medium">{viewer?.displayName || me?.userHandle}</span>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-3 flex gap-2 pr-20">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-2 rounded bg-[oklch(0.22_0.005_285)] border border-[oklch(0.31_0.005_285)] text-lg min-h-[44px] shrink-0"
            >
              📷
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPendingImage(e.target.files?.[0] || null)}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-[oklch(0.18_0.005_285)] border border-[oklch(0.31_0.005_285)] text-[oklch(1_0_0)] min-h-[44px]"
              placeholder={`Message #${channel.name}`}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[oklch(0.79_0.18_75)] text-[oklch(0.18_0.005_285)] font-semibold min-h-[44px]"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function ChannelList({ channels, active, onPick, c }) {
  if (channels.length === 0) {
    return <div className="px-4 py-2 text-xs text-[oklch(0.71_0.02_261)] italic">No channels yet.</div>;
  }
  return channels.map((ch) => (
    <button key={ch._id} onClick={() => onPick(ch._id)} className={active === ch._id ? c.channelBtnActive : c.channelBtn}>
      # {ch.name}
    </button>
  ));
}

function AddChannelForm() {
  const { database } = useFireproof(DB);
  const { can, ready, me } = useVibe(DB);
  const [name, setName] = useState("");

  // Channel creation is owner-only — encoded in access.js and previewed here.
  const verdict = ready ? can.create({ type: "channel", createdBy: me?.userHandle }) : null;
  if (!ready || !verdict.ok) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) return;
    setName("");
    await database.put({ _id: "ch:" + slug, type: "channel", name: slug, createdBy: me?.userHandle, createdAt: Date.now() });
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 flex gap-1 border-t border-[oklch(0.25_0.005_285)]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="new-channel"
        className="flex-1 px-2 py-1 text-xs rounded bg-[oklch(0.22_0.005_285)] border border-[oklch(0.31_0.005_285)] text-[oklch(1_0_0)] min-w-0"
      />
      <button
        type="submit"
        className="px-2 py-1 text-xs rounded bg-[oklch(0.79_0.18_75)] text-[oklch(0.15_0.005_285)] font-semibold shrink-0"
      >
        +
      </button>
    </form>
  );
}

export default function App() {
  const { viewer } = useViewer();
  const { useLiveQuery } = useFireproof(DB);
  const { docs: channels } = useLiveQuery("type", { key: "channel" });
  const [activeId, setActiveId] = useState(null);
  const activeChannel = channels.find((ch) => ch._id === activeId) || null;

  // Request notification permission once viewer is known
  useEffect(() => {
    if (viewer && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [!!viewer]);

  const c = {
    page: "min-h-screen flex bg-[oklch(0.18_0.005_285)] text-[oklch(1_0_0)] font-sans",
    sidebar: "w-64 shrink-0 bg-[oklch(0.15_0.005_285)] border-r border-[oklch(0.31_0.005_285)] flex flex-col",
    sidebarHeader: "px-4 py-4 border-b border-[oklch(0.31_0.005_285)]",
    title: "text-lg font-bold text-[oklch(0.79_0.18_75)] cursor-pointer",
    channelList: "flex-1 overflow-y-auto py-2",
    channelBtn: "w-full text-left px-4 py-2 text-sm text-[oklch(0.87_0.01_258)] hover:bg-[oklch(0.25_0.005_285)] min-h-[44px]",
    channelBtnActive:
      "w-full text-left px-4 py-2 text-sm bg-[oklch(0.25_0.005_285)] text-[oklch(0.79_0.18_75)] min-h-[44px] font-medium",
    viewerBar: "px-4 py-3 border-t border-[oklch(0.31_0.005_285)] text-xs text-[oklch(0.71_0.02_261)] flex items-center gap-2",
    main: "flex-1 flex flex-col bg-[oklch(0.25_0.005_285)] min-w-0",
    header: "px-6 py-4 border-b border-[oklch(0.31_0.005_285)] bg-[oklch(0.22_0.005_285)]",
    headerTitle: "text-base font-semibold text-[oklch(1_0_0)]",
    section: "flex-1 flex flex-col overflow-hidden",
  };

  return (
    <div className={c.page}>
      <aside className={c.sidebar} id="sidebar">
        <div className={c.sidebarHeader}>
          <h1 className={c.title} onClick={() => setActiveId(null)}>
            Team Channels
          </h1>
        </div>
        <section id="channel-list" className={c.channelList}>
          <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-[oklch(0.71_0.02_261)]">Channels</div>
          <ChannelList channels={channels} active={activeId} onPick={setActiveId} c={c} />
          <AddChannelForm />
        </section>
        {viewer && (
          <div className={c.viewerBar}>
            <img src={viewer.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
            <span>{viewer.displayName || viewer.userHandle}</span>
          </div>
        )}
      </aside>
      <main className={c.main} id="app">
        <header className={c.header} id="app-header">
          <h2 className={c.headerTitle}>{activeChannel ? `# ${activeChannel.name}` : "Team Channels"}</h2>
        </header>
        <section id="channel-view" className={c.section}>
          {!activeChannel ? (
            <ChannelHome channels={channels} onPick={setActiveId} />
          ) : (
            <ChannelView key={activeChannel._id} channel={activeChannel} viewer={viewer} />
          )}
        </section>
      </main>
    </div>
  );
}
