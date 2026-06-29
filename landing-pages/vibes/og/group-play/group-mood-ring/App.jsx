import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // --- Hooks & Document Shapes ---
  const { database, useLiveQuery } = useFireproof("mood-ring-v1")
  const [handle, setHandle] = React.useState("GUEST")
  const [activeColor, setActiveColor] = React.useState("#40C4FF")
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  // Query events sorted chronologically (newest first). 
  // We'll use this feed to compute both current members AND average hue history.
  const { docs: logs } = useLiveQuery("type", { key: "mood_entry", descending: true, limit: 100 })

  // Derive unique active members (grouped by handle) holding their most recent state
  const activeMap = {}
  logs.forEach(entry => {
    if (!activeMap[entry.handle]) {
      activeMap[entry.handle] = entry
    }
  })
  const members = Object.values(activeMap)

  // Math helper for color averaging
  const hexToRgb = (h) => {
    let r = 0, g = 0, b = 0
    if (h && h.length === 7) {
      r = parseInt(h.substring(1, 3), 16)
      g = parseInt(h.substring(3, 5), 16)
      b = parseInt(h.substring(5, 7), 16)
    }
    return [r, g, b]
  }

  const rgbToHex = (r, g, b) => "#" + [r,g,b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')

  // Compute Room Hue: Average of all current active members
  let roomHue = "#ffffff"
  if (members.length > 0) {
    let totalR = 0, totalG = 0, totalB = 0
    members.forEach(m => {
      const [r, g, b] = hexToRgb(m.hex)
      totalR += r; totalG += g; totalB += b
    })
    roomHue = rgbToHex(totalR / members.length, totalG / members.length, totalB / members.length)
  }

  // --- Handlers ---
  const handleUpdateMood = async (e) => {
    e.preventDefault()
    if (!handle.trim()) return
    await database.put({
      type: "mood_entry",
      handle: handle.trim(),
      hex: activeColor,
      timestamp: Date.now()
    })
  }

  const handleNudge = async (targetHandle) => {
    // Write a playful nudge event
    await database.put({
      type: "mood_entry",
      handle: targetHandle,
      hex: "#ff3333", // force a red flash to wake them
      timestamp: Date.now(),
      isNudge: true
    })
  }

  const suggestMood = async () => {
    setIsSuggesting(true)
    try {
      const resp = await callAI("Suggest a bold, loud, neobrutalist hex color code that represents focus and kinetic energy. Return only a 6-digit hex and a tiny reason.", {
        schema: {
          properties: {
            hex: { type: "string" },
            reason: { type: "string" }
          }
        }
      })
      const data = JSON.parse(resp)
      if (data.hex) setActiveColor(data.hex.startsWith("#") ? data.hex : `#${data.hex}`)
    } finally {
      setIsSuggesting(false)
    }
  }

  // --- ClassNames (Structure Only - No Colors) ---
  const c = {
    layout: "relative min-h-screen flex flex-col items-center p-4 md:p-8 overflow-hidden font-sans transition-colors duration-1000",
    ambient: "fixed inset-0 z-0 pointer-events-none ambient-grid",
    content: "relative z-10 w-full max-w-[920px] flex flex-col gap-6",
    nav: "w-full flex items-center justify-between p-3 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    navLogo: "flex items-center gap-2 font-bold uppercase tracking-tight text-xl text-[var(--text)]",
    hero: "w-full flex flex-col items-center justify-center p-8 md:p-16 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[8px_8px_0px_var(--border)] text-center relative overflow-hidden",
    heroTitle: "text-4xl md:text-6xl font-black uppercase tracking-tighter mb-2 text-[var(--text)] relative",
    heroSubtitle: "text-sm uppercase tracking-widest font-mono text-[var(--muted)] z-10 bg-[var(--card-bg)] px-2",
    formCard: "w-full p-6 flex flex-col md:flex-row gap-4 items-end rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    inputWrapper: "flex flex-col gap-1 w-full",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "w-full p-2 h-10 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-sm outline-none transition-transform focus:-translate-y-0.5 focus:-translate-x-0.5 focus:shadow-[4px_4px_0px_var(--border)] bg-[var(--card-bg)] text-[var(--text)]",
    colorPicker: "w-16 h-10 p-0 border-[3px] border-[var(--border)] rounded-[4px] cursor-pointer block hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_var(--border)] transition-all",
    btnPrimary: "h-10 px-6 uppercase text-[0.8rem] tracking-wider font-bold rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--red)] text-white shadow-[4px_4px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all flex items-center justify-center whitespace-nowrap",
    btnGhost: "h-10 px-4 uppercase text-[0.8rem] tracking-wider font-bold rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_var(--border)] transition-all flex items-center justify-center whitespace-nowrap",
    grid: "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] overflow-hidden",
    statHeader: "w-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] font-bold flex justify-between items-center border-b-[3px] border-[var(--border)] bg-[var(--blue)] text-white",
    statBody: "p-4 flex flex-col items-center justify-center gap-2",
    statColorBadge: "w-12 h-12 rounded-[4px] border-[3px] border-[var(--border)] shadow-[3px_3px_0px_var(--border)]",
    statName: "font-mono font-bold text-lg uppercase text-[var(--text)]",
    statNudgeBtn: "mt-2 px-3 py-1 text-[0.7rem] uppercase font-bold border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] shadow-[3px_3px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[5px_5px_0px_var(--border)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all rounded-[4px]",
    tableCard: "w-full border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] flex flex-col overflow-hidden shadow-[4px_4px_0px_var(--border)]",
    tableHeader: "p-3 border-b-[3px] border-[var(--border)] flex items-center justify-between",
    tableTitle: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    historyRow: "w-full p-3 flex gap-1 overflow-x-auto scrollbar-hide",
    historyChip: "w-6 h-6 shrink-0 border-[3px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0px_var(--border)]"
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        :root {
          --bg: oklch(0.96 0.01 90);
          --card-bg: oklch(1.00 0 0);
          --text: oklch(0.15 0.02 280);
          --border: oklch(0.15 0.02 280);
          --muted: oklch(0.50 0.02 280);
          --red: oklch(0.55 0.24 28);
          --yellow: oklch(0.85 0.18 85);
          --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
        }
        body { background-color: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .hero-text-shadow { position: absolute; left: 5px; top: 5px; color: var(--red); z-index: -1; opacity: 0.5; }
        
        @keyframes drift { 0% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(20px,20px) rotate(10deg); } 100% { transform: translate(0,0) rotate(0deg); } }
        .float-block-1 { animation: drift 8s ease-in-out infinite; }
        .float-block-2 { animation: drift 12s ease-in-out infinite reverse; }
        
        .ambient-grid {
          background-size: 60px 60px;
          background-image: 
            linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
        }
      `}</style>
      
      {/* Decorative ambient background */}
      <div className={c.ambient}>
        <div className="absolute inset-0 z-0"></div>
        <div className="absolute top-10 left-10 w-[60px] h-[60px] rounded-full border-[3px] border-[var(--border)] bg-[var(--red)] opacity-20 float-block-1"></div>
        <div className="absolute bottom-20 right-10 w-[40px] h-[40px] border-[3px] border-[var(--border)] bg-[var(--yellow)] rotate-45 opacity-20 float-block-2"></div>
      </div>

      <div className={c.layout} style={{ backgroundColor: members.length > 0 ? roomHue : undefined }}>
        <div className={c.content}>
          
          <header className={c.nav}>
            <div className={c.navLogo}>
              <div className="flex gap-1">
                <div className="w-3 h-3 border-[3px] border-[var(--border)] rounded-[2px] bg-[var(--red)]" />
                <div className="w-3 h-3 border-[3px] border-[var(--border)] rounded-[2px] bg-[var(--yellow)]" />
                <div className="w-3 h-3 border-[3px] border-[var(--border)] rounded-[2px] bg-[var(--green)]" />
              </div>
              <span>Level Mood</span>
            </div>
            <div className={c.label}>Sync Active</div>
          </header>

          <section id="hero" className={c.hero}>
            <div className="absolute top-0 left-0 right-0 h-[6px] flex">
               <div className="flex-1 bg-[var(--red)]" />
               <div className="flex-1 bg-[var(--yellow)]" />
               <div className="flex-1 bg-[var(--green)]" />
               <div className="flex-1 bg-[var(--blue)]" />
            </div>
            <div className={c.heroSubtitle}>Live Room Hue</div>
            <div className="relative mt-2">
              <h1 className={c.heroTitle}>{members.length > 0 ? roomHue : "No Data"}</h1>
              <h1 className={`${c.heroTitle} hero-text-shadow`} aria-hidden="true">{members.length > 0 ? roomHue : "No Data"}</h1>
            </div>
          </section>

          <section id="controls" className={c.formCard}>
            <div className={c.inputWrapper}>
              <label className={c.label}>Operative Handle</label>
              <input 
                className={c.input} 
                type="text" 
                placeholder="CALLSIGN" 
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className={c.inputWrapper}>
              <label className={c.label}>Mood Hex</label>
              <div className="flex gap-2 w-full">
                <input 
                  className={c.colorPicker} 
                  type="color" 
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                />
                <input 
                  className={c.input} 
                  type="text" 
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto shrink-0 justify-end h-full">
               <button className={c.btnPrimary} onClick={handleUpdateMood}>
                 Lock In
               </button>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto shrink-0 justify-end h-full">
               <button className={c.btnGhost} onClick={suggestMood} disabled={isSuggesting}>
                 {isSuggesting ? (
                   <div className="flex items-center gap-2">
                     <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span>Thinking</span>
                   </div>
                 ) : (
                   "AI Suggest"
                 )}
               </button>
            </div>
          </section>

          <section id="active-members" className={c.grid}>
            {members.length === 0 && <div className="text-[var(--muted)] font-mono uppercase text-sm mt-2">No agents active</div>}
            
            {members.map((m, idx) => {
              const isStale = (Date.now() - m.timestamp) > 1000 * 60 * 60 // 1 hour old
              const headerColorClass = isStale ? "bg-[var(--red)]" : ['bg-[var(--blue)]', 'bg-[var(--green)]', 'bg-[var(--yellow)]'][idx % 3]
              const headerTextClass = (headerColorClass === 'bg-[var(--yellow)]') ? 'text-[var(--text)]' : 'text-white'
              
              return (
                <div key={m.handle} className={c.statCard}>
                  <div className={`${c.statHeader} ${headerColorClass} ${headerTextClass}`}>
                    <span className="truncate max-w-[80px]">{m.handle}</span>
                    <span>{isStale ? "Stale" : "Active"}</span>
                  </div>
                  <div className={c.statBody}>
                    <div className={c.statColorBadge} style={{ backgroundColor: m.hex }} />
                    <div className={c.statName}>{m.hex}</div>
                    {isStale && (
                      <button className={c.statNudgeBtn} onClick={() => handleNudge(m.handle)}>
                        Nudge Team
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>

          <section id="history" className={c.tableCard}>
            <div className={c.tableHeader}>
              <span className={c.tableTitle}>Hue History Sequence</span>
            </div>
            <div className={c.historyRow}>
              {logs.map((log) => (
                <div 
                  key={log._id} 
                  className={c.historyChip} 
                  style={{ backgroundColor: log.hex }} 
                  title={`${log.handle} at ${new Date(log.timestamp).toLocaleTimeString()}`}
                />
              ))}
              {logs.length === 0 && <div className="text-[var(--muted)] font-mono text-xs uppercase px-2">Log is empty</div>}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}