import React, { useState, useCallback } from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const COLORS = [
  { color: "red", hex: "#ff2d55", points: 10 },
  { color: "blue", hex: "#00f0ff", points: 20 },
  { color: "green", hex: "#39ff14", points: 15 },
  { color: "yellow", hex: "#fcee0a", points: 25 },
  { color: "gold", hex: "#ffd700", points: 50 },
]
const TOTAL_DARTS = 10
const GRID = 20

function makeBalloons() {
  return Array.from({ length: GRID }, (_, i) => {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)]
    return { id: i, ...c, popped: false }
  })
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("balloon-pop-carnival")
  const [balloons, setBalloons] = useState([])
  const [score, setScore] = useState(0)
  const [darts, setDarts] = useState(TOTAL_DARTS)
  const [roundActive, setRoundActive] = useState(false)
  const [popping, setPopping] = useState(null)
  const [roundEnded, setRoundEnded] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const startRound = useCallback(() => {
    setBalloons(makeBalloons())
    setScore(0)
    setDarts(TOTAL_DARTS)
    setRoundActive(true)
    setRoundEnded(false)
    setPopping(null)
  }, [])

  const popBalloon = useCallback((b) => {
    if (!roundActive || b.popped || darts <= 0) return
    setPopping(b.id)
    setTimeout(() => setPopping(null), 300)
    setBalloons(prev => prev.map(bl => bl.id === b.id ? { ...bl, popped: true } : bl))
    const newScore = score + b.points
    const newDarts = darts - 1
    setScore(newScore)
    setDarts(newDarts)
    if (newDarts <= 0) {
      setRoundActive(false)
      setRoundEnded(true)
    }
  }, [roundActive, darts, score])

  const submitScore = useCallback(async () => {
    if (!playerName.trim() || submitting) return
    setSubmitting(true)
    await database.put({
      type: "score",
      name: playerName.trim(),
      score,
      created: Date.now(),
    })
    setSubmitting(false)
    setPlayerName("")
  }, [playerName, submitting, score, database])

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#1a0025] via-[#0a0020] to-[#15002a] font-sans text-white",
    header: "sticky top-0 z-10 bg-[#0a0020]/95 backdrop-blur px-4 py-3 border-b-2 border-[#ff2d55]/50 shadow-[0_0_30px_rgba(255,45,85,0.2)]",
    title: "text-2xl font-black tracking-wider text-center text-[#ff2d55] drop-shadow-[0_0_15px_rgba(255,45,85,0.6)]",
    tagline: "text-center text-[#00f0ff] text-sm mt-1 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-24",
    section: "bg-[#1a0030]/80 backdrop-blur rounded-xl p-4 border border-[#ff2d55]/30 shadow-[0_0_25px_rgba(255,45,85,0.15)]",
    h2: "text-xl font-black text-[#fcee0a] mb-3 tracking-wide drop-shadow-[0_0_10px_rgba(252,238,10,0.4)]",
    btn: "min-h-[44px] px-6 py-3 bg-[#ff2d55] text-white font-bold rounded-lg shadow-[0_0_15px_rgba(255,45,85,0.5)] hover:shadow-[0_0_25px_rgba(255,45,85,0.8)] disabled:opacity-40 transition-all w-full",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#0a0020] text-[#00f0ff] border-2 border-[#00f0ff]/40 rounded-lg focus:outline-none focus:border-[#ff2d55] focus:shadow-[0_0_10px_rgba(255,45,85,0.3)]",
    stat: "text-[#00f0ff] font-bold drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]",
    row: "flex items-center justify-between px-3 py-2 bg-[#0a0020]/60 rounded-lg border border-[#ff2d55]/20",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>★ BALLOON POP CARNIVAL ★</h1>
        <p className={c.tagline}>Step right up — ten darts, big prizes!</p>
      </header>
      <main id="app" className={c.main}>
        <section id="game-board" className={c.section}>
          <h2 className={c.h2}>The Wall</h2>
          <div className="flex justify-between mb-3">
            <span className={c.stat}>SCORE: {score}</span>
            <span className={c.stat}>DARTS: {darts}</span>
          </div>
          <div className="grid grid-cols-5 gap-3 mb-4 min-h-[120px]">
            {balloons.length === 0 ? (
              <div className="col-span-5 text-center text-[#00f0ff] py-8">Press START to inflate the wall!</div>
            ) : balloons.map((b) => (
              <button
                key={b.id}
                onClick={() => popBalloon(b)}
                disabled={!roundActive || b.popped}
                className={`aspect-square rounded-full border-2 transition-all duration-200 ${b.popped ? "opacity-10 scale-50 border-transparent" : "hover:scale-110 border-white/30 cursor-crosshair"} ${popping === b.id ? "animate-ping" : ""}`}
                style={{
                  background: b.popped ? "transparent" : b.hex,
                  boxShadow: b.popped ? "none" : `0 0 15px ${b.hex}, inset 0 -4px 8px rgba(0,0,0,0.3)`,
                }}
                aria-label={`${b.color} balloon worth ${b.points} points`}
              />
            ))}
          </div>
          <div className="flex gap-2 text-xs mb-3 justify-center flex-wrap">
            {COLORS.map(c => (
              <span key={c.color} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: c.hex, boxShadow: `0 0 6px ${c.hex}` }} />
                <span className="text-white/60">{c.points}pts</span>
              </span>
            ))}
          </div>
          {can("write") && (
            <button onClick={startRound} disabled={roundActive} className={c.btn}>
              {roundActive ? "THROWING..." : roundEnded ? "PLAY AGAIN" : "START ROUND"}
            </button>
          )}
          {!can("write") && <p className="text-[#00f0ff] text-sm text-center">Spectator view — watch the leaderboard below.</p>}
        </section>

        {roundEnded && (
          <section id="round-result" className={c.section}>
            <h2 className={c.h2}>Round Over!</h2>
            <div className="text-center py-3 bg-[#0a0020]/60 rounded-lg border border-[#fcee0a]/40 mb-3">
              <p className="text-3xl font-black text-[#fcee0a] drop-shadow-[0_0_15px_rgba(252,238,10,0.5)]">{score} points</p>
              <p className="text-white/60 mt-1">{score >= 300 ? "Legendary arm!" : score >= 200 ? "Sharp shooter!" : score >= 100 ? "Not bad, kid." : "Better luck next time."}</p>
            </div>
            {can("write") && (
              <form onSubmit={(e) => { e.preventDefault(); submitScore(); }} className="space-y-2">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your carnival name"
                  className={c.input}
                  maxLength={20}
                />
                <button type="submit" disabled={!playerName.trim() || submitting} className={c.btn}>
                  {submitting ? "POSTING..." : "POST TO LEADERBOARD"}
                </button>
              </form>
            )}
          </section>
        )}

        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>High Scores</h2>
          <Leaderboard useLiveQuery={useLiveQuery} c={c} />
        </section>
      </main>
    </div>
  )
}

function Leaderboard({ useLiveQuery, c }) {
  const { docs } = useLiveQuery("type", { key: "score" })
  const sorted = [...docs].sort((a, b) => b.score - a.score).slice(0, 10)
  if (sorted.length === 0) {
    return <p className="text-[#00f0ff] text-sm text-center">No scores yet — be the first slinger!</p>
  }
  return (
    <ol className="space-y-2">
      {sorted.map((d, i) => (
        <li key={d._id} className={c.row}>
          <span className="flex items-center gap-3">
            <span className="font-black text-[#fcee0a] w-6">#{i + 1}</span>
            <span className="font-semibold">{d.name}</span>
          </span>
          <span className={`${c.stat} text-lg`}>{d.score}</span>
        </li>
      ))}
    </ol>
  )
}
