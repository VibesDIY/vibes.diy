import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, database } = useFireproof("pinball-rounds")
  const { docs: rounds } = useLiveQuery("score", { descending: true, limit: 10 })

  const [score, setScore] = React.useState(0)
  const [ballsLeft, setBallsLeft] = React.useState(3)
  const [mult, setMult] = React.useState(1)
  const [playing, setPlaying] = React.useState(false)
  const [bumperHits, setBumperHits] = React.useState(0)
  const [name, setName] = React.useState("")
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [ballPositions, setBallPositions] = React.useState([
    { top: "30%", left: "30%" },
    { top: "50%", left: "50%" },
    { top: "60%", left: "40%" },
  ])

  function handleLaunch(e) {
    e.preventDefault()
    setScore(0)
    setBallsLeft(3)
    setMult(1)
    setBumperHits(0)
    setPlaying(true)
  }
  function handleBumperHit() {
    if (!playing) return
    setScore(s => s + 100 * mult)
    setBumperHits(h => h + 1)
  }
  function handleTargetHit() {
    if (!playing) return
    setMult(3)
    setScore(s => s + 500)
    setTimeout(() => setMult(1), 3000)
  }
  function handleDrain() {
    if (!playing) return
    setBallsLeft(b => {
      const next = b - 1
      if (next <= 0) setPlaying(false)
      return Math.max(0, next)
    })
  }
  function handleFlipLeft() { handleBumperHit() }
  function handleFlipRight() { handleBumperHit() }

  async function handleSuggestName() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Generate a single arcade-style player handle, punk/retro vibe, max 12 chars.", {
        schema: { properties: { handle: { type: "string" } } }
      })
      const data = JSON.parse(res)
      setName(data.handle || "")
    } finally {
      setIsSuggesting(false)
    }
  }

  async function handleSaveRound(e) {
    e.preventDefault()
    if (!name.trim() || playing) return
    setIsSaving(true)
    try {
      await database.put({
        name: name.trim(),
        score,
        bumperHits,
        createdAt: Date.now(),
      })
      setName("")
    } finally {
      setIsSaving(false)
    }
  }

  const c = {
    page: "min-h-screen flex flex-col bg-[#f5f3ee] text-[#1a1a2e]",
    header: "px-4 py-4 border-b-[3px] border-[#1a1a2e] bg-white flex items-center justify-between gap-3",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    title: "text-lg font-bold uppercase tracking-tight",
    main: "flex-1 px-4 py-4 flex flex-col gap-4 max-w-[920px] w-full mx-auto",
    hud: "grid grid-cols-3 gap-2",
    hudCard: "border-[3px] border-[#1a1a2e] bg-white p-3 flex flex-col gap-1 shadow-[4px_4px_0px_#1a1a2e]",
    hudLabel: "text-[0.6rem] uppercase tracking-widest text-[#666680] font-bold",
    hudValue: "text-2xl font-bold tabular-nums font-mono",
    playfield: "border-[3px] border-[#1a1a2e] bg-[#2a4d8f] aspect-[3/4] relative overflow-hidden shadow-[4px_4px_0px_#1a1a2e]",
    bumper: "absolute w-12 h-12 border-[3px] border-[#1a1a2e] bg-[#e8c547] rounded-full flex items-center justify-center text-xs font-bold text-[#1a1a2e]",
    target: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-10 border-[3px] border-[#1a1a2e] bg-[#d63828] text-white flex items-center justify-center text-[0.65rem] uppercase tracking-widest font-bold",
    ball: "absolute w-5 h-5 border-[3px] border-[#1a1a2e] bg-white rounded-full shadow-[2px_2px_0px_#1a1a2e]",
    flipperRow: "grid grid-cols-2 gap-3",
    flipper: "border-[3px] border-[#1a1a2e] bg-[#3aa55c] text-white py-6 font-bold uppercase tracking-widest text-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_#1a1a2e] min-h-[60px]",
    launchBar: "flex gap-3",
    launchBtn: "flex-1 border-[3px] border-[#1a1a2e] bg-[#d63828] text-white py-4 font-bold uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_#1a1a2e] disabled:opacity-50",
    saveSection: "border-[3px] border-[#1a1a2e] bg-white p-4 flex flex-col gap-3 shadow-[4px_4px_0px_#1a1a2e]",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest font-bold text-[#666680]",
    inputRow: "flex gap-2",
    input: "flex-1 border-[3px] border-[#1a1a2e] bg-white px-3 py-3 text-sm focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0px_#1a1a2e] transition-transform",
    suggestBtn: "border-[3px] border-[#1a1a2e] bg-[#2a4d8f] text-white px-3 py-3 text-xs uppercase font-bold tracking-widest active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[3px_3px_0px_#1a1a2e] disabled:opacity-50",
    saveBtn: "border-[3px] border-[#1a1a2e] bg-[#e8c547] text-[#1a1a2e] py-3 font-bold uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_#1a1a2e] disabled:opacity-50",
    leaderboard: "border-[3px] border-[#1a1a2e] bg-white p-4 flex flex-col gap-2 shadow-[4px_4px_0px_#1a1a2e]",
    boardTitle: "text-sm font-bold uppercase tracking-tight",
    row: "border-[3px] border-[#1a1a2e] bg-[#f5f3ee] px-3 py-2 flex items-center justify-between text-sm",
    rank: "font-bold w-6",
    name: "flex-1 px-2 truncate",
    score: "font-bold tabular-nums font-mono text-[#d63828]",
    empty: "text-xs italic py-4 text-center text-[#666680]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#d63828] border-[#1a1a2e]`}></span>
            <span className={`${c.dot} bg-[#e8c547] border-[#1a1a2e]`}></span>
            <span className={`${c.dot} bg-[#3aa55c] border-[#1a1a2e]`}></span>
          </div>
          <h1 className={c.title}>Triple Ball Bash</h1>
        </div>
        <span className={c.sectionLabel}>v1</span>
      </header>

      <main id="app" className={c.main}>
        <section id="hud" className={c.hud}>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Score</span>
            <span className={c.hudValue}>{score}</span>
          </div>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Balls</span>
            <span className={c.hudValue}>{ballsLeft}</span>
          </div>
          <div className={c.hudCard}>
            <span className={c.hudLabel}>Mult</span>
            <span className={c.hudValue}>{mult}x</span>
          </div>
        </section>

        <section id="playfield" className={c.playfield}>
          <div className="absolute top-0 left-0 right-0 h-[6px] flex">
            <div className="flex-1 bg-[#d63828]"></div>
            <div className="flex-1 bg-[#e8c547]"></div>
            <div className="flex-1 bg-[#3aa55c]"></div>
            <div className="flex-1 bg-[#2a4d8f]"></div>
          </div>
          <button onClick={handleBumperHit} className={c.bumper} style={{ top: "15%", left: "20%" }}>B1</button>
          <button onClick={handleBumperHit} className={c.bumper} style={{ top: "15%", right: "20%" }}>B2</button>
          <button onClick={handleBumperHit} className={c.bumper} style={{ top: "40%", left: "10%" }}>B3</button>
          <button onClick={handleBumperHit} className={c.bumper} style={{ top: "40%", right: "10%" }}>B4</button>
          <button onClick={handleTargetHit} className={c.target}>Target</button>
          {ballPositions.slice(0, ballsLeft).map((pos, i) => (
            <div key={i} className={c.ball} style={pos}></div>
          ))}
          <button onClick={handleDrain} className="absolute bottom-0 left-0 right-0 h-8 border-t-[3px] border-[#1a1a2e] bg-[#1a1a2e] text-white text-[0.6rem] uppercase tracking-widest font-bold">Drain</button>
        </section>

        <section id="flippers" className={c.flipperRow}>
          <button className={c.flipper} onClick={handleFlipLeft}>Left</button>
          <button className={c.flipper} onClick={handleFlipRight}>Right</button>
        </section>

        <section id="launch" className={c.launchBar}>
          <button className={c.launchBtn} onClick={handleLaunch} disabled={playing}>
            {playing ? "Round In Play" : "Launch Round"}
          </button>
        </section>

        <section id="save" className={c.saveSection}>
          <span className={c.sectionLabel}>Save Round</span>
          <form onSubmit={handleSaveRound} className={c.inputRow}>
            <input className={c.input} placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" className={c.suggestBtn} onClick={handleSuggestName} disabled={isSuggesting}>
              {isSuggesting ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
              ) : "AI"}
            </button>
          </form>
          <button type="button" className={c.saveBtn} onClick={handleSaveRound} disabled={isSaving || playing || !name.trim()}>
            {isSaving ? "Saving..." : playing ? "Finish Round First" : `Save Round (${score})`}
          </button>
        </section>

        <section id="leaderboard" className={c.leaderboard}>
          <h2 className={c.boardTitle}>Leaderboard</h2>
          {rounds.length === 0 && <p className={c.empty}>Play a round to add scores</p>}
          {rounds.map((r, i) => (
            <div key={r._id} className={c.row}>
              <span className={c.rank}>{i + 1}</span>
              <span className={c.name}>{r.name}</span>
              <span className={c.score}>{r.score}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}