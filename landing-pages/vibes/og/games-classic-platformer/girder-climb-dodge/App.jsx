import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const c = {
    page: "min-h-screen bg-[#fafaf5] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]",
    header: "bg-white border-[3px] border-[#1a1a2e] shadow-[4px_4px_0px_#1a1a2e] m-4 p-4 flex items-center gap-3",
    logo: "flex gap-1",
    logoBlock: "w-3 h-3 border-[2px] border-[#1a1a2e]",
    title: "text-xl font-bold uppercase tracking-tight",
    main: "max-w-[920px] mx-auto px-4 pb-24 space-y-4",
    section: "bg-white border-[3px] border-[#1a1a2e] shadow-[4px_4px_0px_#1a1a2e] p-4",
    h2: "text-sm font-bold uppercase tracking-[0.1em] mb-3",
    canvasWrap: "border-[3px] border-[#1a1a2e] bg-[#0f0f1e] aspect-[3/4] w-full max-w-[420px] mx-auto relative",
    statRow: "grid grid-cols-4 gap-2 mb-3",
    stat: "border-[3px] border-[#1a1a2e] bg-white p-2 text-center",
    statLabel: "text-[0.6rem] uppercase tracking-[0.15em] text-[#666]",
    statNum: "font-['JetBrains_Mono',monospace] font-bold text-lg",
    btnPrimary: "px-4 py-3 bg-[#d94a2e] text-white border-[3px] border-[#1a1a2e] shadow-[3px_3px_0px_#1a1a2e] font-bold uppercase text-xs tracking-[0.08em] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnSecondary: "px-4 py-3 bg-[#e8c547] text-[#1a1a2e] border-[3px] border-[#1a1a2e] shadow-[3px_3px_0px_#1a1a2e] font-bold uppercase text-xs tracking-[0.08em] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "px-3 py-2 bg-white border-[3px] border-[#1a1a2e] font-bold uppercase text-xs tracking-[0.08em]",
    ctrlPad: "grid grid-cols-3 gap-2 max-w-[280px] mx-auto mt-3",
    ctrlBtn: "py-4 bg-[#3b6bd1] text-white border-[3px] border-[#1a1a2e] shadow-[3px_3px_0px_#1a1a2e] font-bold text-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none touch-none",
    runRow: "flex items-center justify-between p-3 border-[3px] border-[#1a1a2e] bg-white hover:bg-[#e8c547] cursor-pointer",
    badge: "px-2 py-1 text-[0.65rem] uppercase font-bold border-[2px] border-[#1a1a2e]",
    badgeWin: "bg-[#4ba84b] text-white",
    badgeLoss: "bg-[#d94a2e] text-white",
    mono: "font-['JetBrains_Mono',monospace]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logo}>
          <div className={c.logoBlock + " bg-[#d94a2e]"}></div>
          <div className={c.logoBlock + " bg-[#e8c547]"}></div>
          <div className={c.logoBlock + " bg-[#4ba84b]"}></div>
        </div>
        <h1 className={c.title}>Girder Climb</h1>
      </header>
      <main id="app" className={c.main}>
        <section id="game" className={c.section}>
          <h2 className={c.h2}>Current Run</h2>
          <div className={c.statRow}>
            <div className={c.stat}>
              <div className={c.statLabel}>Level</div>
              <div className={c.statNum}>{hud.level}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statLabel}>Lives</div>
              <div className={c.statNum}>{hud.lives}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statLabel}>Score</div>
              <div className={c.statNum}>{hud.score}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statLabel}>Time</div>
              <div className={c.statNum}>{hud.time}s</div>
            </div>
          </div>
          <div className={c.canvasWrap}>
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!hud.running && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-xs uppercase tracking-[0.15em] opacity-50 pointer-events-none">
                Tap start
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 mt-3">
            <button className={c.btnPrimary} onClick={startRun} disabled={hud.running}>
              {hud.running ? "Running..." : "Start Run"}
            </button>
            <button className={c.btnSecondary} onClick={askTwist} disabled={twistLoading}>
              {twistLoading ? "..." : "AI Twist Idea"}
            </button>
          </div>
          <div className={c.ctrlPad}>
            <div></div>
            <button className={c.ctrlBtn} onTouchStart={holdKey("up", true)} onTouchEnd={holdKey("up", false)} onMouseDown={holdKey("up", true)} onMouseUp={holdKey("up", false)}>↑</button>
            <div></div>
            <button className={c.ctrlBtn} onTouchStart={holdKey("left", true)} onTouchEnd={holdKey("left", false)} onMouseDown={holdKey("left", true)} onMouseUp={holdKey("left", false)}>←</button>
            <button className={c.ctrlBtn} onTouchStart={holdKey("jump", true)} onTouchEnd={holdKey("jump", false)} onMouseDown={holdKey("jump", true)} onMouseUp={holdKey("jump", false)}>JMP</button>
            <button className={c.ctrlBtn} onTouchStart={holdKey("right", true)} onTouchEnd={holdKey("right", false)} onMouseDown={holdKey("right", true)} onMouseUp={holdKey("right", false)}>→</button>
          </div>
        </section>
        <section id="runs" className={c.section}>
          <h2 className={c.h2}>Run History</h2>
          <ul className="space-y-2">
            {runs.length === 0 && <li className="text-xs uppercase tracking-[0.1em] text-[#666]">No runs yet — climb the tower.</li>}
            {runs.map(r => (
              <li key={r._id} className={c.runRow} onClick={() => setSelectedId(r._id)}>
                <div className="flex items-center gap-2">
                  <span className={c.badge + " " + (r.won ? c.badgeWin : c.badgeLoss)}>{r.won ? "Win" : "Loss"}</span>
                  <span className={c.mono + " text-sm font-bold"}>L{r.level}</span>
                  <span className={c.mono + " text-xs text-[#666]"}>{r.score}pt</span>
                </div>
                <span className={c.mono + " text-xs"}>{r.duration}s</span>
              </li>
            ))}
          </ul>
        </section>
        <section id="detail" className={c.section}>
          <h2 className={c.h2}>Run Detail & Twists</h2>
          {selectedId ? (() => {
            const r = runs.find(x => x._id === selectedId)
            if (!r) return <p className="text-xs text-[#666]">Run not found.</p>
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className={c.stat}><div className={c.statLabel}>Result</div><div className={c.statNum}>{r.won ? "Win" : "Loss"}</div></div>
                  <div className={c.stat}><div className={c.statLabel}>Level</div><div className={c.statNum}>{r.level}</div></div>
                  <div className={c.stat}><div className={c.statLabel}>Score</div><div className={c.statNum}>{r.score}</div></div>
                  <div className={c.stat}><div className={c.statLabel}>Duration</div><div className={c.statNum}>{r.duration}s</div></div>
                </div>
                <button className={c.btnGhost} onClick={() => setSelectedId(null)}>Close</button>
              </div>
            )
          })() : (
            <p className="text-xs uppercase tracking-[0.1em] text-[#666]">Tap a run above to see its detail.</p>
          )}
          <div className="mt-4 pt-3 border-t-[3px] border-[#1a1a2e]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.6rem] uppercase tracking-[0.15em] text-[#666]">AI Twist Idea</span>
              <button className={c.btnGhost} onClick={askTwist} disabled={twistLoading}>
                {twistLoading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                ) : "Suggest"}
              </button>
            </div>
            {twistText && <p className="text-sm italic">{twistText}</p>}
          </div>
        </section>
      </main>
    </div>
  )
}