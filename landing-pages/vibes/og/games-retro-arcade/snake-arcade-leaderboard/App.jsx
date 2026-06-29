import React, { useState, useEffect, useRef, useCallback } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const GRID = 20
const START_SNAKE = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

function randFood(snake) {
  while (true) {
    const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
    if (!snake.some(s => s.x === f.x && s.y === f.y)) return f
  }
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("snake-arcade")
  const [snake, setSnake] = useState(START_SNAKE)
  const [dir, setDir] = useState({ x: 1, y: 0 })
  const [food, setFood] = useState({ x: 5, y: 10 })
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [dead, setDead] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const dirRef = useRef(dir)
  dirRef.current = dir

  const speedLabel = `${(1 + Math.floor((snake.length - 3) / 3) * 0.2).toFixed(1)}x`
  const tickMs = Math.max(70, 180 - (snake.length - 3) * 8)

  const reset = useCallback(() => {
    setSnake(START_SNAKE)
    setDir({ x: 1, y: 0 })
    setFood(randFood(START_SNAKE))
    setScore(0)
    setDead(false)
    setRunning(false)
    setName("")
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (DIRS[e.key]) {
        e.preventDefault()
        const nd = DIRS[e.key]
        const cd = dirRef.current
        if (nd.x === -cd.x && nd.y === -cd.y) return
        setDir(nd)
        if (!running && !dead) setRunning(true)
      } else if (e.key === " " && dead) {
        reset()
      } else if (e.key === " " && !running) {
        setRunning(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [running, dead, reset])

  useEffect(() => {
    if (!running || dead) return
    const id = setInterval(() => {
      setSnake(prev => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y }
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || prev.some(s => s.x === head.x && s.y === head.y)) {
          setDead(true)
          setRunning(false)
          return prev
        }
        const ate = head.x === food.x && head.y === food.y
        const next = [head, ...prev]
        if (!ate) next.pop()
        else {
          setScore(s => s + 10)
          setFood(randFood(next))
        }
        return next
      })
    }, tickMs)
    return () => clearInterval(id)
  }, [running, dead, food, tickMs])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayQuery = useLiveQuery("day", { key: todayKey })
  const allQuery = useLiveQuery("score", { descending: true, limit: 10 })
  const todayTop = [...todayQuery.docs].sort((a, b) => b.score - a.score).slice(0, 10)
  const lifetimeTop = allQuery.docs.slice(0, 10)

  async function handleSubmitScore(e) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await database.put({ name: name.trim(), score, day: todayKey, createdAt: Date.now() })
      reset()
    } finally {
      setSaving(false)
    }
  }

  function handleRestart() {
    reset()
  }

  async function handleSuggestName() {
    if (suggesting) return
    setSuggesting(true)
    try {
      const res = await callAI("Generate one short fun arcade gamer handle, 3-10 chars, no spaces.", {
        schema: { properties: { handle: { type: "string" } } },
      })
      const { handle } = JSON.parse(res)
      if (handle) setName(handle.slice(0, 12))
    } finally {
      setSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen p-4 md:p-8 bg-[#f5f2e8] text-[#1a1a2e]",
    shell: "max-w-5xl mx-auto",
    header: "border-[3px] border-[#1a1a2e] rounded-[4px] p-4 mb-6 flex items-center justify-between bg-white shadow-[4px_4px_0px_#1a1a2e]",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    brand: "text-lg font-bold uppercase tracking-tight",
    navRow: "flex gap-2",
    navLink: "px-3 py-1 border-[3px] border-[#1a1a2e] rounded-[4px] text-xs uppercase tracking-wider font-bold bg-[#e8c547]",
    layout: "grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6",
    boardCard: "border-[3px] border-[#1a1a2e] rounded-[4px] p-4 bg-white shadow-[4px_4px_0px_#1a1a2e]",
    boardTopBar: "h-[6px] -mx-4 -mt-4 mb-4 flex",
    boardBarSeg: "flex-1",
    title: "text-3xl md:text-5xl font-bold uppercase tracking-tight mb-2 relative",
    titleShadow: "absolute top-[5px] left-[5px] -z-10 opacity-50 text-[#d63d2a]",
    statRow: "grid grid-cols-3 gap-3 mb-4",
    statCard: "border-[3px] border-[#1a1a2e] rounded-[4px] overflow-hidden shadow-[3px_3px_0px_#1a1a2e]",
    statHead: "px-3 py-1 text-[0.65rem] uppercase tracking-widest font-bold border-b-[3px]",
    statBody: "p-3 text-2xl font-mono font-bold text-center",
    grid: "aspect-square w-full border-[3px] border-[#1a1a2e] rounded-[4px] relative overflow-hidden bg-[#f5f2e8] bg-[linear-gradient(to_right,#1a1a2e10_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e10_1px,transparent_1px)] bg-[size:5%_5%]",
    cell: "absolute",
    overlay: "absolute inset-0 flex items-center justify-center flex-col gap-3 p-4 bg-[#1a1a2e]/60",
    overlayCard: "border-[3px] border-[#1a1a2e] rounded-[4px] p-6 max-w-xs w-full bg-white shadow-[8px_8px_0px_#1a1a2e]",
    overlayTitle: "text-2xl font-bold uppercase tracking-tight mb-3 text-center",
    form: "flex flex-col gap-3",
    label: "text-[0.65rem] uppercase tracking-widest font-bold",
    inputRow: "flex gap-2",
    input: "flex-1 border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 font-mono text-sm bg-white",
    btnPrimary: "px-4 py-3 border-[3px] border-[#1a1a2e] rounded-[4px] font-bold uppercase tracking-wider text-sm min-h-[44px] bg-[#d63d2a] text-white shadow-[4px_4px_0px_#1a1a2e] disabled:opacity-50",
    btnSecondary: "px-4 py-3 border-[3px] border-[#1a1a2e] rounded-[4px] font-bold uppercase tracking-wider text-sm min-h-[44px] bg-[#e8c547] text-[#1a1a2e] shadow-[3px_3px_0px_#1a1a2e]",
    btnGhost: "px-3 py-2 border-[3px] border-[#1a1a2e] rounded-[4px] font-bold uppercase tracking-wider text-xs bg-white",
    side: "flex flex-col gap-4",
    boardPanel: "border-[3px] border-[#1a1a2e] rounded-[4px] p-4 bg-white shadow-[4px_4px_0px_#1a1a2e]",
    boardHead: "text-[0.65rem] uppercase tracking-widest font-bold mb-3 pb-2 border-b-[2px] border-[#1a1a2e]",
    scoreRow: "flex items-center justify-between py-1.5 text-sm",
    rank: "font-mono font-bold w-6",
    name: "flex-1 truncate px-2",
    score: "font-mono font-bold",
    empty: "text-xs italic py-2 text-[#666680]",
    hint: "text-[0.7rem] uppercase tracking-wider mt-3 text-center text-[#666680]",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <div className={c.logoDots}>
              <span className={`${c.dot} bg-[#d63d2a] border-[#1a1a2e]`}></span>
              <span className={`${c.dot} bg-[#e8c547] border-[#1a1a2e]`}></span>
              <span className={`${c.dot} bg-[#3da35d] border-[#1a1a2e]`}></span>
            </div>
            <span className={c.brand}>Snake Arcade</span>
          </div>
          <nav className={c.navRow}>
            <span className={c.navLink}>Play</span>
            <span className={c.navLink}>Scores</span>
          </nav>
        </header>

        <main id="app">
          <div className={c.layout}>
            <section id="game" className={c.boardCard}>
              <div className={c.boardTopBar}>
                <span className={`${c.boardBarSeg} bg-[#d63d2a]`}></span>
                <span className={`${c.boardBarSeg} bg-[#e8c547]`}></span>
                <span className={`${c.boardBarSeg} bg-[#3da35d]`}></span>
                <span className={`${c.boardBarSeg} bg-[#3a6dd6]`}></span>
              </div>
              <h1 className={c.title}>
                <span aria-hidden="true" className={c.titleShadow}>Slither</span>
                Slither
              </h1>

              <div className={c.statRow}>
                <div className={c.statCard}>
                  <div className={`${c.statHead} bg-[#d63d2a] text-white border-[#1a1a2e]`}>Score</div>
                  <div className={c.statBody}>{score}</div>
                </div>
                <div className={c.statCard}>
                  <div className={`${c.statHead} bg-[#e8c547] text-[#1a1a2e] border-[#1a1a2e]`}>Length</div>
                  <div className={c.statBody}>{snake.length}</div>
                </div>
                <div className={c.statCard}>
                  <div className={`${c.statHead} bg-[#3da35d] text-[#1a1a2e] border-[#1a1a2e]`}>Speed</div>
                  <div className={c.statBody}>{speedLabel}</div>
                </div>
              </div>

              <div className={c.grid}>
                {snake.map((s, i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${(s.x / GRID) * 100}%`,
                      top: `${(s.y / GRID) * 100}%`,
                      width: `${100 / GRID}%`,
                      height: `${100 / GRID}%`,
                      background: i === 0 ? "#1a1a2e" : "#3da35d",
                      border: "2px solid #1a1a2e",
                      borderRadius: "2px",
                    }}
                  />
                ))}
                <div
                  className="absolute"
                  style={{
                    left: `${(food.x / GRID) * 100}%`,
                    top: `${(food.y / GRID) * 100}%`,
                    width: `${100 / GRID}%`,
                    height: `${100 / GRID}%`,
                    background: "#d63d2a",
                    border: "2px solid #1a1a2e",
                    borderRadius: "50%",
                  }}
                />
                {!running && !dead && (
                  <div className={c.overlay}>
                    <div className={c.overlayCard}>
                      <h2 className={c.overlayTitle}>Ready</h2>
                      <button type="button" className={c.btnPrimary} onClick={() => setRunning(true)}>Start</button>
                      <p className={c.hint}>Arrow keys to steer</p>
                    </div>
                  </div>
                )}
                {dead && (
                <div className={c.overlay}>
                  <div className={c.overlayCard}>
                    <h2 className={c.overlayTitle}>Crashed · {score}</h2>
                    <form className={c.form} onSubmit={handleSubmitScore}>
                      <label className={c.label}>Your Name</label>
                      <div className={c.inputRow}>
                        <input
                          className={c.input}
                          placeholder="Enter name"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          maxLength={12}
                        />
                        <button type="button" className={c.btnGhost} onClick={handleSuggestName} disabled={suggesting}>
                          {suggesting ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/></svg>
                          ) : "Idea"}
                        </button>
                      </div>
                      <button type="submit" className={c.btnPrimary} disabled={saving || !name.trim()}>
                        {saving ? "Saving..." : "Save Score"}
                      </button>
                      <button type="button" className={c.btnSecondary} onClick={handleRestart}>Play Again</button>
                    </form>
                  </div>
                </div>
                )}
              </div>

              <p className={c.hint}>Arrow keys to move · Space to start</p>
            </section>

            <aside className={c.side}>
              <section id="today" className={c.boardPanel}>
                <h3 className={c.boardHead}>Today's Top 10</h3>
                <ol>
                  {todayTop.length === 0 && <li className={c.empty}>No scores yet today.</li>}
                  {todayTop.map((d, i) => (
                    <li key={d._id} className={c.scoreRow}>
                      <span className={c.rank}>{i + 1}</span>
                      <span className={c.name}>{d.name}</span>
                      <span className={c.score}>{d.score}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section id="lifetime" className={c.boardPanel}>
                <h3 className={c.boardHead}>Lifetime Best</h3>
                <ol>
                  {lifetimeTop.length === 0 && <li className={c.empty}>No scores yet.</li>}
                  {lifetimeTop.map((d, i) => (
                    <li key={d._id} className={c.scoreRow}>
                      <span className={c.rank}>{i + 1}</span>
                      <span className={c.name}>{d.name}</span>
                      <span className={c.score}>{d.score}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}