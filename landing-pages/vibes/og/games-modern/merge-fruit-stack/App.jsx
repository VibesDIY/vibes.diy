import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, database } = useFireproof("merge-drop-scores")
  const { docs: scores } = useLiveQuery("score", { descending: true })
  const [name, setName] = useState("")
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => {
    const links = [
      ["preconnect", "https://fonts.googleapis.com"],
      ["preconnect", "https://fonts.gstatic.com", true],
      ["stylesheet", "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=block"],
    ]
    links.forEach(([rel, href, cross]) => {
      const l = document.createElement("link")
      l.rel = rel; l.href = href; if (cross) l.crossOrigin = ""
      document.head.appendChild(l)
    })
    document.body.style.fontFamily = '"Space Grotesk", sans-serif'
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const W = canvas.width, H = canvas.height
    const CEILING = 60
    const TIERS = [
      { r: 14, color: "#d63b1f" },
      { r: 19, color: "#e8854a" },
      { r: 25, color: "#e8c43a" },
      { r: 32, color: "#a8cc3a" },
      { r: 40, color: "#3a9b4a" },
      { r: 50, color: "#3aa8a0" },
      { r: 62, color: "#3066d6" },
      { r: 76, color: "#7a3ad6" },
    ]
    let balls = []
    let aimX = W / 2
    let nextTier = 0
    let cooldown = 0
    let scoreLocal = 0
    let dead = false
    let raf

    const reset = () => {
      balls = []; nextTier = Math.floor(Math.random() * 3); cooldown = 0; scoreLocal = 0; dead = false; setScore(0); setOver(false)
    }
    stateRef.current = { reset }

    const drop = () => {
      if (dead || cooldown > 0) return
      const t = TIERS[nextTier]
      balls.push({ x: aimX, y: 30, vx: 0, vy: 0, r: t.r, tier: nextTier })
      nextTier = Math.floor(Math.random() * 3)
      cooldown = 30
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
      aimX = Math.max(20, Math.min(W - 20, cx * (W / rect.width)))
    }
    const onDown = (e) => { onMove(e); drop() }
    canvas.addEventListener("mousemove", onMove)
    canvas.addEventListener("mousedown", onDown)
    canvas.addEventListener("touchmove", onMove, { passive: true })
    canvas.addEventListener("touchstart", onDown, { passive: true })

    const step = () => {
      if (cooldown > 0) cooldown--
      // physics
      for (const b of balls) {
        b.vy += 0.4
        b.x += b.vx; b.y += b.vy
        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -0.4 }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -0.4 }
        if (b.y + b.r > H) { b.y = H - b.r; b.vy *= -0.3; b.vx *= 0.92 }
      }
      // collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.hypot(dx, dy), min = a.r + b.r
          if (d < min && d > 0) {
            if (a.tier === b.tier && a.tier < TIERS.length - 1) {
              const nt = a.tier + 1
              const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2
              balls.splice(j, 1); balls.splice(i, 1)
              balls.push({ x: nx, y: ny, vx: 0, vy: -2, r: TIERS[nt].r, tier: nt })
              scoreLocal += (nt + 1) * 10
              setScore(scoreLocal)
              i = -1; break
            } else {
              const nx = dx / d, ny = dy / d
              const overlap = (min - d) / 2
              a.x -= nx * overlap; a.y -= ny * overlap
              b.x += nx * overlap; b.y += ny * overlap
              const p = (a.vx * nx + a.vy * ny) - (b.vx * nx + b.vy * ny)
              a.vx -= p * nx * 0.5; a.vy -= p * ny * 0.5
              b.vx += p * nx * 0.5; b.vy += p * ny * 0.5
            }
          }
        }
      }
      // ceiling check
      if (!dead) {
        for (const b of balls) {
          if (b.y - b.r < CEILING && Math.abs(b.vy) < 0.5) {
            dead = true; setOver(true); setRunning(false)
            const maxTier = balls.reduce((m, x) => Math.max(m, x.tier), 0)
            if (scoreLocal > 0) database.put({ score: scoreLocal, name: name || "anon", maxTier, createdAt: Date.now() })
            break
          }
        }
      }
      // draw
      ctx.fillStyle = "#fffaf0"; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = "#d63b1f"; ctx.lineWidth = 2; ctx.setLineDash([6, 6])
      ctx.beginPath(); ctx.moveTo(0, CEILING); ctx.lineTo(W, CEILING); ctx.stroke(); ctx.setLineDash([])
      // aim guide
      if (!dead) {
        const t = TIERS[nextTier]
        ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(aimX, 0); ctx.lineTo(aimX, H); ctx.stroke()
        ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(aimX, 30, t.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.stroke()
      }
      for (const b of balls) {
        ctx.fillStyle = TIERS[b.tier].color
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.stroke()
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener("mousemove", onMove)
      canvas.removeEventListener("mousedown", onDown)
      canvas.removeEventListener("touchmove", onMove)
      canvas.removeEventListener("touchstart", onDown)
    }
  }, [name, database])
  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#0f172a]",
    shell: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-5",
    header: "flex items-center justify-between gap-3 p-4 border-[3px] border-[#0f172a] rounded bg-white shadow-[4px_4px_0px_#0f172a]",
    brand: "flex items-center gap-2",
    swatches: "flex gap-1",
    sw: "w-3 h-3 border-[2px]",
    title: "text-xl font-bold tracking-tight uppercase",
    nameRow: "flex gap-2 items-stretch p-3 border-[3px] border-[#0f172a] rounded bg-white shadow-[4px_4px_0px_#0f172a]",
    input: "flex-1 px-3 py-3 border-[3px] border-[#0f172a] rounded bg-white min-h-[44px] uppercase tracking-wider text-sm focus:outline-none",
    suggest: "px-3 py-3 border-[3px] border-[#0f172a] rounded bg-[#e8c43a] min-h-[44px] text-xs uppercase tracking-wider font-bold shadow-[3px_3px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    main: "flex flex-col gap-5",
    arena: "relative border-[3px] border-[#0f172a] rounded p-3 flex flex-col gap-3 bg-white shadow-[4px_4px_0px_#0f172a]",
    scoreBar: "flex items-center justify-between gap-3",
    scoreLabel: "text-[0.65rem] uppercase tracking-[0.15em]",
    scoreNum: "text-3xl font-bold font-mono",
    canvasWrap: "relative w-full border-[3px] border-[#0f172a] rounded overflow-hidden bg-[#fffaf0]",
    canvas: "block w-full touch-none",
    overlay: "absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-[#0f172a]/70 text-white",
    bigBtn: "px-6 py-3 border-[3px] border-[#0f172a] rounded bg-[#d63b1f] text-white uppercase tracking-wider text-sm font-bold min-h-[44px] shadow-[4px_4px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "px-4 py-3 border-[3px] border-[#0f172a] rounded bg-white uppercase tracking-wider text-xs min-h-[44px] font-bold hover:shadow-[3px_3px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    board: "border-[3px] border-[#0f172a] rounded p-4 flex flex-col gap-3 bg-white shadow-[4px_4px_0px_#0f172a]",
    boardHead: "flex items-center justify-between",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6c80] font-medium",
    list: "flex flex-col",
    row: "flex items-center justify-between gap-3 px-3 py-3 border-b-[2px] border-[#0f172a] cursor-pointer hover:bg-[#e8c43a] transition-colors",
    rank: "font-bold text-sm w-8 font-mono",
    who: "flex-1 text-sm uppercase tracking-wider truncate",
    pts: "text-sm font-bold font-mono",
    when: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6c80] font-mono",
    empty: "px-3 py-6 text-center text-sm uppercase tracking-wider text-[#6b6c80]",
    detail: "fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#0f172a]/60",
    detailCard: "w-full max-w-md border-[3px] border-[#0f172a] rounded bg-white shadow-[8px_8px_0px_#0f172a]",
    detailBar: "px-4 py-2 border-b-[3px] border-[#0f172a] uppercase tracking-wider text-sm font-bold bg-[#3066d6] text-white",
    detailBody: "p-4 flex flex-col gap-3",
    detailRow: "flex justify-between text-sm",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.brand}>
            <div className={c.swatches}>
              <div className={`${c.sw} bg-[#d63b1f] border-[#0f172a]`}></div>
              <div className={`${c.sw} bg-[#e8c43a] border-[#0f172a]`}></div>
              <div className={`${c.sw} bg-[#3a9b4a] border-[#0f172a]`}></div>
            </div>
            <h1 className={c.title}>Merge Drop</h1>
          </div>
          <div className={c.sectionLabel}>Stack & Pop</div>
        </header>

        <main id="app" className={c.main}>
          <section id="player" className={c.nameRow}>
            <input
              className={c.input}
              placeholder="Your handle"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
            />
            <button className={c.suggest} disabled={busy} onClick={async () => {
              setBusy(true)
              try {
                const r = await callAI("Generate one short playful arcade gamertag, all caps, max 12 chars, no spaces.", { schema: { properties: { handle: { type: "string" } } } })
                const j = JSON.parse(r)
                if (j.handle) setName(j.handle.toUpperCase().slice(0, 16))
              } finally { setBusy(false) }
            }}>{busy ? "..." : "Surprise"}</button>
          </section>

          <section id="arena" className={c.arena}>
            <div className={c.scoreBar}>
              <div>
                <div className={c.scoreLabel}>Score</div>
                <div className={c.scoreNum}>{score}</div>
              </div>
              <button className={c.btnGhost} onClick={() => { stateRef.current?.reset?.(); setScore(0); setOver(false); setRunning(true) }}>Reset</button>
            </div>
            <div className={c.canvasWrap}>
              <canvas ref={canvasRef} className={c.canvas} width="360" height="540"></canvas>
              {(!running || over) && (
                <div className={c.overlay}>
                  <div className="text-2xl font-bold uppercase tracking-tight">{over ? "Game Over" : "Ready?"}</div>
                  {over && <div className="font-mono text-lg">Score {score}</div>}
                  <button className={c.bigBtn} onClick={() => { stateRef.current?.reset?.(); setScore(0); setOver(false); setRunning(true) }}>{over ? "Play Again" : "Drop"}</button>
                </div>
              )}
            </div>
          </section>

          <section id="board" className={c.board}>
            <div className={c.boardHead}>
              <div className={c.sectionLabel}>High Scores</div>
              <div className={c.sectionLabel}>Top 10</div>
            </div>
            <ul className={c.list}>
              {scores.length === 0 && <li className={c.empty}>No runs yet — drop some circles</li>}
              {scores.slice(0, 10).map((d, i) => (
                <li key={d._id} className={c.row} onClick={() => setDetail(d)}>
                  <span className={c.rank}>#{i + 1}</span>
                  <span className={c.who}>{d.name || "anon"}</span>
                  <span className={c.pts}>{d.score}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
      {detail && (
        <div className={c.detail} onClick={() => setDetail(null)}>
          <div className={c.detailCard} onClick={(e) => e.stopPropagation()}>
            <div className={c.detailBar}>Run Detail</div>
            <div className={c.detailBody}>
              <div className={c.detailRow}><span className={c.sectionLabel}>Player</span><span className="font-bold uppercase">{detail.name || "anon"}</span></div>
              <div className={c.detailRow}><span className={c.sectionLabel}>Score</span><span className="font-mono font-bold">{detail.score}</span></div>
              <div className={c.detailRow}><span className={c.sectionLabel}>Top Tier</span><span className="font-mono">{detail.maxTier ?? "—"}</span></div>
              <div className={c.detailRow}><span className={c.sectionLabel}>When</span><span className="font-mono text-xs">{new Date(detail.createdAt).toLocaleString()}</span></div>
              <button className={c.btnGhost} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}