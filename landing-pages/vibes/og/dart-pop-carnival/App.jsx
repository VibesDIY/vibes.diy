import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function LeaderboardSection({ c, useLiveQuery }) {
  const { docs: scores } = useLiveQuery("score", { descending: true, limit: 10 })
  const filtered = scores.filter((s) => s.type === "score")
  return (
    <section id="leaderboard" className={c.section}>
      <h2 className={c.h2}>◆ Live Leaderboard ◆</h2>
      {filtered.length === 0 ? (
        <p className="text-center text-[#00f0ff] text-sm py-4">No scores yet — be the first!</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s, i) => (
            <li key={s._id} className="flex items-center gap-3 bg-[#2a0a2e] rounded-lg p-2 border border-[#f93c94]">
              <span className="font-['Orbitron',sans-serif] text-[#fcee0a] font-bold w-6 text-center">{i + 1}</span>
              {s.avatarUrl && <img src={s.avatarUrl} alt="" className="w-8 h-8 rounded-full border-2 border-[#00f0ff]" />}
              <span className="flex-1 text-white text-sm truncate">{s.displayName}</span>
              <span className="font-['Share_Tech_Mono',monospace] text-[#00f0ff] font-bold">{s.score}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("balloon-pop-arcade")
  const [darts, setDarts] = React.useState(10)
  const [score, setScore] = React.useState(0)
  const [popping, setPopping] = React.useState({})
  const [popped, setPopped] = React.useState({})
  const [savingScore, setSavingScore] = React.useState(false)

  const colors = [
    { hex: "#f93c94", points: 10 },
    { hex: "#00f0ff", points: 20 },
    { hex: "#fcee0a", points: 5 },
    { hex: "#ff5bad", points: 15 },
    { hex: "#9d4edd", points: 25 },
    { hex: "#06ffa5", points: 30 },
  ]
  const balloons = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ id: i, color: colors[i % colors.length] })),
    []
  )

  function popBalloon(b) {
    if (!can("write") || darts <= 0 || popped[b.id] || popping[b.id]) return
    setPopping((p) => ({ ...p, [b.id]: true }))
    setTimeout(() => {
      setPopped((p) => ({ ...p, [b.id]: true }))
      setPopping((p) => ({ ...p, [b.id]: false }))
    }, 300)
    setDarts((d) => d - 1)
    setScore((s) => s + b.color.points)
  }

  function newRound() {
    if (score > 0 && viewer) {
      setSavingScore(true)
      database
        .put({
          type: "score",
          score,
          userSlug: viewer.userSlug,
          displayName: viewer.displayName ?? viewer.userSlug,
          avatarUrl: viewer.avatarUrl,
          createdAt: Date.now(),
        })
        .finally(() => setSavingScore(false))
    }
    setDarts(10)
    setScore(0)
    setPopped({})
    setPopping({})
  }

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] font-['Rajdhani',sans-serif] pb-24",
    header: "bg-[#2a0a2e] text-[#fcee0a] px-4 py-4 sticky top-0 z-10 shadow-lg border-b-4 border-[#f93c94]",
    title: "font-['Orbitron',sans-serif] text-2xl font-bold tracking-wider text-center",
    tagline: "text-center text-[#00f0ff] text-sm font-['Share_Tech_Mono',monospace] mt-1",
    main: "max-w-md mx-auto p-3 space-y-4",
    section: "bg-[#4d1558]/90 backdrop-blur rounded-xl p-4 border-2 border-[#f93c94] shadow-xl text-[#ffffff]",
    h2: "font-['Orbitron',sans-serif] text-lg font-bold text-[#fcee0a] mb-3 tracking-wide",
    btn: "min-h-[44px] px-4 py-3 bg-[#f93c94] hover:bg-[#fcee0a] hover:text-[#2a0a2e] text-white font-bold rounded-lg border-2 border-[#fcee0a] transition shadow-md active:scale-95",
    statBox: "bg-[#2a0a2e] rounded-lg p-3 border-2 border-[#00f0ff] text-center",
    statLabel: "text-[#00f0ff] text-xs font-['Share_Tech_Mono',monospace] uppercase",
    statValue: "font-['Orbitron',sans-serif] text-2xl font-bold text-[#fcee0a]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>◆ BALLOON POP ◆</h1>
        <p className={c.tagline}>Carnival Dart Arcade</p>
      </header>
      <main id="app" className={c.main}>
        <section id="round-tracker" className={c.section}>
          <h2 className={c.h2}>Your Round</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={c.statBox}>
              <div className={c.statLabel}>Darts Left</div>
              <div className={c.statValue}>{darts}</div>
            </div>
            <div className={c.statBox}>
              <div className={c.statLabel}>Score</div>
              <div className={c.statValue}>{score}</div>
            </div>
          </div>
          {can("write") ? (
            <button onClick={newRound} disabled={savingScore} className={c.btn + " w-full flex items-center justify-center gap-2"}>
              {savingScore && (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              )}
              {darts === 0 ? "Save & New Round" : "New Round"}
            </button>
          ) : (
            <p className="text-center text-[#00f0ff] text-sm">Spectator mode — watch scores below</p>
          )}
        </section>
        <section id="balloon-grid" className={c.section}>
          <h2 className={c.h2}>The Wall</h2>
          <div className="grid grid-cols-4 gap-2">
            {balloons.map((b) => (
              <button
                key={b.id}
                onClick={() => popBalloon(b)}
                disabled={!can("write") || darts <= 0 || popped[b.id]}
                className="aspect-square rounded-full border-2 border-white/40 shadow-lg transition-all active:scale-90 relative flex items-center justify-center"
                style={{
                  background: popped[b.id] ? "transparent" : `radial-gradient(circle at 30% 30%, ${b.color.hex}ff, ${b.color.hex}aa)`,
                  transform: popping[b.id] ? "scale(1.5)" : popped[b.id] ? "scale(0)" : "scale(1)",
                  opacity: popping[b.id] ? 0 : popped[b.id] ? 0 : 1,
                  transition: "transform 0.3s, opacity 0.3s",
                  borderColor: popped[b.id] ? "transparent" : undefined,
                }}
                aria-label={`Balloon worth ${b.color.points} points`}
              >
                {!popped[b.id] && !popping[b.id] && (
                  <span className="text-white font-bold font-['Share_Tech_Mono',monospace] text-xs drop-shadow">{b.color.points}</span>
                )}
              </button>
            ))}
          </div>
          {darts === 0 && (
            <p className="text-center text-[#fcee0a] mt-3 font-['Orbitron',sans-serif] text-sm">◆ Out of darts! Start a new round ◆</p>
          )}
        </section>
        <LeaderboardSection c={c} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  )
}