import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("mole-smash")

  const [playing, setPlaying] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState(30)
  const [hits, setHits] = React.useState(0)
  const [misses, setMisses] = React.useState(0)
  const [activeMole, setActiveMole] = React.useState(-1)
  const [finalScore, setFinalScore] = React.useState(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!playing) return
    if (timeLeft <= 0) {
      setPlaying(false)
      setFinalScore({ hits, misses, score: hits * 10 })
      setActiveMole(-1)
      return
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(t)
  }, [playing, timeLeft, hits, misses])

  React.useEffect(() => {
    if (!playing) return
    const elapsed = 30 - timeLeft
    const speed = Math.max(400, 1100 - elapsed * 25)
    const t = setTimeout(() => {
      setActiveMole(Math.floor(Math.random() * 9))
    }, speed)
    return () => clearTimeout(t)
  }, [playing, activeMole, timeLeft])

  function startRound() {
    setHits(0)
    setMisses(0)
    setTimeLeft(30)
    setFinalScore(null)
    setActiveMole(-1)
    setPlaying(true)
  }

  function whack(i) {
    if (!playing) return
    if (i === activeMole) {
      setHits(h => h + 1)
      setActiveMole(-1)
    } else {
      setMisses(m => m + 1)
    }
  }

  async function submitScore() {
    if (!finalScore || !can("write")) return
    setSubmitting(true)
    try {
      await database.put({
        type: "score",
        score: finalScore.score,
        hits: finalScore.hits,
        misses: finalScore.misses,
        playerSlug: viewer?.userSlug || "anon",
        playerName: viewer?.displayName || viewer?.userSlug || "Anonymous",
        playerAvatar: viewer?.avatarUrl,
        createdAt: Date.now(),
      })
      setFinalScore(null)
    } finally {
      setSubmitting(false)
    }
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1530] font-[Space_Grotesk,sans-serif]",
    header: "bg-[#1a1530] text-[#f5f1e8] border-b-4 border-[#e63946] px-4 py-4 sticky top-0 z-10",
    headerInner: "max-w-2xl mx-auto flex items-center justify-between gap-3",
    title: "text-2xl md:text-3xl font-bold tracking-tight",
    tagline: "text-xs md:text-sm text-[#e8c547] font-mono",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-white border-4 border-[#1a1530] rounded p-5 shadow-[4px_4px_0_#1a1530]",
    sectionTitle: "text-xl font-bold mb-4 text-[#1a1530] flex items-center gap-2",
    btn: "bg-[#e63946] text-white border-2 border-[#1a1530] px-6 py-3 rounded font-bold min-h-[44px] shadow-[2px_2px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnAlt: "bg-[#e8c547] text-[#1a1530] border-2 border-[#1a1530] px-4 py-2 rounded font-bold min-h-[44px] shadow-[2px_2px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    grid: "grid grid-cols-3 gap-3 aspect-square",
    hole: "bg-[#3d2817] border-4 border-[#1a1530] rounded-full flex items-center justify-center relative overflow-hidden",
    mole: "absolute inset-2 bg-[#8b5a3c] border-2 border-[#1a1530] rounded-full flex items-center justify-center text-3xl font-bold transition-transform",
    stat: "bg-[#1a1530] text-[#e8c547] px-3 py-2 rounded font-mono text-sm font-bold",
    leaderRow: "flex items-center justify-between gap-3 py-2 border-b-2 border-[#1a1530]/10 last:border-0",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <h1 className={c.title}>MOLE SMASH</h1>
            <p className={c.tagline}>// carnival arcade</p>
          </div>
          <ViewerTag />
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="game" className={c.section}>
          <h2 className={c.sectionTitle}>Arena</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={c.stat}>TIME: {timeLeft}s</span>
            <span className={c.stat}>HITS: {hits}</span>
            <span className={c.stat}>MISSES: {misses}</span>
            <span className={c.stat}>SCORE: {hits * 10}</span>
          </div>
          <div className={c.grid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <button
                key={i}
                onClick={() => whack(i)}
                disabled={!playing}
                className={c.hole}
                aria-label={`hole ${i}`}
              >
                {i === activeMole && playing && (
                  <div className={c.mole}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1a1530" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" fill="#c89060" />
                      <circle cx="9" cy="10" r="1.2" fill="#1a1530" />
                      <circle cx="15" cy="10" r="1.2" fill="#1a1530" />
                      <path d="M9 15 Q12 17 15 15" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {can("write") ? (
            <button onClick={startRound} disabled={playing} className={`${c.btn} w-full mt-4`}>
              {playing ? `PLAYING... ${timeLeft}s` : "START ROUND"}
            </button>
          ) : (
            <p className="mt-4 text-sm text-[#1a1530]/60 text-center font-mono">// read-only view — contact owner for access</p>
          )}
        </section>

        <section id="round-summary" className={c.section}>
          <h2 className={c.sectionTitle}>Round Summary</h2>
          {finalScore ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#f5f1e8] border-2 border-[#1a1530] rounded p-3">
                  <div className="text-xs font-mono text-[#1a1530]/60">HITS</div>
                  <div className="text-2xl font-bold">{finalScore.hits}</div>
                </div>
                <div className="bg-[#f5f1e8] border-2 border-[#1a1530] rounded p-3">
                  <div className="text-xs font-mono text-[#1a1530]/60">MISSES</div>
                  <div className="text-2xl font-bold">{finalScore.misses}</div>
                </div>
                <div className="bg-[#e8c547] border-2 border-[#1a1530] rounded p-3">
                  <div className="text-xs font-mono text-[#1a1530]/80">SCORE</div>
                  <div className="text-2xl font-bold">{finalScore.score}</div>
                </div>
              </div>
              {can("write") && (
                <button onClick={submitScore} disabled={submitting} className={`${c.btn} w-full`}>
                  {submitting ? (
                    <svg className="animate-spin inline" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 2 A10 10 0 0 1 22 12" />
                    </svg>
                  ) : "SUBMIT TO LEADERBOARD"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#1a1530]/60 font-mono">// finish a round to see your score</p>
          )}
        </section>

        <section id="leaderboard" className={c.section}>
          <h2 className={c.sectionTitle}>High Scores</h2>
          <LeaderboardList useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}

function LeaderboardList({ useLiveQuery }) {
  const { docs } = useLiveQuery("score", { descending: true, limit: 10 })
  const scores = docs.filter(d => d.type === "score")
  if (scores.length === 0) {
    return <p className="text-sm text-[#1a1530]/60 font-mono">// no scores yet — be the first!</p>
  }
  return (
    <ol className="space-y-1">
      {scores.map((s, i) => (
        <li key={s._id} className="flex items-center justify-between gap-3 py-2 border-b-2 border-[#1a1530]/10 last:border-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-bold text-[#e63946] w-6">{i + 1}.</span>
            {s.playerAvatar && <img src={s.playerAvatar} alt="" className="w-7 h-7 rounded-full border-2 border-[#1a1530]" />}
            <span className="truncate font-bold">{s.playerName}</span>
          </div>
          <span className="font-mono font-bold text-lg">{s.score}</span>
        </li>
      ))}
    </ol>
  )
}