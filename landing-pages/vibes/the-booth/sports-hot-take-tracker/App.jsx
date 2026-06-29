import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function TakeForm({ database, viewer, access }) {
  const [text, setText] = React.useState("")
  const [crew, setCrew] = React.useState("")
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = React.useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!text.trim() || !crew.trim()) return
    setLoading(true)
    try {
      const res = await callAI(
        `Rate the boldness of this sports take 1-5 and write a punchy one-line tagline (max 12 words): "${text}"`,
        { schema: { properties: { spice: { type: "number" }, tagline: { type: "string" } } } }
      )
      const { spice, tagline } = JSON.parse(res)
      await database.put({
        type: "take",
        text: text.trim(),
        crew: crew.trim(),
        date,
        spice: Math.max(1, Math.min(5, Math.round(spice || 3))),
        tagline: tagline || "",
        verdict: null,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      })
      setText(""); setCrew("")
    } finally { setLoading(false) }
  }

  async function suggest() {
    setLoading(true)
    try {
      const res = await callAI(
        "Give one bold, specific, slightly outrageous sports prediction someone might shout on a podcast. Also give a fake crew member nickname.",
        { schema: { properties: { take: { type: "string" }, crew: { type: "string" } } } }
      )
      const { take, crew: c } = JSON.parse(res)
      setText(take || ""); setCrew(c || "")
    } finally { setLoading(false) }
  }

  const c = {
    field: "w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 text-[var(--text-primary)] font-[var(--font-family)] min-h-[44px]",
    label: "block text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-1 font-[var(--font-family-mono)]",
    btn: "min-h-[44px] px-5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-text)] font-bold uppercase tracking-wide disabled:opacity-50",
    ghost: "min-h-[44px] px-4 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] text-sm",
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={c.label}>The Take</label>
        <textarea className={c.field} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Lakers miss the playoffs. Book it." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={c.label}>Who Said It</label>
          <input className={c.field} value={crew} onChange={e => setCrew(e.target.value)} placeholder="Big Mike" />
        </div>
        <div>
          <label className={c.label}>Date</label>
          <input type="date" className={c.field} value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={c.btn}>
          {loading ? (
            <svg className="animate-spin inline" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : "Post Take"}
        </button>
        <button type="button" onClick={suggest} disabled={loading} className={c.ghost}>
          <svg className="inline mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Surprise me
        </button>
      </div>
    </form>
  )
}

function Scoreboard({ takes }) {
  const stats = React.useMemo(() => {
    const m = {}
    takes.forEach(t => {
      if (!m[t.crew]) m[t.crew] = { crew: t.crew, correct: 0, cooked: 0, pending: 0 }
      if (t.verdict === "correct") m[t.crew].correct++
      else if (t.verdict === "cooked") m[t.crew].cooked++
      else m[t.crew].pending++
    })
    return Object.values(m).map(s => {
      const judged = s.correct + s.cooked
      return { ...s, rate: judged ? s.correct / judged : 0, judged }
    }).sort((a, b) => b.rate - a.rate || b.correct - a.correct)
  }, [takes])

  const c = {
    row: "flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0",
    name: "font-bold uppercase tracking-wide text-[var(--text-primary)]",
    rate: "font-[var(--font-family-mono)] text-2xl text-[var(--accent)]",
    meta: "text-xs text-[var(--text-secondary)] font-[var(--font-family-mono)]",
  }

  if (!stats.length) return <p className="text-[var(--text-secondary)] text-sm italic">No takes yet. The board awaits its first prophet.</p>

  return (
    <ul>
      {stats.map((s, i) => (
        <li key={s.crew} className={c.row}>
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-secondary)] font-[var(--font-family-mono)] text-sm w-6">#{i+1}</span>
            <div>
              <div className={c.name}>{s.crew}</div>
              <div className={c.meta}>{s.correct}W · {s.cooked}L · {s.pending} pending</div>
            </div>
          </div>
          <div className={c.rate}>{s.judged ? Math.round(s.rate * 100) + "%" : "—"}</div>
        </li>
      ))}
    </ul>
  )
}

function TakesFeed({ takes, database, canWrite }) {
  async function setVerdict(take, verdict) {
    await database.put({ ...take, verdict: take.verdict === verdict ? null : verdict })
  }

  const c = {
    card: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 space-y-2",
    crew: "font-bold uppercase tracking-widest text-[var(--accent)]",
    date: "text-xs text-[var(--text-secondary)] font-[var(--font-family-mono)]",
    text: "text-[var(--text-primary)] text-lg leading-snug",
    tagline: "text-sm italic text-[var(--text-secondary)]",
    spice: "inline-flex items-center gap-1 text-xs font-[var(--font-family-mono)] text-[var(--accent)]",
    btn: (active, color) => `min-h-[40px] px-3 rounded-[var(--radius-sm)] border text-sm font-bold uppercase tracking-wide ${active ? `bg-[var(--${color})] text-[var(--background)] border-transparent` : `border-[var(--border)] text-[var(--text-secondary)]`}`,
    badge: (v) => v === "correct" ? "text-[var(--success)]" : v === "cooked" ? "text-[var(--error)]" : "text-[var(--text-secondary)]",
  }

  if (!takes.length) return <p className="text-[var(--text-secondary)] text-sm italic">Empty board. Someone be brave.</p>

  return (
    <ul className="space-y-3">
      {takes.map(t => (
        <li key={t._id} className={c.card}>
          <div className="flex items-center justify-between">
            <span className={c.crew}>{t.crew}</span>
            <span className={c.date}>{t.date}</span>
          </div>
          <p className={c.text}>"{t.text}"</p>
          {t.tagline && <p className={c.tagline}>— {t.tagline}</p>}
          <div className="flex items-center justify-between pt-2">
            <span className={c.spice} title="Spice level">
              {"🌶".repeat(0)}<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>
              {t.spice}/5
            </span>
            {canWrite ? (
              <div className="flex gap-2">
                <button onClick={() => setVerdict(t, "correct")} className={c.btn(t.verdict === "correct", "success")}>Correct</button>
                <button onClick={() => setVerdict(t, "cooked")} className={c.btn(t.verdict === "cooked", "error")}>Cooked</button>
              </div>
            ) : (
              <span className={`text-sm font-bold uppercase ${c.badge(t.verdict)}`}>
                {t.verdict || "pending"}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useLiveQuery, database, access } = useFireproof("hotTakes")
  const { docs: takes } = useLiveQuery("createdAt", { descending: true })

  const canWrite = !!viewer && access.hasChannel("board")

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "sticky top-0 z-10 bg-[var(--background)]/90 backdrop-blur border-b border-[var(--border)] px-4 py-3 flex items-center justify-between",
    brand: "font-['Bebas_Neue'] text-3xl tracking-wider text-[var(--text-primary)]",
    brandAccent: "text-[var(--accent)]",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-6 pb-24",
    section: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4",
    h2: "font-['Bebas_Neue'] text-2xl tracking-wide mb-3",
    readonly: "text-sm text-[var(--text-secondary)] italic",
  }

  if (isViewerPending) return <div className={c.page}></div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=Space+Mono&display=optional');
        :root {
          --background: oklch(0.11 0.01 270);
          --surface: oklch(0.13 0.01 270);
          --accent: oklch(0.65 0.18 290);
          --accent-text: oklch(0.10 0.01 270);
          --text-primary: oklch(0.93 0.01 270);
          --text-secondary: oklch(0.55 0.02 270);
          --border: oklch(0.22 0.01 270);
          --primary: oklch(0.65 0.18 290);
          --success: oklch(0.75 0.18 145);
          --error: oklch(0.65 0.22 25);
          --font-family: 'Inter', sans-serif;
          --font-family-mono: 'Space Mono', monospace;
          --radius: 0.75rem;
          --radius-sm: 0.375rem;
          --radius-lg: 1rem;
          --spacing: 1rem;
          --border-width: 1px;
        }
      `}</style>
      <div className={c.page} id="app">
        <header className={c.header} id="app-header">
          <h1 className={c.brand}>Hot <span className={c.brandAccent}>Takes</span></h1>
          <ViewerTag />
        </header>
        <main className={c.main}>
          <section id="scoreboard" className={c.section}>
            <h2 className={c.h2}>The Reckoning</h2>
            <Scoreboard takes={takes} />
          </section>

          <section id="post-take" className={c.section}>
            <h2 className={c.h2}>Drop a Take</h2>
            {canWrite ? (
              <TakeForm database={database} viewer={viewer} access={access} />
            ) : (
              <p className={c.readonly}>{viewer ? "You're viewing read-only. Ask the owner for posting access." : "Sign in to post."}</p>
            )}
          </section>

          <section id="feed" className={c.section}>
            <h2 className={c.h2}>The Board</h2>
            <TakesFeed takes={takes} database={database} canWrite={canWrite} />
          </section>
        </main>
      </div>
    </>
  )
}