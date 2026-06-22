import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function ChannelList({ activeId, setActiveId, channels }) {
  return (
    <section id="channels" className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="px-[var(--spacing)] py-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2 font-[var(--font-family-mono)]">Channels</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" id="channel-strip">
          {channels.length === 0 && (
            <span className="text-[var(--text-secondary)] text-sm italic py-2">No channels yet</span>
          )}
          {channels.map((ch) => {
            const active = ch._id === activeId
            return (
              <button
                key={ch._id}
                onClick={() => setActiveId(ch._id)}
                className={`min-h-[44px] px-4 rounded-[var(--radius)] border-[length:var(--border-width)] whitespace-nowrap text-sm font-medium transition ${
                  active
                    ? "bg-[var(--primary)] text-[#0a0a0a] border-[var(--primary)]"
                    : "bg-transparent text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface)]"
                }`}
              >
                #{ch.name}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ChannelCreate({ database, can, ready }) {
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const verdict = ready ? can.create({ type: "channel", createdBy: "owner-check" }) : { ok: false, reason: "" }

  if (!ready) return null
  if (!verdict.ok) {
    return verdict.reason ? (
      <section id="channel-create" className="px-[var(--spacing)] py-2 border-b border-[var(--border)]">
        <p className="text-[var(--text-secondary)] text-xs italic">{verdict.reason}</p>
      </section>
    ) : null
  }

  async function create(e) {
    e.preventDefault()
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-")
    if (!trimmed) return
    setSaving(true)
    try {
      await database.put({
        _id: "ch:" + trimmed,
        type: "channel",
        name: trimmed,
        createdAt: Date.now(),
      })
      setName("")
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="channel-create" className="px-[var(--spacing)] py-3 border-b border-[var(--border)]">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-[var(--font-family-mono)] mb-2">New channel</h2>
      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="general"
          className="flex-1 min-h-[44px] px-3 rounded-[var(--radius)] bg-transparent border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="min-h-[44px] px-4 rounded-[var(--radius)] bg-[var(--primary)] text-[#0a0a0a] font-medium disabled:opacity-40"
        >
          {saving ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          ) : "Add"}
        </button>
      </form>
    </section>
  )
}

function MessageFeed({ activeId, database, useLiveQuery }) {
  const { ViewerTag } = useViewer()
  const { can } = useVibe("signalBoard")
  const { docs: messages } = useLiveQuery(
    (doc) => doc.type === "message" ? [doc.channelId, doc.createdAt] : undefined,
    activeId ? { prefix: [activeId] } : { limit: 0 }
  )
  const [pending, setPending] = React.useState(() => new Set())

  async function remove(doc) {
    setPending((s) => new Set(s).add(doc._id))
    try {
      await database.del(doc._id)
    } catch (err) {
      console.error(err)
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(doc._id); return n })
    }
  }

  if (!activeId) {
    return (
      <section id="messages" className="flex-1 overflow-y-auto px-[var(--spacing)] py-12">
        <div className="text-[var(--text-secondary)] text-center text-sm">Pick a channel to view its feed.</div>
      </section>
    )
  }

  return (
    <section id="messages" className="flex-1 overflow-y-auto px-[var(--spacing)] py-4 space-y-3">
      <h2 className="sr-only">Messages</h2>
      {messages.length === 0 && (
        <div className="text-[var(--text-secondary)] text-center py-12 text-sm">No messages yet. Start the thread.</div>
      )}
      {messages.map((m) => {
        const saving = pending.has(m._id)
        const canDelete = can.delete(m).ok
        return (
          <article
            key={m._id}
            className={`rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-3 transition ${saving ? "opacity-50" : ""}`}
          >
            <header className="flex items-center justify-between mb-2 gap-2">
              <ViewerTag userHandle={m.authorHandle} />
              <time className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-[var(--font-family-mono)]">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
            </header>
            <p className="text-[var(--text-primary)] text-[15px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
            {(m.tags?.length > 0 || m.urgency) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {m.urgency && (
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] font-[var(--font-family-mono)] ${
                    m.urgency === "high" ? "bg-[var(--error)] text-white" :
                    m.urgency === "medium" ? "bg-[var(--warning)] text-black" :
                    "bg-[var(--neutral)] text-white"
                  }`}>{m.urgency}</span>
                )}
                {m.tags?.map((t) => (
                  <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] bg-transparent border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-secondary)] font-[var(--font-family-mono)]">#{t}</span>
                ))}
              </div>
            )}
            {canDelete && (
              <button
                onClick={() => remove(m)}
                disabled={saving}
                className="mt-2 text-[11px] text-[var(--text-secondary)] hover:text-[var(--error)] transition"
              >
                {saving ? "Saving…" : "Delete"}
              </button>
            )}
          </article>
        )
      })}
    </section>
  )
}

function Composer({ activeId, database, can, ready, me }) {
  const [body, setBody] = React.useState("")
  const [posting, setPosting] = React.useState(false)

  if (!ready || !activeId) return null
  const verdict = can.create({ type: "message", channelId: activeId, authorHandle: me?.userHandle })
  if (!verdict.ok) {
    return (
      <section id="composer" className="border-t border-[var(--border)] bg-[var(--surface)] px-[var(--spacing)] py-3 sticky bottom-0">
        <p className="text-[var(--text-secondary)] text-xs italic text-center">{verdict.reason}</p>
      </section>
    )
  }

  async function post(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setPosting(true)
    const docId = crypto.randomUUID()
    const base = {
      _id: docId,
      type: "message",
      channelId: activeId,
      body: text,
      authorHandle: me?.userHandle,
      createdAt: Date.now(),
      tags: [],
      urgency: null,
    }
    try {
      await database.put(base)
      setBody("")
      // tag in background
      const prompt = `Tag this team message with 2-3 short lowercase topic tags (single words, no #) and an urgency level (low, medium, or high). Message: "${text}"`
      const raw = await callAI(prompt, {
        schema: {
          properties: {
            tags: { type: "array", items: { type: "string" }, description: "2-3 short lowercase topic tags" },
            urgency: { type: "string", description: "low, medium, or high" },
          },
        },
      })
      const parsed = JSON.parse(raw)
      const current = await database.get(docId)
      await database.put({ ...current, tags: parsed.tags || [], urgency: parsed.urgency || "low" })
    } catch (err) {
      console.error(err)
    } finally {
      setPosting(false)
    }
  }

  async function suggest() {
    setPosting(true)
    try {
      const raw = await callAI(
        "Suggest one short, realistic team message (1-2 sentences) someone might post in a workplace channel. Vary topics: status updates, questions, announcements.",
        { schema: { properties: { message: { type: "string" } } } }
      )
      const parsed = JSON.parse(raw)
      setBody(parsed.message || "")
    } catch (err) {
      console.error(err)
    } finally {
      setPosting(false)
    }
  }

  return (
    <section id="composer" className="border-t border-[var(--border)] bg-[var(--surface)] px-[var(--spacing)] py-3 sticky bottom-0">
      <h2 className="sr-only">Compose</h2>
      <form onSubmit={post} className="flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post to this channel…"
          rows={2}
          className="flex-1 min-h-[44px] px-3 py-2 rounded-[var(--radius)] bg-transparent border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)] resize-none"
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={suggest}
            disabled={posting}
            title="AI suggestion"
            className="min-h-[44px] px-3 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-secondary)] text-xs hover:bg-[var(--surface)] disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
          </button>
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="min-h-[44px] px-4 rounded-[var(--radius)] bg-[var(--primary)] text-[#0a0a0a] font-medium disabled:opacity-40 flex items-center justify-center"
          >
            {posting ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
            ) : "Post"}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("signalBoard")
  const { can, ready, me } = useVibe("signalBoard")
  const { docs: channels } = useLiveQuery("type", { key: "channel" })
  const [activeId, setActiveId] = React.useState(null)

  React.useEffect(() => {
    if (!activeId && channels.length > 0) setActiveId(channels[0]._id)
  }, [activeId, channels])

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)] flex flex-col",
    header: "px-[var(--spacing)] py-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between sticky top-0 z-10 backdrop-blur",
    brand: "text-lg font-semibold tracking-tight",
    sub: "text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)] font-[var(--font-family-mono)]",
  }

  return (
    <>
      <style>{`
:root {
  --background: #030303;
  --surface: rgba(255, 255, 255, 0.04);
  --accent: #ffffff;
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --border: rgba(255, 255, 255, 0.18);
  --primary: #ffffff;
  --secondary: #ffffff;
  --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
  --warning: #f59e0b;
  --success: #22c55e;
  --error: #ef4444;
  --neutral: #6b7280;
  --font-family: 'Inter', sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --font-size-base: 1rem;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=optional');
      `}</style>
      <main id="app" className={c.page}>
        <header id="app-header" className={c.header}>
          <div>
            <div className={c.brand}>Signal Board</div>
            <div className={c.sub}>Team channels</div>
          </div>
          <ViewerTag />
        </header>
        <ChannelList activeId={activeId} setActiveId={setActiveId} channels={channels} />
        <ChannelCreate database={database} can={can} ready={ready} />
        <MessageFeed activeId={activeId} database={database} useLiveQuery={useLiveQuery} />
        <Composer activeId={activeId} database={database} can={can} ready={ready} me={me} />
      </main>
    </>
  )
}