import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // 1. Hooks and document shapes
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("syncStretchUser") || "Player 1"
  })

  // Watch for username updates and store them
  useEffect(() => {
    localStorage.setItem("syncStretchUser", userName)
  }, [userName])
  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  
  // Stretch Sequence State
  const [activeSegment, setActiveSegment] = useState(0) // 0: wait, 1: neck, 2: shoulder, 3: toe, 4: done
  const [modalOpen, setModalOpen] = useState(false)
  
  // Timer State
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [scheduledTime, setScheduledTime] = useState("")

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fireproof integration
  const { useLiveQuery, useDocument, database } = useFireproof("sync-stretch-db")
  
  const { docs: breaks } = useLiveQuery("type", { key: "break", descending: true })
  const { docs: attendances } = useLiveQuery("type", { key: "attendance", descending: true })
  
  // Find a break that is currently in progress or waiting to execute today
  const activeBreak = breaks.find(b => b.status === "pending" || b.status === "active")

  useEffect(() => {
    // If there is a pending break and we've crossed the target time
    if (activeBreak && activeBreak.status === "pending") {
      if (currentTime >= activeBreak.targetTime) {
        // Only one person needs to mark it active, but CRDT resolves concurrent writes fine
        database.put({ ...activeBreak, status: "active" })
        setModalOpen(true)
        setActiveSegment(1) // Start stretch instructions
      }
    }
    // If a break is manually active, ensure modal is popped for late-comers up to a point
    if (activeBreak && activeBreak.status === "active" && !modalOpen && activeSegment === 0) {
      // Allow late joins up to 60s after target
      if (currentTime < activeBreak.targetTime + 60000) {
        setModalOpen(true)
        setActiveSegment(1)
      }
    }
  }, [currentTime, activeBreak, database, modalOpen, activeSegment])

  useEffect(() => {
    if (!modalOpen || !activeBreak) return
    
    const timeSinceStart = currentTime - activeBreak.targetTime
    
    // 0-20s: Neck (1), 20-40s: Shoulders (2), 40-60s: Toes (3), >60s: Done (4)
    if (timeSinceStart >= 60000) {
      setActiveSegment(4)
      if (activeBreak.status === "active") {
        database.put({ ...activeBreak, status: "completed" })
      }
    } else if (timeSinceStart >= 40000) {
      setActiveSegment(3)
    } else if (timeSinceStart >= 20000) {
      setActiveSegment(2)
    } else {
      setActiveSegment(1)
    }
  }, [currentTime, modalOpen, activeBreak, database])

  // AI Suggestion State
  const [isLoadingTip, setIsLoadingTip] = useState(false)
  const [dailyTip, setDailyTip] = useState("Keep your screen at eye level to avoid tech-neck.")

  // 2. Event handlers
  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    if (!scheduledTime) return
    
    // Parse input time string into local timestamp for today
    const [h, m] = scheduledTime.split(":")
    const d = new Date()
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
    
    // If time is strictly in the past, assume it means tomorrow
    if (d.getTime() < Date.now()) {
      d.setDate(d.getDate() + 1)
    }

    await database.put({
      type: "break",
      status: "pending",
      targetTime: d.getTime(),
      targetTimeString: scheduledTime,
      createdAt: Date.now(),
      author: userName
    })
    setScheduledTime("")
  }

  const handleLogAttendance = async () => {
    if (activeBreak) {
      await database.put({
        type: "attendance",
        breakId: activeBreak._id,
        userName: userName,
        timestamp: Date.now()
      })
    }
    setModalOpen(false)
    setActiveSegment(0)
  }

  const handleGenerateTip = async () => {
    setIsLoadingTip(true)
    try {
      const resp = await callAI("Generate a short, 1-sentence tip on workplace stretching and posture. Keep it encouraging and casual, not overly medical.", {
        schema: { properties: { tip: { type: "string" } } }
      })
      setDailyTip(JSON.parse(resp).tip)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingTip(false)
    }
  }

  // 3. ClassNames
  const c = {
    page: "flex flex-col items-center min-h-screen relative overflow-hidden font-sans bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    background: "fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply",
    ambientBlock: "absolute z-0 border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] opacity-20",
    container: "w-full max-w-4xl px-4 py-8 relative z-10 flex flex-col gap-8",
    
    // Nav
    nav: "flex items-center justify-between p-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px]",
    logoGroup: "flex items-center gap-2",
    logoSquares: "flex gap-1",
    logoSquare: "w-3 h-3 block",
    navPill: "px-4 py-2 text-sm font-bold uppercase tracking-wide cursor-pointer bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] transition-transform duration-150 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    
    // Hero
    heroCard: "relative p-8 flex flex-col items-center text-center bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px]",
    heroAccentBar: "absolute top-0 left-0 w-full h-2 flex",
    heroAccentSegment: "flex-1 h-full",
    titleWrapper: "relative mt-4 mb-2",
    heroTitle: "text-4xl md:text-[clamp(2.5rem,6vw,4rem)] md:leading-[1.1] font-black uppercase tracking-tighter relative z-10",
    heroShadow: "text-4xl md:text-[clamp(2.5rem,6vw,4rem)] md:leading-[1.1] font-black uppercase tracking-tighter absolute top-[5px] left-[5px] z-0 opacity-50 text-[oklch(0.55_0.24_28)]",
    heroSubtitle: "text-lg md:text-xl font-bold max-w-xl mx-auto uppercase",
    
    // Forms & Inputs
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    formCard: "p-6 flex flex-col gap-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px]",
    label: "text-[0.65rem] font-bold uppercase tracking-[0.15em] block text-[oklch(0.50_0.02_280)]",
    input: "w-full py-3 px-4 bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all duration-150 mb-2 font-mono text-sm uppercase",
    
    // Buttons
    btnRow: "flex flex-wrap gap-4 mt-2",
    btnPrimary: "px-6 py-3 font-bold uppercase tracking-[0.05em] text-sm cursor-pointer bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] transition-all duration-150 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    btnSecondary: "px-6 py-3 font-bold uppercase tracking-[0.05em] text-sm cursor-pointer bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] transition-all duration-150 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    btnGhost: "px-4 py-2 font-bold uppercase tracking-wide cursor-pointer text-sm",
    btnLoadingState: "flex items-center justify-center gap-2 opacity-80 cursor-not-allowed",
    
    // Roster / Lists
    statGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "flex flex-col overflow-hidden bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px]",
    statHeader: "w-full px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]",
    statBody: "p-6 text-center font-mono text-3xl font-black flex flex-col items-center gap-2",
    statLabel: "text-xs font-sans uppercase tracking-widest",
    
    // Table/Scrapbook
    tableCard: "w-full overflow-hidden border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px] bg-white",
    table: "w-full text-left border-collapse font-sans",
    th: "px-4 py-3 text-[0.6rem] font-bold uppercase tracking-[0.15em] border-b-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] text-[oklch(0.50_0.02_280)]",
    td: "px-4 py-3 text-[0.82rem] font-mono border-b border-[oklch(0.15_0.02_280)] group-hover:bg-[oklch(0.85_0.18_85)] transition-colors duration-0",
    
    // Modal
    modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(0.15_0.02_280_/_0.6)] backdrop-blur-none",
    modalCard: "w-full max-w-md bg-white border-[3px] border-[oklch(0.15_0.02_280)] shadow-[8px_8px_0px_oklch(0.15_0.02_280)] rounded-[4px] flex flex-col overflow-hidden relative animate-bounce-in",
    modalBar: "w-full px-4 py-3 font-bold text-sm uppercase tracking-wide flex justify-between bg-[oklch(0.52_0.18_255)] text-white border-b-[3px] border-[oklch(0.15_0.02_280)]",
    modalBody: "p-8 flex flex-col items-center text-center gap-6",
    
    // Icons
    icon: "w-6 h-6",
    spinner: "w-4 h-4 animate-spin"
  }

  // 4. JSX return
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
        .font-sans { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .bg-grid { background-image: linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px); background-size: 60px 60px; }
        @keyframes drift-1 { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(20px, 15px) rotate(15deg); } }
        @keyframes drift-2 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-15px, 20px) scale(1.1); } }
        @keyframes pop-in { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-bounce-in { animation: pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}} />
      
      <div className={c.page}>
        <div className={`${c.background} bg-grid`} aria-hidden="true">
          <div className={`${c.ambientBlock} bg-[oklch(0.55_0.24_28)] rounded-full`} style={{ width: 60, height: 60, top: '10%', left: '5%', animation: 'drift-1 8s ease-in-out infinite' }} />
          <div className={`${c.ambientBlock} bg-[oklch(0.85_0.18_85)] rotate-45`} style={{ width: 40, height: 40, top: '40%', right: '10%', animation: 'drift-2 10s ease-in-out infinite' }} />
          <div className={`${c.ambientBlock} bg-[oklch(0.52_0.18_255)] rounded-full`} style={{ width: 80, height: 80, bottom: '20%', left: '15%', animation: 'drift-1 12s ease-in-out infinite' }} />
        </div>

        <div className={c.container}>
          
          <header className={c.nav}>
            <div className={c.logoGroup}>
              <div className={c.logoSquares}>
                <span className={`${c.logoSquare} bg-[oklch(0.55_0.24_28)] border-2 border-[oklch(0.15_0.02_280)]`}></span>
                <span className={`${c.logoSquare} bg-[oklch(0.85_0.18_85)] border-2 border-[oklch(0.15_0.02_280)]`}></span>
                <span className={`${c.logoSquare} bg-[oklch(0.62_0.19_145)] border-2 border-[oklch(0.15_0.02_280)]`}></span>
              </div>
              <span className="font-bold uppercase tracking-widest text-sm">SyncStretch</span>
            </div>
            <button className={c.navPill} onClick={() => setIsNameModalOpen(true)}>
              {userName}
            </button>
          </header>

          <main className="flex flex-col gap-8">
            <section id="hero" className={c.heroCard}>
              <div className={c.heroAccentBar}>
                <div className={`${c.heroAccentSegment} bg-[oklch(0.55_0.24_28)] border-b-[3px] border-[oklch(0.15_0.02_280)]`}></div>
                <div className={`${c.heroAccentSegment} bg-[oklch(0.85_0.18_85)] border-b-[3px] border-[oklch(0.15_0.02_280)]`}></div>
                <div className={`${c.heroAccentSegment} bg-[oklch(0.62_0.19_145)] border-b-[3px] border-[oklch(0.15_0.02_280)]`}></div>
                <div className={`${c.heroAccentSegment} bg-[oklch(0.52_0.18_255)] border-b-[3px] border-[oklch(0.15_0.02_280)]`}></div>
              </div>
              
              <span className={c.label}>{activeBreak ? "Next Stretch Countdown" : "Status"}</span>
              <div className={c.titleWrapper}>
                <h1 className={c.heroShadow} aria-hidden="true">
                  {activeBreak && activeBreak.status === "pending" ? (
                    (() => {
                      const diff = Math.max(0, activeBreak.targetTime - currentTime)
                      const m = Math.floor((diff / 1000) / 60).toString().padStart(2, '0')
                      const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0')
                      return `${m}:${s}`
                    })()
                  ) : activeBreak?.status === "active" ? "STRETCH NOW!" : "WAITING FOR SCHEDULE"}
                </h1>
                <h1 className={c.heroTitle}>
                  {activeBreak && activeBreak.status === "pending" ? (
                    (() => {
                      const diff = Math.max(0, activeBreak.targetTime - currentTime)
                      const m = Math.floor((diff / 1000) / 60).toString().padStart(2, '0')
                      const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0')
                      return `${m}:${s}`
                    })()
                  ) : activeBreak?.status === "active" ? "STRETCH NOW!" : "WAITING FOR SCHEDULE"}
                </h1>
              </div>
              
              <div className="flex gap-4 items-center mt-6">
                <span className={c.heroSubtitle}>
                  {activeBreak && activeBreak.status === "pending" 
                    ? `Break scheduled for ${activeBreak.targetTimeString} by ${activeBreak.author}`
                    : activeBreak?.status === "active" 
                    ? "Join the active stretch break!" 
                    : "No break currently scheduled."}
                </span>
              </div>
            </section>

            <section id="controls" className={c.formGrid}>
              <div className={c.formCard}>
                <h2 className="text-xl font-black uppercase mb-2">Schedule Flow</h2>
                <form onSubmit={handleScheduleSubmit}>
                  <label htmlFor="time" className={c.label}>Target Time</label>
                  <input 
                    type="time" 
                    id="time" 
                    className={c.input} 
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required
                  />
                  <div className={c.btnRow}>
                    <button type="submit" className={c.btnPrimary}>
                      Broadcast Schedule
                    </button>
                  </div>
                </form>
              </div>

              <div className={c.formCard}>
                <h2 className="text-xl font-black uppercase mb-2">Daily Ergonomic Tip</h2>
                <p className="text-sm font-medium mb-4">{dailyTip}</p>
                <div className={c.btnRow}>
                  <button onClick={handleGenerateTip} disabled={isLoadingTip} className={c.btnSecondary}>
                    {isLoadingTip ? (
                      <span className={c.btnLoadingState}>
                        <svg className={c.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Thinking...
                      </span>
                    ) : "Generate Tip"}
                  </button>
                </div>
              </div>
            </section>

            <section id="roster" className="flex flex-col gap-4">
              <h2 className="text-xl font-black uppercase tracking-tight">Today's Roster</h2>
              {breaks.length > 0 && breaks[0] ? (
                <div className={c.statGrid}>
                  {attendances.filter(a => a.breakId === breaks[0]._id).map((a, i) => (
                    <div key={a._id} className={c.statCard}>
                      <div className={`${c.statHeader} ${i % 3 === 0 ? "bg-[oklch(0.62_0.19_145)] text-black" : i % 2 === 0 ? "bg-[oklch(0.85_0.18_85)] text-black" : "bg-[oklch(0.52_0.18_255)] text-white"}`}>Checked In</div>
                      <div className={c.statBody}>
                        <svg className={`${c.icon} text-[oklch(0.55_0.24_28)]`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className={c.statLabel}>{a.userName}</span>
                      </div>
                    </div>
                  ))}
                  {attendances.filter(a => a.breakId === breaks[0]._id).length === 0 && (
                     <div className="col-span-full py-6 text-center border-[3px] border-dashed border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] font-bold text-sm uppercase tracking-widest text-[oklch(0.50_0.02_280)]">
                       Nobody has checked in yet.
                     </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center border-[3px] border-dashed border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] font-bold text-sm uppercase tracking-widest text-[oklch(0.50_0.02_280)]">
                  Schedule a break to see the roster.
                </div>
              )}
            </section>

            <section id="history" className={c.tableCard}>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Date / Time</th>
                    <th className={c.th}>Attendance</th>
                    <th className={c.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {breaks.filter(b => b.status === 'completed').slice(0, 10).map((b, i) => {
                    const ct = attendances.filter(a => a.breakId === b._id).length
                    return (
                      <tr key={b._id} className="group">
                        <td className={c.td}>{new Date(b.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className={c.td}>{ct} User{ct !== 1 ? 's' : ''}</td>
                        <td className={c.td}>
                           <span className="px-2 py-1 bg-[oklch(0.62_0.19_145)] text-black border-2 border-[oklch(0.15_0.02_280)] font-bold uppercase text-[0.6rem] tracking-wider rounded-[3px]">Success</span>
                        </td>
                      </tr>
                    )
                  })}
                  {breaks.filter(b => b.status === "completed").length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm font-bold uppercase tracking-widest text-[oklch(0.50_0.02_280)] border-b border-[oklch(0.15_0.02_280)]">
                        No historical stretches yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </main>

        </div>
      </div>

      {modalOpen && (
        <div className={c.modalOverlay}>
          <div className={c.modalCard}>
            <div className={c.modalBar}>
              <span>{activeSegment === 4 ? "Finished" : "Stretch Flow Active"}</span>
              <span className="font-mono">
                {activeSegment !== 4 && activeBreak ? (() => {
                  const elapsed = Math.min(60, Math.floor((currentTime - activeBreak.targetTime) / 1000))
                  const left = 60 - elapsed
                  return `00:${left.toString().padStart(2, '0')}`
                })() : "--:--"}
              </span>
            </div>
            <div className={c.modalBody}>
              {activeSegment === 1 && (
                <>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-[oklch(0.52_0.18_255)]">Neck Roll</h3>
                  <p className="text-[0.9rem] font-medium leading-relaxed">Slowly roll your neck in circles. Look left, then look right. Breathe.</p>
                  <svg viewBox="0 0 100 100" className="w-32 h-32" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="50" cy="25" r="14" />
                    <path d="M50 39 v 30 M 50 45 l -25 10 M 50 45 l 25 10 M 50 69 l -18 20 M 50 69 l 18 20" />
                    <path d="M 25 25 A 35 30 0 0 1 75 25" strokeLinecap="round" strokeDasharray="4,6" stroke="oklch(0.55 0.24 28)"/>
                  </svg>
                </>
              )}
              {activeSegment === 2 && (
                <>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-[oklch(0.85_0.18_85)] text-black">Shoulder Open</h3>
                  <p className="text-[0.9rem] font-medium leading-relaxed">Pull shoulders up to your ears, then let them drop back and down.</p>
                  <svg viewBox="0 0 100 100" className="w-32 h-32" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="50" cy="20" r="14" />
                    <path d="M50 34 v 30 M 50 40 l -20 -15 M 50 40 l 20 -15 M 50 64 l -18 20 M 50 64 l 18 20" />
                    <path d="M 15 25 l 10 -15 M 75 25 l -10 -15" strokeLinecap="round" strokeDasharray="4,6" stroke="oklch(0.55 0.24 28)"/>
                  </svg>
                </>
              )}
              {activeSegment === 3 && (
                <>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-[oklch(0.62_0.19_145)] text-black">Toe Touch</h3>
                  <p className="text-[0.9rem] font-medium leading-relaxed">Reach forward and aim for your toes. It is about the stretch, not the target.</p>
                  <svg viewBox="0 0 100 100" className="w-32 h-32" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="20" cy="50" r="14" />
                    <path d="M34 50 h 40 M 45 40 l 15 10 M 45 60 l 15 -10 M 74 35 l -25 15 M 74 65 l -25 -15" />
                    <path d="M 80 20 l -15 0 M 80 80 l -15 0" strokeLinecap="round" strokeDasharray="4,6" stroke="oklch(0.55 0.24 28)"/>
                  </svg>
                </>
              )}
              {activeSegment === 4 && (
                <>
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Done!</h3>
                  <p className="text-[0.9rem] font-medium leading-relaxed">Blood is flowing. Time to lock in attendance.</p>
                  <button className={c.btnPrimary} onClick={handleLogAttendance}>
                    I DID IT
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isNameModalOpen && (
        <div className={c.modalOverlay}>
          <div className={c.modalCard}>
            <div className={c.modalBar}>
              <span>Player Setup</span>
              <button onClick={() => setIsNameModalOpen(false)}>X</button>
            </div>
            <div className={c.modalBody}>
              <label htmlFor="nameInput" className={c.label}>Enter your display name</label>
              <input 
                id="nameInput"
                type="text" 
                className={c.input} 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)} 
              />
              <button className={c.btnPrimary} onClick={() => setIsNameModalOpen(false)}>
                Save Identity
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}