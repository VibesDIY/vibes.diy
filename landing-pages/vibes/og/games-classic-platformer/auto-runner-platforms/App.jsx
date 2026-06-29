import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, database } = useFireproof("dash-runner")
  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true, limit: 20 })
  const todayKey = new Date().toISOString().slice(0, 10)
  const dailyBest = runs.filter(r => r.day === todayKey).reduce((m, r) => Math.max(m, r.distance || 0), 0)
  const lifetimeBest = runs.reduce((m, r) => Math.max(m, r.distance || 0), 0)

  const [running, setRunning] = React.useState(false)
  const [distance, setDistance] = React.useState(0)
  const [jumping, setJumping] = React.useState(false)
  const [obstacles, setObstacles] = React.useState([])
  const [dead, setDead] = React.useState(false)
  const jumpingRef = React.useRef(false)
  const distRef = React.useRef(0)

  function handleJump() {
    if (!running || jumpingRef.current) return
    jumpingRef.current = true
    setJumping(true)
    setTimeout(() => { jumpingRef.current = false; setJumping(false) }, 520)
  }

  function handleStart(e) {
    e.preventDefault()
    if (running) return
    setRunning(true); setDead(false); setDistance(0); distRef.current = 0
    setObstacles([{ x: 600, id: 1 }])
  }

  function handleReset() {
    setRunning(false); setDead(false); setDistance(0); distRef.current = 0; setObstacles([])
  }

  React.useEffect(() => {
    if (!running) return
    const tick = setInterval(() => {
      distRef.current += 1
      setDistance(distRef.current)
      setObstacles(prev => {
        const moved = prev.map(o => ({ ...o, x: o.x - 8 })).filter(o => o.x > -40)
        if (moved.length === 0 || moved[moved.length - 1].x < 280) {
          moved.push({ x: 600 + Math.random() * 200, id: Date.now() })
        }
        for (const o of moved) {
          if (o.x > 40 && o.x < 90 && !jumpingRef.current) {
            setRunning(false); setDead(true)
            database.put({ type: "run", distance: distRef.current, day: todayKey, createdAt: Date.now() })
            return moved
          }
        }
        return moved
      })
    }, 50)
    return () => clearInterval(tick)
  }, [running, database, todayKey])

  React.useEffect(() => {
    function onKey(e) { if (e.code === "Space") { e.preventDefault(); handleJump() } }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#161427]",
    shell: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-5",
    header: "flex items-center justify-between border-[3px] border-[#161427] rounded p-3 bg-white shadow-[4px_4px_0px_#161427]",
    brand: "flex items-center gap-2",
    swatches: "flex gap-1",
    sw: "w-3 h-3 border-[3px]",
    title: "text-xl font-bold tracking-tight uppercase",
    statsRow: "grid grid-cols-3 gap-3",
    statCard: "border-[3px] border-[#161427] rounded overflow-hidden bg-white shadow-[4px_4px_0px_#161427]",
    statBar: "px-3 py-1 text-[0.65rem] uppercase tracking-widest border-b-[3px] border-[#161427] font-semibold",
    statBody: "px-3 py-3",
    statNum: "text-2xl font-bold font-mono",
    statUnit: "text-[0.6rem] uppercase tracking-widest text-[#6b6982]",
    stage: "border-[3px] border-[#161427] rounded relative overflow-hidden bg-white shadow-[4px_4px_0px_#161427]",
    stageBar: "h-[6px] w-full flex",
    stageSeg: "flex-1",
    stageInner: "relative h-[260px] flex items-end justify-start p-4 select-none cursor-pointer bg-[#faf9f3]",
    distanceTag: "absolute top-3 right-3 border-[3px] border-[#161427] rounded px-2 py-1 text-xs font-mono bg-[#e8c842] shadow-[3px_3px_0px_#161427] font-bold",
    runner: "w-10 h-10 border-[3px] border-[#161427] rounded bg-[#d6402a] shadow-[3px_3px_0px_#161427] absolute bottom-[3px] transition-transform",
    ground: "absolute bottom-0 left-0 right-0 h-[3px] bg-[#161427]",
    actionBar: "flex gap-3",
    btnPrimary: "flex-1 border-[3px] border-[#161427] rounded py-3 uppercase tracking-widest text-sm font-bold bg-[#d6402a] text-white shadow-[4px_4px_0px_#161427] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60",
    btnSecondary: "border-[3px] border-[#161427] rounded px-4 py-3 uppercase tracking-widest text-sm font-bold bg-[#e8c842] text-[#161427] shadow-[3px_3px_0px_#161427] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    section: "border-[3px] border-[#161427] rounded p-4 flex flex-col gap-3 bg-white shadow-[4px_4px_0px_#161427]",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest text-[#6b6982] font-semibold",
    list: "flex flex-col gap-2",
    row: "flex items-center justify-between border-[3px] border-[#161427] rounded px-3 py-2 bg-[#faf9f3]",
    rowDist: "font-mono text-sm",
    rowTime: "text-[0.7rem] uppercase tracking-widest text-[#6b6982]",
    empty: "text-sm py-6 text-center",
    hint: "text-[0.7rem] uppercase tracking-widest text-center text-[#6b6982] font-semibold",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.brand}>
            <div className={c.swatches}>
              <div className={`${c.sw} bg-[#d6402a] border-[#161427]`} />
              <div className={`${c.sw} bg-[#e8c842] border-[#161427]`} />
              <div className={`${c.sw} bg-[#3fa34d] border-[#161427]`} />
            </div>
            <span className={c.title}>Dash Runner</span>
          </div>
          <span className={c.rowTime}>v1</span>
        </header>

        <main id="app">
          <section id="bests" className={c.statsRow}>
            <div className={c.statCard}>
              <div className={`${c.statBar} bg-[#d6402a] text-white`}>Current</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{distance}</div>
                <div className={c.statUnit}>meters</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statBar} bg-[#e8c842] text-[#161427]`}>Daily</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{dailyBest}</div>
                <div className={c.statUnit}>best today</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statBar} bg-[#3960d6] text-white`}>Lifetime</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{lifetimeBest}</div>
                <div className={c.statUnit}>all time</div>
              </div>
            </div>
          </section>

          <section id="stage" className={c.stage}>
            <div className={c.stageBar}>
              <div className={`${c.stageSeg} bg-[#d6402a]`} />
              <div className={`${c.stageSeg} bg-[#e8c842]`} />
              <div className={`${c.stageSeg} bg-[#3fa34d]`} />
              <div className={`${c.stageSeg} bg-[#3960d6]`} />
            </div>
            <div className={c.stageInner} onClick={handleJump}>
              <div className={c.distanceTag}>{distance} m</div>
              <div className={c.runner} style={{ left: 40, transform: jumping ? "translateY(-110px)" : "translateY(0)", transition: "transform 0.26s cubic-bezier(0.34,1.56,0.64,1)" }} />
              {obstacles.map(o => (
                <div key={o.id} className="absolute bottom-[3px] w-6 h-8 border-[3px] border-[#161427] bg-[#161427]" style={{ left: o.x, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
              ))}
              {dead && <div className="absolute inset-0 flex items-center justify-center bg-[#161427]/60"><span className="bg-white border-[3px] border-[#161427] px-4 py-2 uppercase tracking-widest text-sm font-bold shadow-[4px_4px_0px_#d6402a]">Run Over</span></div>}
              <div className={c.ground} />
            </div>
          </section>

          <p className={c.hint}>Tap stage or press space to jump</p>

          <section id="actions" className={c.actionBar}>
            <button type="button" onClick={handleStart} disabled={running} className={c.btnPrimary}>{running ? "Running..." : "Start Run"}</button>
            <button type="button" onClick={handleReset} className={c.btnSecondary}>Reset</button>
          </section>

          <section id="history" className={c.section}>
            <div className={c.sectionLabel}>Recent Runs</div>
            <ul className={c.list}>
              {runs.length === 0 && (
                <li className={c.row}>
                  <span className={c.rowDist}>—</span>
                  <span className={c.rowTime}>no runs yet</span>
                </li>
              )}
              {runs.map(r => (
                <li key={r._id} className={c.row}>
                  <span className={c.rowDist}>{r.distance} m</span>
                  <span className={c.rowTime}>{new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  )
}