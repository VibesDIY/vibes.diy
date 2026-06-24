import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const themeStyle = `
:root {
  --background: #000000;
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --border: rgba(255, 255, 255, 0.18);
  --accent: #D4FF00;
  --surface: rgba(255, 255, 255, 0.04);
  --primary: #D4FF00;
  --radius: 0.5rem;
  --spacing: 1rem;
  --font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
}
`

function ChannelSidebar() {
  const c = { wrap: 'p-3 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--surface)] md:w-64 md:min-h-screen' }
  return <aside id="channels" className={c.wrap}><h2 className="text-[var(--accent)] font-bold text-sm uppercase tracking-wider mb-3">Channels</h2><p className="text-[var(--text-secondary)] text-sm">Loading…</p></aside>
}

function MessageFeed({ activeId }) {
  const { useLiveQuery } = useFireproof("chat")
  const { ViewerTag } = useViewer()
  const { docs: messages } = useLiveQuery((d) => [d.channelId, d.createdAt], activeId ? { prefix: [activeId] } : { key: "__none__" })
  const [summary, setSummary] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  async function summarize() {
    if (!messages.length) return
    setLoading(true)
    try {
      const text = messages.map(m => `${m.authorHandle}: ${m.body}`).join("\n")
      const res = await callAI(`Summarize this team channel conversation. Highlight key decisions, open questions, and action items.\n\n${text}`, {
        schema: { properties: { decisions: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } }, actions: { type: "array", items: { type: "string" } } } }
      })
      setSummary(JSON.parse(res))
    } catch (e) { alert("Summary failed: " + e.message) }
    finally { setLoading(false) }
  }
  const c = { wrap: 'flex-1 p-4 overflow-y-auto space-y-3', msg: 'border border-[var(--border)] rounded-[var(--radius)] p-3 bg-[var(--surface)]' }
  if (!activeId) return <section id="feed" className="flex-1 p-4"><p className="text-[var(--text-secondary)]">Select a channel.</p></section>
  return (
    <section id="feed" className={c.wrap}>
      <div className="flex justify-end">
        <button onClick={summarize} disabled={loading || !messages.length} className="bg-[var(--accent)] text-black font-bold px-3 py-2 rounded-[var(--radius)] text-sm min-h-[44px] disabled:opacity-50 inline-flex items-center gap-2">
          {loading && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>}
          {loading ? "Summarizing…" : "Summarize"}
        </button>
      </div>
      {summary && (
        <div className="border border-[var(--accent)] rounded-[var(--radius)] p-3 bg-[var(--accent)]/10">
          <h3 className="text-[var(--accent)] font-bold text-sm mb-2">AI Summary</h3>
          {summary.decisions?.length > 0 && <div className="mb-2"><strong className="text-xs uppercase text-[var(--text-secondary)]">Decisions</strong><ul className="list-disc pl-5 text-sm">{summary.decisions.map((d,i)=><li key={i}>{d}</li>)}</ul></div>}
          {summary.questions?.length > 0 && <div className="mb-2"><strong className="text-xs uppercase text-[var(--text-secondary)]">Open Questions</strong><ul className="list-disc pl-5 text-sm">{summary.questions.map((d,i)=><li key={i}>{d}</li>)}</ul></div>}
          {summary.actions?.length > 0 && <div><strong className="text-xs uppercase text-[var(--text-secondary)]">Action Items</strong><ul className="list-disc pl-5 text-sm">{summary.actions.map((d,i)=><li key={i}>{d}</li>)}</ul></div>}
          <button onClick={() => setSummary("")} className="text-xs text-[var(--text-secondary)] mt-2 underline">dismiss</button>
        </div>
      )}
      {messages.length === 0 && <p className="text-[var(--text-secondary)]">No messages yet.</p>}
      <ul className="space-y-2">
        {messages.map(m => (
          <li key={m._id} className={c.msg}>
            <div className="flex items-center gap-2 mb-1"><ViewerTag userHandle={m.authorHandle} /><span className="text-xs text-[var(--text-secondary)]">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Composer({ activeId }) {
  const { database } = useFireproof("chat")
  const { can, me, ready } = useVibe("chat")
  const [body, setBody] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  if (!activeId) return null
  const verdict = ready ? can.create({ type: "message", channelId: activeId, authorHandle: me?.userHandle, body: "x", createdAt: Date.now() }) : { ok: false, reason: "" }
  async function send(e) {
    e.preventDefault()
    const b = body.trim()
    if (!b || !me) return
    setSaving(true)
    const draft = { type: "message", channelId: activeId, authorHandle: me.userHandle, body: b, createdAt: Date.now() }
    setBody("")
    try { await database.put(draft) }
    catch (err) { alert("Send failed: " + err.message); setBody(b) }
    finally { setSaving(false) }
  }
  const c = { wrap: 'p-3 border-t border-[var(--border)] bg-[var(--surface)]' }
  if (!verdict.ok) return <section id="composer" className={c.wrap}><p className="text-[var(--text-secondary)] text-sm">{verdict.reason || "Read-only access."}</p></section>
  return (
    <section id="composer" className={c.wrap}>
      <form onSubmit={send} className="flex gap-2">
        <input value={body} onChange={e=>setBody(e.target.value)} placeholder="Type a message…" className="flex-1 bg-black border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 min-h-[44px]" />
        <button type="submit" disabled={saving || !body.trim()} className="bg-[var(--accent)] text-black font-bold px-4 rounded-[var(--radius)] min-h-[44px] disabled:opacity-50">Send</button>
      </form>
    </section>
  )
}

function RolePanel() {
  const { database, useLiveQuery } = useFireproof("chat")
  const { can, ready } = useVibe("chat")
  const { docs: grants } = useLiveQuery("type", { key: "roleGrant" })
  const [handle, setHandle] = React.useState("")
  const [role, setRole] = React.useState("member")
  const canGrant = ready ? can.create({ type: "roleGrant", role: "member", userHandle: "x" }) : { ok: false }
  async function grant(e) {
    e.preventDefault()
    const h = handle.trim()
    if (!h) return
    try { await database.put({ type: "roleGrant", role, userHandle: h, createdAt: Date.now() }); setHandle("") }
    catch (err) { alert("Failed: " + err.message) }
  }
  if (!canGrant.ok && grants.length === 0) return null
  const c = { wrap: 'p-3 border-t border-[var(--border)] bg-[var(--surface)]' }
  return (
    <section id="roles" className={c.wrap}>
      <h2 className="text-[var(--accent)] font-bold text-sm uppercase tracking-wider mb-2">Roles</h2>
      {grants.length > 0 && (
        <ul className="text-sm space-y-1 mb-3">
          {grants.map(g => (
            <li key={g._id} className="flex justify-between items-center gap-2">
              <span><span className="text-[var(--accent)]">{g.role}</span> · {g.userHandle}</span>
              {can.delete(g).ok && <button onClick={() => database.del(g._id)} className="text-xs text-[var(--text-secondary)] underline">revoke</button>}
            </li>
          ))}
        </ul>
      )}
      {canGrant.ok && (
        <form onSubmit={grant} className="flex gap-2 flex-wrap">
          <input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="user handle" className="flex-1 min-w-[120px] bg-black border border-[var(--border)] rounded-[var(--radius)] px-2 py-2 text-sm min-h-[44px]" />
          <select value={role} onChange={e=>setRole(e.target.value)} className="bg-black border border-[var(--border)] rounded-[var(--radius)] px-2 text-sm min-h-[44px]">
            <option value="admin">admin</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
          <button type="submit" className="bg-[var(--accent)] text-black font-bold px-3 rounded-[var(--radius)] text-sm min-h-[44px]">Grant</button>
        </form>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const [activeId, setActiveId] = React.useState(null)
  const c = {
    page: 'min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]',
    header: 'flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--background)] z-10',
    title: 'text-xl font-bold text-[var(--accent)] tracking-tight',
    layout: 'md:flex',
    main: 'flex-1 flex flex-col min-h-[calc(100vh-65px)]',
  }
  return (
    <div className={c.page}>
      <style>{themeStyle}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>TeamSpace</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.layout}>
        <ChannelSidebar activeId={activeId} setActiveId={setActiveId} />
        <div className={c.main}>
          <MessageFeed activeId={activeId} />
          <Composer activeId={activeId} />
          <RolePanel />
        </div>
      </main>
    </div>
  )
}