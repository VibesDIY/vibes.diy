import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, database } = useFireproof("strike-zone")
  const { docs: games } = useLiveQuery("type", { key: "game", descending: true })
  const bestScore = games.reduce((m, g) => Math.max(m, g.finalScore || 0), 0)
  const topGames = [...games].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)).slice(0, 5)

  const [frames, setFrames] = React.useState(() => Array.from({length: 10}, () => []))
  const [frameIdx, setFrameIdx] = React.useState(0)
  const [pins, setPins] = React.useState(Array(10).fill(1))
  const [aim, setAim] = React.useState(0)
  const [power, setPower] = React.useState(0)
  const [charging, setCharging] = React.useState(false)
  const [gameOver, setGameOver] = React.useState(false)
  const chargeRef = React.useRef(null)
  const dirRef = React.useRef(1)
  const savedRef = React.useRef(false)

  const startCharge = () => {
    setCharging(true); setPower(0); dirRef.current = 1
    chargeRef.current = setInterval(() => {
      setPower(p => {
        let n = p + dirRef.current * 4
        if (n >= 100) { n = 100; dirRef.current = -1 }
        if (n <= 0) { n = 0; dirRef.current = 1 }
        return n
      })
    }, 30)
  }

  const release = () => {
    clearInterval(chargeRef.current); setCharging(false)
    const standing = pins.filter(p => p).length
    const accuracy = 1 - Math.abs(aim)/8
    const powerFactor = power < 30 ? 0.4 : power > 90 ? 0.7 : 1
    const expected = Math.round(standing * accuracy * powerFactor * (0.85 + Math.random()*0.3))
    const knocked = Math.min(standing, Math.max(0, expected))
    const newPins = [...pins]
    let toKnock = knocked
    for (let i = 0; i < newPins.length && toKnock > 0; i++) {
      if (newPins[i]) { newPins[i] = 0; toKnock-- }
    }
    setPins(newPins)
    const curFrame = [...frames[frameIdx], knocked]
    const next = [...frames]; next[frameIdx] = curFrame
    setFrames(next)

    const isLast = frameIdx === 9
    const strike = curFrame.length === 1 && curFrame[0] === 10
    const spare = curFrame.length === 2 && curFrame[0] + curFrame[1] === 10

    if (!isLast && (strike || curFrame.length === 2)) {
      setFrameIdx(frameIdx + 1); setPins(Array(10).fill(1))
    } else if (isLast) {
      const bonus = strike || spare ? 3 : 2
      if (curFrame.length >= bonus) setGameOver(true)
      else if (strike && curFrame.length === 1) setPins(Array(10).fill(1))
      else if (curFrame.length === 2 && curFrame[0] + curFrame[1] === 10) setPins(Array(10).fill(1))
    }
    setPower(0); setAim(0)
  }

  const computeScores = (fr) => {
    const scores = []; let total = 0
    for (let i = 0; i < 10; i++) {
      const f = fr[i]; if (!f || f.length === 0) { scores.push(null); continue }
      let s = f.reduce((a,b)=>a+b, 0)
      if (i < 9) {
        if (f[0] === 10) { const nx = fr[i+1] || []; s += (nx[0]||0) + (nx[1] !== undefined ? nx[1] : (fr[i+2]?.[0]||0)) }
        else if (f.length === 2 && s === 10) { s += fr[i+1]?.[0] || 0 }
      }
      total += s; scores.push(total)
    }
    return scores
  }
  const scores = computeScores(frames)
  const finalScore = scores[9] || scores.filter(s => s !== null).pop() || 0

  React.useEffect(() => {
    if (gameOver && !savedRef.current) {
      savedRef.current = true
      database.put({ type: "game", frames, finalScore: scores[9] || 0, createdAt: Date.now() })
    }
  }, [gameOver])

  const newGame = () => {
    setFrames(Array.from({length:10},()=>[])); setFrameIdx(0); setPins(Array(10).fill(1))
    setAim(0); setPower(0); setGameOver(false); savedRef.current = false
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#15151f] font-['Space_Grotesk',sans-serif] pb-20",
    header: "bg-white border-b-[3px] border-[#15151f] px-4 py-4 flex items-center justify-between sticky top-0 z-20",
    brand: "text-2xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#666] font-mono",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#15151f] rounded-[4px] p-5 shadow-[4px_4px_0px_#15151f]",
    h2: "text-lg font-bold uppercase tracking-tight mb-3",
    btnPrimary: "bg-[#d94327] text-white border-[3px] border-[#15151f] rounded-[4px] px-4 py-3 font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
    btnSecondary: "bg-[#f4d03f] text-[#15151f] border-[3px] border-[#15151f] rounded-[4px] px-4 py-3 font-bold uppercase tracking-wider text-sm shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
    laneFrame: "bg-[#e8dcc0] border-[3px] border-[#15151f] rounded-[4px] aspect-[3/4] relative overflow-hidden",
    scoreCell: "border-[2px] border-[#15151f] min-w-[44px] text-center p-1 font-mono text-sm",
    rowItem: "border-[3px] border-[#15151f] rounded-[4px] p-3 bg-white flex items-center justify-between",
    badge: "bg-[#3d8b40] text-white border-[2px] border-[#15151f] rounded-[4px] px-2 py-1 font-mono text-xs font-bold uppercase",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.brand}>Strike Zone</div>
          <div className={c.tag}>Ten-Pin Bowling</div>
        </div>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-[#d94327] border-2 border-[#15151f]"></div>
          <div className="w-3 h-3 bg-[#f4d03f] border-2 border-[#15151f]"></div>
          <div className="w-3 h-3 bg-[#3d8b40] border-2 border-[#15151f]"></div>
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Best Scores</h2>
          <div className="flex items-end gap-4 mb-4">
            <div className="font-mono text-5xl font-bold text-[#d94327]">{bestScore || "—"}</div>
            <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#666] font-mono pb-2">Top Score</div>
          </div>
          <ul className="space-y-2">
            {topGames.length === 0 ? (
              <li className={c.rowItem}>
                <span className="font-mono text-sm text-[#666]">No games yet — roll one!</span>
              </li>
            ) : topGames.map((g, i) => (
              <li key={g._id} className={c.rowItem}>
                <span className="font-mono text-sm"><span className="text-[#666] mr-2">#{i+1}</span>{new Date(g.createdAt).toLocaleDateString()}</span>
                <span className={c.badge}>{g.finalScore}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="lane" className={c.section}>
          <h2 className={c.h2}>Lane {gameOver ? "— Game Over" : `— Frame ${frameIdx+1}`}</h2>
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className={c.laneFrame}>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 grid grid-cols-4 gap-1 w-[70%]">
                {pins.map((p,i) => (
                  <div key={i} className={`aspect-square rounded-full border-2 border-[#15151f] ${p ? 'bg-white' : 'bg-transparent border-dashed opacity-30'}`} />
                ))}
              </div>
              <div className="absolute bottom-6 w-8 h-8 rounded-full bg-[#d94327] border-[3px] border-[#15151f] transition-all" style={{left: `calc(50% + ${aim*8}px - 16px)`}}></div>
              <div className="absolute bottom-16 w-0.5 h-10 bg-[#15151f]" style={{left: `calc(50% + ${aim*8}px)`}}></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-[0.6rem] uppercase tracking-[0.15em] font-mono text-[#666]">Power</div>
              <div className="w-8 h-48 border-[3px] border-[#15151f] rounded-[4px] bg-[#f5f1e8] relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 bg-[#3d8b40] transition-none" style={{height: `${power}%`}}></div>
              </div>
              <div className="font-mono text-xs">{power}%</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button className={c.btnSecondary} onClick={() => setAim(a => Math.max(-5, a-1))} disabled={gameOver || charging}>◀ Aim</button>
            {!charging ? (
              <button className={c.btnPrimary} onClick={startCharge} disabled={gameOver}>{gameOver ? "Done" : "Hold ▶"}</button>
            ) : (
              <button className={c.btnPrimary} onClick={release}>Release!</button>
            )}
            <button className={c.btnSecondary} onClick={() => setAim(a => Math.min(5, a+1))} disabled={gameOver || charging}>Aim ▶</button>
          </div>
          {gameOver && (
            <button className={c.btnSecondary + " mt-3 w-full"} onClick={newGame}>New Game</button>
          )}
        </section>

        <section id="scoresheet" className={c.section}>
          <h2 className={c.h2}>Scoresheet — {finalScore}</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <tbody>
                <tr>
                  {frames.map((f,i) => {
                    const r0 = f[0], r1 = f[1], r2 = f[2]
                    const sym = (v, prev) => v === undefined ? "" : v === 10 ? "X" : (prev !== undefined && prev + v === 10) ? "/" : v === 0 ? "-" : v
                    return (
                      <td key={i} className={`${c.scoreCell} ${i === frameIdx && !gameOver ? 'bg-[#f4d03f]' : ''}`}>
                        <div className="text-[0.55rem] text-[#666] mb-1">F{i+1}</div>
                        <div className="h-4 text-xs font-mono">{sym(r0)} {sym(r1, r0)} {i===9 && sym(r2, r1)}</div>
                        <div className="text-sm font-bold mt-1">{scores[i] ?? "—"}</div>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="history" className={c.section}>
          <h2 className={c.h2}>Recent Games</h2>
          <ul className="space-y-2">
            {games.length === 0 ? (
              <li className={c.rowItem}><span className="font-mono text-sm text-[#666]">Your finished games land here.</span></li>
            ) : games.slice(0, 10).map(g => (
              <li key={g._id} className={c.rowItem}>
                <div>
                  <div className="font-mono text-sm font-bold">{new Date(g.createdAt).toLocaleString()}</div>
                  <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#666] font-mono">10 Frames</div>
                </div>
                <span className={c.badge}>{g.finalScore}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}