import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // 1. Hooks and document shapes
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const { useLiveQuery, useDocument, database } = useFireproof("disposable-camera")
  const { doc: newRoll, merge: mergeRoll, submit: submitRoll } = useDocument({ type: "roll", eventName: "", devTime: 0 })
  const { docs: allRolls } = useLiveQuery("type", { key: "roll", descending: true })
  const { docs: allPhotos } = useLiveQuery("type", { key: "photo" })

  // Active roll is the newest one that hasn't finished its devTime
  const activeRoll = allRolls.find(r => r.devTime > now && allPhotos.filter(p => p.rollId === r._id).length < 24)

  // 2. Event handlers
  const handleCreateRoll = (e) => {
    e.preventDefault()
    if (!newRoll.eventName) return
    // Default dev time is next midnight
    const tomorrow = new Date()
    tomorrow.setHours(24, 0, 0, 0)
    mergeRoll({ devTime: tomorrow.getTime(), _id: `roll-${Date.now()}` })
    submitRoll()
  }

  const handleCapture = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeRoll) return
    
    setIsUploading(true)
    try {
      await database.put({
        type: "photo",
        rollId: activeRoll._id,
        capturedAt: Date.now(),
        _files: { image: file }
      })
    } finally {
      setIsUploading(false)
      e.target.value = '' // reset input
    }
  }

  const handleSuggest = async () => {
    setIsSuggesting(true)
    try {
      const prompt = "Suggest 1 brief, poetic name for a photo album (e.g., 'Midnight in Paris', 'Summer Solstice'). Just a short, elegant phrase."
      const res = await callAI(prompt, { schema: { properties: { name: { type: "string" } } } })
      const data = JSON.parse(res)
      mergeRoll({ eventName: data.name })
    } finally {
      setIsSuggesting(false)
    }
  }

  // 3. ClassNames
  const c = {
    page: "min-h-screen p-4 md:p-8 bg-[#f5f1ea] text-[#322d2c] font-sans antialiased selection:bg-[#50403f] selection:text-[#f5f1ea]",
    container: "max-w-3xl mx-auto flex flex-col gap-12 relative z-10",
    header: "flex flex-col gap-3 pb-8 pt-4",
    appTitle: "text-4xl md:text-5xl font-serif font-bold tracking-tight text-[#322d2c]",
    appDesc: "text-sm md:text-base max-w-md text-[#8a807f] leading-relaxed",
    
    rule: "w-full border-b border-[#443b3a] opacity-30",
    section: "flex flex-col gap-8",
    sectionHeader: "flex justify-between items-baseline",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[#8a807f]",
    
    form: "flex flex-col md:flex-row gap-4 items-end w-full",
    inputGroup: "flex flex-col gap-1 flex-grow w-full",
    inputLabel: "text-[0.60rem] uppercase tracking-[0.1em] text-[#8a807f]",
    input: "w-full p-3 bg-transparent border-b border-[#443b3a] focus:outline-none focus:border-[#50403f] focus:ring-0 transition-colors font-serif text-lg",
    
    buttonPrimary: "px-6 py-2 bg-[#50403f] text-[#f5f1ea] flex items-center justify-center min-h-[44px] hover:bg-[#322d2c] transition-colors text-sm uppercase tracking-widest font-semibold disabled:opacity-50",
    buttonSecondary: "px-4 py-2 border border-[#443b3a] text-[#443b3a] text-xs min-h-[44px] hover:bg-[#443b3a] hover:text-[#f5f1ea] transition-colors uppercase tracking-widest disabled:opacity-50",
    
    activeRollArea: "flex flex-col gap-8 p-6 md:p-10 border border-[#443b3a] bg-[#f0ebe1] relative overflow-hidden",
    statusBadge: "text-[0.55rem] uppercase tracking-[0.2em] px-2 py-1 bg-[#443b3a] text-[#f5f1ea]",
    mainActionArea: "flex flex-col items-center justify-center py-16 gap-6",
    captureBtn: "px-12 py-5 text-lg font-serif italic border border-[#443b3a] bg-[#f5f1ea] text-[#322d2c] hover:bg-[#50403f] hover:text-[#f5f1ea] transition-all cursor-pointer shadow-[4px_4px_0_#443b3a] active:translate-y-1 active:translate-x-1 active:shadow-none min-w-[240px] text-center",
    progressText: "text-xs font-mono tracking-widest text-[#8a807f]",
    
    archiveGrid: "grid grid-cols-2 md:grid-cols-4 gap-6",
    rollCard: "flex flex-col gap-3 border border-[#443b3a] p-4 bg-[#f0ebe1]",
    contactSheet: "grid grid-cols-4 gap-1 bg-[#443b3a] p-1",
    frame: "aspect-square bg-[#f5f1ea] overflow-hidden",
    frameHidden: "aspect-square border border-[#443b3a] border-dashed flex items-center justify-center bg-transparent text-[#8a807f] text-xs font-mono opacity-60",
  }

  // 4. JSX return
  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>
      <div className={c.container}>
        
        <header className={c.header}>
          <h1 className={c.appTitle}>Disposable Archive</h1>
          <p className={c.appDesc}>24 frames per roll. No previews. Develops at midnight. The constraint is the memory.</p>
        </header>

        <div className={c.rule}></div>

        <section className={c.section}>
          <div className={c.sectionHeader}>
            <h2 className={c.sectionLabel}>Active Exhibition</h2>
          </div>
          
          <div className={c.activeRollArea}>
            {!activeRoll ? (
              <form onSubmit={handleCreateRoll} className={c.form}>
                <div className={c.inputGroup}>
                  <label className={c.inputLabel}>Event Title</label>
                  <input 
                    type="text" 
                    className={c.input} 
                    placeholder="e.g. Midnight in Paris" 
                    value={newRoll.eventName}
                    onChange={(e) => mergeRoll({ eventName: e.target.value })}
                  />
                </div>
                <button type="button" className={c.buttonSecondary} onClick={handleSuggest} disabled={isSuggesting}>
                   {isSuggesting ? (
                     <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"></div>
                   ) : "Suggest"}
                </button>
                <button type="submit" className={c.buttonPrimary} disabled={!newRoll.eventName}>
                  Initialize Roll
                </button>
              </form>
            ) : (
              (() => {
                const activePhotos = allPhotos.filter(p => p.rollId === activeRoll._id)
                const isFull = activePhotos.length >= 24
                return (
                  <>
                    <div className={c.mainActionArea}>
                      <div className={c.statusBadge}>Active</div>
                      <h3 className="text-3xl font-serif text-[#322d2c] text-center">{activeRoll.eventName}</h3>
                      <p className={c.progressText}>{activePhotos.length} / 24 FRAMES EXPOSED</p>
                      
                      <label className={`${c.captureBtn} ${isFull || isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} disabled={isFull || isUploading} />
                        <span>
                          {isUploading ? "Exposing..." : isFull ? "Roll Full" : "Expose Frame"}
                        </span>
                      </label>
                      <p className="text-[#8a807f] text-xs italic mt-2">Will develop at {new Date(activeRoll.devTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    
                    <div className={c.archiveGrid}>
                      {activePhotos.map((_, i) => (
                        <div key={i} className={c.frameHidden}>{i + 1}</div>
                      ))}
                    </div>
                  </>
                )
              })()
            )}
          </div>
        </section>

        <div className={c.rule}></div>

        <section className={c.section}>
          <div className={c.sectionHeader}>
            <h2 className={c.sectionLabel}>Catalogued Rolls</h2>
          </div>
          
          <div className={c.archiveGrid}>
            {allRolls.filter(r => r.devTime <= now || allPhotos.filter(p => p.rollId === r._id).length >= 24).length === 0 && (
               <p className="text-[#8a807f] text-sm italic col-span-full">No exhibits catalogued yet.</p>
            )}
            {allRolls.filter(r => r.devTime <= now || allPhotos.filter(p => p.rollId === r._id).length >= 24).map(roll => {
              const rollPhotos = allPhotos.filter(p => p.rollId === roll._id).sort((a,b) => a.capturedAt - b.capturedAt)
              // Only consider developed if time has passed.
              const isDev = roll.devTime <= now;
              return (
                <div key={roll._id} className={c.rollCard}>
                  <div className="flex justify-between items-start">
                    <div className={c.statusBadge}>{isDev ? "Developed" : "Pending Max"}</div>
                  </div>
                  <h4 className="text-lg font-serif leading-tight">{roll.eventName}</h4>
                  <div className={c.contactSheet}>
                    {rollPhotos.map((photo, i) => (
                      <div key={i} className={c.frame}>
                        {isDev && photo._files?.image?.url ? (
                           <img src={photo._files.image.url} alt="frame" className="w-full h-full object-cover grayscale sepia-[.3]" />
                        ) : (
                           <div className="w-full h-full bg-[#322d2c] opacity-10"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}