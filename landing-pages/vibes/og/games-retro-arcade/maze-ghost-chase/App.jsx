import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("chomp-maze")

  const LAYOUT = [
    "#############",
    "#o....#....o#",
    "#.##.#.#.##.#",
    "#...........#",
    "#.##.###.##.#",
    "#....# #....#",
    "#.##.###.##.#",
    "#...........#",
    "#.##.#.#.##.#",
    "#o....#....o#",
    "#############",
  ]
  const ROWS = LAYOUT.length
  const COLS = LAYOUT[0].length
  const isWall = (r, col) => LAYOUT[r]?.[col] === "#"

  const [score, setScore] = React.useState(0)
  const [lives, setLives] = React.useState(3)
  const [level, setLevel] = React.useState(1)
  const [running, setRunning] = React.useState(false)
  const [frightened, setFrightened] = React.useState(0)
  const [pacman, setPacman] = React.useState({ r: 7, c: 6 })
  const [dir, setDir] = React.useState({ dr: 0, dc: 0 })
  const [dots, setDots] = React.useState(() => {
    const s = new Set()
    LAYOUT.forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === "." || ch === "o") s.add(`${r},${col}`)
    }))
    return s
  })
  const [pellets, setPellets] = React.useState(() => {
    const s = new Set()
    LAYOUT.forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === "o") s.add(`${r},${col}`)
    }))
    return s
  })
  const [ghosts, setGhosts] = React.useState([
    { r: 5, c: 5, color: "#d63b2a", kind: "hunter" },
    { r: 5, c: 6, color: "#f0c419", kind: "ambush" },
    { r: 5, c: 7, color: "#2956c2", kind: "random" },
    { r: 4, c: 6, color: "#3aa056", kind: "patrol" },
  ])
  const [chaserNames, setChaserNames] = React.useState(["Hunter", "Ambush", "Random", "Patrol"])
  const [isLoading, setIsLoading] = React.useState(false)
  const [gameOver, setGameOver] = React.useState(false)

  const { docs: runs } = useLiveQuery("score", { descending: true, limit: 10 })

  const dirRef = React.useRef(dir)
  React.useEffect(() => { dirRef.current = dir }, [dir])
  const stateRef = React.useRef({})
  stateRef.current = { pacman, ghosts, dots, pellets, frightened, lives, score, level, running, gameOver }

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp") setDir({ dr: -1, dc: 0 })
      else if (e.key === "ArrowDown") setDir({ dr: 1, dc: 0 })
      else if (e.key === "ArrowLeft") setDir({ dr: 0, dc: -1 })
      else if (e.key === "ArrowRight") setDir({ dr: 0, dc: 1 })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (!running || gameOver) return
    const id = setInterval(() => {
      const s = stateRef.current
      const d = dirRef.current
      let np = { ...s.pacman }
      const nr = np.r + d.dr, nc = np.c + d.dc
      if (!isWall(nr, nc) && (d.dr || d.dc)) np = { r: nr, c: nc }

      let newScore = s.score
      const newDots = new Set(s.dots)
      const newPellets = new Set(s.pellets)
      const key = `${np.r},${np.c}`
      let newFright = Math.max(0, s.frightened - 1)
      if (newDots.has(key)) {
        newDots.delete(key)
        newScore += 10
        if (newPellets.has(key)) {
          newPellets.delete(key)
          newScore += 40
          newFright = 30
        }
      }

      const newGhosts = s.ghosts.map((g) => {
        const opts = [[-1,0],[1,0],[0,-1],[0,1]].filter(([dr,dc]) => !isWall(g.r+dr, g.c+dc))
        if (!opts.length) return g
        let pick
        if (g.kind === "random" || newFright > 0) {
          pick = opts[Math.floor(Math.random() * opts.length)]
        } else {
          const tr = g.kind === "ambush" ? np.r + d.dr*2 : np.r
          const tc = g.kind === "ambush" ? np.c + d.dc*2 : np.c
          pick = opts.reduce((best, o) => {
            const dist = Math.abs(g.r+o[0]-tr) + Math.abs(g.c+o[1]-tc)
            return !best || dist < best.dist ? { o, dist } : best
          }, null).o
        }
        return { ...g, r: g.r + pick[0], c: g.c + pick[1] }
      })

      let newLives = s.lives
      let died = false
      const finalGhosts = []
      for (const g of newGhosts) {
        if (g.r === np.r && g.c === np.c) {
          if (newFright > 0) {
            newScore += 200
            finalGhosts.push({ ...g, r: 5, c: 6 })
          } else {
            died = true
            finalGhosts.push(g)
          }
        } else finalGhosts.push(g)
      }

      if (died) {
        newLives -= 1
        if (newLives <= 0) {
          setGameOver(true)
          setRunning(false)
          database.put({
            type: "run",
            score: newScore,
            level: s.level,
            chasers: chaserNames,
            createdAt: Date.now(),
          })
          return
        }
        setPacman({ r: 7, c: 6 })
        setGhosts([
          { r: 5, c: 5, color: "#d63b2a", kind: "hunter" },
          { r: 5, c: 6, color: "#f0c419", kind: "ambush" },
          { r: 5, c: 7, color: "#2956c2", kind: "random" },
          { r: 4, c: 6, color: "#3aa056", kind: "patrol" },
        ])
        setDir({ dr: 0, dc: 0 })
        setLives(newLives)
        setScore(newScore)
        setFrightened(0)
        return
      }

      if (newDots.size === 0) {
        setLevel(s.level + 1)
        setDots(new Set([...LAYOUT.flatMap((row, r) => [...row].map((ch, col) => (ch === "." || ch === "o") ? `${r},${col}` : null).filter(Boolean))]))
        setPellets(new Set(LAYOUT.flatMap((row, r) => [...row].map((ch, col) => ch === "o" ? `${r},${col}` : null).filter(Boolean))))
        setPacman({ r: 7, c: 6 })
        setDir({ dr: 0, dc: 0 })
        setScore(newScore)
        setFrightened(0)
        return
      }

      setPacman(np)
      setDots(newDots)
      setPellets(newPellets)
      setGhosts(finalGhosts)
      setScore(newScore)
      setFrightened(newFright)
    }, 200)
    return () => clearInterval(id)
  }, [running, gameOver])

  const c = {
    page: "min-h-screen p-4 flex flex-col gap-4 max-w-[920px] mx-auto bg-[#f5f1e8] text-[#1a1530]",
    header: "flex items-center justify-between p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530]",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    brandSquare: "w-3 h-3 border-[2px] border-[#1a1530]",
    title: "text-lg font-bold uppercase tracking-tight",
    hud: "grid grid-cols-3 gap-2 p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530]",
    hudCell: "flex flex-col items-center p-2 border-[3px] border-[#1a1530] rounded bg-white",
    hudLabel: "text-[0.6rem] uppercase tracking-widest text-[#5a5670]",
    hudValue: "text-2xl font-bold font-mono",
    arena: "p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530] flex justify-center overflow-x-auto",
    maze: "grid",
    cell: "w-6 h-6 flex items-center justify-center",
    controls: "p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530] flex flex-col gap-3",
    btnRow: "flex flex-wrap gap-2",
    btnPrimary: "px-4 py-3 border-[3px] border-[#1a1530] rounded font-bold uppercase tracking-wider text-sm min-h-[44px] bg-[#d63b2a] text-white shadow-[4px_4px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnSecondary: "px-4 py-3 border-[3px] border-[#1a1530] rounded font-bold uppercase tracking-wider text-sm min-h-[44px] bg-[#f0c419] text-[#1a1530] shadow-[3px_3px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "px-4 py-3 border-[3px] border-[#1a1530] rounded font-bold uppercase tracking-wider text-sm min-h-[44px] bg-white text-[#1a1530] hover:shadow-[3px_3px_0_#1a1530]",
    dpad: "grid grid-cols-3 gap-2 w-48 mx-auto",
    dpadBtn: "border-[3px] border-[#1a1530] rounded font-bold text-xl min-h-[48px] flex items-center justify-center bg-[#2956c2] text-white shadow-[3px_3px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    chasers: "p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530]",
    chaserGrid: "grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2",
    chaserCard: "p-2 border-[3px] border-[#1a1530] rounded flex flex-col items-center gap-1 bg-white",
    chaserDot: "w-6 h-6 border-[2px] border-[#1a1530] rounded-full",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest text-[#5a5670]",
    board: "p-3 border-[3px] border-[#1a1530] rounded bg-white shadow-[4px_4px_0_#1a1530]",
    runRow: "flex items-center justify-between p-2 border-b-[2px] border-[#1a1530] text-sm hover:bg-[#f0c419]",
    runMono: "font-mono",
    empty: "text-sm p-3 text-center text-[#5a5670]",
  }

  function handleStart() {
    if (gameOver) handleReset()
    setRunning(true)
  }
  function handlePause() { setRunning(false) }
  function handleReset() {
    setScore(0); setLives(3); setLevel(1); setRunning(false); setGameOver(false); setFrightened(0)
    setPacman({ r: 7, c: 6 }); setDir({ dr: 0, dc: 0 })
    setDots(new Set(LAYOUT.flatMap((row, r) => [...row].map((ch, col) => (ch === "." || ch === "o") ? `${r},${col}` : null).filter(Boolean))))
    setPellets(new Set(LAYOUT.flatMap((row, r) => [...row].map((ch, col) => ch === "o" ? `${r},${col}` : null).filter(Boolean))))
    setGhosts([
      { r: 5, c: 5, color: "#d63b2a", kind: "hunter" },
      { r: 5, c: 6, color: "#f0c419", kind: "ambush" },
      { r: 5, c: 7, color: "#2956c2", kind: "random" },
      { r: 4, c: 6, color: "#3aa056", kind: "patrol" },
    ])
  }
  function handleMove(d) {
    if (d === "up") setDir({ dr: -1, dc: 0 })
    else if (d === "down") setDir({ dr: 1, dc: 0 })
    else if (d === "left") setDir({ dr: 0, dc: -1 })
    else if (d === "right") setDir({ dr: 0, dc: 1 })
  }
  async function handleSuggest(e) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await callAI("Generate 4 short, punchy, single-word arcade ghost names with distinct vibes (aggressive, sneaky, chaotic, methodical).", {
        schema: { properties: { names: { type: "array", items: { type: "string" } } } }
      })
      const { names } = JSON.parse(res)
      if (Array.isArray(names) && names.length >= 4) setChaserNames(names.slice(0, 4))
    } finally { setIsLoading(false) }
  }

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <div className={c.brandSquare}></div>
            <div className={c.brandSquare}></div>
            <div className={c.brandSquare}></div>
          </div>
          <span className={c.title}>Chomp Maze</span>
        </div>
        <span className={c.sectionLabel}>Arcade</span>
      </header>

      <section id="hud" className={c.hud}>
        <div className={c.hudCell}>
          <span className={c.hudLabel}>Score</span>
          <span className={c.hudValue}>{score}</span>
        </div>
        <div className={c.hudCell}>
          <span className={c.hudLabel}>Lives</span>
          <span className={c.hudValue}>{lives}</span>
        </div>
        <div className={c.hudCell}>
          <span className={c.hudLabel}>Level</span>
          <span className={c.hudValue}>{level}</span>
        </div>
      </section>

      <section id="arena" className={c.arena}>
        <div className={c.maze} style={{ gridTemplateColumns: `repeat(${COLS}, 1.5rem)` }}>
          {LAYOUT.flatMap((row, r) => [...row].map((ch, col) => {
            const k = `${r},${col}`
            const wall = ch === "#"
            const isPac = pacman.r === r && pacman.c === col
            const ghost = ghosts.find((g) => g.r === r && g.c === col)
            const hasDot = dots.has(k) && !isPac
            const hasPellet = pellets.has(k) && !isPac
            return (
              <div key={k} className={c.cell} style={{ background: wall ? "#1a1530" : "transparent" }}>
                {isPac ? <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f0c419", border: "2px solid #1a1530" }} /> :
                  ghost ? <div style={{ width: 18, height: 18, borderRadius: "50%", background: frightened > 0 ? "#2956c2" : ghost.color, border: "2px solid #1a1530" }} /> :
                  hasPellet ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d63b2a" }} /> :
                  hasDot ? <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1a1530" }} /> : null}
              </div>
            )
          }))}
        </div>
      </section>

      <section id="controls" className={c.controls}>
        <div className={c.btnRow}>
          <button className={c.btnPrimary} onClick={handleStart}>{gameOver ? "Play Again" : running ? "Running" : "Start"}</button>
          <button className={c.btnSecondary} onClick={handlePause}>Pause</button>
          <button className={c.btnGhost} onClick={handleReset}>Reset</button>
        </div>
        <div className={c.dpad}>
          <div></div>
          <button className={c.dpadBtn} onClick={() => handleMove("up")}>↑</button>
          <div></div>
          <button className={c.dpadBtn} onClick={() => handleMove("left")}>←</button>
          <div></div>
          <button className={c.dpadBtn} onClick={() => handleMove("right")}>→</button>
          <div></div>
          <button className={c.dpadBtn} onClick={() => handleMove("down")}>↓</button>
          <div></div>
        </div>
      </section>

      <section id="chasers" className={c.chasers}>
        <div className="flex items-center justify-between">
          <span className={c.sectionLabel}>Chasers</span>
          <button className={c.btnGhost} onClick={handleSuggest} disabled={isLoading}>{isLoading ? "..." : "Suggest names"}</button>
        </div>
        <div className={c.chaserGrid}>
          <div className={c.chaserCard}><div className={c.chaserDot}></div><span className="text-xs uppercase">Hunter</span></div>
          <div className={c.chaserCard}><div className={c.chaserDot}></div><span className="text-xs uppercase">Ambush</span></div>
          <div className={c.chaserCard}><div className={c.chaserDot}></div><span className="text-xs uppercase">Random</span></div>
          <div className={c.chaserCard}><div className={c.chaserDot}></div><span className="text-xs uppercase">Patrol</span></div>
        </div>
      </section>

      <section id="board" className={c.board}>
        <span className={c.sectionLabel}>Top Runs</span>
        {runs.length === 0 ? (
          <div className={c.empty}>No runs yet — press Start.</div>
        ) : (
          <ul>
            {runs.map((r, i) => (
              <li key={r._id} className={c.runRow}>
                <span className="font-bold">#{i + 1}</span>
                <span className={c.runMono}>{r.score}</span>
                <span className="text-xs uppercase">Lv {r.level}</span>
                <span className="text-xs">{(r.chasers || []).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}