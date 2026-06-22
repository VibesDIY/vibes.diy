import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function Feed({ entries }) {
  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)]",
    heading: "text-xl font-semibold text-[var(--text-primary)] mb-3",
    empty: "text-[var(--text-secondary)] italic text-center py-8",
    item: "border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3 bg-[var(--background)]",
    name: "font-semibold text-[var(--primary)]",
    msg: "text-[var(--text-primary)] mt-1",
    greet: "mt-2 text-sm italic text-[var(--accent)] border-l-2 border-[var(--accent)] pl-2",
    time: "text-xs text-[var(--text-secondary)] mt-2",
  }
  return (
    <section id="feed" className={c.section}>
      <h2 className={c.heading}>Signatures</h2>
      {entries.length === 0 ? (
        <p className={c.empty}>Be the first to sign the book.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e._id} className={c.item}>
              <div className={c.name}>{e.name}</div>
              <div className={c.msg}>{e.message}</div>
              {e.greeting && <div className={c.greet}>— {e.greeting}</div>}
              <div className={c.time}>{new Date(e.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SignForm({ database, canCreate }) {
  const [name, setName] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [err, setErr] = React.useState("")

  async function suggest() {
    setIsLoading(true)
    try {
      const r = await callAI("Suggest a short friendly guestbook signature (name and message).", {
        schema: { properties: { name: { type: "string" }, message: { type: "string" } } },
      })
      const d = JSON.parse(r)
      setName(d.name || "")
      setMessage(d.message || "")
    } finally { setIsLoading(false) }
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return
    setIsLoading(true); setErr("")
    try {
      const r = await callAI(`Write a brief, warm one-line welcome reply to this guestbook message from ${name}: "${message}"`, {
        schema: { properties: { greeting: { type: "string" } } },
      })
      const { greeting } = JSON.parse(r)
      await database.put({ type: "entry", name: name.trim(), message: message.trim(), greeting, createdAt: Date.now() })
      setName(""); setMessage("")
    } catch (e) { setErr("Could not sign — try again.") }
    finally { setIsLoading(false) }
  }

  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)] sticky bottom-2",
    heading: "text-xl font-semibold text-[var(--text-primary)] mb-3",
    input: "w-full px-3 py-3 min-h-[44px] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] mb-2",
    row: "flex gap-2",
    btn: "flex-1 px-4 py-3 min-h-[44px] rounded-[var(--radius)] bg-[var(--primary)] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2",
    sug: "px-3 py-3 min-h-[44px] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm disabled:opacity-50",
    err: "text-[var(--error)] text-sm mt-2",
    denied: "text-[var(--text-secondary)] italic text-center py-4",
  }

  if (!canCreate.ok) return <section className={c.section}><p className={c.denied}>{canCreate.reason}</p></section>

  return (
    <section id="sign" className={c.section}>
      <h2 className={c.heading}>Sign the Book</h2>
      <form onSubmit={submit}>
        <input className={c.input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={c.input} placeholder="Leave a message…" rows="2" value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className={c.row}>
          <button type="submit" disabled={isLoading} className={c.btn}>
            {isLoading && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg>}
            {isLoading ? "Signing…" : "Sign"}
          </button>
          <button type="button" onClick={suggest} disabled={isLoading} className={c.sug}>Suggest</button>
        </div>
        {err && <p className={c.err}>{err}</p>}
      </form>
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready } = useVibe("guestbook")
  const { database, useLiveQuery } = useFireproof("guestbook")
  const { docs: entries } = useLiveQuery("createdAt", { descending: true, limit: 100 })

  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 bg-[var(--surface)] backdrop-blur border-b-[length:var(--border-width)] border-[var(--border)] px-[var(--spacing)] py-3 flex items-center justify-between",
    title: "text-2xl font-bold text-[var(--primary)]",
    main: "max-w-2xl mx-auto p-[var(--spacing)] space-y-4 pb-24",
  }

  const canCreate = ready ? can.create({ type: "entry" }) : { ok: false, reason: "" }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Welcome Book</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <Feed entries={entries.filter((e) => e.type === "entry")} />
        <SignForm database={database} canCreate={canCreate} />
      </main>
    </div>
  )
}