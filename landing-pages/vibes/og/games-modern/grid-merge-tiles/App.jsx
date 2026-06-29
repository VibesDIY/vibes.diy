import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const SIZE = 4
const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
function addTile(grid) {
  const empties = []
  for (let r = 0; r < SIZE; r++) for (let col = 0; col < SIZE; col++) if (!grid[r][col]) empties.push([r, col])
  if (!empties.length) return grid
  const [r, col] = empties[Math.floor(Math.random() * empties.length)]
  const next = grid.map((row) => row.slice())
  next[r][col] = Math.random() < 0.9 ? 2 : 4
  return next
}
function startGrid() {
  return addTile(addTile(emptyGrid()))
}
function slideRow(row) {
  const filtered = row.filter((v) => v)
  let gained = 0
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2
      gained += filtered[i]
      filtered.splice(i + 1, 1)
    }
  }
  while (filtered.length < SIZE) filtered.push(0)
  return { row: filtered, gained }
}
function rotate(grid) {
  const next = emptyGrid()
  for (let r = 0; r < SIZE; r++) for (let col = 0; col < SIZE; col++) next[col][SIZE - 1 - r] = grid[r][col]
  return next
}
function move(grid, dir) {
  let g = grid.map((row) => row.slice())
  const turns = { left: 0, up: 1, right: 2, down: 3 }[dir]
  for (let i = 0; i < turns; i++) g = rotate(g)
  let gained = 0
  g = g.map((row) => { const r = slideRow(row); gained += r.gained; return r.row })
  for (let i = 0; i < (4 - turns) % 4; i++) g = rotate(g)
  return { grid: g, gained }
}
function gridsEqual(a, b) {
  for (let r = 0; r < SIZE; r++) for (let col = 0; col < SIZE; col++) if (a[r][col] !== b[r][col]) return false
  return true
}
function isGameOver(grid) {
  for (let r = 0; r < SIZE; r++) for (let col = 0; col < SIZE; col++) {
    if (!grid[r][col]) return false
    if (col < SIZE - 1 && grid[r][col] === grid[r][col + 1]) return false
    if (r < SIZE - 1 && grid[r][col] === grid[r + 1][col]) return false
  }
  return true
}
function maxTile(grid) {
  let m = 0
  for (const row of grid) for (const v of row) if (v > m) m = v
  return m
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("merge-2048")
  const [grid, setGrid] = React.useState(startGrid)
  const [score, setScore] = React.useState(0)
  const [over, setOver] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true, limit: 50 })
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0)
  const todayBest = runs.filter((d) => d.createdAt >= startOfDay.getTime()).reduce((m, d) => Math.max(m, d.score || 0), 0)
  const allTimeBest = runs.reduce((m, d) => Math.max(m, d.score || 0), 0)

  const doMove = (dir) => {
    if (over) return
    const { grid: moved, gained } = move(grid, dir)
    if (gridsEqual(grid, moved)) return
    const next = addTile(moved)
    setGrid(next)
    setScore((s) => s + gained)
    if (isGameOver(next)) setOver(true)
  }

  React.useEffect(() => {
    if (over && !saved) {
      setSaved(true)
      database.put({ type: "run", score, maxTile: maxTile(grid), createdAt: Date.now() })
    }
  }, [over, saved, score, grid, database])

  React.useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }
      if (map[e.key]) { e.preventDefault(); doMove(map[e.key]) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const newGame = () => { setGrid(startGrid()); setScore(0); setOver(false); setSaved(false) }

  const c = {
    page: "min-h-screen bg-[#faf7f0] text-[#15151f] font-['Space_Grotesk',sans-serif] pb-12",
    header: "bg-[#15151f] text-white border-b-[3px] border-[#15151f] px-4 py-4 flex items-center justify-between",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-2 border-white",
    brand: "text-lg font-bold uppercase tracking-tight",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0px_#15151f] p-5",
    h2: "text-xs uppercase tracking-[0.15em] font-bold text-[#15151f] mb-4",
    statRow: "grid grid-cols-3 gap-3",
    stat: "bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[3px_3px_0px_#15151f] overflow-hidden",
    statBarRed: "bg-[#d63a26] text-white px-2 py-1 text-[0.6rem] uppercase tracking-[0.15em] font-bold",
    statBarYellow: "bg-[#f0c419] text-[#15151f] px-2 py-1 text-[0.6rem] uppercase tracking-[0.15em] font-bold",
    statBarBlue: "bg-[#2563d6] text-white px-2 py-1 text-[0.6rem] uppercase tracking-[0.15em] font-bold",
    statValue: "px-3 py-3 text-2xl font-bold font-['JetBrains_Mono',monospace]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logo}>
          <div className={c.logoDots}>
            <span className={c.dot} style={{ background: "#d63a26" }} />
            <span className={c.dot} style={{ background: "#f0c419" }} />
            <span className={c.dot} style={{ background: "#3aa84a" }} />
          </div>
          <span className={c.brand}>Merge//2048</span>
        </div>
        <span className="text-[0.65rem] uppercase tracking-[0.15em] opacity-70">Swipe to fuse</span>
      </header>

      <main id="app" className={c.main}>
        <section id="scoreboard" className={c.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={c.h2} style={{ marginBottom: 0 }}>Scoreboard</h2>
            <button
              onClick={newGame}
              className="bg-[#d63a26] text-white border-[3px] border-[#15151f] rounded-[4px] shadow-[3px_3px_0px_#15151f] px-3 py-2 text-[0.7rem] uppercase tracking-[0.08em] font-bold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              New Game
            </button>
          </div>
          <div className={c.statRow}>
            <div className={c.stat}>
              <div className={c.statBarRed}>Current</div>
              <div className={c.statValue}>{score}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statBarYellow}>Today</div>
              <div className={c.statValue}>{todayBest}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statBarBlue}>All-Time</div>
              <div className={c.statValue}>{allTimeBest}</div>
            </div>
          </div>
        </section>

        <section id="board" className={c.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={c.h2} style={{ marginBottom: 0 }}>Board</h2>
            {over && <span className="text-[0.7rem] uppercase tracking-[0.15em] font-bold text-[#d63a26]">Game Over</span>}
          </div>
          <div
            className="bg-[#15151f] border-[3px] border-[#15151f] rounded-[4px] p-2 grid grid-cols-4 gap-2 aspect-square max-w-[440px] mx-auto select-none touch-none relative"
            onTouchStart={(e) => { const t = e.touches[0]; e.currentTarget._sx = t.clientX; e.currentTarget._sy = t.clientY }}
            onTouchEnd={(e) => {
              const t = e.changedTouches[0]
              const dx = t.clientX - (e.currentTarget._sx || 0)
              const dy = t.clientY - (e.currentTarget._sy || 0)
              if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
              if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left")
              else doMove(dy > 0 ? "down" : "up")
            }}
          >
            {grid.flat().map((v, i) => {
              const colors = {
                0: "bg-[#2a2a36] text-transparent",
                2: "bg-[#faf7f0] text-[#15151f]",
                4: "bg-[#f0e6c4] text-[#15151f]",
                8: "bg-[#f0c419] text-[#15151f]",
                16: "bg-[#f59538] text-white",
                32: "bg-[#e8703a] text-white",
                64: "bg-[#d63a26] text-white",
                128: "bg-[#3aa84a] text-white text-xl",
                256: "bg-[#2a8a3a] text-white text-xl",
                512: "bg-[#2563d6] text-white text-xl",
                1024: "bg-[#1a4aa8] text-white text-lg",
                2048: "bg-[#15151f] text-[#f0c419] text-lg",
              }
              const cls = colors[v] || "bg-[#15151f] text-[#f0c419] text-base"
              return (
                <div key={i} className={`${cls} border-[2px] border-[#15151f] rounded-[4px] flex items-center justify-center font-bold font-['JetBrains_Mono',monospace] text-2xl`}>
                  {v || ""}
                </div>
              )
            })}
            {over && (
              <div className="absolute inset-0 bg-[#15151f]/80 rounded-[4px] flex flex-col items-center justify-center gap-3">
                <div className="text-white text-2xl font-bold uppercase tracking-tight">No Moves Left</div>
                <div className="text-[#f0c419] font-['JetBrains_Mono',monospace] text-lg">Score: {score}</div>
                <button onClick={newGame} className="bg-[#d63a26] text-white border-[3px] border-white rounded-[4px] shadow-[3px_3px_0px_white] px-4 py-2 text-[0.75rem] uppercase tracking-[0.08em] font-bold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  Play Again
                </button>
              </div>
            )}
          </div>
          <p className="text-center text-[0.7rem] uppercase tracking-[0.15em] text-[#50505a] mt-3">Swipe or arrow keys</p>
        </section>

        <section id="runs" className={c.section}>
          <h2 className={c.h2}>Recent Runs</h2>
          {runs.length === 0 ? (
            <p className="text-[0.82rem] text-[#50505a]">Finish a game and your runs will appear here.</p>
          ) : (
            <ul className="divide-y-[2px] divide-[#15151f]">
              {runs.slice(0, 10).map((r) => {
                const isToday = r.createdAt >= startOfDay.getTime()
                return (
                  <li key={r._id} className="flex items-center justify-between py-3 hover:bg-[#f0c419] transition-colors px-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-[0.6rem] uppercase tracking-[0.15em] font-bold px-2 py-1 border-[2px] border-[#15151f] rounded-[4px] ${isToday ? "bg-[#3aa84a] text-[#15151f]" : "bg-white text-[#15151f]"}`}>
                        {isToday ? "Today" : new Date(r.createdAt).toLocaleDateString()}
                      </span>
                      <span className="font-['JetBrains_Mono',monospace] text-sm text-[#50505a]">max {r.maxTile}</span>
                    </div>
                    <span className="font-['JetBrains_Mono',monospace] font-bold text-lg">{r.score}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}