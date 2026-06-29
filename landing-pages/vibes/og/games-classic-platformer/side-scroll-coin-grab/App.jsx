import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const LEVELS = [
  {
    bg: "#bde0fe",
    platforms: [[0, 240, 200, 40], [240, 200, 120, 20], [400, 160, 120, 20], [560, 200, 120, 20], [720, 240, 200, 40]],
    coins: [[280, 170], [440, 130], [600, 170], [780, 210]],
    spikes: [[200, 260, 40], [520, 260, 40], [680, 260, 40]],
    flag: [860, 200],
    spawn: [20, 200],
  },
  {
    bg: "#ffd6a5",
    platforms: [[0, 240, 160, 40], [200, 210, 80, 20], [320, 170, 80, 20], [440, 130, 80, 20], [560, 170, 80, 20], [680, 210, 80, 20], [800, 240, 120, 40]],
    coins: [[230, 180], [350, 140], [470, 100], [590, 140], [710, 180]],
    spikes: [[160, 260, 40], [400, 260, 40], [640, 260, 40], [760, 260, 40]],
    flag: [870, 200],
    spawn: [20, 200],
  },
  {
    bg: "#cdb4db",
    platforms: [[0, 240, 100, 40], [140, 200, 60, 20], [240, 160, 60, 20], [340, 120, 60, 20], [440, 160, 60, 20], [540, 120, 60, 20], [640, 160, 60, 20], [740, 200, 60, 20], [820, 240, 100, 40]],
    coins: [[160, 170], [260, 130], [360, 90], [460, 130], [560, 90], [660, 130], [760, 170]],
    spikes: [[100, 260, 40], [200, 260, 40], [300, 260, 40], [400, 260, 40], [500, 260, 40], [600, 260, 40], [700, 260, 40]],
    flag: [870, 200],
    spawn: [20, 200],
  },
]

function Game({ level, running, setRunning, saveRun, c }) {
  const canvasRef = React.useRef(null)
  const hudCoinsRef = React.useRef(null)
  const hudTimeRef = React.useRef(null)
  const stateRef = React.useRef(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const W = 880, H = 280
    const L = LEVELS[level - 1]
    const keys = {}
    const onDown = (e) => {
      if (["ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key) || e.code === "Space") {
        keys[e.code] = true
        e.preventDefault()
      }
    }
    const onUp = (e) => { keys[e.code] = false }
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)

    let coins = L.coins.map(([x, y]) => ({ x, y, got: false }))
    let player = { x: L.spawn[0], y: L.spawn[1], vx: 0, vy: 0, w: 18, h: 22, onGround: false }
    let startTime = null
    let finished = false
    let raf

    function reset() {
      coins = L.coins.map(([x, y]) => ({ x, y, got: false }))
      player = { x: L.spawn[0], y: L.spawn[1], vx: 0, vy: 0, w: 18, h: 22, onGround: false }
      startTime = performance.now()
      finished = false
    }
    stateRef.current = { reset }

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    }

    function frame() {
      if (running && startTime === null) startTime = performance.now()
      // input
      if (running && !finished) {
        if (keys["ArrowLeft"]) player.vx = -2.5
        else if (keys["ArrowRight"]) player.vx = 2.5
        else player.vx *= 0.7
        if ((keys["Space"]) && player.onGround) { player.vy = -7.2; player.onGround = false }
      } else {
        player.vx *= 0.7
      }
      // physics
      player.vy += 0.35
      if (player.vy > 10) player.vy = 10
      player.x += player.vx
      player.y += player.vy
      player.onGround = false
      // platform collisions
      for (const [px, py, pw, ph] of L.platforms) {
        if (rectsOverlap(player, { x: px, y: py, w: pw, h: ph })) {
          const prevY = player.y - player.vy
          if (prevY + player.h <= py + 1) {
            player.y = py - player.h
            player.vy = 0
            player.onGround = true
          } else if (prevY >= py + ph - 1) {
            player.y = py + ph
            player.vy = 0.5
          } else {
            if (player.vx > 0) player.x = px - player.w
            else if (player.vx < 0) player.x = px + pw
            player.vx = 0
          }
        }
      }
      if (player.x < 0) player.x = 0
      if (player.x + player.w > W) player.x = W - player.w
      if (player.y > H) reset()
      // spikes
      for (const [sx, sy, sw] of L.spikes) {
        if (rectsOverlap(player, { x: sx, y: sy, w: sw, h: 20 })) reset()
      }
      // coins
      let coinCount = 0
      for (const co of coins) {
        if (!co.got && rectsOverlap(player, { x: co.x - 6, y: co.y - 6, w: 12, h: 12 })) co.got = true
        if (co.got) coinCount++
      }
      // flag
      const [fx, fy] = L.flag
      if (!finished && rectsOverlap(player, { x: fx, y: fy, w: 16, h: 40 })) {
        finished = true
        const t = performance.now() - startTime
        saveRun(t, coinCount)
        setRunning(false)
      }
      // draw
      ctx.fillStyle = L.bg
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = "#8b5e34"
      for (const [px, py, pw, ph] of L.platforms) {
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = "#1a1a2e"
        ctx.lineWidth = 2
        ctx.strokeRect(px, py, pw, ph)
      }
      ctx.fillStyle = "#1a1a2e"
      for (const [sx, sy, sw] of L.spikes) {
        const tri = sw / 8
        for (let i = 0; i < 8; i++) {
          ctx.beginPath()
          ctx.moveTo(sx + i * tri, sy + 20)
          ctx.lineTo(sx + i * tri + tri / 2, sy)
          ctx.lineTo(sx + i * tri + tri, sy + 20)
          ctx.closePath()
          ctx.fill()
        }
      }
      for (const co of coins) {
        if (co.got) continue
        ctx.fillStyle = "#fcbf49"
        ctx.beginPath()
        ctx.arc(co.x, co.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "#1a1a2e"
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.fillStyle = "#e63946"
      ctx.fillRect(fx, fy, 4, 40)
      ctx.fillRect(fx, fy, 16, 12)
      ctx.fillStyle = "#06a77d"
      ctx.fillRect(player.x, player.y, player.w, player.h)
      ctx.strokeStyle = "#1a1a2e"
      ctx.lineWidth = 2
      ctx.strokeRect(player.x, player.y, player.w, player.h)
      // HUD
      if (hudCoinsRef.current) hudCoinsRef.current.textContent = `${coinCount}/${L.coins.length}`
      if (hudTimeRef.current && startTime !== null) {
        hudTimeRef.current.textContent = `${((performance.now() - startTime) / 1000).toFixed(1)}s`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
    }
  }, [level, running])

  function start() {
    stateRef.current?.reset()
    setRunning(true)
    canvasRef.current?.focus()
  }

  return (
    <section id="game" className={c.section}>
      <h2 className={c.h2}>Level {level}</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between font-mono text-sm">
          <div>Coins: <span ref={hudCoinsRef}>0/0</span></div>
          <div>Time: <span ref={hudTimeRef}>0.0s</span></div>
        </div>
        <canvas ref={canvasRef} width="880" height="280" tabIndex="0" className="w-full border-[3px] border-[#1a1a2e] rounded-[4px] bg-[#bde0fe] block focus:outline-none" />
        <div className="flex gap-2 flex-wrap">
          <button className={c.btn} onClick={start}>{running ? "Restart" : "Start"}</button>
          <div className="text-[0.7rem] uppercase tracking-wider text-[#1a1a2e]/60 self-center">← → run · space jump</div>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("pixel-hop")
  const { doc: profile, merge: mergeProfile } = useDocument({ _id: "profile", name: "" })
  const [level, setLevel] = React.useState(1)
  const [suggesting, setSuggesting] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true })

  async function suggestName() {
    setSuggesting(true)
    try {
      const r = await callAI("Generate one fun retro arcade player handle, 3-10 chars, no spaces", {
        schema: { properties: { name: { type: "string" } } },
      })
      const { name } = JSON.parse(r)
      mergeProfile({ name })
    } finally {
      setSuggesting(false)
    }
  }

  async function saveRun(timeMs, coins) {
    await database.put({ type: "run", level, name: profile.name || "anon", timeMs, coins, createdAt: Date.now() })
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e6] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]",
    header: "bg-[#1a1a2e] text-[#f5f1e6] border-b-[3px] border-[#1a1a2e] px-4 py-4 sticky top-0 z-20",
    title: "text-2xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#e63946] font-mono",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] p-4",
    h2: "text-lg font-bold uppercase tracking-tight mb-3",
    btn: "bg-[#e63946] text-white border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 min-h-[44px] font-bold uppercase tracking-wide text-sm shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnAlt: "bg-[#fcbf49] text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 min-h-[44px] font-bold uppercase text-xs shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    input: "w-full border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 bg-white font-mono text-sm",
    row: "flex items-center justify-between gap-2 py-2 border-b border-[#1a1a2e]/20 last:border-0",
    levelBtn: "border-[3px] border-[#1a1a2e] rounded-[4px] p-3 flex-1 min-h-[64px] font-bold uppercase text-sm shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  }
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="max-w-[920px] mx-auto flex items-center justify-between">
          <div>
            <h1 className={c.title}>Pixel Hop</h1>
            <div className={c.tag}>Run · Jump · Collect</div>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-[#e63946]"></div>
            <div className="w-3 h-3 bg-[#fcbf49]"></div>
            <div className="w-3 h-3 bg-[#06a77d]"></div>
          </div>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="player" className={c.section}>
          <h2 className={c.h2}>Player</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className={c.input}
                placeholder="Your handle"
                value={profile.name}
                onChange={(e) => mergeProfile({ name: e.target.value })}
              />
              <button className={c.btnAlt} onClick={suggestName} disabled={suggesting}>
                {suggesting ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : "Suggest"}
              </button>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#1a1a2e]/60 mb-2">Pick a level</div>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={c.levelBtn}
                    style={{
                      background: level === n ? "#1a1a2e" : ["#06a77d", "#fcbf49", "#e63946"][n - 1],
                      color: level === n || n !== 2 ? "white" : "#1a1a2e",
                    }}
                    onClick={() => setLevel(n)}
                  >
                    L{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <Game level={level} running={running} setRunning={setRunning} saveRun={saveRun} c={c} />
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Best Times · Level {level}</h2>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#1a1a2e]/60 font-mono mb-2 flex justify-between">
            <span>Rank · Player</span>
            <span>Coins · Time</span>
          </div>
          <ul className="space-y-0">
            {runs.filter((r) => r.level === level).sort((a, b) => a.timeMs - b.timeMs).slice(0, 10).map((r, i) => (
              <li key={r._id} className={c.row}>
                <div className="flex gap-3 items-center">
                  <span className="font-mono font-bold w-6">{i + 1}</span>
                  <span className="font-bold">{r.name}</span>
                </div>
                <div className="font-mono text-sm flex gap-3">
                  <span className="text-[#fcbf49] bg-[#1a1a2e] px-2 rounded-[4px]">{r.coins}</span>
                  <span>{(r.timeMs / 1000).toFixed(2)}s</span>
                </div>
              </li>
            ))}
            {runs.filter((r) => r.level === level).length === 0 && (
              <li className="py-3 text-[#1a1a2e]/50 text-sm italic">No runs yet — be the first.</li>
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}