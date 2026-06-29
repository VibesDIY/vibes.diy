import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function Leaderboard({ useLiveQuery }) {
  const { docs } = useLiveQuery("depth", { descending: true, limit: 10 })
  const runs = docs.filter(d => d.type === "run")
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#15151f] text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b7a]">
            <th className="text-left py-2 font-mono">#</th>
            <th className="text-left py-2">Name</th>
            <th className="text-right py-2 font-mono">Depth</th>
            <th className="text-right py-2 font-mono">Gems</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={r._id} className="border-b border-[#e5e1d8] hover:bg-[#e8b94a] transition-colors">
              <td className="py-2 font-mono">{i + 1}</td>
              <td className="py-2">{r.name}</td>
              <td className="py-2 text-right font-mono font-bold">{r.depth}m</td>
              <td className="py-2 text-right font-mono">◆ {r.gems}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.length === 0 && <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b7a] mt-3 font-mono">No runs yet — go drop in</p>}
    </>
  )
}

function SaveRun({ database, lastRun, onSaved }) {
  const [name, setName] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const disabled = !lastRun
  const save = async () => {
    if (!lastRun) return
    setIsSaving(true)
    try {
      await database.put({ type: "run", name: name.trim() || "Anonymous Drop", depth: lastRun.depth, gems: lastRun.gems, createdAt: Date.now() })
      setName("")
      onSaved?.()
    } finally { setIsSaving(false) }
  }
  const suggest = async () => {
    setIsSuggesting(true)
    try {
      const r = await callAI(`Invent one short, evocative name (max 4 words) for a cave-descent run that reached ${lastRun?.depth ?? 0}m and collected ${lastRun?.gems ?? 0} gems.`, {
        schema: { properties: { name: { type: "string" } } }
      })
      const { name: n } = JSON.parse(r)
      if (n) setName(n)
    } finally { setIsSuggesting(false) }
  }
  const Spinner = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin inline-block"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 60" strokeLinecap="round" /></svg>
  )
  return (
    <div>
      {lastRun && (
        <div className="mb-3 font-mono text-xs bg-[#f5f1e8] border-[3px] border-[#15151f] px-3 py-2 inline-block">
          Last: <b>{lastRun.depth}m</b> · ◆ {lastRun.gems}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your descent"
          disabled={disabled}
          className="flex-1 border-[3px] border-[#15151f] rounded-[4px] px-3 py-2 font-mono text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#15151f] transition-all min-h-[44px] disabled:opacity-50"
        />
        <button onClick={suggest} disabled={disabled || isSuggesting} className="bg-[#e8b94a] border-[3px] border-[#15151f] px-4 py-2 font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_#15151f] min-h-[44px] disabled:opacity-50">
          {isSuggesting ? <Spinner /> : "Suggest"}
        </button>
        <button onClick={save} disabled={disabled || isSaving} className="bg-[#4a9b6e] text-white border-[3px] border-[#15151f] px-5 py-2 font-bold uppercase tracking-wider shadow-[4px_4px_0px_#15151f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[44px] disabled:opacity-50">
          {isSaving ? <Spinner /> : "Save"}
        </button>
      </div>
      <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b7a] mt-2 font-mono">{disabled ? "Finish a run to log it" : "Save before your next drop"}</p>
    </div>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("deep-dive-runs")
  const canvasRef = React.useRef(null)
  const gameRef = React.useRef(null)
  const [hud, setHud] = React.useState({ depth: 0, gems: 0 })
  const [phase, setPhase] = React.useState("idle") // idle | playing | dead
  const [lastRun, setLastRun] = React.useState(null)
  const keysRef = React.useRef({ left: false, right: false, jump: false })

  React.useEffect(() => {
    const onKey = (e, down) => {
      if (e.key === "ArrowLeft") keysRef.current.left = down
      else if (e.key === "ArrowRight") keysRef.current.right = down
      else if (e.key === " " || e.key === "ArrowUp") { keysRef.current.jump = down; e.preventDefault() }
    }
    const kd = (e) => onKey(e, true)
    const ku = (e) => onKey(e, false)
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku) }
  }, [])

  const startGame = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const W = canvas.width, H = canvas.height
    const player = { x: W / 2, y: 40, vx: 0, vy: 0, w: 16, h: 20, onGround: false }
    const ledges = []
    const gems = []
    const hazards = []
    const bats = []
    let depthPx = 0, gemCount = 0, alive = true
    // seed initial ledges
    for (let i = 0; i < 12; i++) {
      const y = 80 + i * 70
      ledges.push({ x: Math.random() * (W - 80), y, w: 60 + Math.random() * 40, h: 10 })
      if (Math.random() < 0.5) gems.push({ x: Math.random() * (W - 12), y: y - 18, w: 10, h: 10, taken: false })
      if (Math.random() < 0.35) hazards.push({ x: Math.random() * (W - 30), y: y - 8, w: 24, h: 6 })
      if (Math.random() < 0.25) bats.push({ x: Math.random() * W, y, vx: (Math.random() < 0.5 ? -1 : 1) * 1.2, w: 14, h: 10 })
    }
    let raf
    const step = () => {
      if (!alive) return
      // input
      if (keysRef.current.left) player.vx = Math.max(player.vx - 0.4, -3)
      else if (keysRef.current.right) player.vx = Math.min(player.vx + 0.4, 3)
      else player.vx *= 0.85
      if (keysRef.current.jump && player.onGround) { player.vy = -7; player.onGround = false }
      player.vy += 0.35
      if (player.vy > 8) player.vy = 8
      player.x += player.vx
      player.y += player.vy
      if (player.x < 0) player.x = 0
      if (player.x + player.w > W) player.x = W - player.w
      // scroll world up when player below mid
      const mid = H * 0.45
      if (player.y > mid) {
        const dy = player.y - mid
        player.y = mid
        depthPx += dy
        ledges.forEach(l => l.y -= dy)
        gems.forEach(g => g.y -= dy)
        hazards.forEach(h => h.y -= dy)
        bats.forEach(b => b.y -= dy)
      }
      // recycle off-top
      ledges.forEach(l => {
        if (l.y < -20) {
          l.y = H + Math.random() * 40
          l.x = Math.random() * (W - 80)
          l.w = 60 + Math.random() * 40
          if (Math.random() < 0.5) gems.push({ x: l.x + Math.random() * l.w, y: l.y - 18, w: 10, h: 10, taken: false })
          if (Math.random() < 0.35) hazards.push({ x: l.x + Math.random() * (l.w - 24), y: l.y - 8, w: 24, h: 6 })
          if (Math.random() < 0.25) bats.push({ x: Math.random() * W, y: l.y, vx: (Math.random() < 0.5 ? -1 : 1) * 1.2, w: 14, h: 10 })
        }
      })
      // collide ledges (top only)
      player.onGround = false
      ledges.forEach(l => {
        if (player.x + player.w > l.x && player.x < l.x + l.w) {
          if (player.y + player.h > l.y && player.y + player.h < l.y + l.h + 10 && player.vy >= 0) {
            player.y = l.y - player.h
            player.vy = 0
            player.onGround = true
          }
        }
      })
      // gems
      gems.forEach(g => {
        if (!g.taken && player.x < g.x + g.w && player.x + player.w > g.x && player.y < g.y + g.h && player.y + player.h > g.y) {
          g.taken = true; gemCount++
        }
      })
      // bats
      bats.forEach(b => {
        b.x += b.vx
        if (b.x < 0 || b.x + b.w > W) b.vx *= -1
        if (player.x < b.x + b.w && player.x + player.w > b.x && player.y < b.y + b.h && player.y + player.h > b.y) alive = false
      })
      // hazards
      hazards.forEach(h => {
        if (player.x < h.x + h.w && player.x + player.w > h.x && player.y + player.h > h.y && player.y + player.h < h.y + h.h + 4) alive = false
      })
      // fell out the top? no — only die from hazards/bats. but also if no ledges and falling forever? fine.
      // draw
      ctx.fillStyle = "#2a1f3d"; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = "#4a3a5c"
      ledges.forEach(l => ctx.fillRect(l.x, l.y, l.w, l.h))
      ctx.fillStyle = "#e8b94a"
      gems.forEach(g => { if (!g.taken) ctx.fillRect(g.x, g.y, g.w, g.h) })
      ctx.fillStyle = "#d94a3d"
      hazards.forEach(h => { for (let i = 0; i < h.w; i += 6) { ctx.beginPath(); ctx.moveTo(h.x + i, h.y + h.h); ctx.lineTo(h.x + i + 3, h.y); ctx.lineTo(h.x + i + 6, h.y + h.h); ctx.fill() } })
      ctx.fillStyle = "#15151f"
      bats.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h))
      ctx.fillStyle = "#f5f1e8"
      ctx.fillRect(player.x, player.y, player.w, player.h)
      setHud({ depth: Math.floor(depthPx / 10), gems: gemCount })
      if (alive) raf = requestAnimationFrame(step)
      else {
        setPhase("dead")
        setLastRun({ depth: Math.floor(depthPx / 10), gems: gemCount })
      }
    }
    gameRef.current = { cancel: () => { alive = false; cancelAnimationFrame(raf) } }
    setPhase("playing")
    setHud({ depth: 0, gems: 0 })
    raf = requestAnimationFrame(step)
  }

  const pressKey = (k, down) => { keysRef.current[k] = down }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#15151f] font-['Space_Grotesk',sans-serif]",
    header: "bg-[#15151f] border-b-[3px] border-[#15151f] px-5 py-4 flex items-center justify-between",
    brand: "text-[#f5f1e8] text-xl font-bold uppercase tracking-tight",
    tagline: "text-[#e8b94a] text-[0.65rem] uppercase tracking-[0.15em] font-mono",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#15151f] rounded-[4px] p-5 shadow-[4px_4px_0px_#15151f]",
    h2: "text-base font-bold uppercase tracking-tight mb-3",
  }
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-[#d94a3d] border-2 border-[#f5f1e8]" />
            <div className="w-3 h-3 bg-[#e8b94a] border-2 border-[#f5f1e8]" />
            <div className="w-3 h-3 bg-[#4a9b6e] border-2 border-[#f5f1e8]" />
          </div>
          <span className={c.brand}>Deep Dive</span>
        </div>
        <span className={c.tagline}>Fall Far</span>
      </header>
      <main id="app" className={c.main}>
        <section id="game" className={c.section}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={c.h2}>Descent</h2>
            <div className="flex gap-2 font-mono text-xs">
              <span className="bg-[#15151f] text-[#f5f1e8] px-2 py-1 border-[3px] border-[#15151f]">D {hud.depth}m</span>
              <span className="bg-[#e8b94a] text-[#15151f] px-2 py-1 border-[3px] border-[#15151f]">◆ {hud.gems}</span>
            </div>
          </div>
          <div className="relative w-full bg-[#2a1f3d] border-[3px] border-[#15151f] aspect-[3/4] max-h-[480px] mx-auto overflow-hidden">
            <canvas ref={canvasRef} width={300} height={400} className="w-full h-full block" style={{ imageRendering: "pixelated" }} />
            {phase !== "playing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#15151f]/70">
                {phase === "dead" && (
                  <div className="text-center text-[#f5f1e8] font-mono">
                    <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#e8b94a]">Run Over</div>
                    <div className="text-2xl font-bold">{lastRun?.depth}m · ◆{lastRun?.gems}</div>
                  </div>
                )}
                <button onClick={startGame} className="bg-[#d94a3d] text-white border-[3px] border-[#15151f] px-6 py-3 font-bold uppercase tracking-wider shadow-[4px_4px_0px_#15151f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[44px]">
                  {phase === "dead" ? "Drop Again" : "Start Descent"}
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 md:hidden">
            <button
              onTouchStart={(e) => { e.preventDefault(); pressKey("left", true) }}
              onTouchEnd={(e) => { e.preventDefault(); pressKey("left", false) }}
              onMouseDown={() => pressKey("left", true)}
              onMouseUp={() => pressKey("left", false)}
              onMouseLeave={() => pressKey("left", false)}
              className="bg-white border-[3px] border-[#15151f] py-3 font-bold min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none"
            >←</button>
            <button
              onTouchStart={(e) => { e.preventDefault(); pressKey("jump", true) }}
              onTouchEnd={(e) => { e.preventDefault(); pressKey("jump", false) }}
              onMouseDown={() => pressKey("jump", true)}
              onMouseUp={() => pressKey("jump", false)}
              onMouseLeave={() => pressKey("jump", false)}
              className="bg-[#e8b94a] border-[3px] border-[#15151f] py-3 font-bold min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none"
            >JUMP</button>
            <button
              onTouchStart={(e) => { e.preventDefault(); pressKey("right", true) }}
              onTouchEnd={(e) => { e.preventDefault(); pressKey("right", false) }}
              onMouseDown={() => pressKey("right", true)}
              onMouseUp={() => pressKey("right", false)}
              onMouseLeave={() => pressKey("right", false)}
              className="bg-white border-[3px] border-[#15151f] py-3 font-bold min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none"
            >→</button>
          </div>
          <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b7a] mt-3 font-mono">Arrows move · Space jumps · Avoid bats & spikes</p>
        </section>
        <section id="save-run" className={c.section}>
          <h2 className={c.h2}>Log This Run</h2>
          <SaveRun database={database} lastRun={lastRun} onSaved={() => setLastRun(null)} />
        </section>
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Top 10 Descents</h2>
          <Leaderboard useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}