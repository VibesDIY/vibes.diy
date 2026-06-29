import React, { useRef, useState, useEffect, useCallback } from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const TOTAL_RINGS = 5
const PEGS = [
  { x: 0.25, y: 0.35, points: 10 },
  { x: 0.5, y: 0.25, points: 25 },
  { x: 0.75, y: 0.35, points: 10 },
  { x: 0.35, y: 0.55, points: 15 },
  { x: 0.65, y: 0.55, points: 15 },
]

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("carnival-ring-toss")
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [ringsLeft, setRingsLeft] = useState(TOTAL_RINGS)
  const [gameOver, setGameOver] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [ringAnim, setRingAnim] = useState(null)
  const animRef = useRef(null)

  const { docs: highScores } = useLiveQuery("type", { key: "score" })
  const { docs: throws } = useLiveQuery("type", { key: "throw" })

  const draw = useCallback((ctx, w, h, animRing) => {
    ctx.fillStyle = "#1e3a8a"
    ctx.fillRect(0, 0, w, h)

    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#dc2626" : "#fef3c7"
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.arc(w / 2, 0, w, (Math.PI / 6) * i, (Math.PI / 6) * (i + 1))
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = "rgba(30, 58, 138, 0.75)"
    ctx.fillRect(0, 0, w, h)

    const stars = [[0.1, 0.1], [0.9, 0.15], [0.15, 0.8], [0.85, 0.75], [0.5, 0.08]]
    ctx.fillStyle = "#fde68a"
    for (const [sx, sy] of stars) {
      ctx.font = `${w * 0.04}px serif`
      ctx.fillText("⭐", sx * w, sy * h)
    }

    for (const peg of PEGS) {
      const px = peg.x * w
      const py = peg.y * h
      const r = w * 0.025
      ctx.fillStyle = "#fde68a"
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = "#1a1033"
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = "#fff"
      ctx.font = `bold ${w * 0.03}px sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(peg.points, px, py + h * 0.07)
    }

    if (animRing) {
      ctx.strokeStyle = animRing.hit ? "#16a34a" : "#dc2626"
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(animRing.x * w, animRing.y * h, w * 0.045, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.fillStyle = "#fef3c7"
    ctx.font = `bold ${w * 0.035}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("🎪 RING TOSS 🎪", w / 2, h * 0.95)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    draw(ctx, rect.width, rect.height, ringAnim)
  }, [draw, ringAnim])

  const throwRing = useCallback(async (startPt, endPt) => {
    if (ringsLeft <= 0 || gameOver || !can("write")) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const dx = (endPt.x - startPt.x) / rect.width
    const dy = (endPt.y - startPt.y) / rect.height

    const landX = 0.5 - dx * 2
    const landY = 0.7 + dy * 2

    let hitPeg = null
    for (const peg of PEGS) {
      const dist = Math.sqrt((landX - peg.x) ** 2 + (landY - peg.y) ** 2)
      if (dist < 0.08) {
        hitPeg = peg
        break
      }
    }

    const frames = 20
    let frame = 0
    const animate = () => {
      const t = frame / frames
      const cx = 0.5 + (landX - 0.5) * t
      const cy = 0.9 - (0.9 - (hitPeg ? hitPeg.y : landY)) * t - Math.sin(t * Math.PI) * 0.15
      setRingAnim({ x: cx, y: cy, hit: !!hitPeg })
      frame++
      if (frame <= frames) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        const newScore = score + (hitPeg ? hitPeg.points : 0)
        const newRings = ringsLeft - 1
        setScore(newScore)
        setRingsLeft(newRings)

        database.put({
          type: "throw",
          by: viewer?.name || "Guest",
          hit: !!hitPeg,
          points: hitPeg ? hitPeg.points : 0,
          created: Date.now(),
        })

        if (newRings <= 0) {
          setGameOver(true)
          if (newScore > 0) {
            database.put({
              type: "score",
              by: viewer?.name || "Guest",
              score: newScore,
              created: Date.now(),
            })
          }
        }

        setTimeout(() => setRingAnim(null), 600)
      }
    }
    animate()
  }, [ringsLeft, gameOver, can, score, viewer, database])

  const handlePointerDown = (e) => {
    if (!can("write") || gameOver || ringsLeft <= 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    setDragging(true)
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handlePointerMove = (e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handlePointerUp = () => {
    if (!dragging || !dragStart || !dragEnd) return
    setDragging(false)
    throwRing(dragStart, dragEnd)
    setDragStart(null)
    setDragEnd(null)
  }

  const resetGame = () => {
    setScore(0)
    setRingsLeft(TOTAL_RINGS)
    setGameOver(false)
    setRingAnim(null)
    if (animRef.current) cancelAnimationFrame(animRef.current)
  }

  const c = {
    page: "min-h-screen bg-[#fef3c7] text-[#1a1033] font-sans pb-24",
    header: "sticky top-0 z-10 bg-[#dc2626] text-[#fef3c7] px-4 py-3 border-b-4 border-[#1a1033] shadow-lg",
    title: "text-2xl font-bold tracking-tight",
    tagline: "text-xs text-[#fde68a] mt-0.5",
    main: "px-3 py-4 max-w-2xl mx-auto space-y-4",
    section: "bg-white border-4 border-[#1a1033] rounded p-3 shadow-[4px_4px_0_0_#1a1033]",
    sectionAlt: "bg-[#fde68a] border-4 border-[#1a1033] rounded p-3 shadow-[4px_4px_0_0_#1a1033]",
    h2: "text-lg font-bold text-[#1a1033] mb-2 uppercase tracking-wide",
    btn: "bg-[#16a34a] text-white font-bold px-4 py-3 rounded border-2 border-[#1a1033] min-h-[44px] shadow-[2px_2px_0_0_#1a1033] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50",
    btnAccent: "bg-[#dc2626] text-white font-bold px-4 py-3 rounded border-2 border-[#1a1033] min-h-[44px] shadow-[2px_2px_0_0_#1a1033] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    canvas: "w-full aspect-square bg-[#2563eb] border-4 border-[#1a1033] rounded touch-none cursor-crosshair",
    stat: "flex-1 text-center bg-white border-2 border-[#1a1033] rounded px-2 py-2",
    statLabel: "text-xs uppercase font-bold text-[#dc2626]",
    statValue: "text-2xl font-bold text-[#1a1033]",
    row: "flex items-center justify-between gap-2 py-2 border-b-2 border-[#fde68a] last:border-b-0",
    muted: "text-sm text-[#6b5b3a]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>🎪 Ring Toss Carnival</h1>
        <p className={c.tagline}>Drag to aim · Release to throw</p>
      </header>
      <main id="app" className={c.main}>
        <section id="game-board" className={c.section}>
          <h2 className={c.h2}>Booth</h2>
          <canvas
            ref={canvasRef}
            className={c.canvas}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          <p className={c.muted + " mt-2 text-center"}>
            {can("write") ? "Drag on the booth to aim your throw" : "Spectator view — read only"}
          </p>
        </section>
        <section id="current-stats" className={c.sectionAlt}>
          <h2 className={c.h2}>Your Round</h2>
          <div className="flex gap-2 mb-3">
            <div className={c.stat}>
              <div className={c.statLabel}>Score</div>
              <div className={c.statValue}>{score}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statLabel}>Rings</div>
              <div className={c.statValue}>{ringsLeft}</div>
            </div>
          </div>
          {gameOver && <p className="text-center font-bold text-[#dc2626] mb-2">Game Over! Final: {score}</p>}
          {can("write") && (
            <button onClick={resetGame} className={c.btnAccent + " w-full"}>
              {gameOver ? "Play Again" : "Reset Game"}
            </button>
          )}
        </section>
        <section id="high-scores" className={c.section}>
          <h2 className={c.h2}>🏆 High Scores</h2>
          {highScores.length === 0 ? (
            <p className={c.muted}>No scores yet — be the first!</p>
          ) : (
            <ul>
              {[...highScores].sort((a, b) => b.score - a.score).slice(0, 5).map((s, i) => (
                <li key={s._id} className={c.row}>
                  <span className="font-bold">#{i + 1} {s.by}</span>
                  <span className="text-xl font-bold text-[#dc2626]">{s.score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="throw-history" className={c.section}>
          <h2 className={c.h2}>Recent Throws</h2>
          {throws.filter(t => t.type === "throw").length === 0 ? (
            <p className={c.muted}>No throws yet.</p>
          ) : (
            <ul>
              {throws.filter(t => t.type === "throw").slice(0, 6).map((t) => (
                <li key={t._id} className={c.row}>
                  <span className="text-sm">{t.by}</span>
                  <span className={t.hit ? "font-bold text-[#16a34a]" : "text-[#6b5b3a]"}>
                    {t.hit ? `+${t.points} ringed!` : "missed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
