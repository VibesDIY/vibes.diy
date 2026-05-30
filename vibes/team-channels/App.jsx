import React, { useState, useRef, useEffect, Fragment } from "react";
import { useFireproof } from "use-vibes";
import { useViewer } from "use-vibes";

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

function ChannelPreview({ name, onPick }) {
  const { useLiveQuery } = useFireproof(name);
  const { docs } = useLiveQuery("timestamp", { descending: true, limit: 5 });
  const last = docs[0];
  const avatars = [
    ...new Map(docs.filter((m) => m.authorAvatarUrl).map((m) => [m.authorUserSlug, m.authorAvatarUrl])).values(),
  ].slice(0, 4);

  return (
    <button
      onClick={() => onPick(name)}
      className="w-full text-left px-5 py-4 border-b border-[oklch(0.31_0.005_285)] hover:bg-[oklch(0.28_0.005_285)] flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[oklch(1_0_0)]"># {name}</span>
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
          <span className="text-[oklch(0.87_0.01_258)]">{last.authorDisplayName || last.authorUserSlug || "someone"}: </span>
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
        No channels yet — add one in the sidebar.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      {channels.map((ch) => (
        <ChannelPreview key={ch._id} name={ch.name} onPick={onPick} />
      ))}
    </div>
  );
}

function ChannelView({ name, viewer, can }) {
  const { useLiveQuery, useDocument, database } = useFireproof(name);
  const { docs: messages } = useLiveQuery("timestamp", { descending: false, limit: 200 });
  const { doc, merge } = useDocument({ text: "" });
  const [pendingImage, setPendingImage] = useState(null);
  const fileRef = useRef(null);
  const writable = can("write", name);
  const prevCountRef = useRef(messages.length);
  const bottomRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Browser notifications for new messages while tab is hidden
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const last = messages[messages.length - 1];
      if (document.hidden && Notification.permission === "granted" && last?.authorUserSlug !== viewer?.userSlug) {
        new Notification(`#${name}`, {
          body: `${last.authorDisplayName || "someone"}: ${last._files?.image ? "📷 sent an image" : last.text}`,
          icon: last.authorAvatarUrl || undefined,
        });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = doc.text.trim();
    if ((!text && !pendingImage) || !viewer) return;
    const entry = {
      text: text || "",
      timestamp: Date.now(),
      authorUserSlug: viewer.userSlug,
      authorDisplayName: viewer.displayName || viewer.userSlug,
      authorAvatarUrl: viewer.avatarUrl,
    };
    if (pendingImage) entry._files = { image: pendingImage };
    merge({ text: "" });
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = "";
    await database.put(entry);
  }

  return (
    <>
      <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 ? (
          <li className="text-sm text-[oklch(0.71_0.02_261)] italic">No messages yet. Be the first.</li>
        ) : (
          messages.map((m) => (
            <li key={m._id} className="text-sm text-[oklch(0.87_0.01_258)] flex gap-3">
              {m.authorAvatarUrl && <img src={m.authorAvatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />}
              <div className="min-w-0">
                <span className="font-semibold text-[oklch(1_0_0)]">{m.authorDisplayName || m.authorUserSlug || "anonymous"}</span>
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
            </li>
          ))
        )}
        <li ref={bottomRef} />
      </ul>
      {!viewer ? (
        <div className="px-6 py-4 border-t border-[oklch(0.31_0.005_285)] text-sm text-[oklch(0.71_0.02_261)]">
          Sign in to participate.
        </div>
      ) : !writable ? (
        <div className="px-6 py-4 border-t border-[oklch(0.31_0.005_285)] text-sm text-[oklch(0.71_0.02_261)] italic">
          Read-only — contact the owner for write access.
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
            Posting as <span className="text-[oklch(0.79_0.18_75)] font-medium">{viewer.displayName || viewer.userSlug}</span>
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
              value={doc.text}
              onChange={(e) => merge({ text: e.target.value })}
              className="flex-1 px-3 py-2 rounded bg-[oklch(0.18_0.005_285)] border border-[oklch(0.31_0.005_285)] text-[oklch(1_0_0)] min-h-[44px]"
              placeholder={`Message #${name}`}
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

function ChannelList({ active, onPick, can, c }) {
  const { useLiveQuery } = useFireproof("channel-registry");
  const { docs } = useLiveQuery("name");
  const visible = docs.filter((ch) => ch.name && can("read", ch.name));
  if (visible.length === 0) {
    return <div className="px-4 py-2 text-xs text-[oklch(0.71_0.02_261)] italic">No channels yet.</div>;
  }
  return visible.map((ch) => (
    <button key={ch._id} onClick={() => onPick(ch.name)} className={active === ch.name ? c.channelBtnActive : c.channelBtn}>
      # {ch.name}
    </button>
  ));
}

function AddChannelForm() {
  const { useDocument, database } = useFireproof("channel-registry");
  const { doc, merge } = useDocument({ name: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    const name = doc.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    merge({ name: "" });
    await database.put({ name });
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 flex gap-1 border-t border-[oklch(0.25_0.005_285)]">
      <input
        value={doc.name}
        onChange={(e) => merge({ name: e.target.value })}
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
  const { viewer, can } = useViewer();
  const [activeChannel, setActiveChannel] = useState(null);
  const { useLiveQuery } = useFireproof("channel-registry");
  const { docs: allChannels } = useLiveQuery("name");
  const visibleChannels = allChannels.filter((ch) => ch.name && can("read", ch.name));

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
          <h1 className={c.title} onClick={() => setActiveChannel(null)}>
            Team Channels
          </h1>
        </div>
        <section id="channel-list" className={c.channelList}>
          <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-[oklch(0.71_0.02_261)]">Channels</div>
          <ChannelList active={activeChannel} onPick={setActiveChannel} can={can} c={c} />
          {can("write", "channel-registry") && <AddChannelForm />}
        </section>
        {viewer && (
          <div className={c.viewerBar}>
            <img src={viewer.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
            <span>{viewer.displayName || viewer.userSlug}</span>
          </div>
        )}
      </aside>
      <main className={c.main} id="app">
        <header className={c.header} id="app-header">
          <h2 className={c.headerTitle}>{activeChannel ? `# ${activeChannel}` : "Team Channels"}</h2>
        </header>
        <section id="channel-view" className={c.section}>
          {!activeChannel ? (
            <ChannelHome channels={visibleChannels} onPick={setActiveChannel} />
          ) : (
            <ChannelView key={activeChannel} name={activeChannel} viewer={viewer} can={can} />
          )}
        </section>
      </main>
    </div>
  );
}
