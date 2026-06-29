import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("air-duel")
  const [difficulty, setDifficulty] = React.useState("medium")
  const arenaRef = React.useRef(null)
  const W = 300, H = 400
  const [cpuPaddle, setCpuPaddle] = React.useState({ x: W/2, y: 60 })
  const [youPaddle, setYouPaddle] = React.useState({ x: W/2, y: H-60 })
  const [puck, setPuck] = React.useState({ x: W/2, y: H/2, vx: 2, vy: 3 })
  const [cpuScore, setCpuScore] = React.useState(0)
  const [youScore, setYouScore] = React.useState(0)
  const [winner, setWinner] = React.useState(null)
  const savedRef = React.useRef(false)
  const { docs: matches } = useLiveQuery("type", { key: "match", descending: true, limit: 10 })

  const handlePointerMove = (e) => {
    if (winner) return
    const rect = arenaRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const y = ((e.clientY - rect.top) / rect.height) * H
    setYouPaddle({ x: Math.max(24, Math.min(W-24, x)), y: Math.max(H/2+24, Math.min(H-24, y)) })
  }

  const resetMatch = () => {
    setCpuScore(0); setYouScore(0); setWinner(null); savedRef.current = false
    setPuck({ x: W/2, y: H/2, vx: 2, vy: 3 })
  }

  React.useEffect(() => {
    if (winner) return
    const speed = { easy: 1.2, medium: 2.2, hard: 3.5 }[difficulty]
    const id = setInterval(() => {
      setPuck(p => {
        let { x, y, vx, vy } = p
        x += vx; y += vy
        if (x < 12 || x > W-12) vx = -vx
        // paddle collisions
        const hit = (pad) => Math.hypot(x-pad.x, y-pad.y) < 36
        if (hit(youPaddle) && vy > 0) { vy = -Math.abs(vy)-0.3; vx += (x-youPaddle.x)*0.05 }
        if (hit(cpuPaddle) && vy < 0) { vy = Math.abs(vy)+0.3; vx += (x-cpuPaddle.x)*0.05 }
        vx = Math.max(-7, Math.min(7, vx)); vy = Math.max(-8, Math.min(8, vy))
        if (y < 0) { setYouScore(s => s+1); return { x: W/2, y: H/2, vx: 2, vy: 3 } }
        if (y > H) { setCpuScore(s => s+1); return { x: W/2, y: H/2, vx: 2, vy: -3 } }
        return { x, y, vx, vy }
      })
      setCpuPaddle(p => {
        const dx = puck.x - p.x
        return { x: p.x + Math.sign(dx)*Math.min(Math.abs(dx), speed), y: 60 }
      })
    }, 16)
    return () => clearInterval(id)
  }, [winner, difficulty, youPaddle, cpuPaddle, puck.x])

  React.useEffect(() => {
    if (winner || savedRef.current) return
    if (youScore >= 7 || cpuScore >= 7) {
      const w = youScore >= 7 ? "You" : "CPU"
      setWinner(w); savedRef.current = true
      database.put({ type: "match", you: youScore, cpu: cpuScore, winner: w, difficulty, createdAt: Date.now() })
    }
  }, [youScore, cpuScore, winner, difficulty, database])

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-['Space_Grotesk',sans-serif] pb-8",
    header: "bg-[#1a1a2e] text-white border-b-[3px] border-[#1a1a2e] px-5 py-4 flex items-center justify-between",
    title: "text-2xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#e63946] font-mono",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] p-5 shadow-[4px_4px_0px_#1a1a2e]",
    h2: "text-lg font-bold uppercase tracking-tight mb-3",
    btn: "bg-[#e63946] text-white border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#1a1a2e] min-h-[44px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnAlt: "bg-[#ffd60a] text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase tracking-wider text-sm shadow-[3px_3px_0px_#1a1a2e] min-h-[44px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  }
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-[#e63946]"></div>
            <div className="w-3 h-3 bg-[#ffd60a]"></div>
            <div className="w-3 h-3 bg-[#06d6a0]"></div>
          </div>
          <h1 className={c.title}>Air Duel</h1>
        </div>
        <span className={c.tag}>v1 // arcade</span>
      </header>
      <main id="app" className={c.main}>
        <section id="difficulty" className={c.section}>
          <h2 className={c.h2}>CPU Difficulty</h2>
          <div className="grid grid-cols-3 gap-2">
            {["easy","medium","hard"].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={difficulty===d ? c.btn : c.btnAlt}>{d}</button>
            ))}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.15em] text-[#6b6b80] font-mono">Selected: {difficulty}</p>
        </section>
        <section id="arena" className={c.section}>
          <h2 className={c.h2}>Match</h2>
          <div className="flex justify-between items-center mb-3 font-mono">
            <div className="text-center">
              <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b80]">CPU</div>
              <div className="text-3xl font-bold text-[#e63946]">{cpuScore}</div>
            </div>
            <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#1a1a2e] font-bold">
              {winner ? `${winner} wins!` : "First to 7"}
            </div>
            <div className="text-center">
              <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b80]">You</div>
              <div className="text-3xl font-bold text-[#06d6a0]">{youScore}</div>
            </div>
          </div>
          <div
            ref={arenaRef}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            className="w-full aspect-[3/4] bg-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] relative overflow-hidden touch-none"
          >
            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-[#ffd60a]"></div>
            <div className="absolute bg-[#e63946] rounded-full border-2 border-white"
              style={{ width: 48, height: 48, left: cpuPaddle.x - 24, top: cpuPaddle.y - 24 }}></div>
            <div className="absolute bg-[#06d6a0] rounded-full border-2 border-white"
              style={{ width: 48, height: 48, left: youPaddle.x - 24, top: youPaddle.y - 24 }}></div>
            <div className="absolute bg-[#ffd60a] rounded-full border-2 border-white"
              style={{ width: 24, height: 24, left: puck.x - 12, top: puck.y - 12 }}></div>
          </div>
          <button onClick={resetMatch} className={`${c.btn} w-full mt-3`}>Reset Match</button>
        </section>
        <section id="history" className={c.section}>
          <h2 className={c.h2}>Record</h2>
          <div className="flex gap-2 mb-3 font-mono text-sm">
            <div className="flex-1 bg-[#06d6a0] border-[3px] border-[#1a1a2e] rounded-[4px] p-2 text-center">
              <div className="text-[0.6rem] uppercase tracking-[0.15em]">Wins</div>
              <div className="text-2xl font-bold">{matches.filter(m=>m.winner==="You").length}</div>
            </div>
            <div className="flex-1 bg-[#e63946] text-white border-[3px] border-[#1a1a2e] rounded-[4px] p-2 text-center">
              <div className="text-[0.6rem] uppercase tracking-[0.15em]">Losses</div>
              <div className="text-2xl font-bold">{matches.filter(m=>m.winner==="CPU").length}</div>
            </div>
          </div>
          <ul className="space-y-2">
            {matches.length === 0 && (
              <li className="text-xs text-[#6b6b80] font-mono uppercase tracking-[0.15em]">No matches yet — play one!</li>
            )}
            {matches.map(m => (
              <li key={m._id} className="flex justify-between items-center border-[3px] border-[#1a1a2e] rounded-[4px] p-2 font-mono text-sm bg-[#f5f1e8]">
                <span className={`font-bold ${m.winner==="You"?"text-[#06d6a0]":"text-[#e63946]"}`}>{m.winner}</span>
                <span>{m.you} - {m.cpu}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b80]">{m.difficulty}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}