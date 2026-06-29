import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function useFonts() {
  React.useEffect(() => {
    const links = [
      ["preconnect", "https://fonts.googleapis.com"],
      ["preconnect", "https://fonts.gstatic.com", true],
    ]
    const created = []
    links.forEach(([rel, href, cors]) => {
      const l = document.createElement("link")
      l.rel = rel; l.href = href
      if (cors) l.crossOrigin = "anonymous"
      document.head.appendChild(l); created.push(l)
    })
    const f = document.createElement("link")
    f.rel = "stylesheet"
    f.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=block"
    document.head.appendChild(f); created.push(f)
    document.body.style.fontFamily = '"Space Grotesk", sans-serif'
    return () => created.forEach((n) => n.remove())
  }, [])
}

export default function App() {
  useFonts()

  const { database, useLiveQuery } = useFireproof("darts-bullseye")
  const [score, setScore] = React.useState(501)
  const [turn, setTurn] = React.useState(1)
  const [turnDarts, setTurnDarts] = React.useState([])
  const [matchId, setMatchId] = React.useState(() => `m-${Date.now()}`)
  const [crossX, setCrossX] = React.useState(50)
  const [crossY, setCrossY] = React.useState(50)
  const [coachText, setCoachText] = React.useState('Hit "Suggest Checkout" for a target plan.')
  const [isCoaching, setIsCoaching] = React.useState(false)
  const [won, setWon] = React.useState(false)

  const { docs: throws } = useLiveQuery("type", { key: "throw", descending: true })
  const { docs: matches } = useLiveQuery("type", { key: "match", descending: true, limit: 8 })

  const totalDarts = throws.length
  const totalScored = throws.reduce((s, d) => s + (d.points || 0), 0)
  const lifetimeAvg = totalDarts ? (totalScored / totalDarts).toFixed(2) : "0.00"
  const wins = matches.filter((m) => m.won).length

  // animate crosshair
  React.useEffect(() => {
    let raf, t0 = performance.now()
    const loop = (t) => {
      const dt = (t - t0) / 1000
      setCrossX(50 + Math.sin(dt * 1.7) * 38)
      setCrossY(50 + Math.cos(dt * 1.1) * 32)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  function scoreFromPosition(x, y) {
    // x,y in 0..100; center at 50,50. radius% from center.
    const dx = x - 50, dy = y - 50
    const r = Math.sqrt(dx * dx + dy * dy)
    // segments: 0-4 bull50, 4-5 bull25, 5-14 inner single (random 1-20),
    // 14-15 triple, 15-26 outer single, 26-27 double, else miss
    const seg = Math.floor(Math.random() * 20) + 1
    if (r < 4) return { points: 50, label: "BULL", isDouble: true }
    if (r < 5) return { points: 25, label: "25", isDouble: false }
    if (r < 14) return { points: seg, label: `${seg}`, isDouble: false }
    if (r < 15) return { points: seg * 3, label: `T${seg}`, isDouble: false }
    if (r < 26) return { points: seg, label: `${seg}`, isDouble: false }
    if (r < 27) return { points: seg * 2, label: `D${seg}`, isDouble: true }
    return { points: 0, label: "MISS", isDouble: false }
  }

  async function handleThrow(e) {
    e.preventDefault?.()
    if (won || turnDarts.length >= 3) return
    const hit = scoreFromPosition(crossX, crossY)
    const next = [...turnDarts, hit]
    let newScore = score - hit.points
    let bust = false
    let finished = false
    if (newScore < 0 || newScore === 1) { bust = true; newScore = score }
    else if (newScore === 0 && hit.isDouble) { finished = true }
    else if (newScore === 0 && !hit.isDouble) { bust = true; newScore = score }

    await database.put({
      type: "throw",
      matchId,
      turn,
      points: bust ? 0 : hit.points,
      label: hit.label,
      bust,
      createdAt: Date.now(),
    })

    if (finished) {
      setScore(0); setTurnDarts(next); setWon(true)
      await database.put({ type: "match", matchId, won: true, finishedAt: Date.now() })
      return
    }
    if (bust) {
      setTurnDarts([...next])
      setTimeout(() => { setTurn(turn + 1); setTurnDarts([]) }, 700)
      return
    }
    setScore(newScore); setTurnDarts(next)
    if (next.length === 3) setTimeout(() => { setTurn(turn + 1); setTurnDarts([]) }, 700)
  }

  function handleNewMatch() {
    setScore(501); setTurn(1); setTurnDarts([]); setWon(false)
    setMatchId(`m-${Date.now()}`)
    setCoachText('Hit "Suggest Checkout" for a target plan.')
  }

  async function handleCoach() {
    setIsCoaching(true)
    try {
      const res = await callAI(`I have ${score} points left in 501 darts and must finish on a double. Suggest a 1-3 dart checkout plan in one short sentence.`, {
        schema: { properties: { plan: { type: "string" } } }
      })
      const { plan } = JSON.parse(res)
      setCoachText(plan)
    } catch (err) { setCoachText("Coach unavailable.") }
    finally { setIsCoaching(false) }
  }


  const c = {
    page: "min-h-screen w-full bg-[#f5f1e8] text-[#1a1625]",
    header: "px-5 py-4 flex items-center justify-between bg-white border-[3px] border-[#1a1625] m-3 rounded shadow-[4px_4px_0px_#1a1625]",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3",
    title: "text-xl font-bold tracking-tight uppercase",
    main: "max-w-[920px] mx-auto px-4 pb-24 pt-2 space-y-5",
    section: "p-4 rounded bg-white border-[3px] border-[#1a1625] shadow-[4px_4px_0px_#1a1625]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-2 text-[#6b6577] font-semibold",
    scoreboard: "grid grid-cols-3 gap-3",
    scoreCard: "rounded text-center border-[3px] border-[#1a1625] bg-white overflow-hidden shadow-[3px_3px_0px_#1a1625]",
    scoreNum: "text-3xl font-bold font-mono",
    scoreLabel: "text-[0.6rem] uppercase tracking-[0.15em] mt-1 text-[#6b6577] font-semibold",
    boardWrap: "relative aspect-square w-full max-w-[420px] mx-auto rounded overflow-hidden select-none cursor-crosshair border-[3px] border-[#1a1625] shadow-[4px_4px_0px_#1a1625] touch-none",
    board: "absolute inset-2 rounded-full border-[3px] border-[#1a1625]",
    crosshair: "absolute w-8 h-8 pointer-events-none -translate-x-1/2 -translate-y-1/2",
    crosshairLine: "absolute bg-[#1a1625]",
    throwBtn: "w-full py-4 rounded font-bold uppercase tracking-[0.08em] min-h-[56px] bg-[#d63d28] text-white border-[3px] border-[#1a1625] shadow-[4px_4px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all mt-4 disabled:opacity-50",
    turnDarts: "flex gap-2 justify-center mt-3",
    dart: "px-3 py-2 rounded font-mono text-sm min-w-[60px] text-center bg-[#f5f1e8] border-[3px] border-[#1a1625] font-bold",
    actionsRow: "flex gap-2 flex-wrap",
    btn: "px-4 py-3 rounded font-bold uppercase tracking-[0.05em] text-xs min-h-[44px] bg-[#3a6dd6] text-white border-[3px] border-[#1a1625] shadow-[3px_3px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50",
    btnSecondary: "px-4 py-3 rounded font-bold uppercase tracking-[0.05em] text-xs min-h-[44px] bg-[#e8c547] border-[3px] border-[#1a1625] shadow-[3px_3px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    historyList: "space-y-2",
    historyRow: "flex items-center justify-between p-3 rounded bg-[#f5f1e8] border-[3px] border-[#1a1625]",
    historyLabel: "text-sm font-semibold",
    historyMeta: "text-xs font-mono",
    coachBox: "p-3 rounded text-sm mt-3 bg-[#fdf6d8] border-[3px] border-[#1a1625]",
    statsGrid: "grid grid-cols-2 gap-3",
    statCard: "p-3 rounded bg-[#f5f1e8] border-[3px] border-[#1a1625] text-center",
    statNum: "text-2xl font-bold font-mono",
    statLabel: "text-[0.6rem] uppercase tracking-[0.15em] mt-1 text-[#6b6577] font-semibold",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className="w-3 h-3 bg-[#d63d28] border-2 border-[#1a1625]" />
            <span className="w-3 h-3 bg-[#e8c547] border-2 border-[#1a1625]" />
            <span className="w-3 h-3 bg-[#3da35d] border-2 border-[#1a1625]" />
          </div>
          <h1 className={c.title}>Bullseye Blitz</h1>
        </div>
        <button className={c.btnSecondary} onClick={handleNewMatch}>New Match</button>
      </header>

      <main id="app">
        <div className={c.main}>
          <section id="scoreboard" className={c.section}>
            <div className={c.sectionLabel}>Match</div>
            <div className={c.scoreboard}>
              <div className={c.scoreCard}>
                <div className="bg-[#d63d28] h-2 border-b-[3px] border-[#1a1625]" />
                <div className="p-3">
                  <div className={c.scoreNum}>{score}</div>
                  <div className={c.scoreLabel}>Remaining</div>
                </div>
              </div>
              <div className={c.scoreCard}>
                <div className="bg-[#e8c547] h-2 border-b-[3px] border-[#1a1625]" />
                <div className="p-3">
                  <div className={c.scoreNum}>{turn}</div>
                  <div className={c.scoreLabel}>Turn</div>
                </div>
              </div>
              <div className={c.scoreCard}>
                <div className="bg-[#3da35d] h-2 border-b-[3px] border-[#1a1625]" />
                <div className="p-3">
                  <div className={c.scoreNum}>{3 - turnDarts.length}</div>
                  <div className={c.scoreLabel}>Darts Left</div>
                </div>
              </div>
            </div>
            <div className={c.turnDarts}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={c.dart}>{turnDarts[i] ? turnDarts[i].label : "—"}</div>
              ))}
            </div>
          </section>

          <section id="board" className={c.section}>
            <div className={c.sectionLabel}>Throw</div>
            <div className={c.boardWrap} onClick={handleThrow} role="button" aria-label="Dartboard">
              <div
                className={c.board}
                style={{
                  background:
                    "radial-gradient(circle, #d63d28 0 8%, #1a1625 8% 10%, #e8c547 10% 28%, #1a1625 28% 30%, #3da35d 30% 55%, #1a1625 55% 57%, #f5f1e8 57% 82%, #1a1625 82% 84%, #d63d28 84% 100%)",
                }}
              />
              <div className={c.crosshair} style={{ left: `${crossX}%`, top: `${crossY}%` }}>
                <div className={c.crosshairLine} style={{ left: 0, right: 0, top: "50%", height: 3, transform: "translateY(-50%)" }} />
                <div className={c.crosshairLine} style={{ top: 0, bottom: 0, left: "50%", width: 3, transform: "translateX(-50%)" }} />
              </div>
            </div>
            <button className={c.throwBtn} onClick={handleThrow} disabled={won || turnDarts.length >= 3}>
              {won ? "You Won!" : turnDarts.length >= 3 ? "Turn Over" : "Tap to Throw"}
            </button>
          </section>

          <section id="coach" className={c.section}>
            <div className={c.sectionLabel}>Coach</div>
            <div className={c.actionsRow}>
              <button className={c.btn} onClick={handleCoach} disabled={isCoaching}>
                {isCoaching ? (
                  <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 3 a9 9 0 0 1 9 9" />
                  </svg>
                ) : "Suggest Checkout"}
              </button>
            </div>
            <div className={c.coachBox}>{coachText}</div>
          </section>

          <section id="stats" className={c.section}>
            <div className={c.sectionLabel}>Lifetime</div>
            <div className={c.statsGrid}>
              <div className={c.statCard}>
                <div className={c.statNum}>{lifetimeAvg}</div>
                <div className={c.statLabel}>Avg / Dart</div>
              </div>
              <div className={c.statCard}>
                <div className={c.statNum}>{wins}</div>
                <div className={c.statLabel}>Matches Won</div>
              </div>
            </div>
          </section>

          <section id="history" className={c.section}>
            <div className={c.sectionLabel}>Recent Matches</div>
            <ul className={c.historyList}>
              {matches.length === 0 && (
                <li className={c.historyRow}>
                  <span className={c.historyLabel}>No matches yet</span>
                  <span className={c.historyMeta}>—</span>
                </li>
              )}
              {matches.map((m) => (
                <li key={m._id} className={c.historyRow}>
                  <span className={c.historyLabel}>{m.won ? "Win" : "Match"}</span>
                  <span className={c.historyMeta}>{new Date(m.finishedAt || 0).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}