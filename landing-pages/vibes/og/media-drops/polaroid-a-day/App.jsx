import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  const { database, useLiveQuery } = useFireproof("polaroid-wall")
  
  const todayKey = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

  const { docs: drops } = useLiveQuery("type", {
    key: "drop",
    descending: true
  })

  const existingToday = drops.find(d => d.dateKey === todayKey)
  const hasPostedToday = !!existingToday

  const handlePickFile = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || hasPostedToday) return
    setIsUploading(true)
    try {
      await database.put({
        type: "drop",
        dateKey: todayKey,
        ts: Date.now(),
        caption: caption.trim() || "UNDEFINED_",
        _files: { photo: file }
      })
      setFile(null)
      setPreview(null)
      setCaption("")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSuggest = async () => {
    setIsSuggesting(true)
    try {
      const resp = await callAI("Generate a cryptic, 3-word neobrutalist status report string for a daily photographic log.", {
        schema: {
          properties: { caption: { type: "string" } }
        }
      })
      const { caption: aiCap } = JSON.parse(resp)
      setCaption(aiCap.toUpperCase())
    } catch(err) {
      console.error(err)
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    appBody: "min-h-screen relative overflow-x-hidden font-sans pb-20 bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    bgPattern: "fixed inset-0 z-0 opacity-5 pointer-events-none",
    layout: "max-w-[920px] mx-auto p-4 md:p-8 flex flex-col gap-10 relative z-10",
    
    nav: "flex items-center justify-between p-4 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] relative shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    logoWrap: "flex items-center gap-2",
    logoSqWrap: "flex gap-0.5",
    logoSq1: "w-3 h-3 flex bg-[oklch(0.55_0.24_28)]",
    logoSq2: "w-3 h-3 flex bg-[oklch(0.85_0.18_85)]",
    logoSq3: "w-3 h-3 flex bg-[oklch(0.62_0.19_145)]",
    logoText: "font-bold uppercase tracking-tighter text-lg leading-none mt-1",
    navLinks: "flex gap-2",
    navLink: "px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] border-[3px] border-transparent hover:border-[oklch(0.15_0.02_280)] rounded-[4px] transition-all cursor-pointer hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[oklch(0.85_0.18_85)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    
    hero: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] relative px-6 py-10 md:p-12 flex flex-col gap-6 overflow-hidden shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    heroTopBar: "absolute top-0 left-0 w-full h-1.5 flex",
    heroBarRed: "h-full w-1/4 bg-[oklch(0.55_0.24_28)]",
    heroBarYellow: "h-full w-1/4 bg-[oklch(0.85_0.18_85)]",
    heroBarGreen: "h-full w-1/4 bg-[oklch(0.62_0.19_145)]",
    heroBarBlue: "h-full w-1/4 bg-[oklch(0.52_0.18_255)]",
    heroTitleWrap: "relative",
    heroTitle: "text-5xl md:text-7xl font-black uppercase tracking-[-0.02em] leading-[0.9] relative z-20",
    heroTextShadow: "text-5xl md:text-7xl font-black uppercase tracking-[-0.02em] leading-[0.9] absolute top-[5px] left-[5px] z-10 text-[oklch(0.55_0.24_28)] opacity-50 block",
    heroDesc: "font-mono text-sm max-w-sm mt-2 text-[oklch(0.50_0.02_280)]",
    
    mainGrid: "grid grid-cols-1 md:grid-cols-2 gap-8 items-start",
    
    dropZone: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] p-6 md:p-8 flex flex-col gap-6 relative shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    inputLabelGroup: "flex justify-between items-center mb-1",
    inputLabel: "text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)]",
    fileInputWrap: "relative border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] border-dashed p-10 flex items-center justify-center text-center cursor-pointer transition-all h-48 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:bg-[oklch(0.85_0.18_85_/_0.2)]",
    filePreviewImg: "absolute inset-0 w-full h-full object-cover rounded hidden",
    fileInputText: "font-bold uppercase tracking-wider text-sm pointer-events-none",
    textInput: "w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-3 font-mono text-sm transition-transform outline-none focus:outline-none focus:-translate-y-1 focus:-translate-x-1 focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)]",
    
    btnGroup: "flex items-center gap-4 mt-2",
    btnPrimary: "flex-1 text-center py-3 px-4 font-bold uppercase tracking-[0.05em] text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] transition-all cursor-pointer flex items-center justify-center bg-[oklch(0.55_0.24_28)] text-white shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-1 active:translate-x-1 active:shadow-none disabled:opacity-75 disabled:cursor-not-allowed",
    btnGhost: "px-4 py-3 font-bold uppercase tracking-[0.05em] text-sm rounded-[4px] transition-all cursor-pointer outline outline-3 outline-transparent hover:outline-[oklch(0.15_0.02_280)] hover:bg-[oklch(0.85_0.18_85)] hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-0.5 active:translate-x-0.5 active:shadow-none bg-transparent",
    
    successCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.62_0.19_145)] p-10 flex flex-col items-center justify-center text-center gap-4 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    statValue: "text-4xl font-mono font-bold leading-none",
    
    feedTitleInner: "text-[0.65rem] font-bold uppercase tracking-[0.15em] mb-4 text-left block text-[oklch(0.50_0.02_280)]",
    feedList: "flex flex-col gap-8",
    polaroidCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] p-4 pb-6 flex flex-col transition-transform shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)]",
    photoWrap: "w-full aspect-square border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden mb-5 bg-[oklch(0.96_0.01_90)] relative",
    photoImg: "w-full h-full object-cover",
    captionLine: "font-mono text-[13px] leading-relaxed mx-2",
    dateStamp: "text-[0.65rem] font-bold uppercase tracking-[0.12em] text-right mt-4 mx-2 border-t-[3px] border-[oklch(0.15_0.02_280)] pt-3 text-[oklch(0.50_0.02_280)]",
  };

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        html, body { margin: 0; padding: 0; font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .spin-slow { animation: spin 0.8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
      <div className={c.appBody}>
        <div className={c.bgPattern} style={{
           backgroundImage: 'linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)',
           backgroundSize: '60px 60px'
        }}></div>

        <div className={c.layout}>
          <header className={c.nav}>
            <div className={c.logoWrap}>
              <div className={c.logoSqWrap}>
                <div className={c.logoSq1}></div>
                <div className={c.logoSq2}></div>
                <div className={c.logoSq3}></div>
              </div>
              <span className={c.logoText}>DropWall</span>
            </div>
            <div className={c.navLinks}>
              <button type="button" className={c.navLink}>Sync</button>
            </div>
          </header>

          <section className={c.hero}>
            <div className={c.heroTopBar}>
              <div className={c.heroBarRed}></div>
              <div className={c.heroBarYellow}></div>
              <div className={c.heroBarGreen}></div>
              <div className={c.heroBarBlue}></div>
            </div>
            <div className={c.heroTitleWrap}>
              <h1 className={c.heroTitle}>One Drop<br/>A Day.</h1>
              <h1 className={c.heroTextShadow} aria-hidden="true">One Drop<br/>A Day.</h1>
            </div>
            <p className={c.heroDesc}>
               Hold the line. Submit a single visual artifact per rotation.
            </p>
          </section>

          <div className={c.mainGrid}>
            <div>
              {!hasPostedToday ? (
              <form className={c.dropZone} onSubmit={handleSubmit}>
                <div>
                  <div className={c.inputLabelGroup}>
                     <span className={c.inputLabel}>Visual Input</span>
                     <span className="font-mono text-[0.65rem] uppercase font-bold tracking-wider">01 REQ</span>
                  </div>
                  <label className={c.fileInputWrap}>
                     <input type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
                     {preview && <img src={preview} alt="preview" className={`${c.filePreviewImg} block`} />}
                     {!preview && <span className={c.fileInputText}>Select File</span>}
                  </label>
                </div>

                <div>
                  <div className={c.inputLabelGroup}>
                     <span className={c.inputLabel}>Caption Context</span>
                  </div>
                  <input type="text" className={c.textInput} placeholder="Subject identified..." value={caption} onChange={e => setCaption(e.target.value)} />
                </div>

                <div className={c.btnGroup}>
                  <button type="submit" className={c.btnPrimary} disabled={!file || isUploading}>
                     {isUploading ? (
                        <svg className="w-5 h-5 spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" strokeLinejoin="round"/></svg>
                     ) : 'Transmit'}
                  </button>
                  <button type="button" className={c.btnGhost} onClick={handleSuggest} disabled={isSuggesting}>
                     {isSuggesting ? '...' : 'Auto-tag'}
                  </button>
                </div>
              </form>
              ) : (
              <div className={`${c.successCard} !block`}>
                <span className={c.inputLabel}>Cycle Complete</span>
                <h2 className={c.statValue}>LOGGED</h2>
                <p className="font-mono text-sm max-w-xs mt-2 text-center">Return tomorrow for next transmission window.</p>
              </div>
              )}
            </div>

            <div>
               <span className={c.feedTitleInner}>Current Sequence</span>
               <div className={c.feedList}>
                  {drops.length === 0 && <p className="text-sm font-mono opacity-50 text-center py-10">No logs on record.</p>}
                  {drops.map((doc) => (
                     <div key={doc._id} className={c.polaroidCard}>
                        <div className={c.photoWrap}>
                           {doc._files?.photo?.url && (
                             <img src={doc._files.photo.url} alt={doc.caption} className={c.photoImg} />
                           )}
                        </div>
                        <p className={c.captionLine}>{doc.caption}</p>
                        <p className={c.dateStamp}>
                           {new Date(doc.ts).toLocaleString('en-CA', { 
                              year: 'numeric', month: '2-digit', day: '2-digit', 
                              hour: '2-digit', minute:'2-digit', hour12: false 
                           }).replace(',', ' / ')}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}