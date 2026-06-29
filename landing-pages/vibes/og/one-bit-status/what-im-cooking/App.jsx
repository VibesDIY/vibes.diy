import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [me, setMe] = React.useState("")
  const [dish, setDish] = React.useState("")
  const [step, setStep] = React.useState("")
  const [eta, setEta] = React.useState("")
  const [, force] = React.useReducer(x => x + 1, 0)
  React.useEffect(() => { const id = setInterval(force, 1000); return () => clearInterval(id) }, [])

  const { database, useLiveQuery } = useFireproof("whats-cooking")
  const { docs: allDocs } = useLiveQuery("_id", { descending: true, limit: 500 })

  const latestByName = {}
  for (const d of allDocs) {
    if (!d.name) continue
    if (!latestByName[d.name]) latestByName[d.name] = d
  }
  const activeCooks = Object.values(latestByName).filter(d => !d.idle)
  const logRows = allDocs.slice(0, 100)

  function handleSubmit(e) {
    e.preventDefault()
    if (!me.trim() || !dish.trim() || !step.trim()) return
    database.put({
      name: me.trim(),
      dish: dish.trim(),
      step: step.trim(),
      eta_minutes: Number(eta) || 0,
      started_ts: Date.now(),
    })
    setDish(""); setStep(""); setEta("")
  }
  function handleClear(e) {
    e.preventDefault()
    if (!me.trim()) return
    database.put({ name: me.trim(), idle: true, ts: Date.now() })
  }

  function heatFor(s) {
    const x = (s || "").toLowerCase()
    if (/sear|fry|broil|flame|wok/.test(x)) return 4
    if (/boil|reduc|deglaz|simmer hard|caramel/.test(x)) return 3
    if (/saute|sauté|simmer|steam|braise/.test(x)) return 2
    if (/sweat|warm|melt|infuse|rest/.test(x)) return 1
    return 0
  }
  function gauge(level) {
    const filled = "▓".repeat(level)
    const empty = "░".repeat(4 - level)
    return filled + empty
  }
  function fmtCountdown(d) {
    const end = (d.started_ts || 0) + (d.eta_minutes || 0) * 60000
    const ms = end - Date.now()
    if (ms <= 0) return "PLATING"
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
  }
  function fmtClock(ts) {
    const d = new Date(ts || 0)
    return d.toTimeString().slice(0, 8)
  }

  const c = {
    page: "min-h-screen w-full px-4 py-6 max-w-3xl mx-auto bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)] font-['VT323',monospace] text-[18px] leading-[1.4]",
    scanlines: "fixed inset-0 pointer-events-none z-[99] bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0px,rgba(0,255,0,0.03)_1px,transparent_1px,transparent_3px)]",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100] bg-gradient-to-b from-[oklch(0.87_0.30_142/0.6)] to-transparent animate-[sweep_8s_linear_infinite]",
    header: "mb-6 pb-4 border-b border-[oklch(0.87_0.30_142/0.3)]",
    title: "text-3xl tracking-widest uppercase [text-shadow:0_0_10px_oklch(0.87_0.30_142/0.7)]",
    subtitle: "text-sm uppercase tracking-[0.1em] mt-1 text-[oklch(0.87_0.30_142/0.4)]",
    sectionLabel: "text-xs uppercase tracking-[0.1em] mb-2 mt-6 text-[oklch(0.87_0.30_142/0.4)]",
    burnerBlock: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-3 mb-4",
    burnerRow: "flex justify-between items-center py-1",
    burnerName: "uppercase tracking-wider",
    burnerGauge: "tracking-widest text-[oklch(0.87_0.30_142)] [text-shadow:0_0_8px_oklch(0.87_0.30_142/0.6)]",
    form: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-3 mb-4 grid gap-2",
    formRow: "flex flex-col gap-1",
    label: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    input: "bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-2 py-2 min-h-[44px] w-full outline-none text-[oklch(0.87_0.30_142)] caret-[oklch(0.87_0.30_142)] placeholder:text-[oklch(0.87_0.30_142/0.3)] font-['VT323',monospace]",
    formActions: "flex gap-3 mt-2",
    button: "px-3 py-3 min-h-[44px] uppercase tracking-widest border border-[oklch(0.87_0.30_142)] bg-transparent text-[oklch(0.87_0.30_142)] hover:bg-[oklch(0.87_0.30_142)] hover:text-[oklch(0_0_0)] transition-colors",
    feed: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-3 mb-4",
    feedRow: "flex flex-col py-2 border-b border-[oklch(0.87_0.30_142/0.1)] last:border-b-0 gap-1",
    feedTopLine: "flex justify-between items-center",
    dot: "inline-block w-[6px] h-[6px] rounded-full mr-2 align-middle bg-[oklch(0.87_0.30_142)] shadow-[0_0_8px_oklch(0.87_0.30_142)]",
    name: "uppercase tracking-wider",
    dish: "text-xl text-[oklch(1_0_0)] [text-shadow:0_0_10px_oklch(0.87_0.30_142/0.8)]",
    step: "text-sm text-[oklch(0.87_0.30_142/0.4)] uppercase tracking-[0.1em]",
    eta: "text-sm tabular-nums text-[oklch(0.87_0.30_142)] [text-shadow:0_0_8px_oklch(0.87_0.30_142/0.6)]",
    log: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-3 max-h-[420px] overflow-y-auto",
    logRow: "py-1 text-sm flex justify-between gap-3 border-b border-[oklch(0.87_0.30_142/0.1)] last:border-b-0 text-[oklch(0.87_0.30_142/0.7)]",
    logTime: "tabular-nums shrink-0 text-[oklch(0.87_0.30_142/0.4)]",
    empty: "py-6 text-center uppercase tracking-[0.1em] text-sm text-[oklch(0.87_0.30_142/0.4)]",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');@keyframes sweep{0%{top:-3%}100%{top:103%}}@keyframes plate{0%,100%{opacity:1}50%{opacity:0.3}}.plating{animation:plate 0.8s ease-in-out infinite}`}</style>
      <div className={c.scanlines} aria-hidden="true" />
      <div className={c.sweep} aria-hidden="true" />

      <header id="app-header" className={c.header}>
        <h1 className={c.title}>What I'm Cooking</h1>
        <div className={c.subtitle}>SYS: stovetop_feed.live // 3-10 cooks</div>
      </header>

      <main id="app">
        <section id="burners">
          <div className={c.sectionLabel}>STATUS: burners</div>
          <div className={c.burnerBlock}>
            {[0,1,2,3].map(i => {
              const cook = activeCooks[i]
              const lvl = cook ? heatFor(cook.step) : 0
              return (
                <div key={i} className={c.burnerRow}>
                  <span className={c.burnerName}>BURNER {i+1}: {cook ? cook.name : "—"}</span>
                  <span className={c.burnerGauge}>{gauge(lvl)}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section id="input">
          <div className={c.sectionLabel}>SYS: update slot</div>
          <form className={c.form} onSubmit={handleSubmit}>
            <div className={c.formRow}>
              <label className={c.label}>name</label>
              <input className={c.input} placeholder="your handle" value={me} onChange={e => setMe(e.target.value)} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>dish</label>
              <input className={c.input} placeholder="what's cooking" value={dish} onChange={e => setDish(e.target.value)} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>step</label>
              <input className={c.input} placeholder="sweating onions" value={step} onChange={e => setStep(e.target.value)} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>eta minutes</label>
              <input className={c.input} placeholder="12" inputMode="numeric" value={eta} onChange={e => setEta(e.target.value)} />
            </div>
            <div className={c.formActions}>
              <button type="submit" className={c.button}>[ RUN ]</button>
              <button type="button" className={c.button} onClick={handleClear}>[ CLEAR ]</button>
            </div>
          </form>
        </section>

        <section id="feed">
          <div className={c.sectionLabel}>FEED: active cooks</div>
          <div className={c.feed}>
            {activeCooks.length === 0 && (
              <div className={c.empty}>STATUS: no active cooks</div>
            )}
            {activeCooks.map(d => {
              const cd = fmtCountdown(d)
              const plating = cd === "PLATING"
              return (
                <div key={d._id} className={c.feedRow}>
                  <div className={c.feedTopLine}>
                    <span className={c.name}><span className={c.dot} />{d.name}</span>
                    <span className={c.eta + (plating ? " plating" : "")}>{plating ? "▲ PLATING" : `ETA ${cd}`}</span>
                  </div>
                  <div className={c.dish}>{d.dish}</div>
                  <div className={c.step}>→ {d.step}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section id="log">
          <div className={c.sectionLabel}>FEED: scrollback</div>
          <div className={c.log}>
            {logRows.length === 0 && (
              <div className={c.logRow}><span className={c.logTime}>--:--:--</span><span>waiting for transitions</span></div>
            )}
            {logRows.map(d => (
              <div key={d._id} className={c.logRow}>
                <span className={c.logTime}>{fmtClock(d.started_ts || d.ts)}</span>
                <span>
                  {d.idle
                    ? `${d.name} → CLEARED`
                    : `${d.name} :: ${d.dish} → ${d.step}${d.eta_minutes ? ` (${d.eta_minutes}m)` : ""}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}