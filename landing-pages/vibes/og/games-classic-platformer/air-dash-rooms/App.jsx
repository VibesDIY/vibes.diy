import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default const ROOMS = [
  {
    id: 'room-1',
    name: 'Warmup',
    platforms: [[0,180,320,20],[60,140,40,10],[140,110,40,10],[220,80,80,10]],
    spikes: [[100,170,40,10]],
    start: [10,160],
    goal: [270,60,30,20],
  },
  {
    id: 'room-2',
    name: 'Spike Hop',
    platforms: [[0,180,80,20],[120,150,40,10],[200,120,40,10],[270,90,50,10]],
    spikes: [[80,170,40,10],[160,170,40,10],[240,170,30,10]],
    start: [10,160],
    goal: [290,70,30,20],
  },
  {
    id: 'room-3',
    name: 'Dash Gap',
    platforms: [[0,180,60,20],[110,140,30,10],[180,140,30,10],[250,100,70,10]],
    spikes: [[60,170,50,10],[140,170,40,10],[210,170,40,10]],
    start: [10,160],
    goal: [290,80,30,20],
  },
]

function App() {
  const { useLiveQuery, database } = useFireproof("dash-runner")
  const [roomIdx, setRoomIdx] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [won, setWon] = React.useState(false)
  const stateRef = React.useRef(null)
  const canvasRef = React.useRef(null)
  const keysRef = React.useRef({})
  const room = ROOMS[roomIdx]

  const { docs: bests } = useLiveQuery("type", { key: "best" })
  const bestForRoom = (rid) => bests.filter(d => d.roomId === rid).sort((a,b) => a.time - b.time)[0]
  const currentBest = bestForRoom(room.id)

  React.useEffect(() => {
    const dn = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift'].includes(e.key)) e.preventDefault()
      keysRef.current[e.key] = true
    }
    const up = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  const startRun = () => {
    setWon(false)
    setElapsed(0)
    stateRef.current = {
      x: room.start[0], y: room.start[1], vx: 0, vy: 0,
      onGround: false, dashUsed: false, dashTimer: 0,
      inputs: [], t0: performance.now(),
      ghost: currentBest?.inputs || null, ghostStep: 0,
      gx: room.start[0], gy: room.start[1], gvx: 0, gvy: 0, gOnGround: false, gDashUsed: false, gDashTimer: 0,
    }
    setRunning(true)
  }

  React.useEffect(() => {
    if (!running) return
    let raf
    const tick = () => {
      const s = stateRef.current
      if (!s) return
      const k = keysRef.current
      const left = k['ArrowLeft'], right = k['ArrowRight'], jump = k[' '], dash = k['Shift']
      const dir = (left ? -1 : 0) + (right ? 1 : 0)
      s.inputs.push([dir, jump?1:0, dash?1:0])

      // physics
      const step = (st, dirI, jumpI, dashI) => {
        if (st.dashTimer > 0) {
          st.dashTimer -= 1
          st.vy = 0
        } else {
          st.vx = dirI * 2.2
          st.vy += 0.35
          if (st.vy > 8) st.vy = 8
        }
        if (jumpI && st.onGround) { st.vy = -6.5; st.onGround = false }
        if (dashI && !st.dashUsed && !st.onGround && st.dashTimer === 0) {
          st.dashUsed = true; st.dashTimer = 10; st.vx = (dirI || (st.vx>0?1:-1)) * 5; st.vy = 0
        }
        st.x += st.vx; st.y += st.vy
        st.onGround = false
        for (const [px,py,pw,ph] of room.platforms) {
          if (st.x+8>px && st.x<px+pw && st.y+12>py && st.y+12<py+ph+8 && st.vy>=0) {
            st.y = py - 12; st.vy = 0; st.onGround = true; st.dashUsed = false
          }
        }
        if (st.y > 200) return 'dead'
        if (st.x < 0) st.x = 0
        if (st.x > 312) st.x = 312
        for (const [sx,sy,sw,sh] of room.spikes) {
          if (st.x+8>sx && st.x<sx+sw && st.y+12>sy && st.y<sy+sh) return 'dead'
        }
        const [gx,gy,gw,gh] = room.goal
        if (st.x+8>gx && st.x<gx+gw && st.y+12>gy && st.y<gy+gh) return 'win'
        return null
      }

      const r = step(s, dir, jump?1:0, dash?1:0)

      // ghost
      if (s.ghost && s.ghostStep < s.ghost.length) {
        const [gd,gj,gdh] = s.ghost[s.ghostStep++]
        const gst = { x:s.gx,y:s.gy,vx:s.gvx,vy:s.gvy,onGround:s.gOnGround,dashUsed:s.gDashUsed,dashTimer:s.gDashTimer }
        const _step = (st, dirI, jumpI, dashI) => {
          if (st.dashTimer > 0) { st.dashTimer -= 1; st.vy = 0 }
          else { st.vx = dirI * 2.2; st.vy += 0.35; if (st.vy>8) st.vy=8 }
          if (jumpI && st.onGround) { st.vy = -6.5; st.onGround = false }
          if (dashI && !st.dashUsed && !st.onGround && st.dashTimer === 0) {
            st.dashUsed = true; st.dashTimer = 10; st.vx = (dirI||(st.vx>0?1:-1))*5; st.vy = 0
          }
          st.x += st.vx; st.y += st.vy; st.onGround = false
          for (const [px,py,pw,ph] of room.platforms) {
            if (st.x+8>px && st.x<px+pw && st.y+12>py && st.y+12<py+ph+8 && st.vy>=0) {
              st.y = py-12; st.vy=0; st.onGround=true; st.dashUsed=false
            }
          }
        }
        _step(gst, gd, gj, gdh)
        s.gx=gst.x; s.gy=gst.y; s.gvx=gst.vx; s.gvy=gst.vy; s.gOnGround=gst.onGround; s.gDashUsed=gst.dashUsed; s.gDashTimer=gst.dashTimer
      }

      // draw
      const cv = canvasRef.current
      if (cv) {
        const ctx = cv.getContext('2d')
        const W = cv.width, H = cv.height
        const sx = W/320, sy = H/200
        ctx.fillStyle = '#262035'; ctx.fillRect(0,0,W,H)
        ctx.fillStyle = '#e9c46a'
        for (const [px,py,pw,ph] of room.platforms) ctx.fillRect(px*sx, py*sy, pw*sx, ph*sy)
        ctx.fillStyle = '#e76f51'
        for (const [px,py,pw,ph] of room.spikes) {
          ctx.beginPath()
          for (let i=0;i<pw;i+=8) { ctx.moveTo((px+i)*sx,(py+ph)*sy); ctx.lineTo((px+i+4)*sx,py*sy); ctx.lineTo((px+i+8)*sx,(py+ph)*sy) }
          ctx.closePath(); ctx.fill()
        }
        const [gx,gy,gw,gh] = room.goal
        ctx.fillStyle = '#2a9d8f'; ctx.fillRect(gx*sx,gy*sy,gw*sx,gh*sy)
        if (s.ghost) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(s.gx*sx, s.gy*sy, 8*sx, 12*sy) }
        ctx.fillStyle = '#fff'; ctx.fillRect(s.x*sx, s.y*sy, 8*sx, 12*sy)
      }

      const e = performance.now() - s.t0
      setElapsed(e)

      if (r === 'dead') { setRunning(false); return }
      if (r === 'win') {
        setRunning(false); setWon(true)
        const time = e
        if (!currentBest || time < currentBest.time) {
          database.put({ type: 'best', roomId: room.id, time, inputs: s.inputs, createdAt: Date.now() })
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const fmt = (ms) => {
    const s = Math.floor(ms/1000), m = Math.floor(s/60), r = s%60, mm = Math.floor(ms%1000)
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}.${String(mm).padStart(3,'0')}`
  }
  const c = {
    page: "min-h-screen bg-[#f4f1ea] text-[#1a1726] font-['Space_Grotesk',sans-serif] relative",
    header: "border-b-[3px] border-[#1a1726] bg-white shadow-[0_4px_0_0_#1a1726] px-4 py-3 flex items-center justify-between sticky top-0 z-20",
    logoWrap: "flex items-center gap-2",
    logoBlocks: "flex gap-1",
    logoBlock: "w-3 h-3 border-[2px] border-[#1a1726]",
    title: "text-lg font-bold uppercase tracking-tight",
    badge: "font-mono text-xs uppercase tracking-widest bg-[#e9c46a] border-[3px] border-[#1a1726] px-2 py-1 shadow-[3px_3px_0_0_#1a1726]",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6 relative z-10",
    section: "bg-white border-[3px] border-[#1a1726] shadow-[4px_4px_0_0_#1a1726] p-4",
    h2: "text-base font-bold uppercase tracking-tight mb-3",
    stageWrap: "bg-[#1a1726] border-[3px] border-[#1a1726] shadow-[4px_4px_0_0_#1a1726] p-2",
    canvasFrame: "bg-[#262035] border-[3px] border-[#e9c46a] aspect-[16/10] w-full relative overflow-hidden",
    roomBtn: "border-[3px] border-[#1a1726] bg-white px-3 py-3 text-left shadow-[3px_3px_0_0_#1a1726] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[60px] flex flex-col gap-1",
    roomBtnActive: "bg-[#e76f51] text-white",
    roomGrid: "grid grid-cols-3 gap-2",
    roomLabel: "text-[0.65rem] uppercase tracking-widest font-bold",
    roomTime: "font-mono text-sm",
    controlsGrid: "grid grid-cols-3 gap-2 text-xs font-mono uppercase",
    keyChip: "bg-[#f4f1ea] border-[3px] border-[#1a1726] px-2 py-2 text-center shadow-[3px_3px_0_0_#1a1726]",
    primaryBtn: "bg-[#e76f51] text-white border-[3px] border-[#1a1726] uppercase font-bold tracking-wider px-4 py-3 shadow-[4px_4px_0_0_#1a1726] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none w-full min-h-[48px]",
    ghostBtn: "bg-white text-[#1a1726] border-[3px] border-[#1a1726] uppercase font-bold tracking-wider px-4 py-3 shadow-[3px_3px_0_0_#1a1726] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none w-full min-h-[48px]",
    leaderRow: "flex items-center justify-between border-b-[2px] border-[#1a1726]/20 py-2 last:border-b-0",
    leaderLabel: "font-mono text-xs uppercase tracking-widest",
    leaderTime: "font-mono text-sm font-bold",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logoWrap}>
          <div className={c.logoBlocks}>
            <div className={c.logoBlock} style={{ background: '#e76f51' }} />
            <div className={c.logoBlock} style={{ background: '#e9c46a' }} />
            <div className={c.logoBlock} style={{ background: '#2a9d8f' }} />
          </div>
          <h1 className={c.title}>Dash Runner</h1>
        </div>
        <div className={c.badge}>v1</div>
      </header>

      <main id="app" className={c.main}>
        <section id="stage" className={c.section}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={c.h2}>{room.name}</h2>
            <div className="font-mono text-sm bg-[#e9c46a] border-[3px] border-[#1a1726] px-2 py-1 shadow-[3px_3px_0_0_#1a1726]">{fmt(elapsed)}</div>
          </div>
          <div className={c.stageWrap}>
            <div className={c.canvasFrame}>
              <canvas ref={canvasRef} width={640} height={400} className="w-full h-full block" />
              {!running && (
                <div className="absolute inset-0 flex items-center justify-center text-[#e9c46a] font-mono text-xs uppercase tracking-widest pointer-events-none">
                  {won ? 'Cleared! Tap start to retry' : 'Tap start — arrows/space/shift'}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className={c.primaryBtn} onClick={startRun} disabled={running}>{running ? 'Running…' : 'Start Run'}</button>
            <button className={c.ghostBtn} onClick={() => { setRunning(false); setElapsed(0); setWon(false) }}>Reset</button>
          </div>
        </section>

        <section id="rooms" className={c.section}>
          <h2 className={c.h2}>Rooms</h2>
          <div className={c.roomGrid}>
            {ROOMS.map((r, i) => {
              const b = bestForRoom(r.id)
              return (
                <button key={r.id} onClick={() => { setRoomIdx(i); setRunning(false); setElapsed(0); setWon(false) }} className={`${c.roomBtn} ${i===roomIdx ? c.roomBtnActive : ''}`}>
                  <span className={c.roomLabel}>{r.name}</span>
                  <span className={c.roomTime}>{b ? fmt(b.time) : '—:—'}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section id="controls" className={c.section}>
          <h2 className={c.h2}>Controls</h2>
          <div className={c.controlsGrid}>
            <div className={c.keyChip}>← →<div className="text-[0.6rem] mt-1 opacity-70">Move</div></div>
            <div className={c.keyChip}>Space<div className="text-[0.6rem] mt-1 opacity-70">Jump</div></div>
            <div className={c.keyChip}>Shift<div className="text-[0.6rem] mt-1 opacity-70">Dash 1x</div></div>
          </div>
          <p className="text-xs mt-3 opacity-70 font-mono uppercase tracking-wider">Dash resets on ground touch. Beat your time — ghost shows your best.</p>
        </section>

        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Best Times</h2>
          {ROOMS.map(r => {
            const b = bestForRoom(r.id)
            return (
              <div key={r.id} className={c.leaderRow}>
                <span className={c.leaderLabel}>{r.name}</span>
                <span className={c.leaderTime}>{b ? fmt(b.time) : 'No run yet'}</span>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}