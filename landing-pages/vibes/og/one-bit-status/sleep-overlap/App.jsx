import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("overlap-scope")
  const { doc, merge, submit } = useDocument({ type: "profile", name: "", wake: 7, sleep: 23, editedAt: Date.now() })
  const { docs: profiles } = useLiveQuery("type", { key: "profile" })
  const { docs: feed } = useLiveQuery("editedAt", { descending: true, limit: 12 })
  const [useUTC, setUseUTC] = React.useState(true)
  const [now, setNow] = React.useState(new Date())
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const currentHour = useUTC ? now.getUTCHours() : now.getHours()

  function isAwake(h, wake, sleep) {
    if (wake === sleep) return false
    if (wake < sleep) return h >= wake && h < sleep
    return h >= wake || h < sleep
  }

  const hourCounts = Array.from({ length: 24 }, (_, h) =>
    profiles.filter(p => isAwake(h, Number(p.wake), Number(p.sleep))).length
  )
  const awakeNow = hourCounts[currentHour] || 0
  const peak = hourCounts.reduce((acc, n, h) => n > acc.n ? { n, h } : acc, { n: 0, h: 0 })
  let nextOverlap = null
  for (let i = 1; i <= 24; i++) {
    const h = (currentHour + i) % 24
    if (hourCounts[h] >= 3) { nextOverlap = i; break }
  }

  function handleProfileSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim()) return
    merge({ editedAt: Date.now() })
    submit()
  }

  function handleToggleTz() {
    setUseUTC(v => !v)
  }

  async function handleSuggest() {
    setIsLoading(true)
    try {
      const res = await callAI("Generate a single example sleep profile for a friend.", {
        schema: { properties: { name: { type: "string" }, wake: { type: "number" }, sleep: { type: "number" } } }
      })
      const p = JSON.parse(res)
      merge({ name: p.name || "anon", wake: p.wake ?? 7, sleep: p.sleep ?? 23 })
    } finally {
      setIsLoading(false)
    }
  }

  const c = {
    page: "min-h-screen w-full bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)]",
    crt: "fixed inset-0 pointer-events-none z-[99]",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100]",
    shell: "relative max-w-[960px] mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex flex-col gap-2 pb-4 border-b border-[oklch(0.87_0.30_142/0.3)]",
    brand: "flex items-center justify-between gap-3",
    title: "text-3xl tracking-wide text-[oklch(0.87_0.30_142)]",
    subtitle: "text-sm tracking-widest uppercase text-[oklch(0.87_0.30_142/0.4)]",
    tzBar: "flex items-center justify-between gap-3 pt-2",
    tzLabel: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    tzBtn: "px-3 py-2 min-h-[44px] text-sm border border-[oklch(0.87_0.30_142/0.3)] text-[oklch(0.87_0.30_142)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black",
    main: "flex flex-col gap-6",
    section: "flex flex-col gap-3 p-4 border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)]",
    sectionLabel: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    readouts: "grid grid-cols-1 md:grid-cols-3 gap-3",
    readoutCard: "p-4 border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0.87_0.30_142/0.05)] flex flex-col gap-2",
    readoutLabel: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    readoutValue: "text-3xl text-[oklch(0.87_0.30_142)]",
    timelineWrap: "flex flex-col gap-2 overflow-x-auto",
    hourRuler: "grid gap-px text-[10px] uppercase tracking-widest min-w-[600px] text-[oklch(0.87_0.30_142/0.4)]",
    hourTick: "text-center py-1",
    memberRow: "flex items-center gap-3 min-w-[600px]",
    memberName: "w-24 shrink-0 text-sm truncate text-[oklch(0.87_0.30_142)]",
    memberBars: "grid gap-px flex-1 h-7",
    barCell: "h-full",
    overlapRow: "flex items-center gap-3 min-w-[600px] mt-2 pt-3 border-t border-[oklch(0.87_0.30_142/0.3)]",
    overlapLabel: "w-24 shrink-0 text-sm uppercase tracking-widest text-[oklch(0.87_0.30_142)]",
    overlapBars: "grid gap-px flex-1 h-8",
    overlapCell: "h-full flex items-center justify-center text-[10px] bg-[oklch(0.87_0.30_142/0.1)] text-[oklch(0.87_0.30_142/0.6)]",
    form: "flex flex-col gap-3",
    formRow: "flex flex-col gap-1",
    label: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    input: "px-3 py-3 min-h-[44px] bg-transparent border border-[oklch(0.87_0.30_142/0.3)] outline-none text-base text-[oklch(0.87_0.30_142)] placeholder:text-[oklch(0.87_0.30_142/0.3)] focus:border-[oklch(0.87_0.30_142)] caret-[oklch(0.87_0.30_142)]",
    hourGrid: "grid grid-cols-2 gap-3",
    formActions: "flex flex-wrap gap-2 pt-2",
    btn: "px-4 py-3 min-h-[44px] text-sm tracking-widest border border-[oklch(0.87_0.30_142/0.3)] text-[oklch(0.87_0.30_142)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black disabled:opacity-50",
    suggestBtn: "px-3 py-2 min-h-[40px] text-xs tracking-widest self-start border border-[oklch(0.87_0.30_142/0.3)] text-[oklch(0.87_0.30_142/0.6)] hover:text-[oklch(0.87_0.30_142)] hover:border-[oklch(0.87_0.30_142)] disabled:opacity-50",
    feed: "flex flex-col gap-2",
    feedItem: "flex items-center gap-3 p-3 border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0.87_0.30_142/0.05)]",
    dot: "w-[6px] h-[6px] rounded-full shrink-0 bg-[oklch(0.87_0.30_142)]",
    feedText: "text-sm flex-1 text-[oklch(0.87_0.30_142)]",
    feedTime: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    empty: "text-sm py-3 text-[oklch(0.87_0.30_142/0.4)]",
    footer: "text-xs uppercase tracking-widest text-center pt-4 border-t border-[oklch(0.87_0.30_142/0.3)] text-[oklch(0.87_0.30_142/0.4)]"
  }

  return (
    <div id="app-root" className={c.page} style={{ fontFamily: "VT323, monospace", fontSize: 18, lineHeight: 1.4 }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=optional" />
      <div className={c.crt} aria-hidden="true" style={{ background: "repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px)" }} />
      <div className={c.sweep} aria-hidden="true" style={{ background: "linear-gradient(180deg, transparent, oklch(0.87 0.30 142 / 0.6), transparent)", animation: "scopeSweep 8s linear infinite" }} />
      <style>{`@keyframes scopeSweep { 0%{top:-3%} 100%{top:103%} }`}</style>

      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.brand}>
            <h1 className={c.title} style={{ textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" }}>▌ OVERLAP.SCOPE</h1>
            <span className={c.subtitle}>SYS: {profiles.length} ONLINE</span>
          </div>
          <div className={c.tzBar}>
            <span className={c.tzLabel}>STATUS: TIMEZONE MODE</span>
            <button onClick={handleToggleTz} className={c.tzBtn}>[ {useUTC ? "UTC" : "LOCAL"} ]</button>
          </div>
        </header>

        <main id="app" className={c.main}>
          <section id="readouts" className={c.section}>
            <span className={c.sectionLabel}>SYS: LIVE READOUTS</span>
            <div className={c.readouts}>
              <div className={c.readoutCard}>
                <span className={c.readoutLabel}>AWAKE NOW</span>
                <span className={c.readoutValue} id="r-now" style={{ textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" }}>{awakeNow} / {profiles.length}</span>
              </div>
              <div className={c.readoutCard}>
                <span className={c.readoutLabel}>NEXT OVERLAP IN</span>
                <span className={c.readoutValue} id="r-next" style={{ textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" }}>{nextOverlap === null ? "—" : `${nextOverlap}h`}</span>
              </div>
              <div className={c.readoutCard}>
                <span className={c.readoutLabel}>PEAK OVERLAP</span>
                <span className={c.readoutValue} id="r-peak" style={{ textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" }}>{peak.n} ({String(peak.h).padStart(2,"0")}:00 {useUTC ? "UTC" : "LOC"})</span>
              </div>
            </div>
          </section>

          <section id="timeline" className={c.section}>
            <span className={c.sectionLabel}>SYS: 24H TIMELINE</span>
            <div className={c.timelineWrap}>
              <div className={c.hourRuler} style={{ gridTemplateColumns: "6rem repeat(24, minmax(0,1fr))" }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className={c.hourTick}>{String(h).padStart(2, "0")}</div>
                ))}
              </div>

              {profiles.length === 0 && (
                <div className={c.empty}>░ no members yet — add one below ░</div>
              )}
              {profiles.map(p => (
                <div key={p._id} className={c.memberRow}>
                  <span className={c.memberName}>{p.name}</span>
                  <div className={c.memberBars} style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const awake = isAwake(h, Number(p.wake), Number(p.sleep))
                      const isNow = h === currentHour
                      return (
                        <div key={h} className={c.barCell} style={{
                          background: awake ? "oklch(0.87 0.30 142 / 0.85)" : "oklch(0.87 0.30 142 / 0.08)",
                          outline: isNow ? "1px solid oklch(1 0 0)" : "none"
                        }} />
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className={c.overlapRow}>
                <span className={c.overlapLabel}>OVERLAP</span>
                <div className={c.overlapBars} style={{ gridTemplateColumns: "repeat(24, minmax(0,1fr))" }}>
                  {hourCounts.map((n, h) => {
                    const hot = n >= 3
                    const isNow = h === currentHour
                    return (
                      <div key={h} className={c.overlapCell} style={{
                        background: hot ? "oklch(0.87 0.30 142 / 0.9)" : "oklch(0.87 0.30 142 / 0.12)",
                        color: hot ? "black" : "oklch(0.87 0.30 142 / 0.6)",
                        outline: isNow ? "1px solid oklch(1 0 0)" : "none"
                      }}>{n}</div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section id="profile-form" className={c.section}>
            <span className={c.sectionLabel}>SYS: ADD / UPDATE MEMBER</span>
            <form onSubmit={handleProfileSubmit} className={c.form}>
              <div className={c.formRow}>
                <label className={c.label}>HANDLE</label>
                <input className={c.input} placeholder="enter name…" value={doc.name} onChange={e => merge({ name: e.target.value })} />
              </div>
              <div className={c.hourGrid}>
                <div className={c.formRow}>
                  <label className={c.label}>WAKE HOUR (0-23)</label>
                  <input type="number" min="0" max="23" className={c.input} placeholder="07" value={doc.wake} onChange={e => merge({ wake: Number(e.target.value) })} />
                </div>
                <div className={c.formRow}>
                  <label className={c.label}>SLEEP HOUR (0-23)</label>
                  <input type="number" min="0" max="23" className={c.input} placeholder="23" value={doc.sleep} onChange={e => merge({ sleep: Number(e.target.value) })} />
                </div>
              </div>
              <button type="button" onClick={handleSuggest} disabled={isLoading} className={c.suggestBtn}>
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="42 42" /></svg>
                    PINGING…
                  </span>
                ) : "[ ▲ SUGGEST EXAMPLE ]"}
              </button>
              <div className={c.formActions}>
                <button type="submit" className={c.btn}>[ RUN ]</button>
                <button type="button" className={c.btn} onClick={() => merge({ name: "", wake: 7, sleep: 23 })}>[ CLEAR ]</button>
              </div>
            </form>
          </section>

          <section id="feed" className={c.section}>
            <span className={c.sectionLabel}>FEED: RECENT EDITS</span>
            <ul className={c.feed}>
              {feed.filter(d => d.type === "profile").map(d => (
                <li key={d._id} className={c.feedItem}>
                  <span className={c.dot} style={{ boxShadow: "0 0 8px oklch(0.87 0.30 142 / 0.8)" }} />
                  <span className={c.feedText}>● {d.name} → {String(d.wake).padStart(2,"0")}:00 ▶ {String(d.sleep).padStart(2,"0")}:00</span>
                  <span className={c.feedTime}>{new Date(d.editedAt || 0).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
            {feed.filter(d => d.type === "profile").length === 0 && (
              <p className={c.empty}>░ no feed yet ░</p>
            )}
          </section>
        </main>

        <footer className={c.footer}>SYS: BUFFER STABLE ▒ EOF</footer>
      </div>
    </div>
  )
}