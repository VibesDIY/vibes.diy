import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, database } = useFireproof("lane-dash")
  const canvasRef = React.useRef(null)
  const stateRef = React.useRef(null)
  const [running, setRunning] = React.useState(false)
  const [overMsg, setOverMsg] = React.useState(null)
  const [liveDist, setLiveDist] = React.useState(0)
  const [liveOrbs, setLiveOrbs] = React.useState(0)
  const [selected, setSelected] = React.useState(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true, limit: 50 })

  const todayKey = new Date().toISOString().slice(0,10)
  const todayRuns = runs.filter(r => (r.date||"").slice(0,10) === todayKey)
  const todayBest = todayRuns.reduce((m,r)=>Math.max(m, r.distance||0), 0)
  const lifetimeBest = runs.reduce((m,r)=>Math.max(m, r.distance||0), 0)
  const orbsToday = todayRuns.reduce((s,r)=>s+(r.orbs||0), 0)

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#15151f]",
    header: "px-4 py-3 flex items-center justify-between border-b-[3px] border-[#15151f] bg-white",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    title: "text-xl font-bold tracking-tight uppercase",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    heroSection: "border-[3px] border-[#15151f] bg-white p-6 relative shadow-[6px_6px_0px_#15151f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitle: "text-4xl md:text-6xl font-bold uppercase tracking-tight relative",
    heroSub: "text-sm uppercase tracking-widest mt-2 text-[#6b6b78]",
    statsRow: "grid grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "border-[3px] border-[#15151f] bg-white overflow-hidden shadow-[4px_4px_0px_#15151f]",
    statHead: "px-3 py-2 text-xs uppercase tracking-widest font-bold border-b-[3px] border-[#15151f]",
    statBody: "px-3 py-4",
    statNum: "text-3xl font-bold font-mono",
    statUnit: "text-[0.65rem] uppercase tracking-widest mt-1 text-[#6b6b78]",
    gameSection: "border-[3px] border-[#15151f] bg-white p-4 shadow-[4px_4px_0px_#15151f]",
    gameLabel: "text-[0.65rem] uppercase tracking-widest font-bold mb-2 text-[#6b6b78]",
    canvasWrap: "relative w-full border-[3px] border-[#15151f] bg-[#f5f3ec] overflow-hidden select-none touch-none",
    canvas: "block w-full h-auto",
    overlay: "absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 bg-[rgba(245,243,236,0.92)]",
    overlayTitle: "text-3xl font-bold uppercase tracking-tight text-center",
    overlayText: "text-sm text-center max-w-xs text-[#6b6b78]",
    btnPrimary: "px-6 py-3 border-[3px] border-[#15151f] bg-[#d94327] text-white font-bold uppercase tracking-widest text-sm min-h-[48px] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSecondary: "px-4 py-2 border-[3px] border-[#15151f] bg-[#e8c33a] text-[#15151f] font-bold uppercase tracking-widest text-xs min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    laneRow: "grid grid-cols-3 gap-3 mt-4",
    laneBtn: "border-[3px] border-[#15151f] bg-white py-4 font-bold uppercase tracking-widest text-sm min-h-[56px] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    runsSection: "border-[3px] border-[#15151f] bg-white p-4 shadow-[4px_4px_0px_#15151f]",
    sectionTitle: "text-lg font-bold uppercase tracking-tight mb-3",
    runList: "divide-y-[2px] divide-[#15151f]",
    runRow: "py-3 px-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#e8c33a] transition-colors",
    runMeta: "flex flex-col",
    runDist: "font-mono font-bold",
    runDate: "text-xs uppercase tracking-widest text-[#6b6b78]",
    badge: "px-2 py-1 text-[0.65rem] uppercase tracking-widest font-bold border-[2px] border-[#15151f] bg-[#e8c33a]",
    detailCard: "border-[3px] border-[#15151f] bg-white p-4 mt-4 shadow-[4px_4px_0px_#15151f]",
    taunt: "italic text-sm leading-relaxed",
    empty: "text-sm uppercase tracking-widest text-center py-8 text-[#6b6b78]",
  }

  function endRun(state) {
    setRunning(false)
    const dist = Math.floor(state.distance)
    const orbs = state.orbs
    setOverMsg(`You ran ${dist} m and grabbed ${orbs} orbs.`)
    setIsSaving(true)
    const prompt = `Write one short, playful, smack-talk taunt (max 18 words) for an endless runner game. The player ran ${dist} meters and collected ${orbs} orbs. No emojis.`
    callAI(prompt, { schema: { properties: { taunt: { type: "string" } } } })
      .then(res => {
        const { taunt } = JSON.parse(res)
        return database.put({ type: "run", distance: dist, orbs, taunt, date: new Date().toISOString() })
      })
      .catch(() => database.put({ type: "run", distance: dist, orbs, taunt: "", date: new Date().toISOString() }))
      .finally(() => setIsSaving(false))
  }

  function handleStart(e) {
    if (e && e.preventDefault) e.preventDefault()
    setOverMsg(null)
    setLiveDist(0); setLiveOrbs(0)
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext("2d")
    const W = cv.width, H = cv.height
    const lanes = [W*0.2, W*0.5, W*0.8]
    const s = { lane: 1, distance: 0, orbs: 0, speed: 180, obstacles: [], spawnT: 0, alive: true, last: 0 }
    stateRef.current = s
    setRunning(true)

    function spawn() {
      const lane = Math.floor(Math.random()*3)
      const isOrb = Math.random() < 0.45
      s.obstacles.push({ lane, y: -30, kind: isOrb ? "orb" : "block" })
    }

    function frame(t) {
      if (!stateRef.current || !stateRef.current.alive) return
      const dt = s.last ? (t - s.last)/1000 : 0
      s.last = t
      s.distance += s.speed * dt * 0.1
      s.speed = Math.min(520, 180 + s.distance*0.4)
      s.spawnT -= dt
      if (s.spawnT <= 0) { spawn(); s.spawnT = Math.max(0.35, 0.9 - s.distance*0.001) }

      ctx.fillStyle = "#f5f3ec"; ctx.fillRect(0,0,W,H)
      ctx.strokeStyle = "#15151f"; ctx.lineWidth = 2
      ctx.setLineDash([10,10])
      ctx.beginPath(); ctx.moveTo(W/3,0); ctx.lineTo(W/3,H); ctx.moveTo(2*W/3,0); ctx.lineTo(2*W/3,H); ctx.stroke()
      ctx.setLineDash([])

      const playerY = H - 80
      for (const o of s.obstacles) {
        o.y += s.speed * dt
        const x = lanes[o.lane]
        if (o.kind === "block") {
          ctx.fillStyle = "#d94327"; ctx.strokeStyle="#15151f"; ctx.lineWidth=3
          ctx.fillRect(x-26, o.y-26, 52, 52); ctx.strokeRect(x-26, o.y-26, 52, 52)
        } else {
          ctx.fillStyle = "#e8c33a"; ctx.strokeStyle="#15151f"; ctx.lineWidth=3
          ctx.beginPath(); ctx.arc(x, o.y, 14, 0, Math.PI*2); ctx.fill(); ctx.stroke()
        }
        if (Math.abs(o.y - playerY) < 28 && o.lane === s.lane) {
          if (o.kind === "orb") { s.orbs++; o.y = H + 999 }
          else { s.alive = false }
        }
      }
      s.obstacles = s.obstacles.filter(o => o.y < H + 40)

      const px = lanes[s.lane]
      ctx.fillStyle = "#2f6fd1"; ctx.strokeStyle = "#15151f"; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(px, playerY, 20, 0, Math.PI*2); ctx.fill(); ctx.stroke()

      setLiveDist(Math.floor(s.distance)); setLiveOrbs(s.orbs)

      if (!s.alive) { endRun(s); return }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  function handleLane(dir) {
    const s = stateRef.current; if (!s || !s.alive) return
    if (dir === 0) s.lane = 1
    else s.lane = Math.max(0, Math.min(2, s.lane + dir))
  }

  React.useEffect(() => {
    function onKey(e) {
      if (!running) { if (e.key === " " || e.key === "Enter") handleStart(); return }
      if (e.key === "ArrowLeft" || e.key === "a") handleLane(-1)
      else if (e.key === "ArrowRight" || e.key === "d") handleLane(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [running])

  return (
    <div className={c.page} id="app">
      <header className={c.header} id="app-header">
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={c.dot} style={{background:"#d94327",borderColor:"#15151f"}}></span>
            <span className={c.dot} style={{background:"#e8c33a",borderColor:"#15151f"}}></span>
            <span className={c.dot} style={{background:"#3aa55a",borderColor:"#15151f"}}></span>
          </div>
          <h1 className={c.title}>Lane Dash</h1>
        </div>
        <span className={c.badge}>v1</span>
      </header>

      <main className={c.main} id="app">
        <section id="hero" className={c.heroSection}>
          <div className={c.heroBar}>
            <span className={c.heroBarSeg} style={{background:"#d94327"}}></span>
            <span className={c.heroBarSeg} style={{background:"#e8c33a"}}></span>
            <span className={c.heroBarSeg} style={{background:"#3aa55a"}}></span>
            <span className={c.heroBarSeg} style={{background:"#2f6fd1"}}></span>
          </div>
          <h2 className={c.heroTitle}>
            <span aria-hidden="true" style={{position:"absolute",left:"5px",top:"5px",color:"#d94327",opacity:0.45,zIndex:0}}>Dodge The Lane</span>
            <span style={{position:"relative",zIndex:1}}>Dodge The Lane</span>
          </h2>
          <p className={c.heroSub}>One Tap. Three Lanes. Endless Sprint.</p>
        </section>

        <section id="stats" className={c.statsRow}>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#d94327",color:"#fff"}}>Today Best</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{todayBest}</div>
              <div className={c.statUnit}>Meters</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#e8c33a",color:"#15151f"}}>Lifetime</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{lifetimeBest}</div>
              <div className={c.statUnit}>Meters</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#2f6fd1",color:"#fff"}}>Orbs Today</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{orbsToday}</div>
              <div className={c.statUnit}>Collected</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#3aa55a",color:"#15151f"}}>Runs</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{runs.length}</div>
              <div className={c.statUnit}>Total</div>
            </div>
          </div>
        </section>

        <section id="game" className={c.gameSection}>
          <div className={c.gameLabel}>Arena</div>
          <div className={c.canvasWrap}>
            <canvas ref={canvasRef} className={c.canvas} width="360" height="540"></canvas>
            {!running && (
              <div className={c.overlay}>
                <h3 className={c.overlayTitle}>{overMsg ? "Crashed!" : "Ready?"}</h3>
                <p className={c.overlayText}>{overMsg || "Tap lanes or use ← → keys. Dodge red blocks. Grab yellow orbs."}</p>
                <button className={c.btnPrimary} onClick={handleStart} disabled={isSaving}>
                  {isSaving ? "Saving..." : (overMsg ? "Run Again" : "Start Run")}
                </button>
              </div>
            )}
            {running && (
              <div style={{position:"absolute",top:8,left:8,right:8,display:"flex",justifyContent:"space-between",fontFamily:"monospace",fontWeight:700,fontSize:14,color:"#15151f",pointerEvents:"none"}}>
                <span>{liveDist} M</span>
                <span style={{color:"#2f6fd1"}}>● {liveOrbs}</span>
              </div>
            )}
          </div>
          <div className={c.laneRow}>
            <button className={c.laneBtn} onClick={() => handleLane(-1)}>Left</button>
            <button className={c.laneBtn} onClick={() => handleLane(0)}>Center</button>
            <button className={c.laneBtn} onClick={() => handleLane(1)}>Right</button>
          </div>
        </section>

        <section id="runs" className={c.runsSection}>
          <h3 className={c.sectionTitle}>Recent Runs</h3>
          {runs.length === 0 ? (
            <p className={c.empty}>No runs yet — tap Start Run!</p>
          ) : (
            <ul className={c.runList}>
              {runs.slice(0,10).map(r => (
                <li key={r._id} className={c.runRow} onClick={() => setSelected(r)}>
                  <div className={c.runMeta}>
                    <span className={c.runDist}>{r.distance} m</span>
                    <span className={c.runDate}>{new Date(r.date).toLocaleString()}</span>
                  </div>
                  <span className={c.badge}>{r.orbs} ORBS</span>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <div className={c.detailCard}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <strong style={{fontFamily:"monospace"}}>{selected.distance} M · {selected.orbs} ORBS</strong>
                <button className={c.btnSecondary} onClick={() => setSelected(null)}>Close</button>
              </div>
              <p className={c.taunt}>{selected.taunt || "(no taunt for this run)"}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}