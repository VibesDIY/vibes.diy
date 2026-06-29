import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("nap-declaration")
  const [name, setName] = React.useState("")
  const [eta, setEta] = React.useState(25)
  const [now, setNow] = React.useState(Date.now())
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { docs: naps } = useLiveQuery("type", { key: "nap", descending: true })
  const { docs: wakes } = useLiveQuery("type", { key: "wake", descending: true })
  const { docs: flags } = useLiveQuery("type", { key: "snooze" })

  const wokeSet = new Set(wakes.map(w => w.napId))
  const activeNaps = naps.filter(n => !wokeSet.has(n._id))
  const myActive = activeNaps.find(n => n.name === name)

  async function handleDeclare(e) {
    e.preventDefault()
    if (!name.trim()) return
    await database.put({ type: "nap", name: name.trim(), ts_start: Date.now(), eta_minutes: Number(eta) || 25 })
  }
  async function handleWake(napId) {
    await database.put({ type: "wake", napId, name, ts: Date.now() })
  }
  async function handleToggleSnooze(user) {
    const existing = flags.find(f => f.user === user)
    await database.put({ ...(existing || { type: "snooze", user }), enabled: !(existing?.enabled) })
  }
  async function handleSuggestName() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Suggest one short lowercase sleepy handle, max 12 chars.", { schema: { properties: { handle: { type: "string" } } } })
      const j = JSON.parse(r)
      if (j.handle) setName(j.handle.slice(0, 12))
    } finally { setIsSuggesting(false) }
  }

  function fmt(ms) {
    if (ms <= 0) return "00:00:00"
    const s = Math.floor(ms / 1000)
    const h = String(Math.floor(s / 3600)).padStart(2, "0")
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
    const ss = String(s % 60).padStart(2, "0")
    return `${h}:${m}:${ss}`
  }

  const c = {
    page: "min-h-screen w-full bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)]",
    crtOverlay: "fixed inset-0 pointer-events-none z-[99]",
    scanSweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100]",
    shell: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    header: "flex items-center justify-between border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] px-3 py-2",
    headerTitle: "text-2xl tracking-widest uppercase glow",
    headerMeta: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    bigButtonWrap: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-6 flex flex-col items-center gap-4",
    bigButton: "w-full min-h-[88px] text-3xl tracking-widest uppercase border border-[oklch(0.87_0.30_142/0.3)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black px-6 py-4 glow",
    presetRow: "flex flex-wrap gap-2 justify-center",
    presetBtn: "min-h-[44px] px-4 py-2 border border-[oklch(0.87_0.30_142/0.3)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black text-sm uppercase tracking-[0.1em]",
    etaForm: "w-full flex flex-col gap-3 mt-2",
    label: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    input: "w-full bg-transparent border border-[oklch(0.87_0.30_142/0.3)] text-[oklch(0.87_0.30_142)] caret-[oklch(0.87_0.30_142)] px-3 py-3 text-lg outline-none focus:border-[oklch(0.87_0.30_142)]",
    submitBtn: "min-h-[44px] px-6 py-3 border border-[oklch(0.87_0.30_142/0.3)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black text-base uppercase tracking-[0.1em]",
    section: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4 space-y-3",
    sectionLabel: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    sectionTitle: "text-xl uppercase tracking-widest glow",
    feedList: "space-y-2",
    feedRow: "border border-[oklch(0.87_0.30_142/0.3)] px-3 py-3 flex items-center justify-between gap-3",
    feedLeft: "flex items-center gap-3",
    statusDot: "w-[6px] h-[6px] rounded-full bg-[oklch(0.87_0.30_142)] dot-on",
    feedName: "text-base uppercase tracking-[0.1em]",
    feedCountdown: "text-base tabular-nums glow",
    feedRight: "flex items-center gap-3",
    actionBtn: "min-h-[44px] px-3 py-2 border border-[oklch(0.87_0.30_142/0.3)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black text-xs uppercase tracking-[0.1em]",
    logGrid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    logCard: "border border-[oklch(0.87_0.30_142/0.3)] p-3 space-y-2",
    logName: "text-base uppercase tracking-[0.1em]",
    logStats: "flex flex-wrap gap-x-4 gap-y-1 text-sm",
    statKey: "uppercase tracking-[0.1em] text-xs text-[oklch(0.87_0.30_142/0.4)]",
    statVal: "tabular-nums glow",
    snoozeRow: "flex items-center justify-between gap-2 pt-1",
    histoWrap: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4 space-y-3",
    histoBars: "flex items-end gap-[2px] h-32",
    histoBar: "flex-1 border-t border-[oklch(0.87_0.30_142)] bg-[oklch(0.87_0.30_142/0.1)]",
    histoAxis: "flex justify-between text-[10px] uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    suggestBtn: "text-[10px] uppercase tracking-[0.1em] underline text-[oklch(0.87_0.30_142/0.4)] hover:text-[oklch(0.87_0.30_142)]",
    empty: "text-sm uppercase tracking-[0.1em] py-2 text-[oklch(0.87_0.30_142/0.4)]",
    footer: "text-center text-xs uppercase tracking-[0.1em] py-4 text-[oklch(0.87_0.30_142/0.4)]",
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');
        body, .nap-root { font-family: 'VT323', monospace; font-size: 18px; line-height: 1.4; }
        .crt { background-image: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px); }
        .sweep { background: linear-gradient(to bottom, oklch(0.87 0.30 142 / 0.5), transparent); animation: sweep 8s linear infinite; }
        @keyframes sweep { 0% { top: -3%; } 100% { top: 103%; } }
        .glow { text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7); }
        .dot-on { box-shadow: 0 0 8px oklch(0.87 0.30 142 / 0.9); }
        input::placeholder { color: oklch(0.87 0.30 142 / 0.4); }
        input:focus { outline: none; }
      `}</style>
      <div className={`${c.crtOverlay} crt`} aria-hidden="true" />
      <div className={`${c.scanSweep} sweep`} aria-hidden="true" />

      <div className={`${c.shell} nap-root`}>
        <header id="app-header" className={c.header}>
          <h1 className={c.headerTitle}>NAP.SYS</h1>
          <div className={c.headerMeta}>SYS: ONLINE</div>
        </header>

        <main id="app" className="space-y-6">
          <section id="declare" className={c.bigButtonWrap}>
            <button className={c.bigButton} onClick={myActive ? () => handleWake(myActive._id) : handleDeclare}>
              {myActive ? "[ WAKE ]" : "[ DECLARE NAP ]"}
            </button>
            <form className={c.etaForm} onSubmit={handleDeclare}>
              <div className={c.presetRow}>
                {[15, 25, 45, 90].map(m => (
                  <button key={m} type="button" className={c.presetBtn} onClick={() => setEta(m)}>[ {m}M ]</button>
                ))}
              </div>
              <label className={c.label} htmlFor="nap-name">USER ID</label>
              <input id="nap-name" className={c.input} placeholder="enter handle" value={name} onChange={e => setName(e.target.value)} />
              <button type="button" className={c.suggestBtn} onClick={handleSuggestName} disabled={isSuggesting}>{isSuggesting ? "> ..." : "> suggest handle"}</button>
              <label className={c.label} htmlFor="nap-eta">ETA MINUTES</label>
              <input id="nap-eta" className={c.input} placeholder="25" type="number" value={eta} onChange={e => setEta(e.target.value)} />
              <button type="submit" className={c.submitBtn}>[ RUN ]</button>
            </form>
          </section>

          <section id="feed" className={c.section}>
            <div className={c.sectionLabel}>FEED: ACTIVE NAPPERS</div>
            <h2 className={c.sectionTitle}>// LIVE</h2>
            <ul className={c.feedList}>
              {activeNaps.length === 0 && <li className={c.empty}>// no active sleepers detected</li>}
              {activeNaps.map(n => {
                const remaining = n.ts_start + n.eta_minutes * 60000 - now
                return (
                  <li key={n._id} className={c.feedRow}>
                    <div className={c.feedLeft}>
                      <span className={c.statusDot} />
                      <span className={c.feedName}>{n.name}</span>
                    </div>
                    <div className={c.feedRight}>
                      <span className={c.feedCountdown}>{fmt(remaining)}</span>
                      {n.name === name && <button className={c.actionBtn} onClick={() => handleWake(n._id)}>[ WAKE ]</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section id="histogram" className={c.histoWrap}>
            <div className={c.sectionLabel}>STATUS: START HOUR DISTRIBUTION</div>
            <h2 className={c.sectionTitle}>// CIRCADIAN</h2>
            <div className={c.histoBars}>
              {(() => {
                const bins = Array(24).fill(0)
                naps.forEach(n => { bins[new Date(n.ts_start).getHours()]++ })
                const max = Math.max(1, ...bins)
                return bins.map((v, i) => (
                  <div key={i} className={c.histoBar} style={{ height: `${(v / max) * 100}%` }} />
                ))
              })()}
            </div>
            <div className={c.histoAxis}>
              <span>00H</span><span>06H</span><span>12H</span><span>18H</span><span>23H</span>
            </div>
          </section>

          <section id="log" className={c.section}>
            <div className={c.sectionLabel}>SYS: 7-DAY LOG</div>
            <h2 className={c.sectionTitle}>// HISTORY</h2>
            <div className={c.logGrid}>
              {(() => {
                const cutoff = now - 7 * 86400000
                const users = [...new Set(naps.map(n => n.name))]
                if (users.length === 0) return <div className={c.empty}>// no archive entries</div>
                return users.map(u => {
                  const userNaps = naps.filter(n => n.name === u && n.ts_start >= cutoff)
                  const completed = userNaps.map(n => {
                    const w = wakes.find(x => x.napId === n._id)
                    return w ? (w.ts - n.ts_start) / 60000 : null
                  }).filter(x => x != null)
                  const avg = completed.length ? Math.round(completed.reduce((a, b) => a + b, 0) / completed.length) : 0
                  const days = [...new Set(userNaps.map(n => new Date(n.ts_start).toDateString()))].sort((a, b) => new Date(b) - new Date(a))
                  let streak = 0
                  for (let i = 0; i < days.length; i++) {
                    const expected = new Date(); expected.setDate(expected.getDate() - i)
                    if (days[i] === expected.toDateString()) streak++; else break
                  }
                  const flag = flags.find(f => f.user === u)
                  return (
                    <div key={u} className={c.logCard}>
                      <div className={c.logName}>{u}</div>
                      <div className={c.logStats}>
                        <span><span className={c.statKey}>AVG </span><span className={c.statVal}>{avg}M</span></span>
                        <span><span className={c.statKey}>STREAK </span><span className={c.statVal}>{streak}D</span></span>
                        <span><span className={c.statKey}>NAPS </span><span className={c.statVal}>{userNaps.length}</span></span>
                      </div>
                      {u === name && (
                        <div className={c.snoozeRow}>
                          <span className={c.statKey}>AUTO-SNOOZE</span>
                          <button className={c.actionBtn} onClick={() => handleToggleSnooze(u)}>[ {flag?.enabled ? "ON" : "OFF"} ]</button>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </section>
        </main>

        <footer className={c.footer}>// END.OF.STREAM</footer>
      </div>
    </div>
  )
}