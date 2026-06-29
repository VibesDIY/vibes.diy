import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("hoop-slinger")
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true, limit: 10 })
  const [running, setRunning] = useState(false)
  const [time, setTime] = useState(60)
  const [score, setScore] = useState(0)
  const [makes, setMakes] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [wind, setWind] = useState(0)
  const [windLog, setWindLog] = useState([])
  const [ball, setBall] = useState({ x: 80, y: 320, vx: 0, vy: 0, flying: false })
  const [drag, setDrag] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [taunt, setTaunt] = useState("Flick the ball toward the hoop.")
  const [isLoadingTaunt, setIsLoadingTaunt] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [playerName, setPlayerName] = useState("Slinger")
  const courtRef = useRef(null)
  const rafRef = useRef(null)
  const stateRef = useRef({})
  stateRef.current = { ball, running, wind, makes, attempts, score }

  useEffect(() => {
    const pre1 = document.createElement('link'); pre1.rel='preconnect'; pre1.href='https://fonts.googleapis.com'; document.head.appendChild(pre1)
    const pre2 = document.createElement('link'); pre2.rel='preconnect'; pre2.href='https://fonts.gstatic.com'; pre2.crossOrigin=''; document.head.appendChild(pre2)
    const link = document.createElement('link'); link.rel='stylesheet'
    link.href='https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=block'
    document.head.appendChild(link)
    const style = document.createElement('style')
    style.textContent = `body{font-family:'Space Grotesk',sans-serif;background:oklch(0.96 0.01 90);background-image:linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px,transparent 1px),linear-gradient(90deg,oklch(0.15 0.02 280 / 0.04) 1px,transparent 1px);background-size:60px 60px;color:oklch(0.15 0.02 280)}.mono{font-family:'JetBrains Mono',monospace}`
    document.head.appendChild(style)
  }, [])
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setTime(s => s - 1), 1000)
    const w = setInterval(() => { const g = Math.round((Math.random() - 0.5) * 30); setWind(g); setWindLog(l => [...l, g]) }, 2500)
    return () => { clearInterval(t); clearInterval(w) }
  }, [running])

  useEffect(() => {
    if (running && time <= 0) { setRunning(false); generateTaunt(score, makes, attempts) }
  }, [time, running])

  useEffect(() => {
    if (!ball.flying) return
    let last = performance.now()
    function tick(now) {
      const dt = Math.min(32, now - last) / 16; last = now
      setBall(b => {
        if (!b.flying) return b
        const nx = b.x + b.vx * dt + (stateRef.current.wind / 200) * dt
        const ny = b.y + b.vy * dt
        const nvy = b.vy + 0.35 * dt
        // rim check: hoop opening between x 230-270 at y ~140-150
        if (nx > 230 && nx < 270 && ny > 138 && ny < 152 && b.vy > 0) {
          setMakes(m => m + 1); setScore(s => s + 2)
          return { x: 80, y: 320, vx: 0, vy: 0, flying: false }
        }
        // backboard bounce
        if (nx > 270 && b.vx > 0) return { ...b, x: 270, vx: -b.vx * 0.5 }
        // off screen
        if (ny > 400 || nx < 0 || nx > 300) return { x: 80, y: 320, vx: 0, vy: 0, flying: false }
        return { x: nx, y: ny, vx: b.vx, vy: nvy, flying: true }
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ball.flying])

  function handleStart(e) {
    e.preventDefault()
    setRunning(true); setTime(60); setScore(0); setMakes(0); setAttempts(0); setWindLog([])
    setBall({ x: 80, y: 320, vx: 0, vy: 0, flying: false })
    setTaunt("Game on. Flick it.")
  }
  function handleReset() {
    setRunning(false); setTime(60); setScore(0); setMakes(0); setAttempts(0); setWindLog([])
    setBall({ x: 80, y: 320, vx: 0, vy: 0, flying: false }); setDrag(null)
  }
  function svgPoint(e) {
    const r = courtRef.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 400 }
  }
  function handlePointerDown(e) {
    if (!running || ball.flying) return
    const p = svgPoint(e)
    if (Math.hypot(p.x - ball.x, p.y - ball.y) < 40) setDrag({ sx: p.x, sy: p.y, x: p.x, y: p.y })
  }
  function handlePointerMove(e) {
    if (!drag) return
    const p = svgPoint(e); setDrag({ ...drag, x: p.x, y: p.y })
  }
  function handlePointerUp() {
    if (!drag) return
    const dx = drag.sx - drag.x, dy = drag.sy - drag.y
    const power = 0.18
    setBall({ x: 80, y: 320, vx: dx * power, vy: dy * power, flying: true })
    setAttempts(a => a + 1); setDrag(null)
  }
  async function handleSelectSession(id) {
    setSelectedId(id)
    const d = sessions.find(s => s._id === id)
    if (d) setTaunt(d.taunt || "—")
  }
  async function suggestName() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Generate one short punchy basketball player nickname, 1-2 words, uppercase friendly.", { schema: { properties: { name: { type: "string" } } } })
      const { name } = JSON.parse(r); setPlayerName(name)
    } finally { setIsSuggesting(false) }
  }
  async function generateTaunt(finalScore, finalMakes, finalAttempts) {
    setIsLoadingTaunt(true)
    try {
      const r = await callAI(`Write a short coach-style trash talk taunt (under 20 words) for a player who scored ${finalScore} on ${finalMakes}/${finalAttempts} shots in 60 seconds.`, { schema: { properties: { taunt: { type: "string" } } } })
      const { taunt: t } = JSON.parse(r)
      setTaunt(t)
      await database.put({ type: "session", name: playerName, score: finalScore, makes: finalMakes, attempts: finalAttempts, avgWind: windLog.length ? Math.round(windLog.reduce((a,b)=>a+b,0)/windLog.length) : 0, taunt: t, createdAt: Date.now() })
    } finally { setIsLoadingTaunt(false) }
  }

  const c = {
    page: "min-h-screen w-full text-[oklch(0.15_0.02_280)]",
    header: "w-full px-4 py-3 flex items-center justify-between border-b-[3px] border-[oklch(0.15_0.02_280)] bg-white",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)]",
    brandText: "text-sm font-bold tracking-wider uppercase",
    navRow: "flex gap-2",
    navChip: "px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-white text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0_oklch(0.15_0.02_280)]",
    main: "max-w-[920px] mx-auto px-4 py-4 flex flex-col gap-4",
    hud: "grid grid-cols-3 gap-2",
    hudCard: "border-[3px] border-[oklch(0.15_0.02_280)] bg-white p-3 flex flex-col items-center justify-center shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
    hudLabel: "text-[0.6rem] uppercase tracking-widest font-semibold text-[oklch(0.5_0.02_280)]",
    hudValue: "text-2xl font-bold mono",
    courtWrap: "border-[3px] border-[oklch(0.15_0.02_280)] bg-white relative overflow-hidden shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
    court: "w-full aspect-[3/4] relative touch-none select-none",
    windBar: "px-3 py-2 border-t-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] text-white flex items-center justify-between text-xs uppercase tracking-wider font-bold",
    actionsRow: "flex gap-3 items-stretch",
    btnPrimary: "flex-1 px-4 py-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white font-bold uppercase tracking-wider text-sm min-h-[48px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSecondary: "px-4 py-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-sm min-h-[48px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    section: "border-[3px] border-[oklch(0.15_0.02_280)] bg-white p-4 flex flex-col gap-3 shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest font-semibold text-[oklch(0.5_0.02_280)]",
    sectionTitle: "text-xl font-bold uppercase tracking-[-0.02em]",
    leaderList: "flex flex-col",
    leaderRow: "flex items-center justify-between px-3 py-3 border-b-[3px] border-[oklch(0.15_0.02_280)] last:border-b-0 cursor-pointer min-h-[48px] hover:bg-[oklch(0.85_0.18_85)] transition-colors",
    leaderRank: "text-sm font-bold w-6 mono",
    leaderName: "flex-1 text-sm font-semibold uppercase tracking-wider px-2",
    leaderScore: "text-base font-bold mono",
    detailCard: "border-[3px] border-[oklch(0.15_0.02_280)] bg-white p-4 flex flex-col gap-3 shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
    detailRow: "flex justify-between text-sm border-b border-[oklch(0.15_0.02_280)] pb-1 mono",
    taunt: "p-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] text-sm italic font-semibold",
    empty: "text-xs uppercase tracking-widest font-semibold py-6 text-center text-[oklch(0.5_0.02_280)]",
    suggestBtn: "text-[0.65rem] uppercase tracking-widest font-bold px-2 py-1 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] shadow-[3px_3px_0_oklch(0.15_0.02_280)]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={c.dot} style={{background:'oklch(0.55 0.24 28)'}}></span>
            <span className={c.dot} style={{background:'oklch(0.85 0.18 85)'}}></span>
            <span className={c.dot} style={{background:'oklch(0.62 0.19 145)'}}></span>
          </div>
          <span className={c.brandText}>Hoop Slinger</span>
        </div>
        <nav className={c.navRow}>
          <button className={c.navChip}>Court</button>
          <button className={c.navChip}>Ranks</button>
        </nav>
      </header>

      <main id="app" className={c.main}>
        <section id="hud" className={c.hud}>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Time</span>
            <span className={c.hudValue}>{time}</span>
          </div>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Score</span>
            <span className={c.hudValue}>{score}</span>
          </div>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Makes</span>
            <span className={c.hudValue}>{makes}/{attempts}</span>
          </div>
        </section>

        <section id="court" className={c.courtWrap}>
          <div
            className={c.court}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <svg ref={courtRef} viewBox="0 0 300 400" className="w-full h-full block">
              <rect x="0" y="0" width="300" height="400" fill="oklch(0.96 0.01 90)" />
              <rect x="270" y="80" width="6" height="80" fill="oklch(0.15 0.02 280)" />
              <line x1="230" y1="140" x2="270" y2="140" strokeWidth="5" stroke="oklch(0.55 0.24 28)" />
              <line x1="230" y1="140" x2="230" y2="155" strokeWidth="3" stroke="oklch(0.55 0.24 28)" />
              <line x1="230" y1="155" x2="270" y2="155" strokeWidth="2" stroke="oklch(0.15 0.02 280)" strokeDasharray="3 3" />
              <circle cx={ball.x} cy={ball.y} r="14" fill="oklch(0.55 0.24 28)" stroke="oklch(0.15 0.02 280)" strokeWidth="3" />
              {drag && <line x1={drag.sx} y1={drag.sy} x2={drag.x} y2={drag.y} stroke="oklch(0.15 0.02 280)" strokeWidth="3" strokeDasharray="4 4" />}
            </svg>
          </div>
          <div className={c.windBar}>
            <span>Wind</span>
            <span className="mono">{wind > 0 ? `${wind} →` : wind < 0 ? `← ${Math.abs(wind)}` : "calm"}</span>
          </div>
        </section>

        <section id="actions" className={c.actionsRow}>
          <form onSubmit={handleStart} className="contents">
            <button type="submit" className={c.btnPrimary}>Start Run</button>
          </form>
          <button type="button" onClick={handleReset} className={c.btnSecondary}>Reset</button>
        </section>

        <section id="leaderboard" className={c.section}>
          <div className="flex items-center justify-between">
            <span className={c.sectionLabel}>Live Sessions</span>
            <button onClick={suggestName} disabled={isSuggesting} className={c.suggestBtn}>
              {isSuggesting ? <svg className="animate-spin inline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round"/></svg> : `Name: ${playerName}`}
            </button>
          </div>
          <h2 className={c.sectionTitle}>Top Runs</h2>
          {sessions.length === 0 ? (
            <p className={c.empty}>No runs yet — flick to start</p>
          ) : (
            <ul className={c.leaderList}>
              {[...sessions].sort((a,b) => b.score - a.score).map((s, i) => (
                <li key={s._id} className={c.leaderRow} onClick={() => handleSelectSession(s._id)}>
                  <span className={c.leaderRank}>{i+1}</span>
                  <span className={c.leaderName}>{s.name}</span>
                  <span className={c.leaderScore}>{s.score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="detail" className={c.detailCard}>
          <span className={c.sectionLabel}>Last Session</span>
          <h2 className={c.sectionTitle}>Session Detail</h2>
          {(() => {
            const sel = sessions.find(s => s._id === selectedId) || { score, makes, attempts, avgWind: windLog.length ? Math.round(windLog.reduce((a,b)=>a+b,0)/windLog.length) : 0 }
            return (<>
              <div className={c.detailRow}><span>Score</span><span>{sel.score}</span></div>
              <div className={c.detailRow}><span>Makes</span><span>{sel.makes}</span></div>
              <div className={c.detailRow}><span>Attempts</span><span>{sel.attempts}</span></div>
              <div className={c.detailRow}><span>Avg Wind</span><span>{sel.avgWind}</span></div>
            </>)
          })()}
          <div className={c.taunt}>
            {isLoadingTaunt ? <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round"/></svg> : taunt}
          </div>
        </section>
      </main>
    </div>
  )
}