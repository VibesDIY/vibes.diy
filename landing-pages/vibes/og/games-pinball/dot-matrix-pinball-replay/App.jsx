import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("path-pinball")
  const { docs: rounds } = useLiveQuery("createdAt", { descending: true, limit: 20 })
  const [score, setScore] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [ghostId, setGhostId] = React.useState(null)
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [suggestion, setSuggestion] = React.useState("")
  const ballRef = React.useRef({ x: 50, y: 20, vx: 0, vy: 0 })
  const pathRef = React.useRef([])
  const flipRef = React.useRef({ L: false, R: false })
  const [trail, setTrail] = React.useState([])
  const startRef = React.useRef(0)

  const bumpers = [{x:20,y:22,r:8,pts:100},{x:62,y:18,r:8,pts:100},{x:42,y:40,r:8,pts:100}]

  React.useEffect(() => {
    if (!playing) return
    let raf
    const tick = () => {
      const b = ballRef.current
      b.vy += 0.08
      if (flipRef.current.L && b.y > 110 && b.x < 50) b.vy -= 1.2
      if (flipRef.current.R && b.y > 110 && b.x >= 50) b.vy -= 1.2
      b.x += b.vx; b.y += b.vy
      if (b.x < 2) { b.x = 2; b.vx = -b.vx * 0.8 }
      if (b.x > 98) { b.x = 98; b.vx = -b.vx * 0.8 }
      if (b.y < 2) { b.y = 2; b.vy = -b.vy * 0.8 }
      for (const bp of bumpers) {
        const dx = b.x - bp.x, dy = b.y - bp.y, d = Math.hypot(dx, dy)
        if (d < bp.r) {
          const n = { x: dx/d, y: dy/d }
          b.x = bp.x + n.x * bp.r; b.y = bp.y + n.y * bp.r
          b.vx = n.x * 2.5; b.vy = n.y * 2.5
          setScore(s => s + bp.pts)
        }
      }
      pathRef.current.push([Math.round(b.x*10)/10, Math.round(b.y*10)/10])
      setTrail([...pathRef.current])
      if (b.y > 130) {
        setPlaying(false)
        const finalScore = scoreRef.current
        database.put({ type: "round", score: finalScore, path: pathRef.current, duration: Date.now() - startRef.current, createdAt: Date.now() })
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const scoreRef = React.useRef(0)
  React.useEffect(() => { scoreRef.current = score }, [score])

  const ghostDoc = ghostId ? rounds.find(r => r._id === ghostId) : rounds.slice().sort((a,b)=>b.score-a.score)[0]

  function handleLaunch(e) {
    e.preventDefault()
    if (playing) return
    ballRef.current = { x: 90, y: 110, vx: -1.2, vy: -2.8 }
    pathRef.current = []
    setTrail([])
    setScore(0)
    startRef.current = Date.now()
    setPlaying(true)
  }
  function handleFlipLeft() { flipRef.current.L = true; setTimeout(()=>flipRef.current.L=false, 150) }
  function handleFlipRight() { flipRef.current.R = true; setTimeout(()=>flipRef.current.R=false, 150) }
  function handleSelectRound(id) { setGhostId(id) }
  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Give one short arcade-style pinball goal, max 8 words, uppercase.", { schema: { properties: { goal: { type: "string" } } } })
      setSuggestion(JSON.parse(r).goal)
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen w-full bg-[#f5f1e8] text-[#0f172a]",
    header: "sticky top-0 z-20 px-4 py-3 border-b-[3px] border-[#0f172a] bg-white flex items-center justify-between",
    brandRow: "flex items-center gap-2",
    brandSquares: "flex gap-1",
    brandSquare: "w-3 h-3 border-[3px]",
    brandText: "text-sm font-bold uppercase tracking-wider",
    headerStat: "text-xs uppercase tracking-widest font-mono text-[#6b6960]",
    main: "px-4 py-4 pb-32 max-w-[920px] mx-auto grid gap-4",
    stage: "relative border-[3px] border-[#0f172a] rounded aspect-[3/4] overflow-hidden bg-[#1a3a8f] shadow-[6px_6px_0px_#0f172a]",
    overlay: "absolute inset-0 pointer-events-none",
    overlayLabel: "absolute top-2 left-2 text-[0.6rem] uppercase tracking-widest font-mono px-2 py-1 border-[3px] border-[#0f172a] bg-[#e8c547] text-[#0f172a] shadow-[3px_3px_0px_#0f172a]",
    scoreBox: "absolute top-2 right-2 text-right px-3 py-1 border-[3px] border-[#0f172a] bg-white shadow-[3px_3px_0px_#0f172a]",
    scoreLabel: "text-[0.55rem] uppercase tracking-widest text-[#6b6960]",
    scoreValue: "text-xl font-mono font-bold text-[#dc3a2a]",
    bumper: "absolute rounded-full border-[3px]",
    flipperZoneRow: "absolute inset-x-0 bottom-0 grid grid-cols-2 h-24",
    flipperZone: "flex items-center justify-center text-[0.65rem] uppercase tracking-widest font-bold select-none active:translate-y-[2px]",
    actionBar: "fixed inset-x-0 bottom-0 px-4 py-3 border-t-[3px] border-[#0f172a] bg-white flex gap-3 items-center justify-between z-30",
    btnPrimary: "flex-1 px-4 py-3 border-[3px] border-[#0f172a] rounded font-bold uppercase tracking-wider text-sm min-h-[48px] bg-[#dc3a2a] text-white shadow-[4px_4px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    btnGhost: "px-4 py-3 border-[3px] border-[#0f172a] rounded font-bold uppercase tracking-wider text-xs min-h-[48px] bg-white text-[#0f172a] shadow-[3px_3px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    listSection: "border-[3px] border-[#0f172a] rounded p-4 bg-white shadow-[4px_4px_0px_#0f172a]",
    listHeader: "flex items-center justify-between mb-3",
    listTitle: "text-xs uppercase tracking-widest font-bold text-[#0f172a]",
    suggestBtn: "text-[0.6rem] uppercase tracking-widest px-2 py-1 border-[3px] border-[#0f172a] rounded font-bold bg-[#e8c547] text-[#0f172a] shadow-[3px_3px_0px_#0f172a] disabled:opacity-50",
    list: "divide-y-[2px] divide-[#0f172a]",
    listRow: "w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center py-2 px-2 text-left hover:bg-[#e8c547] transition-colors rounded",
    rank: "font-mono text-xs w-6 text-[#6b6960]",
    rowMain: "flex flex-col",
    rowScore: "font-mono font-bold text-base",
    rowMeta: "text-[0.65rem] uppercase tracking-widest text-[#6b6960]",
    badge: "text-[0.55rem] uppercase tracking-widest px-2 py-1 border-[2px] border-[#0f172a] font-bold bg-[#1a3a8f] text-white",
    empty: "text-xs uppercase tracking-widest text-center py-6 text-[#6b6960]",
  }

  return (
    <div className={c.page} id="app">
      <header className={c.header} id="app-header">
        <div className={c.brandRow}>
          <div className={c.brandSquares}>
            <div className={c.brandSquare + " bg-[#dc3a2a] border-[#0f172a]"}></div>
            <div className={c.brandSquare + " bg-[#e8c547] border-[#0f172a]"}></div>
            <div className={c.brandSquare + " bg-[#3aa856] border-[#0f172a]"}></div>
          </div>
          <span className={c.brandText}>Path Pinball</span>
        </div>
        <span className={c.headerStat}>Rounds {rounds.length}</span>
      </header>

      <main className={c.main}>
        <section id="playfield">
          <div className={c.stage}>
            <span className={c.overlayLabel}>Ghost Run</span>
            <div className={c.scoreBox}>
              <div className={c.scoreLabel}>Score</div>
              <div className={c.scoreValue}>{score}</div>
            </div>
            <div className={c.bumper + " bg-[#dc3a2a] border-[#0f172a] shadow-[3px_3px_0px_#0f172a]"} style={{ width: 48, height: 48, top: "22%", left: "20%" }}></div>
            <div className={c.bumper + " bg-[#e8c547] border-[#0f172a] shadow-[3px_3px_0px_#0f172a]"} style={{ width: 48, height: 48, top: "18%", left: "62%" }}></div>
            <div className={c.bumper + " bg-[#3aa856] border-[#0f172a] shadow-[3px_3px_0px_#0f172a]"} style={{ width: 48, height: 48, top: "40%", left: "42%" }}></div>
            <svg className={c.overlay} viewBox="0 0 100 133" preserveAspectRatio="none">
              {ghostDoc?.path?.filter((_,i)=>i%2===0).map(([x,y],i)=>(
                <circle key={"g"+i} cx={x} cy={y} r="0.8" fill="#e8c547" opacity="0.5" />
              ))}
              {trail.map(([x,y],i)=>(
                <circle key={"t"+i} cx={x} cy={y} r="0.6" fill="#fff" opacity={0.3 + i/trail.length*0.7} />
              ))}
              {playing && <circle cx={ballRef.current.x} cy={ballRef.current.y} r="2" fill="#fff" stroke="#0f172a" strokeWidth="0.5" />}
            </svg>
            <div className={c.flipperZoneRow}>
              <button className={c.flipperZone + " bg-[#dc3a2a] text-white border-r-[3px] border-[#0f172a] border-t-[3px]"} onClick={handleFlipLeft}>Left Flip</button>
              <button className={c.flipperZone + " bg-[#3aa856] text-[#0f172a] border-t-[3px] border-[#0f172a]"} onClick={handleFlipRight}>Right Flip</button>
            </div>
          </div>
        </section>

        <section id="rounds" className={c.listSection}>
          <div className={c.listHeader}>
            <h2 className={c.listTitle}>Round Library</h2>
            <button className={c.suggestBtn} onClick={handleSuggest} disabled={isSuggesting}>
              {isSuggesting ? (
                <svg className="animate-spin inline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 60" strokeLinecap="round"/></svg>
              ) : "Suggest Goal"}
            </button>
          </div>
          {rounds.length === 0 ? (
            <p className={c.empty}>Launch the ball to record your first run.</p>
          ) : (
            <ul className={c.list}>
              {rounds.map((r, i) => (
                <li key={r._id}>
                  <button className={c.listRow} onClick={() => handleSelectRound(r._id)}>
                    <span className={c.rank}>{String(i+1).padStart(2,"0")}</span>
                    <span className={c.rowMain}>
                      <span className={c.rowScore}>{r.score} PTS</span>
                      <span className={c.rowMeta}>{new Date(r.createdAt).toLocaleString()} · {(r.duration/1000).toFixed(1)}s</span>
                    </span>
                    {(ghostDoc?._id === r._id) && <span className={c.badge}>Ghost</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suggestion && <p className={c.empty}>Goal: {suggestion}</p>}
        </section>
      </main>

      <form className={c.actionBar} onSubmit={handleLaunch}>
        <button type="button" className={c.btnGhost} onClick={() => setGhostId(null)}>Clear Ghost</button>
        <button type="submit" className={c.btnPrimary} disabled={playing}>{playing ? "In Play..." : "Launch Ball"}</button>
      </form>
    </div>
  )
}