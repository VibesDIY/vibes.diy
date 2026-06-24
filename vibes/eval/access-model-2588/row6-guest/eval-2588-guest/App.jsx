import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const c = {
  page: 'min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]',
  header: 'sticky top-0 z-10 backdrop-blur bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-b border-[var(--border)] px-5 py-4 flex items-center justify-between',
  title: 'text-2xl tracking-wide',
  subtitle: 'text-sm text-[var(--text-secondary)] italic',
  main: 'max-w-2xl mx-auto px-5 py-6 space-y-8 pb-32',
  section: 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5',
  sectionTitle: 'text-xl mb-4 tracking-wide',
  field: 'w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[44px]',
  textarea: 'w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] px-3 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[100px] resize-none',
  primary: 'inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[var(--accent-text)] rounded-[var(--radius)] px-4 py-3 min-h-[44px] font-medium disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius)] px-3 py-2 min-h-[40px] text-sm disabled:opacity-50',
  danger: 'text-[var(--error)] text-xs underline-offset-2 hover:underline',
  entry: 'rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] p-4 space-y-2',
  entryHead: 'flex items-center justify-between gap-3',
  entryBody: 'text-lg leading-relaxed italic text-[var(--text-primary)]',
  meta: 'text-xs text-[var(--text-secondary)]',
  muted: 'text-sm text-[var(--text-secondary)]',
  dot: 'inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]',
  spinner: 'animate-spin w-4 h-4',
}

function Spinner() {
  return (
    <svg className={c.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3 a9 9 0 0 1 9 9" />
    </svg>
  )
}

function SignForm({ canCreate, ready, me }) {
  const { database } = useFireproof("guestbook")
  const [name, setName] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [polishing, setPolishing] = React.useState(false)
  const [posting, setPosting] = React.useState(false)
  const [error, setError] = React.useState(null)

  async function polish() {
    if (!message.trim()) return
    setPolishing(true)
    setError(null)
    try {
      const res = await callAI(
        `Polish this guestbook message into something a touch more poetic and warm, keeping the original sentiment and voice. Keep it under 60 words. Original: "${message}"`,
        { schema: { properties: { polished: { type: "string" } } } }
      )
      const { polished } = JSON.parse(res)
      if (polished) setMessage(polished)
    } catch (e) {
      setError("Couldn't polish — try again.")
    } finally {
      setPolishing(false)
    }
  }

  async function sign(e) {
    e.preventDefault()
    if (!message.trim() || !name.trim()) return
    setPosting(true)
    setError(null)
    try {
      await database.put({
        type: "entry",
        name: name.trim(),
        message: message.trim(),
        authorHandle: me?.userHandle || null,
        createdAt: Date.now(),
      })
      setMessage("")
      setName("")
    } catch (err) {
      setError("Signing failed — please try again.")
    } finally {
      setPosting(false)
    }
  }

  if (!ready) return <div className={c.muted}>Preparing the book…</div>
  const draft = { type: "entry", authorHandle: me?.userHandle || null }
  const verdict = canCreate.create(draft)
  if (!verdict.ok) return <p className={c.muted}>{verdict.reason}</p>

  return (
    <form onSubmit={sign} className="space-y-3">
      <input className={c.field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className={c.textarea} placeholder="Leave a few words…" value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={polish} disabled={polishing || !message.trim()} className={c.ghost}>
          {polishing ? <><Spinner /> Polishing…</> : "Polish with AI"}
        </button>
        <button type="submit" disabled={posting || !message.trim() || !name.trim()} className={c.primary}>
          {posting ? <><Spinner /> Signing…</> : "Sign the book"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </form>
  )
}

function EntriesFeed({ me }) {
  const { database, useLiveQuery } = useFireproof("guestbook")
  const { can } = useVibe("guestbook")
  const { ViewerTag } = useViewer()
  const { docs } = useLiveQuery("createdAt", { descending: true, limit: 100 })
  const [deleting, setDeleting] = React.useState(() => new Set())

  async function remove(doc) {
    setDeleting((s) => new Set(s).add(doc._id))
    try {
      await database.del(doc._id)
    } catch (e) {
      console.error("delete failed", e)
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(doc._id); return n })
    }
  }

  const entries = docs.filter((d) => d.type === "entry")
  if (!entries.length) return <p className={c.muted}>No signatures yet. Be the first.</p>

  return (
    <ul className="space-y-3">
      {entries.map((d) => {
        const isPending = deleting.has(d._id)
        const canDelete = can.delete(d).ok
        return (
          <li key={d._id} className={c.entry} style={{ opacity: isPending ? 0.5 : 1 }}>
            <p className={c.entryBody}>“{d.message}”</p>
            <div className={c.entryHead}>
              <div className="flex items-center gap-2">
                {d.authorHandle ? <ViewerTag userHandle={d.authorHandle} /> : null}
                <span className={c.meta}>— {d.name}{!d.authorHandle && " (guest)"} · {new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              {canDelete && (
                <button onClick={() => remove(d)} disabled={isPending} className={c.danger}>
                  {isPending ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("guestbook")

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>The Wayfarer's Guestbook</h1>
          <p className={c.subtitle}>Leave your mark, traveler.</p>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <section id="sign" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.dot}></span> Sign the book</h2>
          <SignForm canCreate={can} ready={ready} me={me} />
        </section>
        <section id="entries" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.dot}></span> Recent signatures</h2>
          <EntriesFeed me={me} />
        </section>
      </main>
    </div>
  )
}