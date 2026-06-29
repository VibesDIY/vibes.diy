import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("mini-golf-nine")
  const W = 300, H = 400
  const holes = [
    { par: 3, ball: [150, 360], hole: [150, 40], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10]], sand: [] },
    { par: 4, ball: [60, 360], hole: [240, 50], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[20,180,180,10]], sand: [[180,250,60,40]] },
    { par: 3, ball: [150, 360], hole: [150, 50], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10]], sand: [[100,180,100,50]] },
    { par: 4, ball: [50, 350], hole: [250, 60], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[100,100,10,150]], sand: [] },
    { par: 5, ball: [150, 360], hole: [150, 50], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[60,150,180,10],[60,250,180,10]], sand: [[120,180,60,60]] },
    { par: 3, ball: [60, 360], hole: [240, 60], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10]], sand: [[100,150,100,80]] },
    { par: 4, ball: [150, 360], hole: [60, 60], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[150,150,10,150]], sand: [] },
    { par: 4, ball: [150, 360], hole: [150, 60], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[50,200,80,10],[170,200,80,10]], sand: [] },
    { par: 5, ball: [50, 350], hole: [250, 50], walls: [[20,20,260,10],[20,20,10,360],[270,20,10,360],[20,370,260,10],[80,120,10,100],[180,200,10,100]], sand: [[120,250,60,40]] },
  ]
  const [holeIdx, setHoleIdx] = React.useState(0)
  const [ball, setBall] = React.useState({ x: holes[0].ball[0], y: holes[0].ball[1], vx: 0, vy: 0 })
  const [strokes, setStrokes] = React.useState(0)
  const [scores, setScores] = React.useState([])
  const [drag, setDrag] = React.useState(null)
  const [done, setDone] = React.useState(false)
  const canvasRef = React.useRef(null)
  const hole = holes[holeIdx]

  React.useEffect(() => {
    setBall({ x: hole.ball[0], y: hole.ball[1], vx: 0, vy: 0 })
    setStrokes(0)
    setDone(false)
  }, [holeIdx])

  React.useEffect(() => {
    let raf
    const step = () => {
      setBall(b => {
        if (done) return b
        let { x, y, vx, vy } = b
        if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return { x, y, vx: 0, vy: 0 }
        const inSand = hole.sand.some(([sx,sy,sw,sh]) => x>=sx&&x<=sx+sw&&y>=sy&&y<=sy+sh)
        const fric = inSand ? 0.88 : 0.985
        x += vx; y += vy
        for (const [wx,wy,ww,wh] of hole.walls) {
          if (x>wx&&x<wx+ww&&y>wy&&y<wy+wh) {
            if (Math.abs(vx)>Math.abs(vy)) { x -= vx; vx = -vx*0.7 } else { y -= vy; vy = -vy*0.7 }
          }
        }
        vx *= fric; vy *= fric
        const dx = x - hole.hole[0], dy = y - hole.hole[1]
        if (Math.sqrt(dx*dx+dy*dy) < 12) {
          setDone(true)
          return { x: hole.hole[0], y: hole.hole[1], vx: 0, vy: 0 }
        }
        return { x, y, vx, vy }
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [holeIdx, done, hole])

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "oklch(0.62 0.19 145)"; ctx.fillRect(0,0,W,H)
    for (const [sx,sy,sw,sh] of hole.sand) { ctx.fillStyle = "oklch(0.85 0.18 85)"; ctx.fillRect(sx,sy,sw,sh) }
    for (const [wx,wy,ww,wh] of hole.walls) { ctx.fillStyle = "oklch(0.15 0.02 280)"; ctx.fillRect(wx,wy,ww,wh) }
    ctx.fillStyle = "oklch(0.15 0.02 280)"; ctx.beginPath(); ctx.arc(hole.hole[0], hole.hole[1], 10, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = "white"; ctx.strokeStyle = "oklch(0.15 0.02 280)"; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI*2); ctx.fill(); ctx.stroke()
    if (drag) {
      ctx.strokeStyle = "oklch(0.55 0.24 28)"; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(drag.x, drag.y); ctx.stroke()
    }
  }, [ball, drag, holeIdx, hole])

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const t = e.touches?.[0] || e
    return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height }
  }
  const onDown = (e) => { e.preventDefault(); if (done || ball.vx || ball.vy) return; setDrag(getPos(e)) }
  const onMove = (e) => { if (!drag) return; e.preventDefault(); setDrag(getPos(e)) }
  const onUp = (e) => {
    if (!drag) return
    e.preventDefault()
    const dx = ball.x - drag.x, dy = ball.y - drag.y
    const mag = Math.min(Math.sqrt(dx*dx+dy*dy)/8, 12)
    const ang = Math.atan2(dy, dx)
    setBall(b => ({ ...b, vx: Math.cos(ang)*mag, vy: Math.sin(ang)*mag }))
    setStrokes(s => s + 1)
    setDrag(null)
  }

  const finishHole = () => {
    const newScores = [...scores, strokes]
    setScores(newScores)
    if (holeIdx < 8) setHoleIdx(holeIdx + 1)
    else {
      const total = newScores.reduce((a,b)=>a+b,0)
      const totalPar = holes.reduce((a,h)=>a+h.par,0)
      database.put({ type: "round", scores: newScores, total, par: totalPar, date: Date.now() })
      setScores([]); setHoleIdx(0)
    }
  }

  const resetHole = () => { setBall({ x: hole.ball[0], y: hole.ball[1], vx: 0, vy: 0 }); setStrokes(0); setDone(false) }

  const c = {
    page: "min-h-screen bg-[oklch(0.96_0.01_90)] font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)] pb-12",
    header: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0_oklch(0.15_0.02_280)] mx-4 mt-4 px-5 py-4 flex items-center justify-between",
    title: "text-2xl font-bold uppercase tracking-tight",
    logo: "flex gap-1 items-center",
    dot: "w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)]",
    main: "px-4 mt-5 space-y-5 max-w-[920px] mx-auto",
    section: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-5",
    h2: "text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-3",
    btn: "bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[3px_3px_0_oklch(0.15_0.02_280)] px-4 py-3 font-bold uppercase tracking-[0.05em] text-sm min-h-[44px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btn2: "bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] shadow-[3px_3px_0_oklch(0.15_0.02_280)] px-4 py-3 font-bold uppercase tracking-[0.05em] text-sm min-h-[44px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    stat: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[3px_3px_0_oklch(0.15_0.02_280)] p-3 text-center",
    statNum: "font-['JetBrains_Mono',monospace] text-2xl font-bold",
    statLabel: "text-[0.6rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-1",
    row: "border-b-[2px] border-[oklch(0.15_0.02_280)] py-2 flex justify-between items-center",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logo}>
          <div className={c.dot} style={{ background: "oklch(0.55 0.24 28)" }} />
          <div className={c.dot} style={{ background: "oklch(0.85 0.18 85)" }} />
          <div className={c.dot} style={{ background: "oklch(0.62 0.19 145)" }} />
          <span className={c.title + " ml-3"}>Mini Golf Nine</span>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="course" className={c.section}>
          <div className="flex justify-between items-center mb-3">
            <h2 className={c.h2 + " mb-0"}>Hole {holeIdx+1} · Par {hole.par}</h2>
            <div className="font-['JetBrains_Mono',monospace] font-bold text-lg">Strokes: {strokes}</div>
          </div>
          <canvas ref={canvasRef} width={W} height={H} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} className="border-[3px] border-[oklch(0.15_0.02_280)] w-full touch-none block" style={{ aspectRatio: "3/4" }} />
          <div className="flex gap-3 mt-3">
            <button className={c.btn2} onClick={resetHole}>Reset Hole</button>
            <button className={c.btn} onClick={finishHole} disabled={!done}>{holeIdx < 8 ? "Next Hole" : "Finish Round"}</button>
          </div>
        </section>
        <section id="scorecard" className={c.section}>
          <h2 className={c.h2}>This Round</h2>
          <div className="grid grid-cols-9 gap-1 font-['JetBrains_Mono',monospace] text-center text-sm">
            {Array.from({length:9}).map((_,i)=>(
              <div key={i} className="border-[2px] border-[oklch(0.15_0.02_280)] p-1">
                <div className="text-[0.6rem] font-bold">{i+1}</div>
                <div className="text-[0.55rem] text-[oklch(0.50_0.02_280)]">par {holes[i].par}</div>
                <div className="font-bold text-base">{scores[i] ?? (i===holeIdx ? strokes : "—")}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between font-['JetBrains_Mono',monospace] font-bold">
            <span>Total: {scores.reduce((a,b)=>a+b,0) + (holeIdx < 9 ? strokes : 0)}</span>
            <span>Par: {holes.reduce((a,h)=>a+h.par,0)}</span>
          </div>
        </section>
        <section id="history" className={c.section}>
          <h2 className={c.h2}>Round History</h2>
          {(() => {
            const { docs } = useLiveQuery("type", { key: "round", descending: true, limit: 10 })
            const best = docs.length ? Math.min(...docs.map(d=>d.total)) : null
            return (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={c.stat}>
                    <div className={c.statNum}>{best ?? "—"}</div>
                    <div className={c.statLabel}>Best Round</div>
                  </div>
                  <div className={c.stat}>
                    <div className={c.statNum}>{docs.length}</div>
                    <div className={c.statLabel}>Rounds Played</div>
                  </div>
                </div>
                {docs.length === 0 ? (
                  <div className="text-sm text-[oklch(0.50_0.02_280)] italic">No rounds saved yet. Finish all 9 holes to log one.</div>
                ) : (
                  <ul>
                    {docs.map(d => (
                      <li key={d._id} className={c.row}>
                        <span className="font-['JetBrains_Mono',monospace] text-sm">{new Date(d.date).toLocaleDateString()}</span>
                        <span className="font-['JetBrains_Mono',monospace] font-bold">{d.total} / par {d.par} <span className={d.total<=d.par ? "text-[oklch(0.62_0.19_145)]" : "text-[oklch(0.55_0.24_28)]"}>({d.total-d.par>=0?"+":""}{d.total-d.par})</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          })()}
        </section>
      </main>
    </div>
  )
}