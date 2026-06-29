import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const GLYPHS = ["ヽ(•‿•)ノ", "(•_•)", "¯\\_(ツ)_/¯", "◉_◉", "(>_<)"]
const MOODS = ["UP", "FLAT", "FRIED", "CHILL", "BUZZED"]
const MEMBERS = ["ada", "lin", "rex", "juno", "kai", "vex"]

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("noon-wave")
  const [name, setName] = React.useState("ada")
  const [glyph, setGlyph] = React.useState(GLYPHS[0])
  const [mood, setMood] = React.useState("UP")
  const { doc, merge, submit } = useDocument({ type: "ping", name, glyph, mood, line: "", ts: Date.now(), late: false })
  const { docs } = useLiveQuery("ts", { descending: true, limit: 100 })

  const [tick, setTick] = React.useState(0)
  React.useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 250); return () => clearInterval(id) }, [])
  const noonStart = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime() })()
  const remaining = Math.max(0, Math.ceil((noonStart + 30000 - Date.now()) / 1000))
  const windowOpen = Date.now() >= noonStart && Date.now() < noonStart + 30000
  const todayKey = new Date().toDateString()
  const todayDocs = docs.filter(d => new Date(d.ts).toDateString() === todayKey)
  const byMember = Object.fromEntries(todayDocs.map(d => [d.name, d]))

  function handleSubmit(e) {
    e.preventDefault()
    const now = Date.now()
    const noon = new Date(); noon.setHours(12, 0, 0, 0)
    const late = now > noon.getTime() + 30000
    database.put({ type: "ping", name, glyph, mood, line: doc.line, ts: now, late })
    merge({ line: "" })
  }

  const c = {
    page: "min-h-screen w-full bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)] font-['VT323',monospace] text-[18px] leading-[1.4]",
    overlay: "fixed inset-0 pointer-events-none",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none",
    shell: "max-w-[720px] mx-auto px-4 py-6 space-y-6",
    header: "flex items-center justify-between py-3 border-b border-[oklch(0.87_0.30_142/0.3)]",
    brand: "text-2xl tracking-widest glow",
    sysline: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    section: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4 space-y-3",
    label: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    countdown: "text-5xl text-center py-4 tracking-widest glow",
    glyphRow: "grid grid-cols-5 gap-2",
    glyphBtn: "border border-[oklch(0.87_0.30_142/0.3)] py-3 text-center min-h-[44px]",
    moodRow: "grid grid-cols-5 gap-2",
    moodBtn: "border border-[oklch(0.87_0.30_142/0.3)] py-3 text-center text-xs tracking-[0.1em] min-h-[44px]",
    input: "w-full bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-3 py-3 outline-none placeholder:text-[oklch(0.87_0.30_142/0.4)]",
    submit: "w-full border border-[oklch(0.87_0.30_142/0.3)] py-3 min-h-[44px] tracking-[0.1em] glow",
    waveRow: "grid grid-cols-2 sm:grid-cols-3 gap-3",
    card: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-3 space-y-2 min-h-[120px]",
    cardName: "text-xs uppercase tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    cardGlyph: "text-lg",
    cardLine: "text-sm",
    cardMood: "text-xs tracking-[0.1em] text-[oklch(0.87_0.30_142/0.4)]",
    grid: "grid gap-[3px]",
    dot: "w-[8px] h-[8px] rounded-full",
    feed: "space-y-2",
    feedRow: "flex gap-3 items-baseline border-b border-[oklch(0.87_0.30_142/0.1)] py-2",
    footer: "text-xs uppercase tracking-[0.1em] text-center pt-4 text-[oklch(0.87_0.30_142/0.4)]",
  }

  return (
    <div className={c.page}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=optional" />
      <style>{`
        #crt-overlay { background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px); z-index: 99; }
        #crt-sweep { background: linear-gradient(to bottom, transparent, rgba(0,255,0,0.15), transparent); z-index: 100; animation: sweep 8s linear infinite; }
        @keyframes sweep { 0% { top: -3px; } 100% { top: 100vh; } }
        @keyframes blink { 50% { opacity: 0; } }
        input, textarea { caret-color: oklch(0.87 0.30 142); }
        h1, h2, .glow { text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7); }
        button:hover { background: oklch(0.87 0.30 142); color: oklch(0 0 0); }
        .dot-on { background: oklch(0.87 0.30 142); box-shadow: 0 0 8px oklch(0.87 0.30 142 / 0.7); }
        .dot-late { background: oklch(0.87 0.30 142 / 0.4); }
        .dot-miss { background: transparent; border: 1px solid oklch(0.87 0.30 142 / 0.4); }
      `}</style>
      <div className={c.overlay} id="crt-overlay" />
      <div className={c.sweep} id="crt-sweep" />
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <h1 className={c.brand}>NOON_WAVE</h1>
          <span className={c.sysline}>● SYS: live</span>
        </header>

        <main id="app" className="space-y-6">
          <section id="window" className={c.section}>
            <div className={c.label}>STATUS: window</div>
            <div className={c.countdown}>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</div>
            <div className={c.sysline}><span className={`${windowOpen ? "dot-on" : "dot-late"} inline-block w-[6px] h-[6px] rounded-full mr-2 align-middle`} />{windowOpen ? "window open · ping now" : "window closed · late pings logged dim"}</div>
          </section>

          <section id="compose" className={c.section}>
            <div className={c.label}>SYS: compose</div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className={c.label}>glyph</div>
                <div className={c.glyphRow}>
                  {GLYPHS.map(g => (
                    <button key={g} type="button" className={c.glyphBtn} onClick={() => setGlyph(g)} style={glyph === g ? { background: "oklch(0.87 0.30 142)", color: "oklch(0 0 0)" } : {}}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className={c.label}>mood</div>
                <div className={c.moodRow}>
                  {MOODS.map(m => (
                    <button key={m} type="button" className={c.moodBtn} onClick={() => setMood(m)} style={mood === m ? { background: "oklch(0.87 0.30 142)", color: "oklch(0 0 0)" } : {}}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className={c.label}>callsign</div>
                <select className={c.input} value={name} onChange={e => setName(e.target.value)}>
                  {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div className={c.label}>line · <button type="button" onClick={async () => {
                  const r = await callAI(`Suggest one short noon check-in line (max 50 chars) matching mood ${mood}.`, { schema: { properties: { line: { type: "string" } } } })
                  try { merge({ line: JSON.parse(r).line.slice(0, 60) }) } catch {}
                }} style={{ background: "transparent", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>[ suggest ]</button></div>
                <input className={c.input} placeholder="one line..." maxLength={60} value={doc.line} onChange={e => merge({ line: e.target.value })} />
              </div>
              <button type="submit" className={c.submit} onClick={handleSubmit}>[ PING ]</button>
            </form>
          </section>

          <section id="today" className={c.section}>
            <div className={c.label}>FEED: today</div>
            <div className={c.waveRow}>
              {MEMBERS.map(m => {
                const d = byMember[m]
                return (
                  <article key={m} className={c.card} style={d?.late ? { opacity: 0.45 } : {}}>
                    <div className={c.cardName}>{m}{d?.late ? " · late" : ""}</div>
                    <div className={c.cardGlyph}>{d?.glyph || "—"}</div>
                    <div className={c.cardLine}>{d?.line || "○ no signal"}</div>
                    <div className={c.cardMood}>{d?.mood || "—"}</div>
                  </article>
                )
              })}
            </div>
          </section>

          <section id="grid" className={c.section}>
            <div className={c.label}>SYS: 30-day grid</div>
            <div className={c.grid} style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
              {Array.from({ length: 6 * 30 }).map((_, i) => {
                const r = (i * 7) % 11
                const cls = r < 6 ? "dot-on" : r < 9 ? "dot-late" : "dot-miss"
                return <span key={i} className={`${c.dot} ${cls}`} />
              })}
            </div>
          </section>

          <section id="feed" className={c.section}>
            <div className={c.label}>FEED: log</div>
            <ul className={c.feed}>
              {docs.length === 0 && <li className={c.feedRow}><span>○ awaiting first ping</span></li>}
              {docs.slice(0, 20).map(d => (
                <li key={d._id} className={c.feedRow} style={d.late ? { opacity: 0.45 } : {}}>
                  <span style={{ minWidth: 60 }}>{d.name}</span>
                  <span style={{ minWidth: 90 }}>{d.glyph}</span>
                  <span>{d.line} <span style={{ opacity: 0.5 }}>· {d.mood}{d.late ? " · LATE" : ""}</span></span>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className={c.footer}>EOF · NOON_WAVE v0</footer>
      </div>
    </div>
  )
}