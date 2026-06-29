import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const COLS = 9
  const ROWS = 11
  const initialFrog = { x: 4, y: 10 }
  const [frog, setFrog] = React.useState(initialFrog)
  const [score, setScore] = React.useState(0)
  const [level, setLevel] = React.useState(1)
  const [lives, setLives] = React.useState(3)
  const [tick, setTick] = React.useState(0)
  const [gameOver, setGameOver] = React.useState(false)
  const [won, setWon] = React.useState(false)

  // lanes: y -> { type: 'car'|'log', speed, dir, spacing }
  const lanes = React.useMemo(() => {
    const s = 1 + (level - 1) * 0.3
    return {
      1: { type: "log", speed: 0.5 * s, dir: 1, spacing: 3, len: 3 },
      2: { type: "log", speed: 0.7 * s, dir: -1, spacing: 4, len: 2 },
      3: { type: "log", speed: 0.4 * s, dir: 1, spacing: 3, len: 3 },
      6: { type: "car", speed: 0.6 * s, dir: -1, spacing: 3, len: 1 },
      7: { type: "car", speed: 0.9 * s, dir: 1, spacing: 4, len: 1 },
      8: { type: "car", speed: 0.5 * s, dir: -1, spacing: 3, len: 2 },
      9: { type: "car", speed: 1.1 * s, dir: 1, spacing: 5, len: 1 },
    }
  }, [level])

  React.useEffect(() => {
    if (gameOver || won) return
    const id = setInterval(() => setTick((t) => t + 1), 120)
    return () => clearInterval(id)
  }, [gameOver, won])

  const objectsInLane = React.useCallback((y, t) => {
    const lane = lanes[y]
    if (!lane) return []
    const offset = (t * lane.speed * lane.dir) % (COLS + lane.spacing)
    const out = []
    for (let i = -2; i < COLS + 2; i++) {
      const x = Math.floor(((i * lane.spacing + offset) % (COLS + lane.spacing) + (COLS + lane.spacing)) % (COLS + lane.spacing)) - 1
      out.push({ x, len: lane.len })
    }
    return out
  }, [lanes])

  const hitTest = React.useCallback((fx, fy, t) => {
    const lane = lanes[fy]
    if (!lane) return { type: "safe" }
    const objs = objectsInLane(fy, t)
    const onObj = objs.find((o) => fx >= o.x && fx < o.x + o.len)
    if (lane.type === "car") return onObj ? { type: "hit" } : { type: "safe" }
    if (lane.type === "log") return onObj ? { type: "log", obj: onObj, lane } : { type: "drown" }
    return { type: "safe" }
  }, [lanes, objectsInLane])

  // ride logs / detect collision each tick
  React.useEffect(() => {
    if (gameOver || won) return
    setFrog((f) => {
      const r = hitTest(f.x, f.y, tick)
      if (r.type === "hit" || r.type === "drown") {
        setLives((l) => {
          const nl = l - 1
          if (nl <= 0) setGameOver(true)
          return nl
        })
        return initialFrog
      }
      if (r.type === "log") {
        const lane = r.lane
        const nx = f.x + lane.dir * lane.speed * 0.12
        if (nx < 0 || nx >= COLS) {
          setLives((l) => {
            const nl = l - 1
            if (nl <= 0) setGameOver(true)
            return nl
          })
          return initialFrog
        }
        return { x: nx, y: f.y }
      }
      return f
    })
  }, [tick, hitTest, gameOver, won])

  const move = React.useCallback((dx, dy) => {
    if (gameOver || won) return
    setFrog((f) => {
      const nx = Math.max(0, Math.min(COLS - 1, Math.round(f.x) + dx))
      const ny = Math.max(0, Math.min(ROWS - 1, f.y + dy))
      if (ny === 0) {
        setScore((s) => s + 100 * level)
        setWon(true)
      } else if (ny < f.y) {
        setScore((s) => s + 10)
      }
      return { x: nx, y: ny }
    })
  }, [gameOver, won, level])

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); move(0, -1) }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(0, 1) }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0) }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(1, 0) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [move])

  const nextLevel = () => {
    setLevel((l) => l + 1)
    setFrog(initialFrog)
    setWon(false)
  }
  const restart = () => {
    setFrog(initialFrog)
    setScore(0)
    setLevel(1)
    setLives(3)
    setGameOver(false)
    setWon(false)
  }

  const { database, useLiveQuery, useDocument } = useFireproof("hopper-crossing")
  const { doc: nameDoc, merge: mergeName } = useDocument({ name: "" })
  const [saving, setSaving] = React.useState(false)
  const [savedId, setSavedId] = React.useState(null)

  const saveScore = async () => {
    if (!nameDoc.name.trim() || score === 0) return
    setSaving(true)
    try {
      const r = await database.put({
        type: "score",
        name: nameDoc.name.trim().slice(0, 20),
        score,
        level,
        createdAt: Date.now(),
      })
      setSavedId(r.id)
    } finally {
      setSaving(false)
    }
  }

  const { docs: scores } = useLiveQuery("score", { descending: true, limit: 10 })
  const topScores = scores.filter((d) => d.type === "score")

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-['Space_Grotesk',sans-serif] p-4 md:p-8",
    header: "max-w-[920px] mx-auto bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] p-4 mb-6 flex items-center justify-between",
    logo: "flex items-center gap-2",
    sq: "w-3 h-3 border-[2px] border-[#1a1a2e]",
    title: "text-xl md:text-2xl font-bold uppercase tracking-tight",
    main: "max-w-[920px] mx-auto space-y-6",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] p-5",
    h2: "text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a8a] font-semibold mb-3",
    btnPrimary: "bg-[#d9442e] text-white border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase tracking-[0.06em] text-sm shadow-[4px_4px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[44px]",
    btnYellow: "bg-[#f0c419] text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase tracking-[0.06em] text-sm shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[44px]",
    input: "w-full border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 font-mono bg-white",
    mono: "font-['JetBrains_Mono',monospace]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logo}>
          <span className={`${c.sq} bg-[#d9442e]`}></span>
          <span className={`${c.sq} bg-[#f0c419]`}></span>
          <span className={`${c.sq} bg-[#4a9d3a]`}></span>
          <span className={c.title}>Hopper Crossing</span>
        </div>
        <span className={`${c.mono} text-xs uppercase tracking-wider text-[#7a7a8a]`}>v1</span>
      </header>
      <main id="app" className={c.main}>
        <section id="game-board" className={c.section}>
          <h2 className={c.h2}>Play Field</h2>
          <div className="flex flex-wrap gap-3 mb-3 text-sm">
            <div className={`${c.mono} bg-[#d9442e] text-white px-3 py-1 border-[2px] border-[#1a1a2e] rounded-[4px]`}>SCORE {score}</div>
            <div className={`${c.mono} bg-[#f0c419] px-3 py-1 border-[2px] border-[#1a1a2e] rounded-[4px]`}>LEVEL {level}</div>
            <div className={`${c.mono} bg-[#4a9d3a] text-white px-3 py-1 border-[2px] border-[#1a1a2e] rounded-[4px]`}>LIVES {"♥".repeat(Math.max(0, lives)) || "—"}</div>
          </div>
          <div className="bg-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] aspect-[9/11] max-w-[480px] mx-auto relative overflow-hidden">
            {Array.from({ length: ROWS }).map((_, y) => {
              const lane = lanes[y]
              const bg = y === 0 ? "bg-[#4a9d3a]/50" : y === 10 ? "bg-[#4a9d3a]/50" : y === 5 ? "bg-[#2a2a3a]" : lane?.type === "log" ? "bg-[#2b5b8a]" : lane?.type === "car" ? "bg-[#3a3a4a]" : "bg-[#1a1a2e]"
              return (
                <div key={y} className={`absolute left-0 right-0 ${bg}`} style={{ top: `${(y / ROWS) * 100}%`, height: `${100 / ROWS}%` }}>
                  {lane && objectsInLane(y, tick).map((o, i) => (
                    <div key={i} className={`absolute top-1 bottom-1 border-[2px] border-[#1a1a2e] rounded-[3px] ${lane.type === "car" ? (lane.dir > 0 ? "bg-[#d9442e]" : "bg-[#f0c419]") : "bg-[#8b6f3a]"}`} style={{ left: `${(o.x / COLS) * 100}%`, width: `${(o.len / COLS) * 100}%` }} />
                  ))}
                </div>
              )
            })}
            <div className="absolute border-[2px] border-[#1a1a2e] bg-[#4a9d3a] rounded-[3px] transition-all duration-100" style={{ left: `${(frog.x / COLS) * 100}%`, top: `${(frog.y / ROWS) * 100}%`, width: `${100 / COLS}%`, height: `${100 / ROWS}%` }}>
              <div className="absolute inset-1 bg-[#1a1a2e] rounded-[2px]"></div>
            </div>
            {(gameOver || won) && (
              <div className="absolute inset-0 bg-[#1a1a2e]/85 flex flex-col items-center justify-center gap-3 text-white">
                <div className="text-2xl font-bold uppercase tracking-tight">{won ? `Level ${level} Cleared!` : "Game Over"}</div>
                <div className={`${c.mono} text-sm`}>Score {score}</div>
                {won ? <button className={c.btnYellow} onClick={nextLevel}>Next Level</button> : <button className={c.btnPrimary} onClick={restart}>Restart</button>}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <div className="grid grid-cols-3 gap-2 w-[180px]">
              <div></div>
              <button className={c.btnYellow} onClick={() => move(0, -1)}>↑</button>
              <div></div>
              <button className={c.btnYellow} onClick={() => move(-1, 0)}>←</button>
              <button className={c.btnPrimary} onClick={restart}>RESET</button>
              <button className={c.btnYellow} onClick={() => move(1, 0)}>→</button>
              <div></div>
              <button className={c.btnYellow} onClick={() => move(0, 1)}>↓</button>
              <div></div>
            </div>
          </div>
        </section>
        <section id="save-run" className={c.section}>
          <h2 className={c.h2}>Save Your Run</h2>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            <div className="flex-1">
              <label className="block text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a8a] font-semibold mb-1">Player name</label>
              <input
                className={c.input}
                placeholder="Enter your name"
                value={nameDoc.name}
                onChange={(e) => mergeName({ name: e.target.value })}
                maxLength={20}
              />
            </div>
            <button
              className={c.btnPrimary}
              disabled={saving || !nameDoc.name.trim() || score === 0}
              onClick={saveScore}
            >
              {saving ? (
                <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 3 a 9 9 0 0 1 9 9" />
                </svg>
              ) : "Save Score"}
            </button>
          </div>
          <p className={`${c.mono} text-xs text-[#7a7a8a] mt-2`}>
            {score === 0 ? "Play a round first — score must be above zero." : savedId ? "Saved! Check the leaderboard below." : "Saves your current score + level."}
          </p>
        </section>
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Top 10 Hoppers</h2>
          <ol className="divide-y divide-[#1a1a2e]/15">
            {topScores.length === 0 ? (
              <li className={`${c.mono} text-sm text-[#7a7a8a] py-3`}>No scores yet — be the first to land a run.</li>
            ) : topScores.map((s, i) => (
              <li key={s._id} className="flex items-center justify-between py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`${c.mono} text-xs w-6 text-right ${i === 0 ? "text-[#d9442e] font-bold" : "text-[#7a7a8a]"}`}>{i + 1}.</span>
                  <span className="font-semibold truncate">{s.name}</span>
                  <span className={`${c.mono} text-[0.65rem] uppercase tracking-wider bg-[#f0c419] px-2 py-[2px] border-[2px] border-[#1a1a2e] rounded-[3px]`}>L{s.level}</span>
                </div>
                <span className={`${c.mono} font-bold tabular-nums`}>{s.score}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}