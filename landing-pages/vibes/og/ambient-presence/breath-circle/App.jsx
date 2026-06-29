import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // Application Data via Fireproof
  const { database, useLiveQuery } = useFireproof("oxygen-lnk-sys")
  
  // Realtime Logic
  const [handle, setHandle] = useState("")
  const [joined, setJoined] = useState(false)
  
  const [phase, setPhase] = useState("...")
  const [scale, setScale] = useState(1)
  const cycleDuration = 16000 // 16s total (4x 4s)

  // AI assistant state
  const [mantra, setMantra] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // Database hook for pulses
  const sortedPulses = useLiveQuery("type", { key: "pulse", descending: true, limit: 100 })
  const pulses = sortedPulses.docs

  // Keep all clocks in exact sync using Date.now() mod 16s
  useEffect(() => {
    let animationFrameId;
    const processTick = () => {
      const now = Date.now()
      const t = now % cycleDuration
      
      if (t < 4000) {
        setPhase("INHALE")
        setScale(1.0 + (t / 4000) * 0.5) // grow to 1.5
      } else if (t < 8000) {
        setPhase("HOLD")
        setScale(1.5) // stay big
      } else if (t < 12000) {
        setPhase("EXHALE")
        setScale(1.5 - ((t - 8000) / 4000) * 0.5) // shrink to 1.0
      } else {
        setPhase("HOLD")
        setScale(1.0) // stay small
      }
      animationFrameId = requestAnimationFrame(processTick)
    }
    processTick()
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  const c = {
    page: "relative min-h-screen flex flex-col items-center p-4 sm:p-8 font-sans overflow-x-hidden bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    ambient: "fixed inset-0 pointer-events-none z-0",
    nav: "relative z-10 w-full max-w-[920px] flex justify-between items-center p-4 mb-8 border-[3px] rounded-[4px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    navLogo: "flex items-center gap-2 font-bold tracking-tighter uppercase text-lg",
    navChip: "px-3 py-1 text-xs uppercase font-bold border-[3px] rounded-[4px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] cursor-default",
    hero: "relative z-10 w-full max-w-[920px] p-8 mb-8 border-[3px] rounded-[4px] text-center border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    heroTitle: "text-4xl sm:text-6xl font-extrabold uppercase tracking-tight mb-2 relative",
    heroSubtitle: "text-sm sm:text-base font-mono uppercase tracking-widest",
    statRow: "relative z-10 w-full max-w-[920px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8",
    statCard: "flex flex-col border-[3px] rounded-[4px] overflow-hidden border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    statHeader: "px-2 py-1 text-[10px] uppercase tracking-widest font-bold border-b-[3px] border-[oklch(0.15_0.02_280)]",
    statBody: "p-4 text-center font-mono text-3xl font-bold flex flex-col items-center justify-center min-h-[100px] bg-[oklch(1.00_0_0)]",
    dashboardGrid: "relative z-10 w-full max-w-[920px] grid grid-cols-1 md:grid-cols-2 gap-8 mb-8",
    card: "p-6 border-[3px] rounded-[4px] flex flex-col items-center justify-center border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] relative z-10",
    circleRing: "relative flex items-center justify-center rounded-full border-[3px] transition-all ease-linear w-[240px] h-[240px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] shadow-[inset_4px_4px_0px_oklch(0.15_0.02_280)]",
    circlePhase: "font-black uppercase tracking-widest text-3xl z-10 text-[oklch(0.15_0.02_280)]",
    circlePulse: "absolute inset-0 rounded-full border-[3px] animate-ping border-[oklch(0.52_0.18_255)] opacity-50",
    actionRow: "w-full flex justify-center gap-4 mt-6",
    btnPrimary: "px-8 py-4 font-bold uppercase tracking-widest border-[3px] rounded-[4px] transition-all border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed",
    btnSecondary: "px-6 py-3 font-bold uppercase tracking-[0.08em] text-[0.8rem] border-[3px] rounded-[4px] transition-all border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed",
    input: "w-full max-w-[300px] p-3 font-mono text-sm border-[3px] rounded-[4px] outline-none text-center mb-4 transition-transform border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    tableCard: "relative z-10 w-full max-w-[920px] border-[3px] rounded-[4px] overflow-hidden border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] mb-12",
    table: "w-full text-left border-collapse",
    th: "p-3 text-[10px] uppercase font-bold tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] text-[oklch(0.50_0.02_280)]",
    td: "p-3 text-sm font-mono border-b-[1px] border-[oklch(0.15_0.02_280)/0.2] transition-colors group-hover:bg-[oklch(0.85_0.18_85)] group-hover:text-[oklch(0.15_0.02_280)]",
    badge: "inline-block px-2 py-1 text-[10px] font-bold uppercase border-[3px] rounded-[4px] border-[oklch(0.15_0.02_280)] shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        :root {
          font-family: 'Space Grotesk', sans-serif;
        }
        
        .drift-pos-1 { animation: drift-1 8s ease-in-out infinite alternate; }
        .drift-pos-2 { animation: drift-2 10s ease-in-out infinite alternate; }
        .drift-pos-3 { animation: drift-3 12s linear infinite; }
        .drift-pos-4 { animation: drift-4 7s ease-in-out infinite alternate; }
        .drift-pos-5 { animation: drift-5 9s ease-in-out infinite alternate; }

        @keyframes drift-1 { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(20px, 30px) rotate(15deg); } }
        @keyframes drift-2 { 0% { transform: translate(0, 0); } 100% { transform: translate(-30px, 20px); } }
        @keyframes drift-3 { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes drift-4 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(25px, -15px) scale(1.1); } }
        @keyframes drift-5 { 0% { transform: translate(0, 0) rotate(45deg); } 100% { transform: translate(-40px, -40px) rotate(90deg); } }

        .bg-graph {
          background-image: linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
                            linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .modal-pop { animation: pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className={c.page}>
        <div className={`${c.ambient} bg-graph overflow-hidden`}>
          <div className="absolute top-[10%] left-[5%] w-[40px] h-[40px] bg-[oklch(0.55_0.24_28)] opacity-20 drift-pos-1 rounded-full border-[3px] border-[oklch(0.15_0.02_280)]" />
          <div className="absolute bottom-[20%] right-[10%] w-[60px] h-[60px] bg-[oklch(0.85_0.18_85)] opacity-30 drift-pos-2 border-[3px] border-[oklch(0.15_0.02_280)]" />
          <div className="absolute top-[30%] right-[15%] w-[30px] h-[30px] bg-[oklch(0.62_0.19_145)] opacity-25 drift-pos-4 border-[3px] border-[oklch(0.15_0.02_280)]" />
          <div className="absolute bottom-[10%] left-[15%] w-[50px] h-[50px] bg-[oklch(0.52_0.18_255)] opacity-20 drift-pos-1 rounded-full border-[3px] border-[oklch(0.15_0.02_280)]" />
          <div className="absolute top-[50%] left-[40%] w-[35px] h-[35px] bg-[oklch(0.85_0.18_85)] opacity-20 drift-pos-5 border-[3px] border-[oklch(0.15_0.02_280)] rotate-45" />
          
          <div className="absolute top-[20%] right-[40%] w-[40px] h-[40px] opacity-15 drift-pos-3">
            <div className="absolute top-[15px] left-0 w-[40px] h-[10px] bg-[oklch(0.15_0.02_280)]" />
            <div className="absolute top-0 left-[15px] w-[10px] h-[40px] bg-[oklch(0.15_0.02_280)]" />
          </div>
        </div>

        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-[oklch(0.55_0.24_28)] border-[2px] border-[oklch(0.15_0.02_280)]" />
              <div className="w-3 h-3 bg-[oklch(0.85_0.18_85)] border-[2px] border-[oklch(0.15_0.02_280)]" />
              <div className="w-3 h-3 bg-[oklch(0.62_0.19_145)] border-[2px] border-[oklch(0.15_0.02_280)]" />
            </div>
            <span>OXYGEN.LNK</span>
          </div>
          <div className={c.navChip}>STATUS: STANDBY</div>
        </header>

        <section className={c.hero}>
          <div className="absolute top-0 left-0 w-full h-[6px] flex border-b-[3px] border-[oklch(0.15_0.02_280)]">
            <div className="w-1/4 h-full bg-[oklch(0.55_0.24_28)]" />
            <div className="w-1/4 h-full bg-[oklch(0.85_0.18_85)]" />
            <div className="w-1/4 h-full bg-[oklch(0.62_0.19_145)]" />
            <div className="w-1/4 h-full bg-[oklch(0.52_0.18_255)]" />
          </div>
          <h1 className={c.heroTitle}>
            GLOBAL SYNC
            <span aria-hidden="true" className="absolute top-0 left-0 w-full h-full text-[oklch(0.55_0.24_28)] opacity-50 translate-x-[5px] translate-y-[5px] -z-10 blur-none pointer-events-none">
              GLOBAL SYNC
            </span>
          </h1>
          <p className={`${c.heroSubtitle} text-[oklch(0.50_0.02_280)]`}>Establishing dynamic connection</p>
        </section>

        <section className={c.statRow}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.55_0.24_28)] text-white`}>TOTAL PULSES</div>
            <div className={c.statBody}>
              {pulses.length}
              <span className="text-[10px] text-[oklch(0.50_0.02_280)] uppercase mt-1">LIFETIME</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]`}>CURRENT LOOP</div>
            <div className={c.statBody}>
              {((Date.now() % cycleDuration) / 1000).toFixed(1)}
              <span className="text-[10px] text-[oklch(0.50_0.02_280)] uppercase mt-1">SECONDS</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.52_0.18_255)] text-white`}>ACTIVE NODES</div>
            <div className={c.statBody}>
              {new Set(pulses.filter(p => Date.now() - p.timestamp < 16000).map(p => p.handle)).size}
              <span className="text-[10px] text-[oklch(0.50_0.02_280)] uppercase mt-1">THIS CYCLE</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]`}>SESSION STATE</div>
            <div className={c.statBody}>
              SYNC
              <span className="text-[10px] text-[oklch(0.50_0.02_280)] uppercase mt-1">CONTINUOUS</span>
            </div>
          </div>
        </section>

        <section className={c.dashboardGrid}>
          {!joined ? (
            <form 
              className={c.card} 
              onSubmit={(e) => { e.preventDefault(); if (handle.trim()) setJoined(true); }}
            >
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4 text-center">INITIALIZE NODE</h2>
              <input
                type="text"
                placeholder="ENTER OPERATOR HANDLE"
                className={c.input}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={12}
                required
              />
              <button type="submit" className={c.btnSecondary} disabled={!handle.trim()}>
                CONNECT
              </button>
            </form>
          ) : (
            <div className={`${c.card} justify-between`}>
              <div className="w-full text-center">
                <span className="text-[10px] font-bold text-[oklch(0.50_0.02_280)] tracking-[0.15em] block mb-1">OPERATOR</span>
                <span className="text-2xl font-bold uppercase border-b-[3px] border-[oklch(0.52_0.18_255)] px-4 pb-1 inline-block">{handle}</span>
              </div>
              
              <div className="w-full mt-6 bg-[oklch(0.96_0.01_90)] p-4 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] relative">
                <span className="absolute -top-3 left-4 bg-[oklch(1.00_0_0)] px-2 text-[10px] font-bold tracking-widest text-[oklch(0.50_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px]">INTENTION</span>
                <p className="font-mono text-sm leading-relaxed min-h-[40px] text-center">{
                  isGenerating ? "Synthesizing focus..." : 
                  mantra ? mantra : "No strict intention set for this loop. Default standard sequence."
                }</p>
              </div>

              <div className="w-full flex justify-center mt-4">
                <button 
                  onClick={async () => {
                    if (isGenerating) return
                    setIsGenerating(true)
                    try {
                      const res = await callAI("Generate a very short 2-4 word cyberpunk/zen mantra or focus command for a breathing exercise. e.g. 'CLEAR THE NOISE' or 'HOLD THE LINE'. No quotes.", 
                        { schema: { properties: { mantra: { type: 'string' } } } }
                      )
                      setMantra(JSON.parse(res).mantra)
                    } finally {
                      setIsGenerating(false)
                    }
                  }}
                  disabled={isGenerating}
                  className={`${c.btnSecondary} !py-2 !px-4 !text-[10px] flex items-center gap-2`}
                >
                  {isGenerating ? (
                    <svg className="animate-spin h-3 w-3 text-current" viewBox="0 0 24 24" fill="none" strokeWidth="3" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="square" />
                    </svg>
                  ) : "GENERATE FOCUS"}
                </button>
              </div>
            </div>
          )}

          <div className={`${c.card} overflow-hidden`}>
            {/* Visual representation of other synchronized users could be positioned here absolute, but we'll stick to text indicators to keep UI clean */}
            <div className={c.circleRing} style={{ transform: `scale(${scale})`, transition: 'none' }}>
              <div className={c.circlePhase} style={{ transform: `scale(${1/scale})` }}>{phase}</div>
              {phase === "INHALE" || phase === "EXHALE" ? (
                <div className={c.circlePulse} />
              ) : null}
            </div>
            <div className={c.actionRow}>
              <button 
                disabled={!joined}
                onClick={() => {
                  database.put({
                    type: "pulse",
                    handle: handle,
                    phase: phase,
                    timestamp: Date.now()
                  })
                }}
                className={c.btnPrimary}
              >
                {!joined ? "SYSTEM LOCKED" : "SYNC PRESENCE"}
              </button>
            </div>
          </div>
        </section>

        <section className={c.tableCard}>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>TIMESTAMP</th>
                <th className={c.th}>NODE HANDLE</th>
                <th className={c.th}>EVENT RATING</th>
                <th className={c.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pulses.length === 0 ? (
                <tr>
                  <td colSpan="4" className={`${c.td} text-center py-6 text-[oklch(0.50_0.02_280)]`}>NO NETWORK ACTIVITY</td>
                </tr>
              ) : pulses.map((evt) => (
                <tr key={evt._id} className="group">
                  <td className={c.td}>{new Date(evt.timestamp).toISOString().split('T')[1].slice(0, -1)}</td>
                  <td className={c.td}>
                    {evt.handle === handle ? (
                      <span className="font-bold underline decoration-2 decoration-[oklch(0.62_0.19_145)]">{evt.handle} (YOU)</span>
                    ) : (
                      evt.handle
                    )}
                  </td>
                  <td className={c.td}>{evt.phase} SYNC</td>
                  <td className={c.td}>
                    <span className={`${c.badge} bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]`}>LOGGED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  )
}