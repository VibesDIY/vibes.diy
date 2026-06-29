import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("spot-kick-db")
  const { docs: matches } = useLiveQuery("type", { key: "match", descending: true })
  const wins = matches.filter(m => m.youScore > m.keeperScore).length

  const [phase, setPhase] = useState("shooting") // shooting | keeping | done
  const [round, setRound] = useState(1)
  const [youScore, setYouScore] = useState(0)
  const [keeperScore, setKeeperScore] = useState(0)
  const [aim, setAim] = useState({ x: 50, y: 30 })
  const [power, setPower] = useState(0)
  const [charging, setCharging] = useState(false)
  const [keeperPos, setKeeperPos] = useState({ x: 45, y: 20 })
  const [ballPos, setBallPos] = useState(null)
  const [reaction, setReaction] = useState("Bring it on.")
  const [isLoading, setIsLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const chargeRef = useRef(null)

  useEffect(() => {
    if (charging) {
      chargeRef.current = setInterval(() => {
        setPower(p => (p >= 100 ? 0 : p + 4))
      }, 30)
      return () => clearInterval(chargeRef.current)
    }
  }, [charging])

  async function fetchReaction(context) {
    setIsLoading(true)
    try {
      const r = await callAI(`Goalkeeper trash talk, one short sentence, max 10 words. Context: ${context}`, {
        schema: { properties: { line: { type: "string" } } }
      })
      setReaction(JSON.parse(r).line)
    } catch { setReaction("...") } finally { setIsLoading(false) }
  }

  function handleShoot(e) {
    e?.preventDefault()
    if (animating || phase !== "shooting") return
    setAnimating(true)
    const kx = 15 + Math.random() * 70
    const ky = 15 + Math.random() * 35
    setKeeperPos({ x: kx, y: ky })
    setBallPos({ x: aim.x, y: aim.y })
    const dist = Math.hypot(kx - aim.x, ky - aim.y)
    const accuracy = power > 30 && power < 90 ? 1 : 0.6
    const goal = dist > 12 && Math.random() < accuracy
    setTimeout(() => {
      const newYou = goal ? youScore + 1 : youScore
      setYouScore(newYou)
      fetchReaction(goal ? "player scored" : "keeper saved it")
      if (round >= 5) { setPhase("keeping"); setRound(1) } else { setRound(r => r + 1) }
      setPower(0); setBallPos(null); setAnimating(false)
    }, 600)
  }

  function handleSave(e) {
    e?.preventDefault()
    if (animating || phase !== "keeping") return
    setAnimating(true)
    const sx = 15 + Math.random() * 70
    const sy = 15 + Math.random() * 35
    setBallPos({ x: sx, y: sy })
    const dist = Math.hypot(aim.x - sx, aim.y - sy)
    const saved = dist < 18
    setTimeout(async () => {
      const newKeeper = saved ? keeperScore : keeperScore + 1
      setKeeperScore(newKeeper)
      fetchReaction(saved ? "you saved it" : "they scored on you")
      if (round >= 5) {
        await database.put({ type: "match", youScore, keeperScore: newKeeper, createdAt: Date.now() })
        setPhase("done")
      } else { setRound(r => r + 1) }
      setBallPos(null); setAnimating(false)
    }, 600)
  }

  function reset() {
    setPhase("shooting"); setRound(1); setYouScore(0); setKeeperScore(0)
    setPower(0); setBallPos(null); setReaction("Fresh match. Let's go.")
  }

  const c = {
    page: "min-h-screen p-4 max-w-[920px] mx-auto bg-[#f5f3ec] text-[#15151f]",
    header: "flex items-center justify-between p-4 mb-4 border-[3px] border-[#15151f] bg-white shadow-[4px_4px_0px_#15151f] rounded-[4px]",
    brand: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px] border-[#15151f]",
    title: "text-lg font-bold tracking-tight uppercase",
    streak: "px-3 py-2 border-[3px] border-[#15151f] bg-[#f3d34a] font-mono text-sm font-bold rounded-[4px] shadow-[3px_3px_0px_#15151f]",
    hero: "relative p-6 mb-4 border-[3px] border-[#15151f] bg-white rounded-[4px] shadow-[4px_4px_0px_#15151f] overflow-hidden",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1",
    heroTitle: "text-3xl md:text-5xl font-bold tracking-tight uppercase mt-2",
    heroSub: "text-xs uppercase tracking-widest mt-2 text-[#6b6b7a]",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-4",
    stat: "border-[3px] border-[#15151f] bg-white rounded-[4px] shadow-[3px_3px_0px_#15151f] overflow-hidden",
    statHead: "px-3 py-2 text-[0.65rem] uppercase tracking-widest font-bold",
    statBody: "p-3",
    statNum: "font-mono text-2xl font-bold",
    statUnit: "text-[0.6rem] uppercase tracking-widest mt-1 text-[#6b6b7a]",
    pitch: "relative border-[3px] border-[#15151f] bg-[#3aa84a] rounded-[4px] shadow-[4px_4px_0px_#15151f] aspect-[4/3] mb-4 overflow-hidden cursor-crosshair",
    goal: "absolute top-4 left-[10%] right-[10%] h-[40%] border-[3px] border-[#15151f] bg-white/30",
    crosshair: "absolute w-6 h-6 border-[3px] border-[#d63f2c] bg-[#d63f2c]/30 pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full",
    keeper: "absolute w-10 h-14 border-[3px] border-[#15151f] bg-[#2f5fd9] pointer-events-none transition-all rounded-[4px]",
    ball: "absolute bottom-4 left-1/2 w-6 h-6 border-[3px] border-[#15151f] bg-white rounded-full -translate-x-1/2 transition-all",
    controls: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4",
    card: "p-4 border-[3px] border-[#15151f] bg-white rounded-[4px] shadow-[4px_4px_0px_#15151f]",
    cardLabel: "text-[0.65rem] uppercase tracking-widest font-bold mb-3",
    powerWrap: "h-8 border-[3px] border-[#15151f] mb-3 overflow-hidden bg-[#f5f3ec] rounded-[4px]",
    powerFill: "h-full transition-all bg-[repeating-linear-gradient(-45deg,#3aa84a_0_10px,#2d8a3b_10px_20px)]",
    btnRow: "flex gap-3 flex-wrap",
    btnPrimary: "px-4 py-3 border-[3px] border-[#15151f] bg-[#d63f2c] text-white font-bold uppercase tracking-wider text-sm min-h-[44px] rounded-[4px] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSecondary: "px-4 py-3 border-[3px] border-[#15151f] bg-[#f3d34a] text-[#15151f] font-bold uppercase tracking-wider text-sm min-h-[44px] rounded-[4px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnGhost: "px-4 py-3 border-[3px] border-[#15151f] bg-white text-[#15151f] font-bold uppercase tracking-wider text-sm min-h-[44px] rounded-[4px] hover:shadow-[3px_3px_0px_#15151f] transition-all",
    aimGrid: "grid grid-cols-3 gap-2",
    aimBtn: "py-3 border-[3px] border-[#15151f] bg-white font-mono text-base font-bold min-h-[44px] rounded-[4px] hover:bg-[#f3d34a] transition-colors",
    history: "p-4 border-[3px] border-[#15151f] bg-white rounded-[4px] shadow-[4px_4px_0px_#15151f]",
    historyTitle: "text-[0.65rem] uppercase tracking-widest font-bold mb-3",
    historyList: "space-y-2",
    historyRow: "flex items-center justify-between p-3 border-[3px] border-[#15151f] bg-white rounded-[4px] cursor-pointer hover:bg-[#f3d34a] transition-colors",
    badge: "px-2 py-1 text-[0.6rem] uppercase tracking-widest font-bold border-[3px] border-[#15151f] bg-[#3aa84a] rounded-[4px] font-mono",
    reaction: "p-3 border-[3px] border-[#15151f] bg-[#2f5fd9] text-white mt-3 italic text-sm rounded-[4px]",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest font-bold mb-2",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.logoDots}>
            <div className={c.dot + " bg-[#d63f2c]"}></div>
            <div className={c.dot + " bg-[#f3d34a]"}></div>
            <div className={c.dot + " bg-[#3aa84a]"}></div>
          </div>
          <h1 className={c.title}>Spot Kick</h1>
        </div>
        <div className={c.streak}>WINS {wins}</div>
      </header>

      <main id="app">
        <section id="hero" className={c.hero}>
          <div className={c.heroBar}>
            <div className="flex-1 bg-[#d63f2c]"></div>
            <div className="flex-1 bg-[#f3d34a]"></div>
            <div className="flex-1 bg-[#3aa84a]"></div>
            <div className="flex-1 bg-[#2f5fd9]"></div>
          </div>
          <div className={c.heroSub}>Round {round} of 5 · {phase === "shooting" ? "Shooting" : phase === "keeping" ? "Keeping" : "Match Over"}</div>
          <h2 className={c.heroTitle}>{phase === "shooting" ? "Take The Shot" : phase === "keeping" ? "Stop The Ball" : youScore > keeperScore ? "You Win" : youScore < keeperScore ? "You Lose" : "Draw"}</h2>
        </section>

        <section id="stats" className={c.statRow}>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#d63f2c] text-white border-b-[3px] border-[#15151f]"}>You</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{youScore}</div>
              <div className={c.statUnit}>Goals</div>
            </div>
          </div>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#f3d34a] text-[#15151f] border-b-[3px] border-[#15151f]"}>Keeper</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{keeperScore}</div>
              <div className={c.statUnit}>Saves</div>
            </div>
          </div>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#2f5fd9] text-white border-b-[3px] border-[#15151f]"}>Round</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{round}/5</div>
              <div className={c.statUnit}>Kicks</div>
            </div>
          </div>
          <div className={c.stat}>
            <div className={c.statHead + " bg-[#3aa84a] text-[#15151f] border-b-[3px] border-[#15151f]"}>Wins</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{wins}</div>
              <div className={c.statUnit}>Total</div>
            </div>
          </div>
        </section>

        <section
          id="pitch"
          className={c.pitch}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width) * 100
            const y = ((e.clientY - r.top) / r.height) * 100
            setAim({ x: Math.max(10, Math.min(90, x)), y: Math.max(10, Math.min(50, y)) })
          }}
        >
          <div className={c.goal}></div>
          <div className={c.crosshair} style={{ left: `${aim.x}%`, top: `${aim.y}%` }}></div>
          <div className={c.keeper} style={{ left: `${keeperPos.x}%`, top: `${keeperPos.y}%` }}></div>
          {ballPos && <div className="absolute w-6 h-6 border-[3px] border-[#15151f] bg-white rounded-full transition-all duration-500" style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: "translate(-50%, -50%)" }}></div>}
          {!ballPos && <div className={c.ball}></div>}
        </section>

        <section id="controls" className={c.controls}>
          <form className={c.card} onSubmit={handleShoot}>
            <div className={c.cardLabel}>Power</div>
            <div className={c.powerWrap}>
              <div className={c.powerFill} style={{ width: `${power}%` }}></div>
            </div>
            <div className={c.cardLabel}>Aim</div>
            <div className={c.aimGrid}>
              {[["↖",-15,-10],["↑",0,-10],["↗",15,-10],["←",-15,0],["•",0,0],["→",15,0],["↙",-15,10],["↓",0,10],["↘",15,10]].map(([s,dx,dy]) => (
                <button key={s} type="button" className={c.aimBtn} onClick={() => {
                  if (s === "•") setAim({ x: 50, y: 30 })
                  else setAim(a => ({ x: Math.max(15, Math.min(85, a.x + dx)), y: Math.max(15, Math.min(45, a.y + dy)) }))
                }}>{s}</button>
              ))}
            </div>
          </form>

          <div className={c.card}>
            <div className={c.cardLabel}>Match</div>
            <div className={c.btnRow}>
              {phase === "shooting" && (
                <button
                  type="button"
                  className={c.btnPrimary}
                  disabled={animating}
                  onPointerDown={() => setCharging(true)}
                  onPointerUp={() => { setCharging(false); handleShoot() }}
                  onPointerLeave={() => { if (charging) { setCharging(false); handleShoot() } }}
                >{charging ? `Charging ${power}%` : "Hold to Shoot"}</button>
              )}
              {phase === "keeping" && (
                <button type="button" className={c.btnPrimary} disabled={animating} onClick={handleSave}>Dive Here</button>
              )}
              {phase === "done" && (
                <button type="button" className={c.btnPrimary} onClick={reset}>New Match</button>
              )}
              <button type="button" className={c.btnGhost} onClick={reset}>Reset</button>
            </div>
            <div className={c.reaction}>{isLoading ? <span className="inline-block w-4 h-4 border-[3px] border-white border-t-transparent rounded-full animate-spin align-middle"></span> : `"${reaction}"`}</div>
          </div>
        </section>

        <section id="history" className={c.history}>
          <div className={c.historyTitle}>Past Matches</div>
          <ul className={c.historyList}>
            {matches.length === 0 && <li className="text-sm text-[#6b6b7a] italic">No matches yet — finish a round of 5 to record one.</li>}
            {matches.slice(0, 10).map((m) => {
              const won = m.youScore > m.keeperScore
              const tied = m.youScore === m.keeperScore
              const badgeColor = won ? "bg-[#3aa84a]" : tied ? "bg-[#f3d34a]" : "bg-[#d63f2c] text-white"
              return (
                <li key={m._id} className={c.historyRow}>
                  <span className="font-mono text-sm">{new Date(m.createdAt).toLocaleString()}</span>
                  <span className={`px-2 py-1 text-[0.6rem] uppercase tracking-widest font-bold border-[3px] border-[#15151f] rounded-[4px] font-mono ${badgeColor}`}>
                    {won ? "Win" : tied ? "Draw" : "Loss"} {m.youScore}-{m.keeperScore}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </div>
  )
}