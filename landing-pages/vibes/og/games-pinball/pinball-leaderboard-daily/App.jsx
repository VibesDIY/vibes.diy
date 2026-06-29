import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  React.useEffect(() => {
    const links = [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=block" },
    ]
    const els = links.map(l => { const e = document.createElement("link"); Object.assign(e, l); document.head.appendChild(e); return e })
    document.body.style.fontFamily = '"Space Grotesk", sans-serif'
    return () => els.forEach(e => e.remove())
  }, [])
  const { database, useLiveQuery } = useFireproof("pin-key")
  const [name, setName] = React.useState("")
  const [tab, setTab] = React.useState("today")
  const [score, setScore] = React.useState(0)
  const [ball, setBall] = React.useState(1)
  const [running, setRunning] = React.useState(false)
  const [gameOver, setGameOver] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const canvasRef = React.useRef(null)
  const stateRef = React.useRef(null)
  const scoreRef = React.useRef(0)

  const { docs: allRuns } = useLiveQuery("score", { descending: true })
  const startOfDay = (offset = 0) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + offset); return d.getTime() }
  const todayStart = startOfDay(0), tomorrowStart = startOfDay(1), yesterdayStart = startOfDay(-1)
  const todayRuns = allRuns.filter(r => r.createdAt >= todayStart && r.createdAt < tomorrowStart).slice(0, 10)
  const yesterdayRuns = allRuns.filter(r => r.createdAt >= yesterdayStart && r.createdAt < todayStart).slice(0, 10)
  const allTimeRuns = allRuns.slice(0, 10)
  const board = tab === "today" ? todayRuns : tab === "yesterday" ? yesterdayRuns : allTimeRuns
  const boardTitle = tab === "today" ? "Top 10 Today" : tab === "yesterday" ? "Top 10 Yesterday" : "All Time Top 10"
  const best = allTimeRuns[0]?.score ?? 0

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Invent one punchy 3-letter arcade player initials tag (uppercase A-Z only).", {
        schema: { properties: { tag: { type: "string", description: "Three uppercase letters" } } }
      })
      const { tag } = JSON.parse(res)
      const clean = String(tag || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "ACE"
      setName(clean)
    } finally { setIsSuggesting(false) }
  }

  function handleTab(e) {
    const label = e.currentTarget.textContent.trim().toLowerCase()
    if (label.startsWith("today")) setTab("today")
    else if (label.startsWith("yesterday")) setTab("yesterday")
    else setTab("all")
  }

  async function saveRun(finalScore) {
    const tag = (name || "AAA").toUpperCase().slice(0, 3)
    await database.put({ name: tag, score: finalScore, createdAt: Date.now(), type: "run" })
  }

  function handleStart(e) {
    if (e) e.preventDefault()
    if (running) return
    setScore(0); scoreRef.current = 0
    setBall(1); setGameOver(false); setRunning(true)
    stateRef.current = {
      ball: { x: 280, y: 380, vx: 0, vy: 0, launched: false },
      flip: 0,
      bumpers: [
        { x: 90, y: 120, r: 22, color: "#d63d2a" },
        { x: 210, y: 100, r: 22, color: "#f0d040" },
        { x: 150, y: 200, r: 26, color: "#3aa84a" },
        { x: 70, y: 260, r: 18, color: "#2a6fd6" },
        { x: 230, y: 260, r: 18, color: "#2a6fd6" },
      ],
    }
  }

  React.useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const W = 300, H = 400
    let raf, alive = true
    const keys = { space: false }
    const onDown = (e) => { if (e.code === "Space") { e.preventDefault(); keys.space = true } }
    const onUp = (e) => { if (e.code === "Space") { e.preventDefault(); keys.space = false } }
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)

    const tick = () => {
      if (!alive) return
      const s = stateRef.current
      const b = s.ball
      if (!b.launched) {
        if (keys.space) { b.vy = -12 - Math.random() * 2; b.vx = -1.5; b.launched = true }
      } else {
        b.vy += 0.28
        b.vx *= 0.999
        b.x += b.vx; b.y += b.vy
        if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx) * 0.9 }
        if (b.x > W - 8) { b.x = W - 8; b.vx = -Math.abs(b.vx) * 0.9 }
        if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy) * 0.9 }
        if (b.x < W - 30 && b.y > H - 8) {
          alive = false
          setRunning(false); setGameOver(true)
          saveRun(scoreRef.current)
          return
        }
        if (b.x >= W - 30) {
          if (b.x > W - 8) { b.x = W - 8; b.vx = -Math.abs(b.vx) }
        }
        for (const bp of s.bumpers) {
          const dx = b.x - bp.x, dy = b.y - bp.y
          const d = Math.hypot(dx, dy), min = bp.r + 8
          if (d < min && d > 0) {
            const nx = dx / d, ny = dy / d
            b.x = bp.x + nx * min; b.y = bp.y + ny * min
            const dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx) * 1.05
            b.vy = (b.vy - 2 * dot * ny) * 1.05
            scoreRef.current += 100
            setScore(scoreRef.current)
          }
        }
        s.flip = keys.space ? Math.min(1, s.flip + 0.25) : Math.max(0, s.flip - 0.2)
        const flipAng = s.flip * 0.7
        const flippers = [
          { x: 90, y: H - 40, dir: 1, ang: -0.5 + flipAng },
          { x: 210, y: H - 40, dir: -1, ang: 0.5 - flipAng },
        ]
        for (const f of flippers) {
          const len = 60
          const ex = f.x + Math.cos(f.ang) * len * f.dir
          const ey = f.y + Math.sin(f.ang) * len
          const lx = ex - f.x, ly = ey - f.y
          const t = Math.max(0, Math.min(1, ((b.x - f.x) * lx + (b.y - f.y) * ly) / (lx * lx + ly * ly)))
          const cx = f.x + lx * t, cy = f.y + ly * t
          const dx = b.x - cx, dy = b.y - cy
          const d = Math.hypot(dx, dy)
          if (d < 12 && d > 0) {
            const nx = dx / d, ny = dy / d
            b.x = cx + nx * 12; b.y = cy + ny * 12
            const dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx)
            b.vy = (b.vy - 2 * dot * ny)
            if (s.flip > 0.3) { b.vy -= 6; b.vx += f.dir * 2 }
          }
        }
      }
      ctx.fillStyle = "#f5f3ec"
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = "#1a1a24"; ctx.lineWidth = 3
      ctx.strokeRect(W - 30, 0, 30, H - 8)
      for (const bp of s.bumpers) {
        ctx.fillStyle = bp.color
        ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = "#1a1a24"; ctx.lineWidth = 3; ctx.stroke()
      }
      const flipAng = s.flip * 0.7
      const flippers = [
        { x: 90, y: H - 40, dir: 1, ang: -0.5 + flipAng },
        { x: 210, y: H - 40, dir: -1, ang: 0.5 - flipAng },
      ]
      for (const f of flippers) {
        ctx.strokeStyle = "#1a1a24"; ctx.lineWidth = 8; ctx.lineCap = "round"
        ctx.beginPath(); ctx.moveTo(f.x, f.y)
        ctx.lineTo(f.x + Math.cos(f.ang) * 60 * f.dir, f.y + Math.sin(f.ang) * 60)
        ctx.stroke()
      }
      ctx.fillStyle = "#1a1a24"
      ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp) }
  }, [running])

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#1a1a24]",
    header: "w-full px-4 py-4 flex items-center justify-between border-b-[3px] border-[#1a1a24] bg-white",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px] border-[#1a1a24]",
    brandText: "text-sm font-bold uppercase tracking-tight",
    main: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-6",
    nameRow: "flex flex-col gap-2",
    nameLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-[#6b6b7a]",
    nameInputRow: "flex gap-2",
    nameInput: "flex-1 px-3 py-3 border-[3px] border-[#1a1a24] bg-white text-base font-semibold uppercase min-h-[44px] shadow-[3px_3px_0px_#1a1a24] focus:outline-none",
    suggestBtn: "px-3 py-3 border-[3px] border-[#1a1a24] bg-[#f0d040] text-[#1a1a24] text-xs uppercase font-bold min-h-[44px] shadow-[3px_3px_0px_#1a1a24] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    stage: "border-[3px] border-[#1a1a24] bg-white relative overflow-hidden shadow-[4px_4px_0px_#1a1a24]",
    stageBar: "h-[6px] w-full flex",
    stageBarSeg: "flex-1",
    scoreRow: "flex items-stretch border-b-[3px] border-[#1a1a24]",
    scoreCell: "flex-1 px-4 py-3 flex flex-col gap-1 border-r-[3px] border-[#1a1a24] last:border-r-0",
    scoreLabel: "text-[0.6rem] uppercase tracking-[0.15em] font-semibold text-[#6b6b7a]",
    scoreValue: "font-mono text-2xl font-bold",
    canvasWrap: "relative w-full aspect-[3/4] flex items-center justify-center",
    canvas: "w-full h-full block bg-[#f5f3ec]",
    overlay: "absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#f5f3ec]/90",
    overlayTitle: "text-3xl font-bold uppercase tracking-tight",
    overlayHint: "text-xs uppercase tracking-[0.08em] font-semibold text-[#6b6b7a]",
    launchBtn: "px-6 py-3 border-[3px] border-[#1a1a24] bg-[#d63d2a] text-white text-sm uppercase font-bold min-h-[44px] shadow-[4px_4px_0px_#1a1a24] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    tabsCard: "border-[3px] border-[#1a1a24] bg-white shadow-[4px_4px_0px_#1a1a24]",
    tabsRow: "flex border-b-[3px] border-[#1a1a24]",
    tab: "flex-1 px-3 py-3 text-xs uppercase font-bold tracking-[0.05em] border-r-[3px] border-[#1a1a24] last:border-r-0 min-h-[44px] bg-white text-[#1a1a24]",
    boardHead: "px-4 py-3 border-b-[3px] border-[#1a1a24] flex items-center justify-between bg-[#2a6fd6] text-white",
    boardTitle: "text-sm uppercase font-bold tracking-[0.05em]",
    boardCount: "font-mono text-xs opacity-90",
    list: "flex flex-col",
    row: "flex items-center px-4 py-3 border-b-[3px] border-[#1a1a24] last:border-b-0 gap-3 hover:bg-[#f0d040]",
    rank: "font-mono text-sm w-8 text-[#6b6b7a]",
    who: "flex-1 font-semibold uppercase text-sm tracking-tight",
    score: "font-mono text-base font-bold",
    badge: "text-[0.6rem] uppercase font-bold px-2 py-1 border-[3px] border-[#1a1a24] bg-[#3aa84a] text-[#1a1a24]",
    empty: "px-4 py-8 text-center text-sm uppercase tracking-[0.05em] text-[#6b6b7a]",
    footer: "px-4 py-6 text-center text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b7a]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#d63d2a]`}></span>
            <span className={`${c.dot} bg-[#f0d040]`}></span>
            <span className={`${c.dot} bg-[#3aa84a]`}></span>
          </div>
          <span className={c.brandText}>Pin Key</span>
        </div>
        <span className={c.brandText}>v1</span>
      </header>

      <main id="app" className={c.main}>
        <section id="player">
          <form onSubmit={handleStart} className={c.nameRow}>
            <label htmlFor="player-name" className={c.nameLabel}>Player Tag</label>
            <div className={c.nameInputRow}>
              <input id="player-name" className={c.nameInput} placeholder="ABC" maxLength={3} value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0,3))} />
              <button type="button" onClick={handleSuggest} disabled={isSuggesting} className={c.suggestBtn}>
                {isSuggesting ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M12 3a9 9 0 1 1-6.4 2.6" strokeLinecap="round"/></svg>
                ) : "Idea"}
              </button>
            </div>
          </form>
        </section>

        <section id="stage" className={c.stage}>
          <div className={c.stageBar}>
            <span className="flex-1 bg-[#d63d2a]"></span>
            <span className="flex-1 bg-[#f0d040]"></span>
            <span className="flex-1 bg-[#3aa84a]"></span>
            <span className="flex-1 bg-[#2a6fd6]"></span>
          </div>
          <div className={c.scoreRow}>
            <div className={c.scoreCell}>
              <span className={c.scoreLabel}>Score</span>
              <span className={c.scoreValue}>{score}</span>
            </div>
            <div className={c.scoreCell}>
              <span className={c.scoreLabel}>Ball</span>
              <span className={c.scoreValue}>{ball}</span>
            </div>
            <div className={c.scoreCell}>
              <span className={c.scoreLabel}>Best</span>
              <span className={c.scoreValue}>{best}</span>
            </div>
          </div>
          <div className={c.canvasWrap}>
            <canvas ref={canvasRef} className={c.canvas} width="300" height="400"></canvas>
            {!running && (
              <div className={c.overlay}>
                <h2 className={c.overlayTitle}>{gameOver ? `Score ${score}` : "Press Space"}</h2>
                <p className={c.overlayHint}>{gameOver ? "Run saved. Tap to play again." : "Launch and flip with one key"}</p>
                <button type="button" onClick={handleStart} className={c.launchBtn}>{gameOver ? "Play Again" : "Tap to Start"}</button>
              </div>
            )}
          </div>
        </section>

        <section id="boards" className={c.tabsCard}>
          <div className={c.tabsRow}>
            <button type="button" onClick={handleTab} className={`${c.tab} ${tab === "today" ? "bg-[#f0d040]" : ""}`}>Today</button>
            <button type="button" onClick={handleTab} className={`${c.tab} ${tab === "yesterday" ? "bg-[#f0d040]" : ""}`}>Yesterday</button>
            <button type="button" onClick={handleTab} className={`${c.tab} ${tab === "all" ? "bg-[#f0d040]" : ""}`}>All Time</button>
          </div>
          <div className={c.boardHead}>
            <span className={c.boardTitle}>{boardTitle}</span>
            <span className={c.boardCount}>{String(board.length).padStart(2,"0")} runs</span>
          </div>
          <ul className={c.list}>
            {board.length === 0 && <li className={c.empty}>No runs yet — be the first.</li>}
            {board.map((r, i) => (
              <li key={r._id} className={c.row}>
                <span className={c.rank}>{String(i + 1).padStart(2, "0")}</span>
                <span className={c.who}>{r.name}</span>
                <span className={c.score}>{r.score}</span>
                {tab === "today" && i === 0 && <span className={c.badge}>Hot</span>}
              </li>
            ))}
          </ul>
        </section>

        <footer className={c.footer}>One key. One ball. One shot.</footer>
      </main>
    </div>
  )
}