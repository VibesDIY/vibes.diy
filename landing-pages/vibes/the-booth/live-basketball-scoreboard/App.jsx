import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Scoreboard() {
  return <section id="scoreboard" />
}

function Controls({ game, isOwner, database }) {
  if (!isOwner) return null
  const btn = "min-h-[48px] px-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] font-bold text-[var(--text-primary)] active:bg-[var(--accent)] active:text-white"
  function bump(side, pts) {
    const key = side === "home" ? "homeScore" : "awayScore"
    database.put({ ...game, [key]: Math.max(0, game[key] + pts) })
  }
  function foul(side, d) {
    const key = side === "home" ? "homeFouls" : "awayFouls"
    database.put({ ...game, [key]: Math.max(0, game[key] + d) })
  }
  function Row({ side, label }) {
    return (
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">{label}</div>
        <div className="grid grid-cols-3 gap-2">
          <button className={btn} onClick={() => bump(side, 1)}>+1</button>
          <button className={btn} onClick={() => bump(side, 2)}>+2</button>
          <button className={btn} onClick={() => bump(side, 3)}>+3</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button className={btn} onClick={() => bump(side, -1)}>−1</button>
          <button className={btn} onClick={() => foul(side, 1)}>+ Foul</button>
          <button className={btn} onClick={() => foul(side, -1)}>− Foul</button>
        </div>
      </div>
    )
  }
  return (
    <section id="controls" className="grid grid-cols-2 gap-3">
      <Row side="home" label={game.homeName} />
      <Row side="away" label={game.awayName} />
    </section>
  )
}

function GameClock({ game, isOwner, database }) {
  const [, force] = React.useState(0)
  React.useEffect(() => {
    if (!game.clockRunning) return
    const id = setInterval(() => force(n => n + 1), 100)
    return () => clearInterval(id)
  }, [game.clockRunning])

  const remaining = game.clockRunning && game.clockStartedAt
    ? Math.max(0, game.clockMs - (Date.now() - game.clockStartedAt))
    : game.clockMs
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0")
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")
  const tenths = String(Math.floor((remaining % 1000) / 100))

  function toggle() {
    if (game.clockRunning) {
      const elapsed = Date.now() - game.clockStartedAt
      database.put({ ...game, clockRunning: false, clockMs: Math.max(0, game.clockMs - elapsed), clockStartedAt: null })
    } else {
      database.put({ ...game, clockRunning: true, clockStartedAt: Date.now() })
    }
  }
  function reset() {
    database.put({ ...game, clockRunning: false, clockMs: 12 * 60 * 1000, clockStartedAt: null })
  }

  const btn = "min-h-[44px] px-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] font-bold uppercase text-sm tracking-wider"

  return (
    <section id="clock" className="space-y-2">
      <div className="bg-[var(--screen-bg)] rounded-[var(--radius)] py-4 px-2 border border-[var(--border)]">
        <div className="text-center font-[var(--font-family-mono)] text-[var(--led-green)] text-6xl font-bold tabular-nums leading-none">
          {mm}:{ss}<span className="text-3xl">.{tenths}</span>
        </div>
      </div>
      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <button className={`${btn} ${game.clockRunning ? "bg-[var(--accent)] text-white" : ""}`} onClick={toggle}>
            {game.clockRunning ? "Stop" : "Start"}
          </button>
          <button className={btn} onClick={reset}>Reset</button>
        </div>
      )}
    </section>
  )
}

function QuarterPicker({ game, isOwner, database }) {
  return (
    <section id="quarter" className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map(q => {
        const active = game.quarter === q
        return (
          <button
            key={q}
            disabled={!isOwner}
            onClick={() => database.put({ ...game, quarter: q })}
            className={`min-h-[44px] rounded-[var(--radius)] border border-[var(--border)] font-bold uppercase text-sm tracking-wider ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-primary)]"}`}
          >
            Q{q}
          </button>
        )
      })}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useDocument, database, callAI } = useFireproof("scoreboard")
  const { doc: game } = useDocument({
    _id: "game",
    type: "game",
    homeName: "HOME",
    awayName: "AWAY",
    homeScore: 0,
    awayScore: 0,
    homeFouls: 0,
    awayFouls: 0,
    quarter: 1,
    clockMs: 12 * 60 * 1000,
    clockRunning: false,
    clockStartedAt: null,
  })

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "sticky top-0 z-10 bg-[var(--surface)] backdrop-blur border-b border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-bold tracking-tight uppercase",
    main: "max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24",
  }

  return (
    <>
      <style>{`
        :root {
          --background: oklch(0.93 0.003 265);
          --surface: rgba(255,255,255,0.85);
          --primary: oklch(0.58 0.20 35);
          --text-primary: rgba(20,20,20,0.92);
          --text-secondary: rgba(20,20,20,0.5);
          --border: rgba(20,20,20,0.14);
          --accent: oklch(0.58 0.20 35);
          --font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
          --radius: 0.5rem;
          --spacing: 1rem;
          --screen-bg: oklch(0.07 0 0);
          --led-green: oklch(0.85 0.30 140);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --background: oklch(0.07 0.003 265);
            --surface: rgba(255,255,255,0.04);
            --text-primary: rgba(255,255,255,0.92);
            --text-secondary: rgba(255,255,255,0.55);
            --border: rgba(255,255,255,0.18);
            --primary: oklch(0.42 0.20 35);
            --accent: oklch(0.42 0.20 35);
          }
        }
      `}</style>
      <div className={c.page}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>Hoops Live</h1>
          <ViewerTag />
        </header>
        <main id="app" className={c.main}>
          <Scoreboard game={game} isOwner={isOwner} database={database} callAI={callAI} />
          <GameClock game={game} isOwner={isOwner} database={database} />
          <QuarterPicker game={game} isOwner={isOwner} database={database} />
          <Controls game={game} isOwner={isOwner} database={database} />
        </main>
      </div>
    </>
  )
}