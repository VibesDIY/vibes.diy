import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const c = {
  page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
  header: "sticky top-0 z-10 backdrop-blur bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between",
  title: "text-lg font-semibold tracking-tight",
  drawer: "border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto",
  drawerRow: "flex gap-2 px-4 py-3 min-w-max",
  chip: "px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] text-sm whitespace-nowrap min-h-[44px] flex items-center",
  chipActive: "bg-[var(--primary)] text-[color:var(--accent-text,#0a0a0a)] border-transparent",
  main: "max-w-2xl mx-auto px-4 py-4 pb-32",
  section: "mb-6",
  sectionTitle: "text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2",
  msgList: "flex flex-col gap-3",
  msg: "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3",
  msgHead: "flex items-center justify-between gap-2 mb-1 text-xs text-[var(--text-secondary)]",
  msgBody: "text-sm leading-relaxed",
  tagRow: "flex flex-wrap gap-1.5 mt-2",
  tag: "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)]",
  composer: "fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur px-4 py-3",
  composerInner: "max-w-2xl mx-auto flex gap-2 items-end",
  input: "flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]",
  btn: "px-4 py-3 rounded-[var(--radius)] bg-[var(--primary)] text-[color:var(--accent-text,#0a0a0a)] text-sm font-medium min-h-[44px] disabled:opacity-50",
  ghostBtn: "px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] text-sm min-h-[44px]",
  empty: "text-center text-[var(--text-secondary)] text-sm py-12",
  muted: "text-xs text-[var(--text-secondary)]",
  newChannelForm: "flex gap-2 px-4 pb-3",
}

function ThemeStyles() {
  return (
    <style>{`:root{
      --background:#030303;--surface:rgba(255,255,255,0.04);--accent:#ffffff;
      --text-primary:rgba(255,255,255,0.92);--text-secondary:rgba(255,255,255,0.55);
      --border:rgba(255,255,255,0.18);--primary:#ffffff;--secondary:#ffffff;
      --accent-text:#0a0a0a;
      --warning:#f59e0b;--success:#22c55e;--error:#ef4444;--neutral:#6b7280;
      --font-family:'Inter',sans-serif;--font-family-mono:ui-monospace,'JetBrains Mono',Menlo,monospace;
      --font-size-base:1rem;--radius:0.5rem;--radius-sm:0.25rem;--radius-lg:1rem;
      --spacing:1rem;--border-width:1px;
    }`}</style>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function ChannelDrawer({ channels, activeId, onPick, canCreate, onCreate, messageCounts }) {
  const [name, setName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try { await onCreate(name.trim()) ; setName("") } finally { setCreating(false) }
  }
  return (
    <div className={c.drawer}>
      <div className={c.drawerRow}>
        {channels.length === 0 && <span className={c.muted}>No channels yet</span>}
        {channels.map((ch) => (
          <button
            key={ch._id}
            onClick={() => onPick(ch._id)}
            className={`${c.chip} ${activeId === ch._id ? c.chipActive : ""}`}
          >
            # {ch.name}
            <span className="ml-2 opacity-60">{messageCounts[ch._id] || 0}</span>
          </button>
        ))}
      </div>
      {canCreate && (
        <form onSubmit={submit} className={c.newChannelForm}>
          <input
            className={c.input}
            placeholder="new-channel-name"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
          />
          <button className={c.btn} disabled={creating || !name.trim()}>
            {creating ? <Spinner /> : "Add"}
          </button>
        </form>
      )}
    </div>
  )
}

function MessageFeed({ messages, ViewerTag }) {
  if (messages.length === 0) {
    return <div className={c.empty}>No messages here yet. Be the first to post.</div>
  }
  return (
    <ul className={c.msgList}>
      {messages.map((m) => (
        <li key={m._id} className={c.msg}>
          <div className={c.msgHead}>
            <ViewerTag userHandle={m.authorHandle} />
            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className={c.msgBody}>{m.body}</div>
          {(m.summary || m.sentiment) && (
            <div className={c.tagRow}>
              {m.sentiment && <span className={c.tag}>{m.sentiment}</span>}
              {m.summary && <span className={c.tag}>{m.summary}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function Composer({ canPost, reason, onSend, sending }) {
  const [body, setBody] = React.useState("")
  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    const text = body.trim()
    setBody("")
    await onSend(text)
  }
  if (!canPost) {
    return (
      <div className={c.composer}>
        <div className={c.composerInner}>
          <p className={c.muted}>{reason || "You can't post here."}</p>
        </div>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className={c.composer}>
      <div className={c.composerInner}>
        <input
          className={c.input}
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className={c.btn} disabled={sending || !body.trim()}>
          {sending ? <Spinner /> : "Send"}
        </button>
      </div>
    </form>
  )
}

export default function App() {
  const { database, useLiveQuery, access } = useFireproof("board")
  const { can, ready, me } = useVibe("board")
  const { ViewerTag, viewer, isViewerPending } = useViewer()

  const { docs: channels } = useLiveQuery("type", { key: "channel" })
  const [activeId, setActiveId] = React.useState(null)

  React.useEffect(() => {
    if (!activeId && channels.length > 0) setActiveId(channels[0]._id)
  }, [channels, activeId])

  const { docs: allMessages } = useLiveQuery("type", { key: "message" })
  const messageCounts = React.useMemo(() => {
    const m = {}
    for (const x of allMessages) m[x.channelId] = (m[x.channelId] || 0) + 1
    return m
  }, [allMessages])

  const visibleMessages = React.useMemo(() => {
    return allMessages
      .filter((m) => m.channelId === activeId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [allMessages, activeId])

  const [sending, setSending] = React.useState(false)

  const canCreateChannel = ready && can.create({ type: "channel", name: "x" }).ok
  const postCheck = ready && activeId
    ? can.create({ type: "message", channelId: activeId, authorHandle: me?.userHandle })
    : { ok: false, reason: "Pick a channel" }

  const createChannel = async (name) => {
    const _id = `ch:${name}`
    try {
      await database.put({ _id, type: "channel", name, createdAt: Date.now() })
      setActiveId(_id)
    } catch (err) {
      console.error("channel create failed", err)
    }
  }

  const sendMessage = async (text) => {
    if (!activeId || !me) return
    setSending(true)
    const base = {
      type: "message",
      channelId: activeId,
      body: text,
      authorHandle: me.userHandle,
      createdAt: Date.now(),
    }
    let tags = {}
    try {
      const raw = await callAI(
        `Tag this team chat message. Message: "${text}". Return a one or two word summary and a sentiment (positive, neutral, negative, urgent, question).`,
        { schema: { properties: { summary: { type: "string" }, sentiment: { type: "string" } } } }
      )
      const parsed = JSON.parse(raw)
      tags = { summary: parsed.summary, sentiment: parsed.sentiment }
    } catch (err) {
      console.warn("tagging failed", err)
    }
    try {
      await database.put({ ...base, ...tags })
    } catch (err) {
      console.error("post failed", err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header className={c.header} id="app-header">
        <h1 className={c.title}>Team Channels</h1>
        <ViewerTag />
      </header>

      <ChannelDrawer
        channels={channels}
        activeId={activeId}
        onPick={setActiveId}
        canCreate={canCreateChannel}
        onCreate={createChannel}
        messageCounts={messageCounts}
      />

      <main className={c.main} id="app">
        <section className={c.section} id="feed">
          <h2 className={c.sectionTitle}>
            {activeId ? `# ${channels.find((ch) => ch._id === activeId)?.name || ""}` : "Select a channel"}
          </h2>
          {isViewerPending ? (
            <div className={c.empty}>Loading…</div>
          ) : (
            <MessageFeed messages={visibleMessages} ViewerTag={ViewerTag} />
          )}
        </section>
      </main>

      <Composer
        canPost={postCheck.ok}
        reason={postCheck.reason}
        onSend={sendMessage}
        sending={sending}
      />
    </div>
  )
}