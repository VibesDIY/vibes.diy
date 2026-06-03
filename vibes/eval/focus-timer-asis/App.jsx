import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Header({ ViewerTag }) {
  return (
    <header id="app-header" className="border-b border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[oklch(0.93_0.005_264)] text-xl tracking-wider" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>FOCUSSTACK</h1>
          <p className="text-[oklch(0.63_0.008_264)] text-xs">parallel pomodoro engine</p>
        </div>
        <ViewerTag />
      </div>
    </header>
  )
}

function TimerCreator({ database }) {
  const [name, setName] = React.useState("")
  const [workMin, setWorkMin] = React.useState(25)
  const [breakMin, setBreakMin] = React.useState(5)
  const [suggesting, setSuggesting] = React.useState(false)

  const create = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const workMs = Math.max(1, workMin) * 60000
    const breakMs = Math.max(1, breakMin) * 60000
    database.put({
      type: "timer",
      name: name.trim(),
      workMs,
      breakMs,
      phase: "work",
      remainingMs: workMs,
      endsAt: 0,
      running: false,
      createdAt: Date.now(),
    })
    setName("")
  }

  const suggest = async () => {
    setSuggesting(true)
    try {
      const res = await callAI("Suggest one creative Pomodoro timer name and durations for a focused work session. Be specific and energetic.", {
        schema: { properties: { name: { type: "string" }, workMinutes: { type: "number" }, breakMinutes: { type: "number" } } }
      })
      const data = JSON.parse(res)
      setName(data.name || "")
      if (data.workMinutes) setWorkMin(data.workMinutes)
      if (data.breakMinutes) setBreakMin(data.breakMinutes)
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <section id="timer-creator" className="rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[oklch(0.63_0.008_264)] text-xs uppercase tracking-widest">// new timer</h2>
        <button type="button" onClick={suggest} disabled={suggesting} className="text-xs text-[oklch(0.53_0.22_25)] flex items-center gap-1 disabled:opacity-50">
          {suggesting ? (
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          )}
          suggest
        </button>
      </div>
      <form onSubmit={create} className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="timer name" className="w-full min-h-[44px] px-3 rounded bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] placeholder:text-[oklch(0.63_0.008_264)]" />
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-xs text-[oklch(0.63_0.008_264)] mb-1">work (min)</span>
            <input type="number" min="1" value={workMin} onChange={e => setWorkMin(Number(e.target.value))} className="w-full min-h-[44px] px-3 rounded bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] tabular-nums" />
          </label>
          <label className="flex-1">
            <span className="block text-xs text-[oklch(0.63_0.008_264)] mb-1">break (min)</span>
            <input type="number" min="1" value={breakMin} onChange={e => setBreakMin(Number(e.target.value))} className="w-full min-h-[44px] px-3 rounded bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] tabular-nums" />
          </label>
        </div>
        <button type="submit" className="w-full min-h-[44px] rounded bg-[oklch(0.53_0.22_25)] text-white tracking-wider" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>+ ADD TIMER</button>
      </form>
    </section>
  )
}
  return (
    <section id="timer-creator" className="rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] p-4">
      <h2 className="text-[oklch(0.63_0.008_264)] text-xs uppercase tracking-widest mb-3">// new timer</h2>
      {/* form lands here */}
    </section>
  )
}

function StatsDashboard({ sessions, timers }) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const today = sessions.filter(s => s.completedAt >= startOfDay.getTime())
  const totalFocusMs = today.reduce((a, s) => a + (s.durationMs || 0), 0)
  const totalBreakMs = timers.reduce((a, t) => {
    const completed = today.filter(s => s.timerId === t._id).length
    return a + completed * (t.breakMs || 0)
  }, 0)
  const fmt = ms => {
    const m = Math.round(ms / 60000)
    if (m < 60) return `${m}m`
    return `${Math.floor(m/60)}h ${m%60}m`
  }

  const stats = [
    { label: "completed", value: today.length, color: "oklch(0.53 0.22 25)" },
    { label: "focus time", value: fmt(totalFocusMs), color: "oklch(0.93 0.005 264)" },
    { label: "break time", value: fmt(totalBreakMs), color: "oklch(0.63 0.008 264)" },
  ]

  return (
    <section id="stats-dashboard" className="rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] p-4">
      <h2 className="text-[oklch(0.63_0.008_264)] text-xs uppercase tracking-widest mb-3">// today's stats</h2>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded bg-[oklch(0.20_0.005_264)] p-3 text-center">
            <div className="text-2xl tabular-nums" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-[oklch(0.63_0.008_264)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CoachInsights({ database, sessions, insights, isOwner }) {
  const [loading, setLoading] = React.useState(false)

  const requestInsight = async () => {
    setLoading(true)
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const today = sessions.filter(s => s.completedAt >= startOfDay.getTime())
      const summary = today.map(s => `${s.timerName}: ${Math.round(s.durationMs/60000)}m at ${new Date(s.completedAt).toLocaleTimeString()}`).join("; ") || "no sessions yet today"
      const res = await callAI(`As a productivity coach, analyze today's pomodoro sessions and respond. Sessions: ${summary}. Give a brief motivational insight and suggest a next-session focus duration in minutes.`, {
        schema: { properties: { insight: { type: "string" }, suggestedMinutes: { type: "number" } } }
      })
      const data = JSON.parse(res)
      await database.put({
        type: "insight",
        insight: data.insight,
        suggestedMinutes: data.suggestedMinutes,
        createdAt: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  const recent = insights.slice(0, 3)

  return (
    <section id="coach-insights" className="rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[oklch(0.63_0.008_264)] text-xs uppercase tracking-widest">// ai coach</h2>
        {isOwner && (
          <button onClick={requestInsight} disabled={loading} className="text-xs text-[oklch(0.53_0.22_25)] flex items-center gap-1 disabled:opacity-50">
            {loading ? (
              <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg> analyzing...</>
            ) : "get insight"}
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="text-[oklch(0.63_0.008_264)] text-sm">no insights yet{isOwner ? " — tap get insight" : ""}</div>
      ) : (
        <ul className="space-y-2">
          {recent.map(i => (
            <li key={i._id} className="rounded bg-[oklch(0.20_0.005_264)] p-3 border-l-2 border-[oklch(0.53_0.22_25)]">
              <p className="text-[oklch(0.93_0.005_264)] text-sm leading-relaxed">{i.insight}</p>
              {i.suggestedMinutes && <p className="text-xs text-[oklch(0.53_0.22_25)] mt-2 tracking-wider">▸ next session: {i.suggestedMinutes}m</p>}
              <p className="text-[10px] text-[oklch(0.63_0.008_264)] mt-1">{new Date(i.createdAt).toLocaleTimeString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60).toString().padStart(2, "0")
  const s = (total % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

function computeRemaining(timer, now) {
  if (!timer.running) return timer.remainingMs
  return Math.max(0, timer.endsAt - now)
}

function TimerCard({ timer, isOwner, database, viewer }) {
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (!timer.running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [timer.running])

  const remaining = computeRemaining(timer, now)
  const phase = timer.phase || "work"
  const phaseLabel = phase === "work" ? "FOCUS" : "BREAK"
  const phaseColor = phase === "work" ? "oklch(0.53 0.22 25)" : "oklch(0.63 0.008 264)"

  React.useEffect(() => {
    if (!timer.running || !isOwner) return
    if (remaining > 0) return
    // phase complete
    const nextPhase = phase === "work" ? "break" : "work"
    const nextDuration = nextPhase === "work" ? timer.workMs : timer.breakMs
    const update = {
      ...timer,
      phase: nextPhase,
      remainingMs: nextDuration,
      endsAt: Date.now() + nextDuration,
      running: true,
    }
    database.put(update)
    if (phase === "work") {
      database.put({
        type: "session",
        timerId: timer._id,
        timerName: timer.name,
        durationMs: timer.workMs,
        completedAt: Date.now(),
      })
    }
  }, [remaining, timer.running, isOwner])

  const start = () => database.put({ ...timer, running: true, endsAt: Date.now() + timer.remainingMs })
  const pause = () => database.put({ ...timer, running: false, remainingMs: remaining })
  const reset = () => database.put({ ...timer, running: false, phase: "work", remainingMs: timer.workMs })
  const del = () => database.del(timer._id)

  return (
    <li className="rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)] p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[oklch(0.93_0.005_264)] text-base" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600, letterSpacing: "0.05em" }}>{timer.name.toUpperCase()}</div>
          <div className="text-xs" style={{ color: phaseColor }}>{phaseLabel} · {Math.round(timer.workMs/60000)}m / {Math.round(timer.breakMs/60000)}m</div>
        </div>
        <div className="text-3xl tabular-nums" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, color: phaseColor }}>{formatTime(remaining)}</div>
      </div>
      <div className="h-1 bg-[oklch(0.20_0.005_264)] rounded overflow-hidden mb-3">
        <div className="h-full transition-all" style={{ width: `${100 - (remaining / (phase === "work" ? timer.workMs : timer.breakMs)) * 100}%`, background: phaseColor }} />
      </div>
      {isOwner && (
        <div className="flex gap-2">
          {!timer.running ? (
            <button onClick={start} className="flex-1 min-h-[44px] rounded bg-[oklch(0.53_0.22_25)] text-white text-sm tracking-wider" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>START</button>
          ) : (
            <button onClick={pause} className="flex-1 min-h-[44px] rounded bg-[oklch(0.19_0.003_264)] border border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] text-sm tracking-wider" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>PAUSE</button>
          )}
          <button onClick={reset} className="min-h-[44px] px-4 rounded border border-[oklch(0.24_0.003_264)] text-[oklch(0.63_0.008_264)] text-sm tracking-wider" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>RESET</button>
          <button onClick={del} aria-label="Delete" className="min-h-[44px] w-11 rounded border border-[oklch(0.24_0.003_264)] text-[oklch(0.63_0.008_264)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </div>
      )}
    </li>
  )
}

function TimerStack({ database, timers, isOwner, viewer }) {
  return (
    <section id="timer-stack" className="space-y-3">
      <h2 className="text-[oklch(0.63_0.008_264)] text-xs uppercase tracking-widest">// active timers</h2>
      {timers.length === 0 ? (
        <div className="rounded border border-dashed border-[oklch(0.24_0.003_264)] p-6 text-center text-[oklch(0.63_0.008_264)] text-sm">no timers yet{isOwner ? " — create one below" : ""}</div>
      ) : (
        <ul className="space-y-3">
          {timers.map(t => <TimerCard key={t._id} timer={t} isOwner={isOwner} database={database} viewer={viewer} />)}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("focusstack")
  const { docs: timers } = useLiveQuery("type", { key: "timer" })
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true })
  const { docs: insights } = useLiveQuery("type", { key: "insight", descending: true })

  if (isViewerPending) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Rajdhani:wght@500;600;700&display=optional');
        :root { --accent: oklch(0.53 0.22 25); --text: oklch(0.93 0.005 264); --muted: oklch(0.63 0.008 264); --card-bg: oklch(0.16 0.003 264); --border: oklch(0.24 0.003 264); }
        body { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      `}</style>
      <div className="min-h-screen bg-[oklch(0.10_0.003_264)] text-[oklch(0.93_0.005_264)]">
        <Header ViewerTag={ViewerTag} />
        <main id="app" className="max-w-3xl mx-auto px-4 py-5 space-y-4 pb-24">
          <TimerStack database={database} timers={timers} isOwner={isOwner} viewer={viewer} />
          {isOwner && <TimerCreator database={database} />}
          <StatsDashboard sessions={sessions} timers={timers} />
          <CoachInsights database={database} sessions={sessions} insights={insights} isOwner={isOwner} />
        </main>
      </div>
    </>
  )
}