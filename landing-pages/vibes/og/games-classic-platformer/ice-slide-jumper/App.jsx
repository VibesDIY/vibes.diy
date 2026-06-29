import React, { useState, useEffect, useRef, useCallback } from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const LEVELS = [
  {
    id: 1, name: "Frost", friction: 0.92,
    platforms: [[0,360,800,40],[120,280,140,20],[340,220,140,20],[560,160,140,20]],
    flakes: [[180,250],[400,190],[620,130]],
    flag: [720,120], start: [40,300],
  },
  {
    id: 2, name: "Glacier", friction: 0.96,
    platforms: [[0,360,200,40],[260,360,120,40],[440,360,120,40],[620,360,180,40],[160,260,120,20],[380,200,120,20],[600,140,120,20]],
    flakes: [[210,230],[430,170],[660,110],[300,330],[500,330]],
    flag: [740,100], start: [30,320],
  },
  {
    id: 3, name: "Black Ice", friction: 0.985,
    platforms: [[0,360,140,40],[200,340,80,20],[330,300,80,20],[460,260,80,20],[590,220,80,20],[720,180,80,20]],
    flakes: [[230,310],[360,270],[490,230],[620,190],[740,150]],
    flag: [760,140], start: [20,320],
  },
]

export default function App() {
  const { database, useLiveQuery } = useFireproof("ice-slide-v1")
  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true, limit: 50 })
  const { docs: bestDocs } = useLiveQuery("type", { key: "best" })
  const bestByLevel = {}
  bestDocs.forEach(d => { bestByLevel[d.levelId] = d.time })

  const [levelId, setLevelId] = useState(1)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [collected, setCollected] = useState(0)
  const [taunt, setTaunt] = useState("The ice awaits.")
  const [tauntLoading, setTauntLoading] = useState(false)

  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)

  const level = LEVELS.find(l => l.id === levelId)

  function resetGame(lid) {
    const lv = LEVELS.find(l => l.id === lid)
    stateRef.current = {
      x: lv.start[0], y: lv.start[1], vx: 0, vy: 0, onGround: false,
      flakes: lv.flakes.map(f => ({ x: f[0], y: f[1], got: false })),
      done: false,
    }
    setCollected(0)
    setElapsed(0)
  }

  useEffect(() => { resetGame(levelId) }, [levelId])

  useEffect(() => {
    const down = e => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault()
      keysRef.current[e.key] = true
    }
    const up = e => { keysRef.current[e.key] = false }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up) }
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    let last = performance.now()

    function tick(now) {
      const dt = Math.min(33, now - last) / 16.67
      last = now
      const s = stateRef.current
      const lv = LEVELS.find(l => l.id === levelId)
      if (running && s && !s.done) {
        const k = keysRef.current
        const accel = 0.5
        if (k["ArrowLeft"]) s.vx -= accel * dt
        if (k["ArrowRight"]) s.vx += accel * dt
        s.vx *= Math.pow(lv.friction, dt)
        if ((k[" "] || k["ArrowUp"]) && s.onGround) { s.vy = -9; s.onGround = false }
        s.vy += 0.5 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.onGround = false
        for (const [px,py,pw,ph] of lv.platforms) {
          if (s.x+12 > px && s.x-12 < px+pw && s.y+16 > py && s.y+16 < py+ph+10 && s.vy >= 0) {
            s.y = py - 16; s.vy = 0; s.onGround = true
          }
        }
        if (s.x < 12) { s.x = 12; s.vx = 0 }
        if (s.x > 788) { s.x = 788; s.vx = 0 }
        if (s.y > 500) { resetGame(levelId); return (rafRef.current = requestAnimationFrame(tick)) }
        s.flakes.forEach(f => {
          if (!f.got && Math.abs(f.x - s.x) < 16 && Math.abs(f.y - s.y) < 18) {
            f.got = true; setCollected(c => c + 1)
          }
        })
        const [fx,fy] = lv.flag
        if (Math.abs(fx - s.x) < 18 && Math.abs(fy - s.y) < 30) {
          s.done = true
          finishRun()
        }
        setElapsed((performance.now() - startTimeRef.current) / 1000)
      }

      ctx.fillStyle = "#cde6f5"
      ctx.fillRect(0,0,800,400)
      ctx.fillStyle = "#15151f"
      lv.platforms.forEach(([x,y,w,h]) => {
        ctx.fillRect(x,y,w,h)
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x+3,y+3,w-6,h-6)
        ctx.fillStyle = "#15151f"
      })
      if (s) {
        s.flakes.forEach(f => {
          if (!f.got) {
            ctx.fillStyle = "#2f6df0"; ctx.fillRect(f.x-6,f.y-6,12,12)
            ctx.strokeStyle = "#15151f"; ctx.lineWidth = 3; ctx.strokeRect(f.x-6,f.y-6,12,12)
          }
        })
        const [fx,fy] = lv.flag
        ctx.fillStyle = "#d9442b"; ctx.fillRect(fx-12,fy-24,24,24)
        ctx.strokeStyle = "#15151f"; ctx.lineWidth = 3; ctx.strokeRect(fx-12,fy-24,24,24)
        ctx.fillStyle = "#e8c547"; ctx.fillRect(s.x-12,s.y-16,24,32)
        ctx.strokeStyle = "#15151f"; ctx.lineWidth = 3; ctx.strokeRect(s.x-12,s.y-16,24,32)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, levelId])

  async function finishRun() {
    const time = (performance.now() - startTimeRef.current) / 1000
    const lv = LEVELS.find(l => l.id === levelId)
    setRunning(false)
    await database.put({
      type: "run", levelId, levelName: lv.name,
      time, flakes: stateRef.current.flakes.filter(f => f.got).length,
      total: lv.flakes.length, createdAt: Date.now(),
    })
    const prev = bestByLevel[levelId]
    if (prev === undefined || time < prev) {
      const existing = bestDocs.find(d => d.levelId === levelId)
      await database.put({ ...(existing || {}), type: "best", levelId, time })
    }
  }

  function handleStart() {
    resetGame(levelId)
    startTimeRef.current = performance.now()
    setRunning(true)
  }
  function handleReset() { resetGame(levelId); setRunning(false) }
  function handleLevelPick(id) { setLevelId(id); setRunning(false) }
  function pressKey(k, on) { keysRef.current[k] = on }

  async function handleTaunt() {
    setTauntLoading(true)
    try {
      const lv = LEVELS.find(l => l.id === levelId)
      const r = await callAI(`Write a short snarky one-line taunt (max 14 words, no emojis) for a player on the icy platformer level "${lv.name}". They've collected ${collected}/${lv.flakes.length} snowflakes.`, {
        schema: { properties: { taunt: { type: "string" } } }
      })
      setTaunt(JSON.parse(r).taunt)
    } finally { setTauntLoading(false) }
  }

  const c = {
    page: "min-h-screen w-full bg-[#f5f1e8] text-[#15151f]",
    shell: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex items-center justify-between p-4 border-[3px] border-[#15151f] rounded bg-white shadow-[4px_4px_0px_#15151f]",
    logo: "flex items-center gap-2",
    logoDot: "w-3 h-3 border-[3px]",
    title: "text-2xl font-bold tracking-tight uppercase",
    nav: "flex gap-2",
    navLink: "px-3 py-2 border-[3px] border-[#15151f] rounded text-xs uppercase tracking-wider font-semibold bg-white shadow-[3px_3px_0px_#15151f]",
    hero: "relative p-6 border-[3px] border-[#15151f] rounded overflow-hidden bg-white shadow-[4px_4px_0px_#15151f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitle: "text-4xl md:text-6xl font-bold uppercase tracking-tight mt-2",
    heroSub: "mt-3 text-sm uppercase tracking-widest text-[#6a6a78]",
    levelGrid: "grid grid-cols-1 md:grid-cols-3 gap-4",
    levelCard: "p-4 border-[3px] border-[#15151f] rounded flex flex-col gap-2 bg-white shadow-[3px_3px_0px_#15151f]",
    levelHead: "p-2 border-[3px] rounded text-xs uppercase tracking-widest font-bold",
    levelStat: "font-mono text-2xl font-bold text-[#15151f]",
    levelLabel: "text-[0.65rem] uppercase tracking-widest text-[#6a6a78]",
    stage: "relative border-[3px] border-[#15151f] rounded overflow-hidden bg-[#cde6f5] shadow-[4px_4px_0px_#15151f]",
    canvas: "w-full block touch-none",
    hud: "flex items-center justify-between p-3 border-[3px] border-[#15151f] rounded text-xs uppercase tracking-widest font-bold bg-white shadow-[3px_3px_0px_#15151f] gap-2",
    controls: "flex flex-wrap gap-2",
    btnPrimary: "px-4 py-3 border-[3px] border-[#15151f] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-[#d9442b] text-white shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    btnSecondary: "px-4 py-3 border-[3px] border-[#15151f] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-[#e8c547] text-[#15151f] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    btnGhost: "px-4 py-3 border-[3px] border-[#15151f] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-white text-[#15151f] hover:shadow-[3px_3px_0px_#15151f] transition-shadow",
    section: "p-4 border-[3px] border-[#15151f] rounded flex flex-col gap-3 bg-white shadow-[4px_4px_0px_#15151f]",
    sectionTitle: "text-xs uppercase tracking-widest font-bold text-[#6a6a78]",
    taunt: "p-3 border-[3px] border-[#15151f] rounded font-mono text-sm bg-[#2f6df0] text-white shadow-[3px_3px_0px_#15151f]",
    runList: "flex flex-col gap-2",
    runRow: "flex items-center justify-between p-3 border-[3px] border-[#15151f] rounded text-sm bg-white shadow-[3px_3px_0px_#15151f] gap-3",
    runMono: "font-mono font-bold",
    badge: "px-2 py-1 border-[3px] border-[#15151f] rounded text-[0.6rem] uppercase tracking-widest font-bold bg-[#3aa84a] text-white",
    touchPad: "grid grid-cols-3 gap-2 mt-3 md:hidden",
    touchBtn: "p-4 border-[3px] border-[#15151f] rounded font-bold uppercase min-h-[56px] bg-[#3aa84a] text-white shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform",
    empty: "text-sm uppercase tracking-widest text-center py-6 text-[#6a6a78]",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <span className={`${c.logoDot} bg-[#d9442b] border-[#15151f]`}></span>
            <span className={`${c.logoDot} bg-[#e8c547] border-[#15151f]`}></span>
            <span className={`${c.logoDot} bg-[#3aa84a] border-[#15151f]`}></span>
            <span className={c.title}>Ice Slide</span>
          </div>
          <nav className={c.nav}>
            <a className={c.navLink} href="#play">Play</a>
            <a className={c.navLink} href="#runs">Runs</a>
          </nav>
        </header>

        <main id="app">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar}>
              <div className={`${c.heroBarSeg} bg-[#d9442b]`}></div>
              <div className={`${c.heroBarSeg} bg-[#e8c547]`}></div>
              <div className={`${c.heroBarSeg} bg-[#3aa84a]`}></div>
              <div className={`${c.heroBarSeg} bg-[#2f6df0]`}></div>
            </div>
            <h1 className={c.heroTitle}>Don't Stop Sliding</h1>
            <p className={c.heroSub}>Arrows steer. Space jumps. Momentum lies.</p>
          </section>

          <section id="levels" className={c.section}>
            <h2 className={c.sectionTitle}>Pick A Level</h2>
            <div className={c.levelGrid}>
              {LEVELS.map(lv => {
                const colors = {1:"bg-[#d9442b] text-white",2:"bg-[#e8c547] text-[#15151f]",3:"bg-[#2f6df0] text-white"}
                const best = bestByLevel[lv.id]
                return (
                  <div key={lv.id} className={c.levelCard}>
                    <div className={`${c.levelHead} ${colors[lv.id]} border-[#15151f]`}>Level {lv.id} — {lv.name}</div>
                    <div className={c.levelStat}>{best !== undefined ? best.toFixed(2)+"s" : "--:--"}</div>
                    <div className={c.levelLabel}>Best Time</div>
                    <button className={c.btnPrimary} onClick={() => handleLevelPick(lv.id)}>{levelId===lv.id ? "Selected" : "Pick"}</button>
                  </div>
                )
              })}
            </div>
          </section>

          <section id="play" className={c.section}>
            <div className={c.hud}>
              <span>Time {elapsed.toFixed(2)}s</span>
              <span>Flakes {collected} / {level.flakes.length}</span>
              <span>L{level.id} {level.name}</span>
            </div>
            <div className={c.stage}>
              <canvas ref={canvasRef} className={c.canvas} width={800} height={400} style={{aspectRatio:"2/1"}}></canvas>
            </div>
            <div className={c.touchPad}>
              <button className={c.touchBtn} onTouchStart={()=>pressKey("ArrowLeft",true)} onTouchEnd={()=>pressKey("ArrowLeft",false)} onMouseDown={()=>pressKey("ArrowLeft",true)} onMouseUp={()=>pressKey("ArrowLeft",false)}>Left</button>
              <button className={c.touchBtn} onTouchStart={()=>pressKey(" ",true)} onTouchEnd={()=>pressKey(" ",false)} onMouseDown={()=>pressKey(" ",true)} onMouseUp={()=>pressKey(" ",false)}>Jump</button>
              <button className={c.touchBtn} onTouchStart={()=>pressKey("ArrowRight",true)} onTouchEnd={()=>pressKey("ArrowRight",false)} onMouseDown={()=>pressKey("ArrowRight",true)} onMouseUp={()=>pressKey("ArrowRight",false)}>Right</button>
            </div>
            <div className={c.controls}>
              <button className={c.btnPrimary} onClick={handleStart} disabled={running}>{running ? "Sliding..." : "Start"}</button>
              <button className={c.btnSecondary} onClick={handleReset}>Reset</button>
              <button className={c.btnGhost} onClick={handleTaunt} disabled={tauntLoading}>
                {tauntLoading ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15151f" strokeWidth="3" className="animate-spin inline"><path d="M12 2 a10 10 0 0 1 10 10"/></svg> : "Taunt Me"}
              </button>
            </div>
            <div className={c.taunt}>{taunt}</div>
          </section>

          <section id="runs" className={c.section}>
            <h2 className={c.sectionTitle}>Run History</h2>
            <ul className={c.runList}>
              {runs.length === 0 && <li className={c.empty}>No runs yet — go slip.</li>}
              {runs.map(r => (
                <li key={r._id} className={c.runRow}>
                  <span className={c.badge}>L{r.levelId}</span>
                  <span className={c.runMono}>{r.time?.toFixed(2)}s</span>
                  <span>{r.flakes} / {r.total}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  )
}