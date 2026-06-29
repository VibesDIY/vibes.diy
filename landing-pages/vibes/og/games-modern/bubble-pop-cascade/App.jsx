import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("pop-cascade")
  const [angle, setAngle] = React.useState(90)
  const [power, setPower] = React.useState("Medium")
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState([])

  const { doc: state, merge: mergeState } = useDocument({
    _id: "current-run",
    type: "run-state",
    score: 0,
    level: 1,
    combo: 1,
    shots: 20,
    handle: "",
  })
  const handle = state.handle || ""
  const setHandle = (v) => mergeState({ handle: v })

  const { docs: scores } = useLiveQuery("type", { key: "score", descending: true, limit: 10 })
  const ranked = [...scores].sort((a, b) => (b.score || 0) - (a.score || 0))

  function handleFire(e) { e.preventDefault() }
  function handleNewRun() {
    const nextLevel = (state.level || 1) + 0
    mergeState({ score: 0, level: 1, combo: 1, shots: 20 })
  }
  async function handleSuggestNames() {
    setIsSuggesting(true)
    try {
      const raw = await callAI("Generate 5 short, punchy arcade-style player handles. Uppercase, max 12 chars each, no spaces.", {
        schema: { properties: { names: { type: "array", items: { type: "string" } } } }
      })
      const parsed = JSON.parse(raw)
      setSuggestions(parsed.names || [])
      if (parsed.names && parsed.names[0]) setHandle(parsed.names[0])
    } finally {
      setIsSuggesting(false)
    }
  }

  async function handleSaveScore() {
    if (!handle.trim()) return
    await database.put({
      type: "score",
      handle: handle.trim(),
      score: state.score || 0,
      level: state.level || 1,
      createdAt: Date.now(),
    })
  }

  const c = {
    page: "min-h-screen p-4 pb-32 max-w-[920px] mx-auto bg-[#f5f2e8] text-[#15151f]",
    header: "flex items-center justify-between p-4 mb-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    brandText: "uppercase tracking-tight font-bold text-lg",
    navRow: "flex gap-2",
    navLink: "px-3 py-2 border-[3px] rounded-[4px] uppercase tracking-wider text-xs font-semibold bg-white border-[#15151f] shadow-[3px_3px_0px_#15151f]",
    hero: "relative p-6 mb-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitleWrap: "relative mt-2",
    heroTitle: "uppercase tracking-tight font-bold text-4xl md:text-6xl leading-none",
    heroShadow: "absolute top-[5px] left-[5px] uppercase tracking-tight font-bold text-4xl md:text-6xl leading-none opacity-50 select-none text-[#d63a1f]",
    heroSub: "mt-4 text-sm text-[#6b6b7a]",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-4",
    statCard: "border-[3px] rounded-[4px] overflow-hidden bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    statHead: "px-3 py-2 border-b-[3px] border-[#15151f] uppercase tracking-wider text-[0.65rem] font-bold",
    statBody: "p-3",
    statNum: "font-mono text-2xl font-bold",
    statLabel: "uppercase tracking-wider text-[0.6rem] mt-1 text-[#6b6b7a]",
    boardSection: "p-4 mb-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    sectionLabel: "uppercase tracking-widest text-[0.65rem] font-semibold mb-3 text-[#6b6b7a]",
    board: "relative w-full aspect-[3/4] border-[3px] rounded-[4px] overflow-hidden bg-[#f5f2e8] border-[#15151f]",
    bubbleRow: "flex justify-center gap-1 py-1",
    bubble: "w-7 h-7 md:w-9 md:h-9 rounded-full border-[3px] border-[#15151f]",
    shooterWrap: "absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2",
    shooter: "w-10 h-10 rounded-full border-[3px] border-[#15151f] bg-[#d63a1f]",
    aimLine: "w-[2px] h-16 border-l-[3px] border-dashed border-[#15151f]",
    controlsGrid: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4",
    controlCard: "p-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    fieldLabel: "block uppercase tracking-widest text-[0.65rem] font-semibold mb-2 text-[#6b6b7a]",
    input: "w-full px-3 py-2 border-[3px] rounded-[4px] font-mono text-sm bg-white border-[#15151f] text-[#15151f]",
    select: "w-full px-3 py-2 border-[3px] rounded-[4px] uppercase text-xs font-semibold bg-white border-[#15151f] text-[#15151f] mb-2",
    progressOuter: "w-full h-4 border-[3px] rounded-[4px] overflow-hidden mt-3 border-[#15151f] bg-white",
    progressInner: "h-full bg-[#4a9b5e]",
    btnRow: "flex flex-wrap gap-3 mt-4",
    btnPrimary: "px-5 py-3 border-[3px] rounded-[4px] uppercase tracking-wider text-sm font-bold min-h-[44px] bg-[#d63a1f] text-white border-[#15151f] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnSecondary: "px-5 py-3 border-[3px] rounded-[4px] uppercase tracking-wider text-sm font-bold min-h-[44px] bg-[#e8c547] text-[#15151f] border-[#15151f] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "px-5 py-3 border-[3px] rounded-[4px] uppercase tracking-wider text-sm font-bold min-h-[44px] bg-white text-[#15151f] border-[#15151f] hover:shadow-[3px_3px_0px_#15151f]",
    suggestBtn: "px-3 py-2 border-[3px] rounded-[4px] uppercase tracking-wider text-[0.65rem] font-bold bg-[#3a6dd6] text-white border-[#15151f] shadow-[3px_3px_0px_#15151f] disabled:opacity-50",
    leaderSection: "p-4 mb-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    table: "w-full",
    th: "text-left px-2 py-2 uppercase tracking-widest text-[0.6rem] font-bold border-b-[3px] border-[#15151f]",
    td: "px-2 py-2 text-[0.82rem] border-b border-[#e5e2d8]",
    tdMono: "px-2 py-2 font-mono text-[0.82rem] border-b border-[#e5e2d8]",
    badge: "inline-block px-2 py-1 border-[3px] rounded-[4px] uppercase tracking-wider text-[0.6rem] font-bold bg-[#e8c547] text-[#15151f] border-[#15151f]",
    actionsCard: "flex flex-wrap gap-3 p-4 border-[3px] rounded-[4px] bg-white border-[#15151f] shadow-[4px_4px_0px_#15151f]",
    bottomBar: "fixed bottom-0 left-0 right-0 p-3 border-t-[3px] flex gap-2 justify-center bg-white border-[#15151f] z-20",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#d63a1f] border-[#15151f]`}></span>
            <span className={`${c.dot} bg-[#e8c547] border-[#15151f]`}></span>
            <span className={`${c.dot} bg-[#4a9b5e] border-[#15151f]`}></span>
          </div>
          <span className={c.brandText}>Pop Cascade</span>
        </div>
        <nav className={c.navRow}>
          <a className={c.navLink} href="#play">Play</a>
          <a className={c.navLink} href="#scores">Scores</a>
        </nav>
      </header>

      <main id="app">
        <section id="hero" className={c.hero}>
          <div className={c.heroBar} aria-hidden="true">
            <div className={`${c.heroBarSeg} bg-[#d63a1f]`}></div>
            <div className={`${c.heroBarSeg} bg-[#e8c547]`}></div>
            <div className={`${c.heroBarSeg} bg-[#4a9b5e]`}></div>
            <div className={`${c.heroBarSeg} bg-[#3a6dd6]`}></div>
          </div>
          <div className={c.heroTitleWrap}>
            <span className={c.heroShadow} aria-hidden="true">Pop. Pop. Pop.</span>
            <h1 className={c.heroTitle}>Pop. Pop. Pop.</h1>
          </div>
          <p className={c.heroSub}>Aim with the slider. Fire to launch. Group three of a color to pop them. Clear every bubble to advance.</p>
        </section>

        <section id="stats" aria-label="run stats">
          <div className={c.statRow}>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#d63a1f] text-white`}>Score</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{state.score || 0}</div>
                <div className={c.statLabel}>Points</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#e8c547] text-[#15151f]`}>Level</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{state.level || 1}</div>
                <div className={c.statLabel}>Stage</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#3a6dd6] text-white`}>Combo</div>
              <div className={c.statBody}>
                <div className={c.statNum}>x{state.combo || 1}</div>
                <div className={c.statLabel}>Multiplier</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#4a9b5e] text-[#15151f]`}>Shots</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{state.shots ?? 20}</div>
                <div className={c.statLabel}>Remaining</div>
              </div>
            </div>
          </div>
        </section>

        <section id="play" className={c.boardSection}>
          <div className={c.sectionLabel}>Board</div>
          <div className={c.board}>
            <div className={c.bubbleRow}>
              <span className={`${c.bubble} bg-[#d63a1f]`}></span>
              <span className={`${c.bubble} bg-[#e8c547]`}></span>
              <span className={`${c.bubble} bg-[#4a9b5e]`}></span>
              <span className={`${c.bubble} bg-[#3a6dd6]`}></span>
              <span className={`${c.bubble} bg-[#d63a1f]`}></span>
              <span className={`${c.bubble} bg-[#e8c547]`}></span>
            </div>
            <div className={c.bubbleRow}>
              <span className={`${c.bubble} bg-[#3a6dd6]`}></span>
              <span className={`${c.bubble} bg-[#4a9b5e]`}></span>
              <span className={`${c.bubble} bg-[#e8c547]`}></span>
              <span className={`${c.bubble} bg-[#d63a1f]`}></span>
              <span className={`${c.bubble} bg-[#3a6dd6]`}></span>
            </div>
            <div className={c.bubbleRow}>
              <span className={`${c.bubble} bg-[#e8c547]`}></span>
              <span className={`${c.bubble} bg-[#d63a1f]`}></span>
              <span className={`${c.bubble} bg-[#3a6dd6]`}></span>
              <span className={`${c.bubble} bg-[#4a9b5e]`}></span>
              <span className={`${c.bubble} bg-[#d63a1f]`}></span>
              <span className={`${c.bubble} bg-[#e8c547]`}></span>
            </div>
            <div className={c.shooterWrap}>
              <div className={c.aimLine} aria-hidden="true"></div>
              <div className={c.shooter}></div>
            </div>
          </div>
        </section>

        <section id="controls">
          <div className={c.controlsGrid}>
            <div className={c.controlCard}>
              <form onSubmit={handleFire}>
                <label className={c.fieldLabel} htmlFor="aim">Aim Angle</label>
                <input id="aim" className={c.input} type="range" min="0" max="180" value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                <label className={c.fieldLabel} htmlFor="power">Power</label>
                <select id="power" className={c.select} value={power} onChange={(e) => setPower(e.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <div className={c.progressOuter}>
                  <div className={c.progressInner} style={{width: `${(angle / 180) * 100}%`}}></div>
                </div>
                <div className={c.btnRow}>
                  <button type="submit" className={c.btnPrimary}>Fire</button>
                  <button type="button" className={c.btnSecondary} onClick={handleNewRun}>New Run</button>
                </div>
              </form>
            </div>
            <div className={c.controlCard}>
              <label className={c.fieldLabel} htmlFor="handle">Player Handle</label>
              <input id="handle" className={c.input} type="text" placeholder="Enter your alias" value={handle} onChange={(e) => setHandle(e.target.value)} />
              <div className={c.btnRow}>
                <button type="button" className={c.suggestBtn} onClick={handleSuggestNames} disabled={isSuggesting}>
                  {isSuggesting ? (
                    <svg className="animate-spin inline-block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 3 a9 9 0 0 1 9 9" />
                    </svg>
                  ) : "Suggest Names"}
                </button>
                <button type="button" className={c.btnGhost} onClick={handleSaveScore}>Save Score</button>
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => setHandle(s)} className="px-2 py-1 border-[3px] rounded-[4px] text-[0.7rem] font-mono bg-[#e8c547] text-[#15151f] border-[#15151f]">{s}</button>
                  ))}
                </div>
              )}
              <div className={c.progressOuter}>
                <div className={c.progressInner} style={{width: handle ? "100%" : "0%"}}></div>
              </div>
            </div>
          </div>
        </section>

        <section id="scores" className={c.leaderSection}>
          <div className={c.sectionLabel}>Leaderboard</div>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Rank</th>
                <th className={c.th}>Player</th>
                <th className={c.th}>Score</th>
                <th className={c.th}>Level</th>
                <th className={c.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 && (
                <tr>
                  <td className={c.td} colSpan="5">No scores yet. Save a run to claim the top slot.</td>
                </tr>
              )}
              {ranked.map((s, i) => (
                <tr key={s._id}>
                  <td className={c.tdMono}>{String(i + 1).padStart(2, "0")}</td>
                  <td className={c.td}>{s.handle}</td>
                  <td className={c.tdMono}>{s.score}</td>
                  <td className={c.tdMono}>{s.level}</td>
                  <td className={c.td}>
                    <span className={`inline-block px-2 py-1 border-[3px] rounded-[4px] uppercase tracking-wider text-[0.6rem] font-bold border-[#15151f] ${i === 0 ? "bg-[#4a9b5e] text-[#15151f]" : "bg-[#e8c547] text-[#15151f]"}`}>
                      {i === 0 ? "Top" : "Logged"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="actions">
          <div className={c.actionsCard}>
            <button type="button" className={c.btnPrimary} onClick={handleNewRun}>Start Run</button>
            <button type="button" className={c.btnSecondary}>How To Play</button>
            <button type="button" className={c.btnGhost}>Reset Board</button>
          </div>
        </section>
      </main>

      <div className={c.bottomBar}>
        <button type="button" className={c.btnPrimary} onClick={handleNewRun}>New Run</button>
        <button type="button" className={c.btnSecondary}>Fire</button>
      </div>
    </div>
  )
}