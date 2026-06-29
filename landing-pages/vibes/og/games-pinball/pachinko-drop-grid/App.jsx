import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const PEG_ROWS = 7
  const SLOTS = [100, 25, 50, 10, 50, 25, 100]
  const { database, useLiveQuery } = useFireproof("peg-drop-db")
  const [dropping, setDropping] = React.useState(false)
  const [ballPos, setBallPos] = React.useState(null)
  const [hyping, setHyping] = React.useState(false)

  const todayKey = new Date().toISOString().slice(0, 10)
  const { docs: drops } = useLiveQuery("type", { key: "drop", descending: true, limit: 50 })
  const todayTotal = drops.filter(d => d.day === todayKey).reduce((s, d) => s + (d.score || 0), 0)

  async function handleDrop(e) {
    e.preventDefault()
    if (dropping) return
    setDropping(true)
    const slotIdx = Math.floor(Math.random() * SLOTS.length)
    const score = SLOTS[slotIdx]
    for (let r = 0; r <= PEG_ROWS; r++) {
      const x = 10 + Math.random() * 80
      const y = (r / PEG_ROWS) * 85
      setBallPos({ x, y })
      await new Promise(res => setTimeout(res, 130))
    }
    setBallPos({ x: (slotIdx + 0.5) * (100 / SLOTS.length), y: 92 })
    await new Promise(res => setTimeout(res, 200))
    await database.put({ type: "drop", score, slot: slotIdx, day: todayKey, createdAt: Date.now() })
    setBallPos(null)
    setDropping(false)
  }

  async function handleHype() {
    if (hyping || drops.length === 0) return
    setHyping(true)
    try {
      const last = drops[0]
      const r = await callAI(`Write a punchy 6-word hype line for a pachinko score of ${last.score}.`, {
        schema: { properties: { line: { type: "string" } } }
      })
      const { line } = JSON.parse(r)
      await database.put({ ...last, hype: line })
    } finally {
      setHyping(false)
    }
  }

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#15131f]",
    shell: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-5",
    header: "flex items-center justify-between p-4 rounded bg-white border-[3px] border-[#15131f] shadow-[4px_4px_0_#15131f]",
    brand: "flex items-center gap-2",
    brandDot: "w-3 h-3",
    brandText: "text-sm font-bold tracking-wider uppercase",
    totalChip: "px-3 py-2 rounded text-xs font-bold uppercase tracking-wider bg-[#3066d6] text-white border-[3px] border-[#15131f] shadow-[3px_3px_0_#15131f]",
    hero: "relative p-5 pt-7 rounded flex flex-col gap-3 bg-white border-[3px] border-[#15131f] shadow-[4px_4px_0_#15131f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1",
    heroTitle: "text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2 text-[#15131f] [text-shadow:4px_4px_0_#d6422a]",
    heroSub: "text-xs uppercase tracking-widest text-[#6c6680] font-semibold",
    board: "relative w-full aspect-[3/4] rounded overflow-hidden p-3 select-none bg-[#fff8e0] border-[3px] border-[#15131f] shadow-[4px_4px_0_#15131f]",
    pegRow: "flex justify-around items-center",
    peg: "w-3 h-3 rounded-full bg-[#15131f]",
    ball: "absolute w-5 h-5 rounded-full transition-all duration-150 bg-[#d6422a] border-2 border-[#15131f] shadow-[2px_2px_0_#15131f]",
    slotsRow: "absolute bottom-0 left-0 right-0 flex",
    slot: "flex-1 text-center py-2 text-xs font-bold uppercase border-r-[3px] border-t-[3px] border-[#15131f] last:border-r-0 font-mono",
    dropBar: "flex gap-3",
    btnPrimary: "flex-1 min-h-[52px] rounded font-bold uppercase tracking-wider text-sm bg-[#d6422a] text-white border-[3px] border-[#15131f] shadow-[4px_4px_0_#15131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition disabled:opacity-60",
    btnSecondary: "px-4 min-h-[52px] rounded font-bold uppercase tracking-wider text-sm bg-[#e8c547] text-[#15131f] border-[3px] border-[#15131f] shadow-[3px_3px_0_#15131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition",
    panel: "p-4 rounded flex flex-col gap-3 bg-white border-[3px] border-[#15131f] shadow-[4px_4px_0_#15131f]",
    panelLabel: "text-[0.65rem] uppercase tracking-widest font-semibold text-[#6c6680]",
    logList: "flex flex-col gap-2 max-h-[320px] overflow-y-auto",
    logRow: "flex items-center justify-between p-3 rounded border-[3px] border-[#15131f] bg-[#fff8e0] hover:bg-[#e8c547] transition",
    logScore: "font-mono font-bold text-lg text-[#d6422a]",
    logMeta: "text-xs uppercase tracking-wider text-[#6c6680]",
    empty: "text-sm py-6 text-center uppercase tracking-wider text-[#6c6680]",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.brand}>
            <span className={`${c.brandDot} bg-[#d6422a] border-2 border-[#15131f]`} />
            <span className={`${c.brandDot} bg-[#e8c547] border-2 border-[#15131f]`} />
            <span className={`${c.brandDot} bg-[#3aa05a] border-2 border-[#15131f]`} />
            <span className={c.brandText}>Peg Drop</span>
          </div>
          <span className={c.totalChip}>Today {todayTotal}</span>
        </header>

        <main id="app">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar}>
              <span className={`${c.heroSeg} bg-[#d6422a]`} />
              <span className={`${c.heroSeg} bg-[#e8c547]`} />
              <span className={`${c.heroSeg} bg-[#3aa05a]`} />
              <span className={`${c.heroSeg} bg-[#3066d6]`} />
            </div>
            <h1 className={c.heroTitle}>Drop The Ball</h1>
            <p className={c.heroSub}>Bounce. Land. Score.</p>
          </section>

          <section id="board-section" className="flex flex-col gap-3 mt-2">
            <span className={c.panelLabel}>Field</span>
            <div className={c.board}>
              {Array.from({ length: PEG_ROWS }).map((_, r) => (
                <div key={r} className={c.pegRow} style={{ marginTop: r === 0 ? 24 : 18 }}>
                  {Array.from({ length: r % 2 === 0 ? 6 : 7 }).map((_, i) => (
                    <span key={i} className={c.peg} />
                  ))}
                </div>
              ))}
              {ballPos && (
                <span
                  className={c.ball}
                  style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: "translate(-50%, -50%)" }}
                />
              )}
              <div className={c.slotsRow}>
                {SLOTS.map((v, i) => {
                  const tint = v >= 100 ? "bg-[#d6422a] text-white" : v >= 50 ? "bg-[#3066d6] text-white" : v >= 25 ? "bg-[#e8c547] text-[#15131f]" : "bg-[#3aa05a] text-[#15131f]"
                  return <div key={i} className={`${c.slot} ${tint}`}>{v}</div>
                })}
              </div>
            </div>
          </section>

          <section id="drop" className="mt-2">
            <form onSubmit={handleDrop} className={c.dropBar}>
              <button type="submit" disabled={dropping} className={c.btnPrimary}>
                {dropping ? "Dropping…" : "Drop Ball"}
              </button>
              <button type="button" onClick={handleHype} disabled={hyping || drops.length === 0} className={c.btnSecondary}>
                {hyping ? "…" : "Hype"}
              </button>
            </form>
          </section>

          <section id="log" className={c.panel}>
            <span className={c.panelLabel}>Recent Drops</span>
            <ul className={c.logList}>
              {drops.length === 0 && (
                <li className={c.empty}>No drops yet — tap Drop Ball</li>
              )}
              {drops.map(d => (
                <li key={d._id} className={c.logRow}>
                  <span className={c.logScore}>+{d.score}</span>
                  <span className={c.logMeta}>
                    {d.hype ? d.hype : `slot ${d.slot + 1} · ${new Date(d.createdAt).toLocaleTimeString()}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  )
}