import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');
    body, input, button, textarea { font-family: 'VT323', monospace; font-size: 18px; line-height: 1.4; }
    h1, h2, .glow { text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7); }
    @keyframes scanSweep { 0% { top: 0 } 100% { top: 100vh } }
    @keyframes pulse-row { 0%,100% { background: oklch(0.87 0.30 142 / 0.18) } 50% { background: oklch(0.87 0.30 142 / 0.05) } }
    @keyframes caretBlink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
    @keyframes spin { to { transform: rotate(360deg) } }
    .pulse-row { animation: pulse-row 1.6s ease-in-out infinite; }
    input:focus { caret-color: oklch(0.87 0.30 142); }
  `}</style>
)

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("home-in-5")

  const householdQuery = useLiveQuery("type", { key: "household", limit: 1 })
  const household = householdQuery.docs[0]
  const [me, setMe] = React.useState(localStorage.getItem("home5_me") || "")
  const [householdName, setHouseholdName] = React.useState("")
  const [roomInputs, setRoomInputs] = React.useState(["", "", ""])
  const [isLoading, setIsLoading] = React.useState(false)

  function handleSetup(e) {
    e.preventDefault()
    const members = roomInputs.map(s => s.trim()).filter(Boolean)
    if (!householdName.trim() || members.length < 2) return
    database.put({
      type: "household",
      name: householdName.trim(),
      members,
      createdAt: Date.now(),
    })
  }

  function pickMe(name) {
    setMe(name)
    localStorage.setItem("home5_me", name)
  }

  function handlePing(kind) {
    if (!me) return
    database.put({
      type: "ping",
      from: me,
      kind,
      ts: Date.now(),
    })
  }

  async function suggestRoommates() {
    setIsLoading(true)
    try {
      const res = await callAI("Suggest 3 short first names for housemates", {
        schema: { properties: { names: { type: "array", items: { type: "string" } } } }
      })
      const data = JSON.parse(res)
      setRoomInputs(data.names.slice(0, 3))
    } finally { setIsLoading(false) }
  }

  const pingsQuery = useLiveQuery("type", { key: "ping", descending: true, limit: 20 })
  const pings = pingsQuery.docs

  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return s + "s ago"
    if (s < 3600) return Math.floor(s/60) + "m ago"
    if (s < 86400) return Math.floor(s/3600) + "h ago"
    return Math.floor(s/86400) + "d ago"
  }

  function kindLabel(k) {
    return { "5":"home in 5","15":"home in 15","30":"home in 30","now":"home now","stay":"staying out" }[k] || k
  }

  function kindGlyph(k) {
    return { "5":"●","15":"▲","30":"▼","now":"█","stay":"░" }[k] || "▒"
  }

  const [, force] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => force(x => x+1), 15000)
    return () => clearInterval(id)
  }, [])

  const c = {
    page: "min-h-screen p-4 max-w-2xl mx-auto bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)]",
    crtOverlay: "fixed inset-0 pointer-events-none z-[99] bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0px,rgba(0,255,0,0.03)_1px,transparent_1px,transparent_3px)]",
    scanSweep: "fixed left-0 right-0 h-[3px] z-[100] pointer-events-none bg-gradient-to-b from-[oklch(0.87_0.30_142_/_0.6)] to-transparent",
    header: "flex items-center justify-between py-3 mb-4 border-b border-[oklch(0.87_0.30_142_/_0.3)]",
    brand: "text-2xl tracking-widest glow text-[oklch(0.87_0.30_142)]",
    statusLine: "flex items-center gap-2 text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)]",
    dot: "w-[6px] h-[6px] rounded-full inline-block bg-[oklch(0.87_0.30_142)] shadow-[0_0_8px_oklch(0.87_0.30_142_/_0.9)]",
    sectionLabel: "text-xs uppercase tracking-widest mb-3 text-[oklch(0.87_0.30_142_/_0.4)]",
    card: "border border-[oklch(0.87_0.30_142_/_0.3)] bg-[oklch(0_0_0_/_0.85)] p-4 mb-4",
    setupForm: "flex flex-col gap-3",
    input: "w-full bg-transparent border border-[oklch(0.87_0.30_142_/_0.3)] text-[oklch(0.87_0.30_142)] px-2 py-2 outline-none focus:border-[oklch(0.87_0.30_142)] placeholder:text-[oklch(0.87_0.30_142_/_0.4)]",
    rosterRow: "flex items-center gap-2 mb-2",
    bigButton: "w-full py-8 border-2 border-[oklch(0.87_0.30_142)] bg-[oklch(0.87_0.30_142_/_0.1)] text-[oklch(0.87_0.30_142)] text-3xl tracking-widest min-h-[88px] mb-3 glow hover:bg-[oklch(0.87_0.30_142)] hover:text-black active:bg-[oklch(0.87_0.30_142)] active:text-black",
    variantGrid: "grid grid-cols-2 gap-2 mb-4",
    variantButton: "py-4 border border-[oklch(0.87_0.30_142_/_0.5)] bg-transparent text-[oklch(0.87_0.30_142)] text-base tracking-widest min-h-[56px] hover:bg-[oklch(0.87_0.30_142)] hover:text-black",
    feedList: "list-none p-0 m-0",
    feedRow: "flex items-center justify-between py-2 px-2 border-b border-[oklch(0.87_0.30_142_/_0.15)] text-[oklch(0.87_0.30_142)]",
    feedFrom: "tracking-wider",
    feedMeta: "text-sm text-[oklch(0.87_0.30_142_/_0.5)]",
    patternSection: "mt-6",
    patternRow: "flex items-center justify-between py-2 border-b border-[oklch(0.87_0.30_142_/_0.15)] text-[oklch(0.87_0.30_142)]",
    patternName: "tracking-wider",
    patternGlyphs: "tracking-widest text-lg",
    patternCount: "text-sm text-[oklch(0.87_0.30_142_/_0.5)]",
    footer: "text-xs uppercase tracking-widest text-center py-6 text-[oklch(0.87_0.30_142_/_0.4)]",
  }

  return (
    <>
      <FontStyles />
      <div className={c.crtOverlay} aria-hidden="true" />
      <div className={c.scanSweep} aria-hidden="true" style={{ animation: "scanSweep 8s linear infinite" }} />

      <div className={c.page}>
        <header id="app-header" className={c.header}>
          <h1 className={c.brand}>HOME-IN-5 ▌</h1>
          <div className={c.statusLine}>
            <span className={c.dot} />
            <span>link active</span>
          </div>
        </header>

        <main id="app">
          {!household && (
            <section id="setup" className={c.card}>
              <div className={c.sectionLabel}>sys: household setup</div>
              <form className={c.setupForm} onSubmit={handleSetup}>
                <input className={c.input} placeholder="household name" value={householdName} onChange={e => setHouseholdName(e.target.value)} />
                {roomInputs.map((v, i) => (
                  <input key={i} className={c.input} placeholder={"roommate " + (i+1)} value={v} onChange={e => {
                    const next = [...roomInputs]; next[i] = e.target.value; setRoomInputs(next)
                  }} />
                ))}
                <button type="button" className={c.variantButton} onClick={() => setRoomInputs([...roomInputs, ""])}>[ + add slot ]</button>
                <button type="button" className={c.variantButton} disabled={isLoading} onClick={suggestRoommates}>
                  {isLoading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{animation:"spin 0.8s linear infinite", display:"inline-block"}}>
                      <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  ) : "[ ai: suggest names ]"}
                </button>
                <button type="submit" className={c.variantButton}>[ initialize ]</button>
              </form>
            </section>
          )}

          {household && !me && (
            <section id="who" className={c.card}>
              <div className={c.sectionLabel}>sys: identify operator</div>
              <div className="flex flex-col gap-2">
                {household.members.map(m => (
                  <button key={m} className={c.variantButton} onClick={() => pickMe(m)}>[ i am {m} ]</button>
                ))}
              </div>
            </section>
          )}

          {household && me && (
          <section id="ping" className={c.card}>
            <div className={c.sectionLabel}>status: signed in as {me}</div>
            <button className={c.bigButton} onClick={() => handlePing("5")}>
              [ HOME IN 5 ]
            </button>
            <div className={c.variantGrid}>
              <button className={c.variantButton} onClick={() => handlePing("15")}>[ HOME IN 15 ]</button>
              <button className={c.variantButton} onClick={() => handlePing("30")}>[ HOME IN 30 ]</button>
              <button className={c.variantButton} onClick={() => handlePing("now")}>[ HOME NOW ]</button>
              <button className={c.variantButton} onClick={() => handlePing("stay")}>[ STAYING OUT ]</button>
            </div>
          </section>
          )}

          <section id="feed" className={c.card}>
            <div className={c.sectionLabel}>feed: recent pings</div>
            <ul className={c.feedList}>
              {pings.length === 0 && (
                <li className={c.feedRow}>
                  <span className={c.feedFrom}>—</span>
                  <span className={c.feedMeta}>no transmissions</span>
                </li>
              )}
              {pings.map(p => {
                const fresh = Date.now() - p.ts < 5 * 60 * 1000
                return (
                  <li key={p._id} className={c.feedRow + (fresh ? " pulse-row" : "")}>
                    <span className={c.feedFrom}>{kindGlyph(p.kind)} {p.from}</span>
                    <span className={c.feedMeta}>{kindLabel(p.kind)} — {relTime(p.ts)}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          {household && (
          <section id="pattern" className={c.patternSection}>
            <div className={c.sectionLabel}>status: 7-day pattern</div>
            <div className={c.card}>
              {household.members.map(name => {
                const weekAgo = Date.now() - 7*86400000
                const mine = pings.filter(p => p.from === name && p.ts >= weekAgo)
                const days = []
                for (let i = 6; i >= 0; i--) {
                  const dayStart = Date.now() - i*86400000
                  const dayPings = mine.filter(p => Math.abs(p.ts - dayStart) < 43200000)
                  days.push(dayPings[0] ? kindGlyph(dayPings[0].kind) : "·")
                }
                return (
                  <div key={name} className={c.patternRow}>
                    <span className={c.patternName}>{name}</span>
                    <span className={c.patternGlyphs}>{days.join(" ")}</span>
                    <span className={c.patternCount}>{mine.length} this week</span>
                  </div>
                )
              })}
            </div>
          </section>
          )}
        </main>

        <footer className={c.footer}>sys: {household ? "ready ▌ " + (pings.length) + " pings logged" : "awaiting setup ▌"}</footer>
      </div>
    </>
  )
}