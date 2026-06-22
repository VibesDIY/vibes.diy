import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function FilterBar() {
  const c = {
    section: "px-[var(--spacing)] py-3 border-b-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10",
    label: "text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 font-[var(--font-family)]",
    chips: "flex gap-2 overflow-x-auto pb-1",
    chip: "shrink-0 px-3 py-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-sm text-[var(--text-primary)] bg-[var(--background)] min-h-[44px]",
  }
  return (
    <section id="filters" className={c.section}>
      <div className={c.label}>Browse by topic</div>
      <div className={c.chips}>
        <button className={c.chip}>All</button>
        <button className={c.chip}>General</button>
        <button className={c.chip}>News</button>
        <button className={c.chip}>Help</button>
      </div>
    </section>
  )
}

function Composer() {
  const { database } = useFireproof("forum")
  const { can, me, ready } = useVibe("forum")
  const [body, setBody] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  const verdict = can.create({ type: "post", authorHandle: me?.userHandle })

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setIsLoading(true)
    try {
      let category = "General", civility = 7
      try {
        const res = await callAI(
          `Categorize and score this forum post. Civility is 1-10 (10 = very civil).\n\nPost: ${body}`,
          { schema: { properties: {
            category: { type: "string", description: "Topic category like General, News, Help, Tech, Politics" },
            civility: { type: "number", description: "1-10 score" },
          } } }
        )
        const parsed = JSON.parse(res)
        category = parsed.category || category
        civility = parsed.civility ?? civility
      } catch {}
      await database.put({
        type: "post",
        body: body.trim(),
        authorHandle: me?.userHandle,
        category,
        civility,
        createdAt: Date.now(),
      })
      setBody("")
    } catch (err) {
      alert("Post failed: " + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const c = {
    section: "px-[var(--spacing)] py-4 border-b-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)]",
    label: "text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 font-[var(--font-family)]",
    input: "w-full p-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[88px] font-[var(--font-family)]",
    btn: "mt-2 w-full px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text)] min-h-[44px] font-[var(--font-family)] flex items-center justify-center gap-2 disabled:opacity-50",
    muted: "text-sm text-[var(--text-secondary)] italic font-[var(--font-family)]",
  }

  if (!ready) return <section className={c.section}><p className={c.muted}>Loading…</p></section>
  if (!verdict.ok) return (
    <section id="composer" className={c.section}>
      <div className={c.label}>Start a discussion</div>
      <p className={c.muted}>{verdict.reason}</p>
    </section>
  )

  return (
    <section id="composer" className={c.section}>
      <div className={c.label}>Start a discussion</div>
      <form onSubmit={submit}>
        <textarea
          className={c.input}
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isLoading}
        />
        <button className={c.btn} type="submit" disabled={isLoading || !body.trim()}>
          {isLoading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
          )}
          {isLoading ? "Tagging & posting…" : "Post"}
        </button>
      </form>
    </section>
  )
}

function PostCard({ post, pinned, replies, canEdit, canPin, onPin, onUnpin, onDelete, pinId }) {
  const { ViewerTag } = useViewer()
  const c = {
    card: "mb-4 p-3 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)]",
    pinned: "border-[var(--warning)]",
    head: "flex items-center justify-between gap-2 mb-2",
    body: "text-[var(--text-primary)] mb-2 whitespace-pre-wrap",
    tags: "flex gap-2 flex-wrap text-xs text-[var(--text-secondary)] mb-2",
    tag: "px-2 py-1 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)]",
    actions: "flex gap-2 flex-wrap",
    btn: "px-3 py-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-sm text-[var(--text-primary)] min-h-[36px]",
    pinBadge: "text-xs uppercase tracking-wider text-[var(--warning)] font-bold",
    replies: "mt-3 pl-3 border-l-[length:var(--border-width)] border-[var(--border)]",
    reply: "py-2 text-sm",
  }
  return (
    <article className={`${c.card} ${pinned ? c.pinned : ""}`}>
      <div className={c.head}>
        <ViewerTag userHandle={post.authorHandle} />
        {pinned && <span className={c.pinBadge}>📌 Pinned</span>}
      </div>
      <div className={c.body}>{post.body}</div>
      {(post.category || post.civility != null) && (
        <div className={c.tags}>
          {post.category && <span className={c.tag}>{post.category}</span>}
          {post.civility != null && <span className={c.tag}>civility {post.civility}/10</span>}
        </div>
      )}
      <div className={c.actions}>
        {canPin && !pinned && <button className={c.btn} onClick={() => onPin(post._id)}>Pin</button>}
        {canPin && pinned && <button className={c.btn} onClick={() => onUnpin(pinId)}>Unpin</button>}
        {canEdit && <button className={c.btn} onClick={() => onDelete(post._id)}>Remove</button>}
      </div>
      {replies.length > 0 && (
        <div className={c.replies}>
          {replies.map(r => (
            <div key={r._id} className={c.reply}>
              <ViewerTag userHandle={r.authorHandle} />
              <div>{r.body}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function Feed() {
  const { useLiveQuery, database } = useFireproof("forum")
  const { can } = useVibe("forum")
  const { docs: posts } = useLiveQuery("type", { key: "post" })
  const { docs: replies } = useLiveQuery("type", { key: "reply" })
  const { docs: pins } = useLiveQuery("type", { key: "pin" })

  const pinMap = new Map(pins.map(p => [p.postId, p._id]))
  const sorted = [...posts].sort((a, b) => {
    const ap = pinMap.has(a._id) ? 1 : 0
    const bp = pinMap.has(b._id) ? 1 : 0
    if (ap !== bp) return bp - ap
    return (b.createdAt || 0) - (a.createdAt || 0)
  })

  const pin = async (postId) => {
    try { await database.put({ type: "pin", postId, createdAt: Date.now() }) }
    catch (e) { alert("Pin failed: " + e.message) }
  }
  const unpin = async (pinId) => {
    try { await database.del(pinId) } catch (e) { alert("Unpin failed: " + e.message) }
  }
  const remove = async (id) => {
    try { await database.del(id) } catch (e) { alert("Remove failed: " + e.message) }
  }

  const c = {
    section: "px-[var(--spacing)] py-4",
    heading: "text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-3 font-[var(--font-family)]",
    empty: "text-sm text-[var(--text-secondary)] italic font-[var(--font-family)] py-8 text-center",
  }
  return (
    <section id="feed" className={c.section}>
      <h2 className={c.heading}>Discussions</h2>
      {sorted.length === 0 && <p className={c.empty}>No posts yet — be the first to start a discussion.</p>}
      {sorted.map(post => (
        <PostCard
          key={post._id}
          post={post}
          pinned={pinMap.has(post._id)}
          pinId={pinMap.get(post._id)}
          replies={replies.filter(r => r.postId === post._id)}
          canEdit={can.delete(post).ok}
          canPin={can.create({ type: "pin", postId: post._id }).ok}
          onPin={pin}
          onUnpin={unpin}
          onDelete={remove}
        />
      ))}
    </section>
  )
}

function ModPanel() {
  const { useLiveQuery, database } = useFireproof("forum")
  const { can, ready } = useVibe("forum")
  const { ViewerTag } = useViewer()
  const { docs: mods } = useLiveQuery("type", { key: "moderator" })
  const [handle, setHandle] = React.useState("")

  const canAppoint = can.create({ type: "moderator", userHandle: "anyone" })

  const appoint = async (e) => {
    e.preventDefault()
    if (!handle.trim()) return
    try {
      await database.put({ type: "moderator", userHandle: handle.trim(), createdAt: Date.now() })
      setHandle("")
    } catch (err) { alert("Appoint failed: " + err.message) }
  }

  const revoke = async (id) => {
    try { await database.del(id) } catch (e) { alert("Revoke failed: " + e.message) }
  }

  const c = {
    section: "px-[var(--spacing)] py-4 border-t-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)]",
    heading: "text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 font-[var(--font-family)]",
    muted: "text-sm text-[var(--text-secondary)] italic font-[var(--font-family)]",
    input: "w-full p-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]",
    btn: "mt-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text)] min-h-[44px]",
    row: "flex items-center justify-between py-2 border-b-[length:var(--border-width)] border-[var(--border)]",
    revoke: "px-3 py-1 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-sm",
  }

  if (!ready) return null

  return (
    <section id="mod-panel" className={c.section}>
      <h2 className={c.heading}>Moderator Roster ({mods.length})</h2>
      {mods.length === 0 && <p className={c.muted}>No moderators yet.</p>}
      {mods.map(m => (
        <div key={m._id} className={c.row}>
          <ViewerTag userHandle={m.userHandle} />
          {canAppoint.ok && <button className={c.revoke} onClick={() => revoke(m._id)}>Revoke</button>}
        </div>
      ))}
      {canAppoint.ok ? (
        <form onSubmit={appoint} style={{ marginTop: 12 }}>
          <input
            className={c.input}
            placeholder="User handle to appoint"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <button className={c.btn} type="submit">Appoint moderator</button>
        </form>
      ) : (
        <p className={c.muted} style={{ marginTop: 8 }}>Owner-only.</p>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready } = useVibe("forum")

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "px-[var(--spacing)] py-4 border-b-[length:var(--border-width)] border-[var(--border)] flex items-center justify-between bg-[var(--surface)]",
    title: "text-xl font-bold tracking-tight text-[var(--text-primary)]",
    subtitle: "text-xs text-[var(--text-secondary)] uppercase tracking-wider",
  }

  return (
    <div className={c.page}>
      <style>{`
:root {
  --background: #fff;
  --accent: #666;
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.14);
  --surface: rgba(255, 255, 255, 0.85);
  --primary: #666;
  --secondary: #666;
  --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
  --warning: #f59e0b;
  --success: #22c55e;
  --error: #ef4444;
  --neutral: #6b7280;
  --accent-text: #fafafa;
  --font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --font-size-base: 1rem;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --accent: #999999;
    --border: rgba(255, 255, 255, 0.18);
    --background: #0f0f0f;
    --text-primary: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --surface: rgba(255, 255, 255, 0.04);
    --primary: #999999;
    --secondary: #999999;
    --accent-text: #0a0a0a;
  }
}
      `}</style>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Town Square</h1>
          <div className={c.subtitle}>Community Discussion</div>
        </div>
        <ViewerTag />
      </header>
      <main id="app">
        <FilterBar />
        <Composer />
        <Feed />
        <ModPanel />
      </main>
    </div>
  )
}