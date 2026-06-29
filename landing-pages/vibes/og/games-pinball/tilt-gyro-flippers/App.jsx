import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("tilt-pinball")
  const [score, setScore] = React.useState(0)
  const [ballPos, setBallPos] = React.useState({ x: 48, y: 60 })
  const [ballVel, setBallVel] = React.useState({ x: 0, y: 0 })
  const [running, setRunning] = React.useState(false)
  const [tilt, setTilt] = React.useState(0)
  const [calibration, setCalibration] = React.useState(0)
  const [sensitivity, setSensitivity] = React.useState(5)
  const [leftFlip, setLeftFlip] = React.useState(false)
  const [rightFlip, setRightFlip] = React.useState(false)
  const [status, setStatus] = React.useState("Ball Ready")
  const startTimeRef = React.useRef(0)

  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true, limit: 5 })

  React.useEffect(() => {
    function onOrient(e) {
      if (typeof e.gamma === "number") setTilt(e.gamma)
    }
    window.addEventListener("deviceorientation", onOrient)
    return () => window.removeEventListener("deviceorientation", onOrient)
  }, [])

  React.useEffect(() => {
    const adj = tilt - calibration
    const threshold = 11 - sensitivity
    setLeftFlip(adj < -threshold)
    setRightFlip(adj > threshold)
  }, [tilt, calibration, sensitivity])

  React.useEffect(() => {
    function down(e) {
      if (e.key === "a" || e.key === "A") setLeftFlip(true)
      if (e.key === "l" || e.key === "L") setRightFlip(true)
    }
    function up(e) {
      if (e.key === "a" || e.key === "A") setLeftFlip(false)
      if (e.key === "l" || e.key === "L") setRightFlip(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up) }
  }, [])

  function handleCalibrate() {
    setCalibration(tilt)
    setStatus("Calibrated")
  }
  function handleLaunch(e) {
    e.preventDefault()
    setScore(0)
    setBallPos({ x: 50, y: 80 })
    setBallVel({ x: (Math.random() - 0.5) * 2, y: -5 })
    setRunning(true)
    setStatus("In Play")
    startTimeRef.current = Date.now()
  }
  function handleSensitivity(e) {
    setSensitivity(Number(e.target.value))
  }

  const [suggestLoading, setSuggestLoading] = React.useState(false)
  async function handleSuggest() {
    setSuggestLoading(true)
    try {
      const res = await callAI("Suggest a tilt sensitivity from 1 to 10 for a casual mobile pinball player who wants responsive but not twitchy flippers.", {
        schema: { properties: { sensitivity: { type: "number" }, reason: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      if (parsed.sensitivity) setSensitivity(Math.max(1, Math.min(10, Math.round(parsed.sensitivity))))
    } finally { setSuggestLoading(false) }
  }

  React.useEffect(() => {
    if (!running) return
    const bumpers = [
      { x: 31, y: 25, color: "red", points: 100 },
      { x: 69, y: 25, color: "yellow", points: 150 },
      { x: 50, y: 50, color: "blue", points: 200 },
    ]
    const id = setInterval(() => {
      setBallPos(p => {
        setBallVel(v => {
          let nx = p.x + v.x
          let ny = p.y + v.y
          let vx = v.x
          let vy = v.y + 0.18
          const adj = tilt - calibration
          vx += adj * 0.008
          if (nx < 3) { nx = 3; vx = Math.abs(vx) * 0.8 }
          if (nx > 97) { nx = 97; vx = -Math.abs(vx) * 0.8 }
          if (ny < 3) { ny = 3; vy = Math.abs(vy) * 0.8 }
          for (const b of bumpers) {
            const dx = nx - b.x, dy = ny - b.y
            const d = Math.sqrt(dx*dx + dy*dy)
            if (d < 10) {
              const nrm = d || 1
              vx = (dx/nrm) * 2.5; vy = (dy/nrm) * 2.5
              setScore(s => s + b.points)
            }
          }
          if (ny > 88 && nx > 15 && nx < 50 && leftFlip) { vy = -4; vx += 1.2 }
          if (ny > 88 && nx > 50 && nx < 85 && rightFlip) { vy = -4; vx -= 1.2 }
          if (ny > 98) {
            setRunning(false)
            setStatus("Drained")
            const finalScore = score
            const duration = Math.round((Date.now() - startTimeRef.current)/1000)
            database.put({ type: "session", score: finalScore, duration, createdAt: Date.now() })
            return { x: 0, y: 0 }
          }
          setTimeout(() => setBallPos({ x: nx, y: ny }), 0)
          return { x: vx, y: vy }
        })
        return p
      })
    }, 30)
    return () => clearInterval(id)
  }, [running, tilt, calibration, leftFlip, rightFlip, score, database])

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ec] text-[#15151e]",
    header: "px-4 py-3 flex items-center justify-between border-b-[3px] border-[#15151e] bg-white",
    title: "text-xl font-bold tracking-tight uppercase",
    badge: "text-xs px-2 py-1 border-[3px] border-[#15151e] rounded bg-[#3aa856] text-white font-bold uppercase",
    main: "px-4 py-4 max-w-[920px] mx-auto flex flex-col gap-4",
    table: "relative w-full aspect-[3/4] border-[3px] border-[#15151e] rounded bg-white overflow-hidden shadow-[4px_4px_0_#15151e]",
    tableInner: "absolute inset-0 flex items-center justify-center",
    bumper: "absolute w-12 h-12 rounded-full border-[3px] border-[#15151e] shadow-[3px_3px_0_#15151e]",
    ball: "absolute w-4 h-4 rounded-full bg-[#15151e] border-[2px] border-[#15151e] shadow-[2px_2px_0_#15151e]",
    flipperRow: "absolute bottom-4 left-0 right-0 flex justify-between px-6",
    flipper: "w-20 h-3 rounded border-[3px] border-[#15151e] bg-[#d83a2c] shadow-[2px_2px_0_#15151e]",
    hud: "flex items-center justify-between px-1",
    score: "font-mono text-3xl font-extrabold tracking-tight",
    controls: "grid grid-cols-2 gap-3",
    btn: "min-h-[44px] px-4 py-3 border-[3px] border-[#15151e] rounded font-bold uppercase tracking-wide text-sm bg-[#f2c84b] shadow-[3px_3px_0_#15151e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60",
    btnPrimary: "min-h-[52px] px-4 py-3 border-[3px] border-[#15151e] rounded font-extrabold uppercase tracking-wider bg-[#d83a2c] text-white shadow-[4px_4px_0_#15151e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60",
    section: "border-[3px] border-[#15151e] rounded p-4 flex flex-col gap-3 bg-white shadow-[4px_4px_0_#15151e]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b80] font-bold",
    sliderRow: "flex items-center gap-3",
    slider: "flex-1",
    list: "flex flex-col gap-2",
    row: "flex items-center justify-between px-3 py-2 border-[3px] border-[#15151e] rounded bg-[#f5f3ec]",
    rowScore: "font-mono font-extrabold text-lg",
    empty: "text-sm py-6 text-center text-[#6b6b80] uppercase tracking-wide",
    suggestBtn: "text-xs px-2 py-1 border-[3px] border-[#15151e] rounded uppercase tracking-wide bg-[#3a7bd8] text-white font-bold shadow-[2px_2px_0_#15151e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={{ textShadow: "3px 3px 0 #d83a2c" }}>Tilt Pinball</h1>
        <span className={c.badge}>{status}</span>
      </header>
      <main id="app" className={c.main}>
        <section id="playfield" className={c.section}>
          <div className={c.hud}>
            <span className={c.sectionLabel}>Score</span>
            <span className={c.score}>{score}</span>
          </div>
          <div className={c.table}>
            <div className={c.bumper} style={{ top: "20%", left: "25%", background: "#d83a2c" }} />
            <div className={c.bumper} style={{ top: "20%", right: "25%", background: "#f2c84b" }} />
            <div className={c.bumper} style={{ top: "45%", left: "44%", background: "#3a7bd8" }} />
            <div className={c.ball} style={{ top: `${ballPos.y}%`, left: `${ballPos.x}%`, transform: "translate(-50%, -50%)" }} />
            <div className={c.flipperRow}>
              <div className={c.flipper} style={{ transform: leftFlip ? "rotate(-25deg)" : "rotate(15deg)", transformOrigin: "left center", transition: "transform 0.08s" }} />
              <div className={c.flipper} style={{ transform: rightFlip ? "rotate(25deg)" : "rotate(-15deg)", transformOrigin: "right center", transition: "transform 0.08s" }} />
            </div>
          </div>
          <form onSubmit={handleLaunch} className={c.controls}>
            <button type="button" onClick={handleCalibrate} className={c.btn}>Calibrate Tilt</button>
            <button type="submit" className={c.btnPrimary} disabled={running}>{running ? "In Play" : "Launch Ball"}</button>
          </form>
        </section>

        <section id="settings" className={c.section}>
          <div className="flex items-center justify-between">
            <span className={c.sectionLabel}>Tilt Sensitivity</span>
            <button type="button" onClick={handleSuggest} disabled={suggestLoading} className={c.suggestBtn}>
              {suggestLoading ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline">
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : "Suggest"}
            </button>
          </div>
          <div className={c.sliderRow}>
            <span className="font-mono text-xs">LOW</span>
            <input type="range" min="1" max="10" value={sensitivity} onChange={handleSensitivity} className={c.slider} />
            <span className="font-mono text-xs">HIGH</span>
          </div>
          <p className="text-xs">Fallback keys: A (left flipper) · L (right flipper)</p>
        </section>

        <section id="history" className={c.section}>
          <span className={c.sectionLabel}>Last 5 Sessions</span>
          {sessions.length === 0 ? (
            <p className={c.empty}>No sessions yet — launch a ball.</p>
          ) : (
            <ul className={c.list}>
              {sessions.map((s, i) => (
                <li key={s._id} className={c.row}>
                  <span className="font-bold uppercase text-xs">Run #{sessions.length - i} · {s.duration}s</span>
                  <span className={c.rowScore}>{s.score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}