import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  
  const { useLiveQuery, useDocument, database } = useFireproof("outfit-squad-db")

  const { doc, merge, submit } = useDocument({ 
    type: "outfit_check", 
    destination: "", 
    createdAt: Date.now(),
    _files: {}
  })

  const { docs: checks } = useLiveQuery("type", { key: "outfit_check", descending: true })
  const { docs: votes } = useLiveQuery("type", { key: "vote" })

  const calculateVerdict = (checkId) => {
    const checkVotes = votes.filter(v => v.checkId === checkId)
    const up = checkVotes.filter(v => v.val === 1).length
    const down = checkVotes.filter(v => v.val === -1).length
    return { up, down, total: up + down }
  }

  const activeChecks = checks.filter(c => (nowTick - c.createdAt) < 600000)
  const archiveChecks = checks.filter(c => (nowTick - c.createdAt) >= 600000)

  // Live timer tick for active checks
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // HANDLER STUBS
  const handleUploadClick = async (e) => {
    e.preventDefault();
    if (!doc._files?.photo || !doc.destination) return;
    setSubmitLoading(true)
    try {
      await submit()
      setPhotoUrl(null)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleVote = async (checkId, val) => {
    await database.put({ type: "vote", checkId, val, createdAt: Date.now() })
  }

  const generateSuggestion = async (e) => {
    e.preventDefault();
    setSuggestLoading(true)
    try {
      const response = await callAI("Suggest a fun, specific occasion to wear an outfit for (like 'Indie Rock Concert', 'Third Hinge Date', 'Sunday Farmers Market'). Just one.", {
         schema: {
           properties: {
             suggestion: { type: "string" }
           }
         }
      })
      const data = JSON.parse(response)
      if (data.suggestion) merge({ destination: data.suggestion.toUpperCase() })
    } finally {
      setSuggestLoading(false)
    }
  }

  // CLASSNAMES (Layout only)
  const c = {
    page: "relative max-w-[920px] mx-auto p-12 min-h-screen z-10 flex flex-col gap-12",
    nav: "flex justify-between items-center p-4 rounded border-[3px] border-[var(--border)] shadow-block bg-white",
    navLogo: "flex gap-2 items-center font-bold text-sm tracking-widest",
    navLinks: "flex gap-4",
    navLink: "px-4 py-2 font-bold text-xs rounded border-[3px] border-[var(--border)] shadow-block-sm hover-lift active-slam bg-[var(--yellow)]",
    
    hero: "p-8 rounded relative overflow-hidden flex flex-col items-center text-center border-[3px] border-[var(--border)] shadow-block bg-white",
    heroTitle: "text-5xl font-bold tracking-tight mb-4",
    heroAccentBar: "absolute top-0 left-0 w-full h-[6px] flex",
    
    uploadGrid: "grid grid-cols-1 md:grid-cols-2 gap-8",
    card: "p-6 rounded flex flex-col gap-4 border-[3px] border-[var(--border)] bg-white shadow-block",
    inputWrapper: "flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-widest font-bold text-[var(--muted)]",
    input: "p-3 rounded border-[3px] border-[var(--border)] font-mono text-sm w-full focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-block hover-lift transition-all",
    fileInput: "p-6 rounded border-[3px] border-[var(--border)] border-dashed flex flex-col items-center justify-center cursor-pointer min-h-[120px] bg-[var(--bg)] hover:bg-[var(--yellow)] transition-colors active-slam",
    
    btnContainer: "flex gap-4 mt-2",
    btnPrimary: "flex-1 py-3 px-6 rounded font-bold text-[0.8rem] tracking-wider uppercase text-center bg-[var(--red)] text-white border-[3px] border-[var(--border)] shadow-block hover-lift active-slam transition-all cursor-pointer",
    btnSecondary: "flex-1 py-3 px-6 rounded font-bold text-[0.8rem] tracking-wider uppercase text-center",
    btnGhost: "py-3 px-6 rounded font-bold text-[0.8rem] tracking-wider uppercase",
    btnAi: "ml-2 p-1 rounded text-[0.65rem] font-bold border-[3px] border-[var(--border)] bg-[var(--yellow)] shadow-block-sm hover-lift active-slam transition-all cursor-pointer",
    
    activeCheck: "p-6 rounded border-[3px] border-[var(--border)] bg-white shadow-block-lg flex flex-col md:flex-row gap-6 items-start",
    checkImgContainer: "w-full md:w-1/2 aspect-[3/4] rounded overflow-hidden border-[3px] border-[var(--border)] bg-[var(--bg)]",
    checkInfo: "w-full md:w-1/2 flex flex-col gap-6",
    checkTitle: "text-2xl font-bold uppercase",
    checkMeta: "font-mono text-sm",
    
    voteGrid: "flex gap-4 w-full",
    btnVoteUp: "flex-1 py-6 rounded font-bold text-xl border-[3px] border-[var(--border)] bg-[var(--green)] shadow-block hover-lift active-slam cursor-pointer transition-all",
    btnVoteDown: "flex-1 py-6 rounded font-bold text-xl border-[3px] border-[var(--border)] bg-[var(--red)] text-white shadow-block hover-lift active-slam cursor-pointer transition-all",
    
    archiveSection: "flex flex-col gap-6",
    archiveHeader: "text-sm uppercase tracking-widest font-bold border-b-[3px] border-[var(--border)] pb-2 text-[var(--muted)]",
    archiveGrid: "grid grid-cols-2 md:grid-cols-4 gap-4",
    archiveCard: "p-3 rounded border-[3px] border-[var(--border)] bg-white shadow-block flex flex-col gap-2 hover-lift transition-all cursor-pointer",
    archiveImg: "w-full aspect-square rounded border-[3px] border-[var(--border)] bg-[var(--bg)] object-cover mb-2",
    archiveVerdict: "text-center font-bold text-xs py-1 rounded border-[3px] border-[var(--border)] shadow-block-sm bg-[var(--yellow)]"
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
          --accent: oklch(0.55 0.24 28);
          --red: oklch(0.55 0.24 28);
          --yellow: oklch(0.85 0.18 85);
          --yellow-dark: oklch(0.75 0.16 85);
          --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
          --radius: 4px;
        }

        body {
          background-color: var(--bg);
          color: var(--text);
          font-family: "Space Grotesk", sans-serif;
          min-height: 100vh;
          background-image: 
            linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .mono { font-family: "JetBrains Mono", monospace; }
        
        .shadow-block { box-shadow: 4px 4px 0px var(--border); }
        .shadow-block-sm { box-shadow: 3px 3px 0px var(--border); }
        .shadow-block-lg { box-shadow: 8px 8px 0px var(--border); }
        
        .hover-lift:hover {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0px var(--border);
        }
        
        .active-slam:active {
          transform: translate(2px, 2px);
          box-shadow: none;
        }

        .hero-text-shadow {
          position: absolute;
          top: 5px;
          left: 5px;
          color: var(--red);
          opacity: 0.5;
          z-index: -1;
        }

        .ambient-shape {
          position: fixed;
          background-color: var(--border);
          opacity: 0.2;
          z-index: 1;
          pointer-events: none;
        }
        .shape-cross::before, .shape-cross::after {
          content: ''; position: absolute; background-color: inherit;
        }
        .shape-cross::before { width: 40px; height: 10px; top: 15px; left: 0; }
        .shape-cross::after { width: 10px; height: 40px; top: 0; left: 15px; }
      `}</style>

      {/* AMBIENT BACKGROUND DECORATIONS */}
      <div className="ambient-shape shape-cross" style={{ top: '10%', right: '15%' }}></div>
      <div className="ambient-shape shape-cross" style={{ bottom: '20%', left: '10%' }}></div>
      <div className="fixed top-[30%] left-[5%] w-[40px] h-[40px] bg-[var(--blue)] opacity-20 border-[3px] border-[var(--border)] rounded-full"></div>
      <div className="fixed bottom-[15%] right-[20%] w-[60px] h-[60px] bg-[var(--yellow)] opacity-20 border-[3px] border-[var(--border)] rotate-45"></div>

      <div className={c.page}>
        
        {/* NAV */}
        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className="flex">
              <div className="w-3 h-3 bg-[var(--red)] border-[var(--border)] border border-r-0"></div>
              <div className="w-3 h-3 bg-[var(--yellow)] border-[var(--border)] border border-r-0"></div>
              <div className="w-3 h-3 bg-[var(--green)] border-[var(--border)] border"></div>
            </div>
            OUTFIT CHECK
          </div>
          <div className={c.navLinks}>
            <button className={c.navLink}>PENDING ({activeChecks.length})</button>
            <button className={c.navLink}>ARCHIVE</button>
          </div>
        </header>

        {/* HERO */}
        <section className={c.hero}>
          <div className={c.heroAccentBar}>
            <div className="w-1/4 h-full bg-[var(--red)]"></div>
            <div className="w-1/4 h-full bg-[var(--yellow)]"></div>
            <div className="w-1/4 h-full bg-[var(--green)]"></div>
            <div className="w-1/4 h-full bg-[var(--blue)]"></div>
          </div>
          <h1 className="relative inline-block">
            <span className={c.heroTitle}>SQUAD VERDICT</span>
            <span className={`${c.heroTitle} hero-text-shadow`} aria-hidden="true">SQUAD VERDICT</span>
          </h1>
          <p className="max-w-md font-mono text-sm uppercase">Upload your fit. Declare destination. Get exactly 10 minutes of brutal honesty.</p>
        </section>

        {/* UPLOAD FORM */}
        <section className={c.card}>
          <div className={c.inputWrapper}>
            <label className={c.label}>1. SECURE IMAGE</label>
            <label className={c.fileInput}>
              {photoUrl ? (
                 <img src={photoUrl} alt="Preview" className="w-full h-full object-cover rounded max-h-[200px]" />
              ) : (
                 <>
                   <span className="font-mono text-sm font-bold uppercase mb-2">TAP TO BROWSE</span>
                   <span className="text-xs uppercase opacity-70">JPG, PNG ACCEPTED</span>
                 </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                 const f = e.target.files?.[0];
                 if (f) {
                   merge({ _files: { photo: f } })
                   setPhotoUrl(URL.createObjectURL(f))
                 }
              }} />
            </label>
          </div>

          <div className={c.inputWrapper}>
            <label className={c.label}>
              2. DESTINATION PROTOCOL
              <button onClick={generateSuggestion} disabled={suggestLoading} className={c.btnAi}>
                {suggestLoading ? "LOADING..." : "AI SUGGEST"}
              </button>
            </label>
            <input className={c.input} type="text" placeholder="e.g. Sushi Date, Interview..."
                   value={doc.destination || ""}
                   onChange={(e) => merge({ destination: e.target.value })} />
          </div>

          <div className={c.btnContainer}>
            <button className={c.btnPrimary} onClick={handleUploadClick} disabled={submitLoading || !doc.destination || !doc._files?.photo}>
              {submitLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  PROCESSING...
                </span>
              ) : "INITIATE CHECK"}
            </button>
          </div>
        </section>

        {/* ACTIVE CHECK */}
        {activeChecks.map(check => {
           const limits = calculateVerdict(check._id)
           const timeSeconds = Math.max(0, Math.floor((600000 - (nowTick - check.createdAt)) / 1000))
           const m = Math.floor(timeSeconds / 60)
           const s = timeSeconds % 60
           
           return (
             <section key={check._id} className={c.activeCheck}>
               <div className={c.checkImgContainer}>
                 {check._files?.photo?.url ? (
                    <img src={check._files.photo.url} className="w-full h-full object-cover" alt="Outfit" />
                 ) : (
                    <div className="w-full h-full min-h-[300px] flex items-center justify-center text-xs font-mono">LOADING FILE...</div>
                 )}
               </div>
               <div className={c.checkInfo}>
                 <div>
                   <div className="text-xs font-bold uppercase mb-2">TARGET SCENARIO</div>
                   <h2 className={c.checkTitle}>{check.destination}</h2>
                   <div className={c.checkMeta}>TIME REMAINING: {m}:{s < 10 ? '0':''}{s}</div>
                   <div className="mt-4 font-mono text-sm">CURRENT TALLY: GO({limits.up}) - NO({limits.down})</div>
                 </div>
                 
                 <div className="flex flex-col gap-2 w-full mt-auto">
                   <div className="font-bold text-xs uppercase text-center mb-2">CAST VOTE</div>
                   <div className={c.voteGrid}>
                     <button className={c.btnVoteUp} onClick={() => handleVote(check._id, 1)}>GO</button>
                     <button className={c.btnVoteDown} onClick={() => handleVote(check._id, -1)}>NO</button>
                   </div>
                 </div>
               </div>
             </section>
           )
        })}

        {/* ARCHIVE */}
        <section className={c.archiveSection}>
          <h3 className={c.archiveHeader}>DATABASE / PAST VERDICTS ({archiveChecks.length})</h3>
          <div className={c.archiveGrid}>
            {archiveChecks.map(check => {
               const limits = calculateVerdict(check._id)
               const won = limits.up - limits.down
               const btnColor = won > 0 ? 'bg-[var(--green)]' : won < 0 ? 'bg-[var(--red)] text-white' : 'bg-[var(--yellow)]'
               const lbl = won > 0 ? 'GO' : won < 0 ? 'NO' : 'DRAW'
               
               return (
                 <div key={check._id} className={c.archiveCard}>
                   {check._files?.photo?.url ? (
                     <img src={check._files.photo.url} className={c.archiveImg} alt="Archive" />
                   ) : (
                     <div className={c.archiveImg}></div>
                   )}
                   <div className="font-bold text-xs uppercase truncate" title={check.destination}>{check.destination}</div>
                   <div className={`${c.archiveVerdict} ${btnColor}`}>
                     {lbl} ({limits.up}-{limits.down})
                   </div>
                 </div>
               )
            })}
          </div>
        </section>

      </div>
    </>
  )
}