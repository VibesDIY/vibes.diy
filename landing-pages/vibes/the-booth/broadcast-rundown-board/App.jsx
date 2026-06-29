import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ThemeStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;500;700&display=optional');
      :root {
        --background: oklch(0.16 0 0);
        --surface: rgba(255,255,255,0.04);
        --raised: rgba(255,255,255,0.06);
        --text-primary: rgba(255,255,255,0.92);
        --text-secondary: rgba(255,255,255,0.55);
        --border: rgba(255,255,255,0.18);
        --border-fg: oklch(1 0 0);
        --accent: #ff7a1a;
        --primary: #ff7a1a;
        --secondary: #666;
        --success: #22c55e;
        --warning: #f59e0b;
        --error: #ef4444;
        --font-family: 'Roboto Mono', monospace;
        --font-display: 'Archivo Black', sans-serif;
        --radius: 0.5rem;
        --radius-sm: 0.25rem;
        --spacing: 1rem;
        --border-width: 1px;
      }
      .display { font-family: var(--font-display); letter-spacing: 0.02em; }
    `}</style>
  )
}

function RuntimeTotals({ segments }) {
  const aired = segments.filter(s => s.aired).reduce((a, s) => a + (s.duration || 0), 0)
  const remaining = segments.filter(s => !s.aired).reduce((a, s) => a + (s.duration || 0), 0)
  const total = aired + remaining
  const c = {
    wrap: 'grid grid-cols-3 gap-2 mb-4',
    box: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3',
    label: 'text-[10px] uppercase tracking-widest text-[var(--text-secondary)]',
    val: 'display text-2xl text-[var(--text-primary)] mt-1',
    aired: 'display text-2xl text-[var(--success)] mt-1',
    rem: 'display text-2xl text-[var(--accent)] mt-1',
  }
  return (
    <section id="runtime" className={c.wrap}>
      <div className={c.box}><div className={c.label}>Aired</div><div className={c.aired}>{aired}m</div></div>
      <div className={c.box}><div className={c.label}>Remaining</div><div className={c.rem}>{remaining}m</div></div>
      <div className={c.box}><div className={c.label}>Total</div><div className={c.val}>{total}m</div></div>
    </section>
  )
}

function SegmentList({ segments, canWrite, database, viewer }) {
  const ordered = [...segments].sort((a, b) => (a.position || 0) - (b.position || 0))

  async function toggle(s) {
    await database.put({ ...s, aired: !s.aired })
  }
  async function move(s, dir) {
    const idx = ordered.findIndex(x => x._id === s._id)
    const swap = ordered[idx + dir]
    if (!swap) return
    await database.put({ ...s, position: swap.position })
    await database.put({ ...swap, position: s.position })
  }
  async function remove(s) {
    await database.del(s._id)
  }

  const c = {
    wrap: 'space-y-2',
    empty: 'text-center text-[var(--text-secondary)] py-8 text-sm border border-dashed border-[var(--border)] rounded-[var(--radius)]',
    row: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3 flex items-start gap-3',
    rowAired: 'opacity-50',
    chk: 'mt-1 min-w-[28px] min-h-[28px] rounded border-[var(--border)] border-2 flex items-center justify-center bg-[var(--raised)]',
    chkOn: 'bg-[var(--success)] border-[var(--success)]',
    body: 'flex-1 min-w-0',
    top: 'flex items-center gap-2 flex-wrap',
    time: 'display text-[var(--accent)] text-sm',
    dur: 'text-[10px] uppercase tracking-widest text-[var(--text-secondary)] bg-[var(--raised)] px-2 py-0.5 rounded-sm',
    topic: 'text-[var(--text-primary)] mt-1 break-words',
    host: 'text-xs text-[var(--text-secondary)] mt-1',
    ctrls: 'flex flex-col gap-1',
    btn: 'min-w-[36px] min-h-[36px] rounded-sm border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center hover:bg-[var(--raised)]',
    del: 'text-[var(--error)] text-xs underline mt-1',
  }

  if (!ordered.length) return <div className={c.empty}>No segments yet. Add the first one below.</div>

  return (
    <ul className={c.wrap}>
      {ordered.map((s, i) => (
        <li key={s._id} className={`${c.row} ${s.aired ? c.rowAired : ''}`}>
          <button
            onClick={() => canWrite && toggle(s)}
            disabled={!canWrite}
            aria-label="toggle aired"
            className={`${c.chk} ${s.aired ? c.chkOn : ''}`}
          >
            {s.aired && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <div className={c.body}>
            <div className={c.top}>
              <span className={c.time}>{s.scheduledTime || '--:--'}</span>
              <span className={c.dur}>{s.duration || 0}m</span>
            </div>
            <div className={c.topic}>{s.topic}</div>
            <div className={c.host}>HOST · {s.host}</div>
            {canWrite && <button onClick={() => remove(s)} className={c.del}>delete</button>}
          </div>
          {canWrite && (
            <div className={c.ctrls}>
              <button onClick={() => move(s, -1)} disabled={i === 0} className={c.btn} aria-label="up">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button onClick={() => move(s, 1)} disabled={i === ordered.length - 1} className={c.btn} aria-label="down">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function AddSegmentForm({ database, viewer, maxPosition }) {
  const { useDocument } = useFireproof("runOfShow")
  const { doc, merge, submit } = useDocument({
    type: "segment",
    scheduledTime: "",
    host: "",
    topic: "",
    duration: 5,
    aired: false,
    position: 0,
    createdAt: Date.now(),
  })
  const [loading, setLoading] = React.useState(false)

  async function suggest() {
    setLoading(true)
    try {
      const res = await callAI(
        "Suggest one realistic segment for a live NBA basketball broadcast run-of-show. Include a short topic, a host first name, and an estimated duration in minutes (typical 2-8).",
        { schema: { properties: {
          topic: { type: "string" },
          host: { type: "string" },
          duration: { type: "number" },
        }}}
      )
      const data = JSON.parse(res)
      merge({ topic: data.topic || "", host: data.host || "", duration: data.duration || 5 })
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!doc.topic.trim() || !doc.host.trim()) return
    merge({ position: (maxPosition || 0) + 1000, createdAt: Date.now() })
    submit()
  }

  const c = {
    form: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-4 space-y-3',
    label: 'block text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-1',
    input: 'w-full bg-[var(--raised)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 text-[var(--text-primary)] font-[var(--font-family)] min-h-[44px]',
    row: 'grid grid-cols-2 gap-3',
    btnRow: 'flex gap-2',
    submit: 'flex-1 bg-[var(--accent)] text-black display rounded-[var(--radius-sm)] py-3 min-h-[44px] disabled:opacity-50',
    suggest: 'min-h-[44px] px-3 bg-[var(--raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius-sm)] text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-1',
    spin: 'animate-spin',
  }

  return (
    <form id="add-form" onSubmit={onSubmit} className={c.form}>
      <div className="flex items-center justify-between">
        <h3 className="display text-sm text-[var(--text-primary)]">NEW SEGMENT</h3>
        <button type="button" onClick={suggest} disabled={loading} className={c.suggest}>
          {loading ? (
            <svg className={c.spin} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          )}
          {loading ? 'Thinking' : 'Suggest'}
        </button>
      </div>
      <div className={c.row}>
        <div>
          <label className={c.label}>Time</label>
          <input className={c.input} type="text" placeholder="19:30" value={doc.scheduledTime} onChange={e => merge({ scheduledTime: e.target.value })} />
        </div>
        <div>
          <label className={c.label}>Duration (m)</label>
          <input className={c.input} type="number" min="1" value={doc.duration} onChange={e => merge({ duration: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <div>
        <label className={c.label}>Host</label>
        <input className={c.input} type="text" placeholder="Mike" value={doc.host} onChange={e => merge({ host: e.target.value })} />
      </div>
      <div>
        <label className={c.label}>Topic</label>
        <input className={c.input} type="text" placeholder="Tip-off & starting lineups" value={doc.topic} onChange={e => merge({ topic: e.target.value })} />
      </div>
      <div className={c.btnRow}>
        <button type="submit" className={c.submit} disabled={!doc.topic.trim() || !doc.host.trim()}>ADD TO RUNDOWN</button>
      </div>
    </form>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useLiveQuery, database, access } = useFireproof("runOfShow")
  const { docs: segments } = useLiveQuery("type", { key: "segment" })

  const canWrite = !!viewer && (isOwner || access.hasChannel("rundown"))
  const maxPosition = segments.reduce((m, s) => Math.max(m, s.position || 0), 0)

  const c = {
    page: 'min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]',
    header: 'sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between',
    brand: 'display text-lg text-[var(--text-primary)]',
    sub: 'text-[10px] uppercase tracking-widest text-[var(--accent)]',
    main: 'max-w-2xl mx-auto p-4 pb-24',
    sectionTitle: 'display text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2 mt-6',
    readonly: 'text-xs text-[var(--text-secondary)] text-center py-3 border border-dashed border-[var(--border)] rounded-[var(--radius)] mb-3',
  }

  if (isViewerPending) return <div className={c.page}><ThemeStyles /></div>

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.brand}>COURT CUE</div>
          <div className={c.sub}>RUN OF SHOW</div>
        </div>
        <ViewerTag />
      </header>
      <main id="app">
        <div className={c.main}>
          <RuntimeTotals segments={segments} />

          <h2 className={c.sectionTitle}>Rundown</h2>
          <SegmentList segments={segments} canWrite={canWrite} database={database} viewer={viewer} />

          {canWrite ? (
            <>
              <h2 className={c.sectionTitle}>Add Segment</h2>
              <AddSegmentForm database={database} viewer={viewer} maxPosition={maxPosition} />
            </>
          ) : (
            <div className={c.readonly} style={{ marginTop: '1.5rem' }}>
              {viewer ? 'Read-only view · ask the producer for write access' : 'Sign in to edit the rundown'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}