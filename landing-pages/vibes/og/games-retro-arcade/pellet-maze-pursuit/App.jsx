import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

function Leaderboard({ c, useLiveQuery }) {
  const { docs } = useLiveQuery("score", { descending: true, limit: 10 })
  const runs = docs.filter(d => d.type === "run")
  return (
    <section id="leaderboard" className={c.section}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={c.h2}>Past Runs</h2>
        <span className="text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6480]">Top {runs.length}</span>
      </div>
      {runs.length === 0 ? (
        <div className="border-[3px] border-[#1a1530] rounded-[4px] p-3 bg-[#f5f1e8] text-center text-xs uppercase tracking-[0.15em] text-[#6b6480]">No runs yet — play one</div>
      ) : (
        <ul className="space-y-2">
          {runs.map(r => (
            <li key={r._id} className="border-[3px] border-[#1a1530] rounded-[4px] p-3 bg-[#f5f1e8] shadow-[3px_3px_0_#1a1530]">
              <div className="flex items-baseline justify-between font-['JetBrains_Mono',monospace]">
                <span className="text-lg font-bold">{r.score}</span>
                <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6480]">Lv {r.level} · {r.duration}s</span>
              </div>
              {r.taunt && <p className="text-xs mt-1 italic text-[#1a1530]">"{r.taunt}"</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("pellet-chase-v1")
  const MAZE = React.useMemo(() => [
    "###################",
    "#........#........#",
    "#O##.###.#.###.##O#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.### # ###.####",
    "   #.#       #.#   ",
    "####.# ##=## #.####",
    "#......#   #......#",
    "####.# ##### #.####",
    "   #.#       #.#   ",
    "####.# ##### #.####",
    "#........#........#",
    "#O##.###.#.###.##O#",
    "#..#.....P.....#..#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "###################",
  ], [])
  const ROWS = MAZE.length, COLS = MAZE[0].length
  const isWall = (x, y) => MAZE[y]?.[x] === "#"
  const [score, setScore] = React.useState(0)
  const [lives, setLives] = React.useState(3)
  const [level, setLevel] = React.useState(1)
  const [playing, setPlaying] = React.useState(false)
  const [powerMs, setPowerMs] = React.useState(0)
  const [gameOver, setGameOver] = React.useState(false)
  const [dots, setDots] = React.useState(() => new Set())
  const [pellets, setPellets] = React.useState(() => new Set())
  const playerRef = React.useRef({ x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0 })
  const ghostsRef = React.useRef([])
  const runStartRef = React.useRef(0)
  const dirRef = React.useRef({ dx: 0, dy: 0 })

  const resetLevel = React.useCallback(() => {
    const d = new Set(), p = new Set()
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAZE[y][x]
      if (ch === ".") d.add(`${x},${y}`)
      else if (ch === "O") p.add(`${x},${y}`)
    }
    setDots(d); setPellets(p)
    playerRef.current = { x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0 }
    ghostsRef.current = [
      { x: 9, y: 9, dx: 0, dy: -1, color: "#d94a2c", kind: "chase", scared: false },
      { x: 8, y: 9, dx: 0, dy: -1, color: "#e8a8d4", kind: "ambush", scared: false },
      { x: 10, y: 9, dx: 0, dy: -1, color: "#5ec4d4", kind: "flank", scared: false },
      { x: 9, y: 10, dx: 0, dy: -1, color: "#e8a04a", kind: "random", scared: false },
    ]
  }, [MAZE, ROWS, COLS])

  const startGame = () => {
    setScore(0); setLives(3); setLevel(1); setGameOver(false); setPowerMs(0)
    resetLevel(); setPlaying(true); runStartRef.current = Date.now()
  }

  const setDir = (dx, dy) => { dirRef.current = { dx, dy }; playerRef.current.nextDx = dx; playerRef.current.nextDy = dy }

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp") setDir(0, -1)
      else if (e.key === "ArrowDown") setDir(0, 1)
      else if (e.key === "ArrowLeft") setDir(-1, 0)
      else if (e.key === "ArrowRight") setDir(1, 0)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (!playing) return
    let raf, last = performance.now(), acc = 0, ghostAcc = 0
    const STEP = 160, GSTEP = 200
    const tick = (t) => {
      const delta = t - last; last = t; acc += delta; ghostAcc += delta
      if (powerMs > 0) setPowerMs(p => Math.max(0, p - delta))
      while (acc >= STEP) {
        acc -= STEP
        const p = playerRef.current
        // try buffered direction
        const nx = p.x + p.nextDx, ny = p.y + p.nextDy
        if ((p.nextDx || p.nextDy) && !isWall(nx, ny)) { p.dx = p.nextDx; p.dy = p.nextDy }
        const tx = p.x + p.dx, ty = p.y + p.dy
        if (!isWall(tx, ty)) {
          p.x = (tx + COLS) % COLS; p.y = ty
          const k = `${p.x},${p.y}`
          if (dots.has(k)) { dots.delete(k); setScore(s => s + 10); setDots(new Set(dots)) }
          if (pellets.has(k)) {
            pellets.delete(k); setScore(s => s + 50); setPellets(new Set(pellets))
            setPowerMs(6000)
            ghostsRef.current = ghostsRef.current.map(g => ({ ...g, scared: true }))
          }
        }
      }
      while (ghostAcc >= GSTEP) {
        ghostAcc -= GSTEP
        const p = playerRef.current
        ghostsRef.current = ghostsRef.current.map(g => {
          const opts = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => !isWall(g.x+dx, g.y+dy) && !(dx===-g.dx && dy===-g.dy))
          if (!opts.length) return g
          let pick
          const scared = powerMs > 0
          if (scared) pick = opts[Math.floor(Math.random()*opts.length)]
          else if (g.kind === "random") pick = opts[Math.floor(Math.random()*opts.length)]
          else {
            const tgt = g.kind === "ambush" ? { x: p.x + p.dx*4, y: p.y + p.dy*4 }
                      : g.kind === "flank" ? { x: COLS - p.x, y: ROWS - p.y }
                      : { x: p.x, y: p.y }
            opts.sort((a,b) => {
              const da = Math.hypot(g.x+a[0]-tgt.x, g.y+a[1]-tgt.y)
              const db = Math.hypot(g.x+b[0]-tgt.x, g.y+b[1]-tgt.y)
              return da - db
            })
            pick = opts[0]
          }
          return { ...g, dx: pick[0], dy: pick[1], x: g.x + pick[0], y: g.y + pick[1], scared }
        })
        // collisions
        const pp = playerRef.current
        ghostsRef.current.forEach((g, i) => {
          if (g.x === pp.x && g.y === pp.y) {
            if (powerMs > 0) {
              ghostsRef.current[i] = { ...g, x: 9, y: 9, scared: false }
              setScore(s => s + 200)
            } else {
              setLives(l => {
                const nl = l - 1
                if (nl <= 0) { setPlaying(false); setGameOver(true) }
                else { resetLevel() }
                return nl
              })
            }
          }
        })
        if (dots.size === 0 && pellets.size === 0) {
          setLevel(lv => lv + 1); resetLevel()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, dots, pellets, powerMs, resetLevel, COLS, ROWS])

  // save run on game over
  React.useEffect(() => {
    if (!gameOver) return
    const duration = Math.round((Date.now() - runStartRef.current) / 1000)
    const finalScore = score, finalLevel = level
    ;(async () => {
      let taunt = "Gulped by the ghosts."
      try {
        const r = await callAI(`Write a 1-sentence playful arcade taunt for a player who scored ${finalScore} on level ${finalLevel}.`, {
          schema: { properties: { taunt: { type: "string" } } }
        })
        taunt = JSON.parse(r).taunt || taunt
      } catch {}
      await database.put({ type: "run", score: finalScore, level: finalLevel, duration, taunt, createdAt: Date.now() })
    })()
  }, [gameOver])

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1530] font-['Space_Grotesk',sans-serif] relative",
    header: "bg-white border-[3px] border-[#1a1530] shadow-[4px_4px_0_#1a1530] rounded-[4px] px-4 py-3 m-3 flex items-center justify-between",
    title: "text-xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6480]",
    main: "px-3 pb-24 max-w-[920px] mx-auto space-y-3",
    section: "bg-white border-[3px] border-[#1a1530] shadow-[4px_4px_0_#1a1530] rounded-[4px] p-4",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6480] mb-2 font-semibold",
    h2: "text-base font-bold uppercase tracking-tight mb-3",
    btnPrimary: "bg-[#d94a2c] text-white border-[3px] border-[#1a1530] shadow-[4px_4px_0_#1a1530] rounded-[4px] px-4 py-3 uppercase font-bold tracking-[0.05em] text-sm min-h-[44px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60",
    btnGhost: "bg-white text-[#1a1530] border-[3px] border-[#1a1530] shadow-[3px_3px_0_#1a1530] rounded-[4px] px-3 py-2 uppercase font-bold tracking-[0.05em] text-xs min-h-[40px]",
    dot: "inline-block w-3 h-3 border-2 border-[#1a1530]",
  }
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-2">
          <span className={`${c.dot} bg-[#d94a2c]`}></span>
          <span className={`${c.dot} bg-[#e8c547] rounded-full`}></span>
          <span className={`${c.dot} bg-[#4a9b5e]`}></span>
          <span className={c.title}>Pellet Chase</span>
        </div>
        <span className={c.tag}>Arcade</span>
      </header>
      <main id="app" className={c.main}>
        <section id="game-board" className={c.section}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={c.h2}>Maze</h2>
            <button className={c.btnPrimary} onClick={startGame}>{playing ? "Restart" : gameOver ? "Play again" : "Start"}</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3 font-['JetBrains_Mono',monospace]">
            <div className="border-[3px] border-[#1a1530] rounded-[4px] p-2 bg-[#d94a2c] text-white">
              <div className="text-[0.6rem] uppercase tracking-[0.15em]">Score</div>
              <div className="text-xl font-bold">{score}</div>
            </div>
            <div className="border-[3px] border-[#1a1530] rounded-[4px] p-2 bg-[#e8c547]">
              <div className="text-[0.6rem] uppercase tracking-[0.15em]">Lives</div>
              <div className="text-xl font-bold">{lives}</div>
            </div>
            <div className="border-[3px] border-[#1a1530] rounded-[4px] p-2 bg-[#4a9b5e]">
              <div className="text-[0.6rem] uppercase tracking-[0.15em]">Level</div>
              <div className="text-xl font-bold">{level}</div>
            </div>
          </div>
          <div className="border-[3px] border-[#1a1530] rounded-[4px] bg-[#0f0a1f] w-full max-w-[420px] mx-auto overflow-hidden">
            {playing || (!gameOver && score === 0 && dots.size === 0) ? null : null}
            {(playing || gameOver) ? (
              <svg viewBox={`0 0 ${COLS} ${ROWS}`} className="w-full block">
                {MAZE.map((row, y) => row.split("").map((ch, x) => ch === "#"
                  ? <rect key={`w${x},${y}`} x={x} y={y} width={1} height={1} fill="#2d2470" />
                  : null))}
                {[...dots].map(k => { const [x,y] = k.split(",").map(Number); return <circle key={`d${k}`} cx={x+0.5} cy={y+0.5} r={0.1} fill="#f5f1e8" /> })}
                {[...pellets].map(k => { const [x,y] = k.split(",").map(Number); return <circle key={`p${k}`} cx={x+0.5} cy={y+0.5} r={0.3} fill="#e8c547" /> })}
                <circle cx={playerRef.current.x+0.5} cy={playerRef.current.y+0.5} r={0.42} fill="#e8c547" stroke="#1a1530" strokeWidth={0.08} />
                {ghostsRef.current.map((g, i) => (
                  <rect key={`g${i}`} x={g.x+0.1} y={g.y+0.1} width={0.8} height={0.8} rx={0.2}
                    fill={powerMs > 0 ? "#5ec4d4" : g.color} stroke="#1a1530" strokeWidth={0.08} />
                ))}
              </svg>
            ) : (
              <div className="aspect-square flex items-center justify-center text-[#6b6480] uppercase tracking-[0.2em] text-xs">Press Start</div>
            )}
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6480] mt-2 text-center font-['JetBrains_Mono',monospace]">
            {powerMs > 0 ? `Power: ${(powerMs/1000).toFixed(1)}s` : gameOver ? "Game over" : "Power pellet: ready"}
          </div>
        </section>
        <section id="controls" className={c.section}>
          <h2 className={c.h2}>Controls</h2>
          <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto select-none">
            <div></div>
            <button className={c.btnGhost} onClick={() => setDir(0, -1)} aria-label="Up">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
            <div></div>
            <button className={c.btnGhost} onClick={() => setDir(-1, 0)} aria-label="Left">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div className="border-[3px] border-[#1a1530] rounded-[4px] bg-[#f5f1e8] flex items-center justify-center text-[0.6rem] uppercase tracking-[0.15em] font-bold">Move</div>
            <button className={c.btnGhost} onClick={() => setDir(1, 0)} aria-label="Right">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <div></div>
            <button className={c.btnGhost} onClick={() => setDir(0, 1)} aria-label="Down">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </button>
            <div></div>
          </div>
          <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6480] mt-3 text-center">Or use arrow keys</p>
        </section>
        <Leaderboard c={c} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  )
}