import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function NewPostForm({ database, can, me, ready }) {
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState("")

  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4",
    h: "text-lg font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide",
    input: "w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 text-[var(--text-primary)] min-h-[44px] mb-2",
    btn: "w-full bg-[var(--primary)] text-[var(--accent-text)] rounded-[var(--radius-sm)] py-3 min-h-[44px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2",
    muted: "text-sm text-[var(--text-secondary)] italic",
    err: "text-sm text-[var(--error)] mt-2",
  }

  if (!ready) return <section className={c.section}><p className={c.muted}>Loading…</p></section>
  const verdict = can.create({ type: "post", authorHandle: me?.userHandle })
  if (!verdict.ok) return <section className={c.section}><p className={c.muted}>{verdict.reason}</p></section>

  async function submit(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setBusy(true); setErr("")
    let tags = [], tone = "neutral"
    try {
      const resp = await callAI(`Categorize this forum post and rate its tone. Title: "${title}". Body: "${body}".`, {
        schema: { properties: {
          tags: { type: "array", items: { type: "string" }, description: "2-4 short topic tags" },
          tone: { type: "string", description: "one of: friendly, neutral, heated, concerning" },
        } }
      })
      const parsed = JSON.parse(resp)
      tags = parsed.tags || []
      tone = parsed.tone || "neutral"
    } catch (e) { /* AI optional */ }
    try {
      await database.put({
        type: "post", title: title.trim(), body: body.trim(),
        authorHandle: me.userHandle, createdAt: Date.now(), tags, tone,
      })
      setTitle(""); setBody("")
    } catch (e) { setErr("Could not post: " + (e.message || "rejected")) }
    finally { setBusy(false) }
  }

  async function suggest() {
    setBusy(true)
    try {
      const resp = await callAI("Suggest one interesting forum discussion topic with a title and a 2-sentence opening post.", {
        schema: { properties: { title: { type: "string" }, body: { type: "string" } } }
      })
      const p = JSON.parse(resp)
      setTitle(p.title || ""); setBody(p.body || "")
    } catch (e) {} finally { setBusy(false) }
  }

  return (
    <section id="new-post" className={c.section}>
      <h2 className={c.h}>Start a discussion</h2>
      <form onSubmit={submit}>
        <input className={c.input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        <textarea className={c.input} placeholder="What's on your mind?" rows={3} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} />
        <div className="flex gap-2">
          <button type="button" onClick={suggest} disabled={busy} className="px-3 py-3 min-h-[44px] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] text-sm">Suggest</button>
          <button type="submit" disabled={busy} className={c.btn}>
            {busy && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>}
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
        {err && <p className={c.err}>{err}</p>}
      </form>
    </section>
  )
}

function PostList({ posts, database, can, me, isMod }) {
  const [saving, setSaving] = React.useState(new Set())
  const [editingId, setEditingId] = React.useState(null)
  const [editBody, setEditBody] = React.useState("")

  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4",
    h: "text-lg font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide",
    empty: "text-sm text-[var(--text-secondary)] italic py-8 text-center",
    post: "border-t-[length:var(--border-width)] border-[var(--border)] py-3",
    title: "font-semibold text-[var(--text-primary)]",
    body: "text-[var(--text-primary)] mt-1 whitespace-pre-wrap",
    meta: "text-xs text-[var(--text-secondary)] mt-2 flex flex-wrap gap-2 items-center",
    tag: "inline-block bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-2 py-0.5 text-xs",
    tone: "inline-block px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium uppercase tracking-wide",
    btn: "text-xs px-2 py-1 border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] min-h-[32px]",
    input: "w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-primary)] mb-2",
  }

  const toneColor = (t) => ({
    friendly: "bg-[var(--success)] text-white",
    heated: "bg-[var(--warning)] text-black",
    concerning: "bg-[var(--error)] text-white",
  })[t] || "bg-[var(--neutral)] text-white"

  async function remove(p) {
    setSaving((s) => new Set(s).add(p._id))
    try { await database.del(p._id) }
    catch (e) { alert("Delete failed: " + (e.message || "rejected")) }
    finally { setSaving((s) => { const n = new Set(s); n.delete(p._id); return n }) }
  }

  async function saveEdit(p) {
    setSaving((s) => new Set(s).add(p._id))
    try { await database.put({ ...p, body: editBody, editedAt: Date.now() }); setEditingId(null) }
    catch (e) { alert("Edit failed: " + (e.message || "rejected")) }
    finally { setSaving((s) => { const n = new Set(s); n.delete(p._id); return n }) }
  }

  return (
    <section id="post-list" className={c.section}>
      <h2 className={c.h}>Discussions</h2>
      {posts.length === 0 && <p className={c.empty}>No posts yet.</p>}
      {posts.map((p) => {
        const mine = p.authorHandle === me?.userHandle
        const canEdit = (mine || isMod) && can.edit(p).ok
        const canDel = (mine || isMod) && can.delete(p).ok
        const isSaving = saving.has(p._id)
        return (
          <article key={p._id} className={c.post} style={{ opacity: isSaving ? 0.6 : 1 }}>
            <div className={c.title}>{p.title}</div>
            {editingId === p._id ? (
              <div className="mt-2">
                <textarea className={c.input} rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex gap-2">
                  <button className={c.btn} onClick={() => saveEdit(p)} disabled={isSaving}>Save</button>
                  <button className={c.btn} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className={c.body}>{p.body}</p>
            )}
            <div className={c.meta}>
              <span>by {p.authorHandle}</span>
              {p.tone && <span className={`${c.tone} ${toneColor(p.tone)}`}>{p.tone}</span>}
              {(p.tags || []).map((t) => <span key={t} className={c.tag}>{t}</span>)}
              {isSaving && <span className="italic">Saving…</span>}
              {canEdit && editingId !== p._id && (
                <button className={c.btn} onClick={() => { setEditingId(p._id); setEditBody(p.body) }}>Edit</button>
              )}
              {canDel && (
                <button className={c.btn} onClick={() => remove(p)} disabled={isSaving}>Delete</button>
              )}
            </div>
          </article>
        )
      })}
    </section>
  )
}

function ModeratorPanel({ database, mods }) {
  const [handle, setHandle] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4",
    h: "text-lg font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide",
    input: "flex-1 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 text-[var(--text-primary)] min-h-[44px]",
    btn: "px-4 py-3 min-h-[44px] bg-[var(--primary)] text-[var(--accent-text)] rounded-[var(--radius-sm)] font-semibold",
    list: "mt-3 flex flex-wrap gap-2",
    chip: "inline-flex items-center gap-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-2 py-1 text-sm",
  }
  async function appoint(e) {
    e.preventDefault()
    if (!handle.trim()) return
    setBusy(true)
    try { await database.put({ type: "modGrant", userHandle: handle.trim(), createdAt: Date.now() }); setHandle("") }
    catch (e) { alert("Failed: " + (e.message || "rejected")) }
    finally { setBusy(false) }
  }
  async function revoke(m) {
    try { await database.del(m._id) } catch (e) { alert("Failed: " + (e.message || "rejected")) }
  }
  return (
    <section id="mod-panel" className={c.section}>
      <h2 className={c.h}>Moderators</h2>
      <form onSubmit={appoint} className="flex gap-2">
        <input className={c.input} placeholder="userHandle to appoint" value={handle} onChange={(e) => setHandle(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy} className={c.btn}>Appoint</button>
      </form>
      <div className={c.list}>
        {mods.length === 0 && <span className="text-sm text-[var(--text-secondary)] italic">No moderators yet.</span>}
        {mods.map((m) => (
          <span key={m._id} className={c.chip}>
            {m.userHandle}
            <button onClick={() => revoke(m)} className="text-[var(--error)] font-bold">×</button>
          </span>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const { ViewerTag, viewer, isOwner } = useViewer()
  const { ready, can, me } = useVibe("forum")
  const { database, useLiveQuery, access } = useFireproof("forum")
  const { docs: posts } = useLiveQuery("type", { key: "post", descending: true })
  const { docs: mods } = useLiveQuery("type", { key: "modGrant" })
  const isMod = isOwner || access.hasRole("moderator")

  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 bg-[var(--background)] border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "text-2xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto px-4 py-4",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Town Square</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <NewPostForm database={database} can={can} me={me} ready={ready} />
        <PostList posts={posts} database={database} can={can} me={me} isMod={isMod} />
        {isOwner && <ModeratorPanel database={database} mods={mods} />}
      </main>
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
  --raised: rgba(255, 255, 255, 0.55);
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
    --raised: rgba(255, 255, 255, 0.06);
  }
}
.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}