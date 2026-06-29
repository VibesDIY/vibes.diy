import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const canvasRef = React.useRef(null)
  const { database, useLiveQuery } = useFireproof("pinball-zone")
  const { docs: scores } = useLiveQuery("type", { key: "score", descending: true, limit: 50 })

  const [name, setName] = React.useState("")
  const [score, setScore] = React.useState(0)
  const [hits, setHits] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const stateRef = React.useRef({ ball: null, flipL: false, flipR: false, lAngle: 0, rAngle: 0 })

  const top10 = React.useMemo(
    () => [...scores].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10),
    [scores]
  )
  const best = top10[0]?.score || 0

  function startGame(e) {
    if (e) e.preventDefault()
    setScore(0)
    setHits(0)
    stateRef.current.ball = { x: 380, y: 100, vx: -2, vy: 0, r: 9 }
    setRunning(true)
  }

  async function handleSuggestName() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Generate one short punchy arcade player handle, all caps, 3-10 letters, no spaces.", {
        schema: { properties: { handle: { type: "string" } } }
      })
      const data = JSON.parse(res)
      if (data.handle) setName(data.handle.toUpperCase().slice(0, 14))
    } catch (err) { console.error(err) }
    finally { setIsSuggesting(false) }
  }

  // Bumpers + flippers geometry
  const W = 400, H = 560
  const bumpers = [
    { x: 110, y: 180, r: 26, color: "#d94327" },
    { x: 290, y: 180, r: 26, color: "#3aa856" },
    { x: 200, y: 280, r: 28, color: "#f0c64a" },
  ]
  const flipL = { px: 130, py: 490, len: 70 }
  const flipR = { px: 270, py: 490, len: 70 }

  // Keyboard
  React.useEffect(() => {
    function down(e) {
      if (e.repeat) return
      if (e.key === "a" || e.key === "A") stateRef.current.flipL = true
      if (e.key === "l" || e.key === "L") stateRef.current.flipR = true
    }
    function up(e) {
      if (e.key === "a" || e.key === "A") stateRef.current.flipL = false
      if (e.key === "l" || e.key === "L") stateRef.current.flipR = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up) }
  }, [])

  // Physics + render loop
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let raf
    function frame() {
      const s = stateRef.current
      // Flipper angles
      const target = (down) => down ? -0.9 : 0.3
      s.lAngle += (target(s.flipL) - s.lAngle) * 0.4
      s.rAngle += (-target(s.flipR) - s.rAngle) * 0.4

      // Clear
      ctx.fillStyle = "#1a1a26"
      ctx.fillRect(0, 0, W, H)
      // Side rails
      ctx.fillStyle = "#15151f"
      ctx.fillRect(0, 0, 12, H)
      ctx.fillRect(W - 12, 0, 12, H)
      // Top wall
      ctx.fillRect(0, 0, W, 12)

      // Bumpers
      for (const b of bumpers) {
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = b.color
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = "#15151f"
        ctx.stroke()
      }

      // Flippers
      function drawFlipper(p, angle, dir) {
        ctx.save()
        ctx.translate(p.px, p.py)
        ctx.rotate(angle * dir)
        ctx.fillStyle = "#f0c64a"
        ctx.strokeStyle = "#15151f"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(0, -8, p.len * dir, 16, 6)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
      drawFlipper(flipL, s.lAngle, 1)
      drawFlipper(flipR, s.rAngle, -1)

      // Drain gap visual
      ctx.fillStyle = "#15151f"
      ctx.fillRect(170, H - 12, 60, 12)

      // Ball physics
      if (s.ball) {
        const b = s.ball
        b.vy += 0.18 // gravity
        b.vx *= 0.999
        b.x += b.vx
        b.y += b.vy

        // Walls
        if (b.x < 12 + b.r) { b.x = 12 + b.r; b.vx = Math.abs(b.vx) * 0.85 }
        if (b.x > W - 12 - b.r) { b.x = W - 12 - b.r; b.vx = -Math.abs(b.vx) * 0.85 }
        if (b.y < 12 + b.r) { b.y = 12 + b.r; b.vy = Math.abs(b.vy) * 0.85 }

        // Bumpers
        for (const bp of bumpers) {
          const dx = b.x - bp.x, dy = b.y - bp.y
          const d = Math.hypot(dx, dy)
          if (d < bp.r + b.r) {
            const nx = dx / d, ny = dy / d
            b.x = bp.x + nx * (bp.r + b.r)
            b.y = bp.y + ny * (bp.r + b.r)
            const dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx) * 1.05 + nx * 3
            b.vy = (b.vy - 2 * dot * ny) * 1.05 + ny * 3
            setScore((v) => v + 100)
            setHits((v) => v + 1)
          }
        }

        // Flipper collision (simple line-circle)
        function flipCollide(p, angle, dir) {
          const ax = p.px, ay = p.py
          const bx = p.px + Math.cos(angle * dir) * p.len * dir
          const by = p.py + Math.sin(angle * dir) * p.len * dir
          const ex = bx - ax, ey = by - ay
          const t = Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / (ex * ex + ey * ey)))
          const cx = ax + ex * t, cy = ay + ey * t
          const dx = b.x - cx, dy = b.y - cy
          const d = Math.hypot(dx, dy)
          if (d < b.r + 8) {
            const nx = dx / (d || 1), ny = dy / (d || 1)
            b.x = cx + nx * (b.r + 8)
            b.y = cy + ny * (b.r + 8)
            const kick = (dir === 1 ? s.flipL : s.flipR) ? 9 : 3
            b.vx = nx * kick + b.vx * 0.3
            b.vy = ny * kick - 2
          }
        }
        flipCollide(flipL, s.lAngle, 1)
        flipCollide(flipR, s.rAngle, -1)

        // Draw ball
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = "#fff"
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = "#15151f"
        ctx.stroke()

        // Drain
        if (b.y > H + 30) {
          s.ball = null
          setRunning(false)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Save score on game end
  const savedRef = React.useRef(false)
  React.useEffect(() => {
    if (running) { savedRef.current = false; return }
    if (savedRef.current) return
    if (score <= 0) return
    savedRef.current = true
    database.put({
      type: "score",
      name: (name || "ANON").toUpperCase().slice(0, 14),
      score,
      hits,
      createdAt: Date.now(),
    })
  }, [running, score, hits, name, database])

  const c = {
    page: "min-h-screen w-full bg-[#f5f2e8] text-[#15151f]",
    header: "w-full max-w-[920px] mx-auto mt-4 mb-2 px-4 py-3 flex items-center justify-between bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f]",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-2 border-[#15151f]",
    title: "text-2xl font-bold tracking-tight uppercase",
    main: "w-full max-w-[920px] mx-auto px-4 pb-24 flex flex-col gap-6",
    hero: "w-full p-5 flex flex-col gap-2 bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f] relative overflow-hidden",
    heroLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b78] font-bold",
    heroTitle: "text-3xl md:text-5xl font-bold uppercase leading-none tracking-tight",
    heroSub: "text-sm text-[#6b6b78] font-medium",
    statRow: "grid grid-cols-2 md:grid-cols-3 gap-3",
    stat: "p-0 overflow-hidden flex flex-col bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[3px_3px_0px_#15151f]",
    statHead: "px-3 py-2 text-[0.6rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[#15151f]",
    statBody: "px-3 py-3 flex flex-col gap-1",
    statNum: "text-2xl font-bold font-mono",
    statUnit: "text-[0.6rem] uppercase tracking-[0.15em]",
    play: "w-full p-4 flex flex-col gap-3 items-center bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f]",
    canvasWrap: "w-full flex justify-center",
    canvas: "w-full max-w-[400px] h-auto block border-[3px] border-[#15151f] rounded-[4px] bg-[#1a1a26]",
    controlsRow: "w-full flex gap-3 justify-between items-center",
    flipBtn: "flex-1 min-h-[64px] font-bold uppercase tracking-[0.08em] text-sm select-none bg-[#d94327] text-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    startRow: "w-full flex gap-3 items-center flex-wrap",
    input: "flex-1 min-w-[140px] px-3 py-3 text-sm uppercase tracking-[0.05em] font-medium bg-white border-[3px] border-[#15151f] rounded-[4px] outline-none focus:shadow-[3px_3px_0px_#15151f] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all",
    btnPrimary: "px-4 py-3 font-bold uppercase tracking-[0.08em] text-sm min-h-[44px] bg-[#d94327] text-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    btnGhost: "px-3 py-3 font-bold uppercase tracking-[0.08em] text-xs min-h-[44px] bg-[#f0c64a] text-[#15151f] border-[3px] border-[#15151f] rounded-[4px] shadow-[3px_3px_0px_#15151f] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 disabled:opacity-60",
    board: "w-full p-4 flex flex-col gap-3 bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f]",
    boardHead: "flex items-center justify-between",
    boardTitle: "text-lg font-bold uppercase tracking-tight",
    boardLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b78] font-bold",
    list: "flex flex-col",
    row: "grid grid-cols-[2rem_1fr_auto] gap-3 items-center px-2 py-2 text-sm border-b-2 border-[#15151f]/10 hover:bg-[#f0c64a] transition-colors",
    rank: "font-mono font-bold text-sm",
    name: "uppercase tracking-[0.05em] font-medium truncate",
    score: "font-mono font-bold text-base text-right",
    empty: "px-2 py-6 text-center text-sm uppercase tracking-[0.05em] text-[#6b6b78] font-bold",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={c.dot + " bg-[#d94327]"} />
            <span className={c.dot + " bg-[#f0c64a]"} />
            <span className={c.dot + " bg-[#3aa856]"} />
          </div>
          <span className={c.title}>Pinball Zone</span>
        </div>
        <span className={c.boardLabel}>Arcade</span>
      </header>

      <main id="app" className={c.main}>
        <section id="hero" className={c.hero}>
          <div className="absolute top-0 left-0 right-0 h-[6px] flex">
            <div className="flex-1 bg-[#d94327]" />
            <div className="flex-1 bg-[#f0c64a]" />
            <div className="flex-1 bg-[#3aa856]" />
            <div className="flex-1 bg-[#3a6fd8]" />
          </div>
          <span className={c.heroLabel}>Level 01</span>
          <h1 className={c.heroTitle}>Drop The Ball</h1>
          <p className={c.heroSub}>Tap A and L to flip. Smash bumpers. Beat the board.</p>
        </section>

        <section id="stats" className={c.statRow}>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#d94327] text-white"}>Score</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{score}</span>
              <span className={c.statUnit}>Points</span>
            </div>
          </div>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#f0c64a] text-[#15151f]"}>Hits</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{hits}</span>
              <span className={c.statUnit}>Bumpers</span>
            </div>
          </div>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#3aa856] text-[#15151f]"}>Best</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{best}</span>
              <span className={c.statUnit}>All Time</span>
            </div>
          </div>
        </section>

        <section id="play" className={c.play}>
          <div className={c.canvasWrap}>
            <canvas ref={canvasRef} width={400} height={560} className={c.canvas} />
          </div>
          <div className={c.controlsRow}>
            <button
              type="button"
              className={c.flipBtn}
              onMouseDown={() => { stateRef.current.flipL = true }}
              onMouseUp={() => { stateRef.current.flipL = false }}
              onMouseLeave={() => { stateRef.current.flipL = false }}
              onTouchStart={(e) => { e.preventDefault(); stateRef.current.flipL = true }}
              onTouchEnd={(e) => { e.preventDefault(); stateRef.current.flipL = false }}
            >A — Left</button>
            <button
              type="button"
              className={c.flipBtn}
              onMouseDown={() => { stateRef.current.flipR = true }}
              onMouseUp={() => { stateRef.current.flipR = false }}
              onMouseLeave={() => { stateRef.current.flipR = false }}
              onTouchStart={(e) => { e.preventDefault(); stateRef.current.flipR = true }}
              onTouchEnd={(e) => { e.preventDefault(); stateRef.current.flipR = false }}
            >L — Right</button>
          </div>
          <form className={c.startRow} onSubmit={startGame}>
            <input
              className={c.input}
              placeholder="Your handle"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 14))}
            />
            <button type="button" className={c.btnGhost} onClick={handleSuggestName} disabled={isSuggesting}>
              {isSuggesting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin inline">
                  <circle cx="12" cy="12" r="9" stroke="#15151f" strokeWidth="3" strokeDasharray="42 60" strokeLinecap="round" />
                </svg>
              ) : "Suggest"}
            </button>
            <button type="submit" className={c.btnPrimary} disabled={running}>
              {running ? "Playing..." : "Start"}
            </button>
          </form>
        </section>

        <section id="board" className={c.board}>
          <div className={c.boardHead}>
            <h2 className={c.boardTitle}>Last 10 Runs</h2>
            <span className={c.boardLabel}>Live</span>
          </div>
          <ul className={c.list}>
            {top10.length === 0 && <li className={c.empty}>No runs yet — drop a ball</li>}
            {top10.map((d, i) => (
              <li key={d._id} className={c.row}>
                <span className={c.rank}>{String(i + 1).padStart(2, "0")}</span>
                <span className={c.name}>{d.name}</span>
                <span className={c.score}>{d.score}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}