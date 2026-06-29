import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("relay-dash-db")

  // The local user's primary transmission document
  // Fetch active network ops
  const { docs: onlineOps } = useLiveQuery("type", {
    key: "presence",
    descending: true
  })

  // Fetch recent reactions
  const { docs: rawReactions } = useLiveQuery("type", {
    key: "reaction",
    descending: true,
    limit: 10
  })
  
  // Only show reactions less than 10 seconds old
  const activeReactions = rawReactions.filter(r => Date.now() - r.timestamp < 10000)

  const { doc: presenceDoc, merge, submit } = useDocument({
    _id: "local-operator",
    type: "presence",
    handle: "NEW-OP",
    sprite: "(⌐■_■)",
    talk: false,
    blink: false,
    tilt: "NONE", // NONE, LEFT, RIGHT
    active: false,
    pingTime: Date.now()
  })

  // Reflect doc state into form inputs
  React.useEffect(() => {
    if (presenceDoc.active) {
       setHandle(presenceDoc.handle)
       setSprite(presenceDoc.sprite)
    }
  }, [presenceDoc.active, presenceDoc.handle, presenceDoc.sprite])

  const [handle, setHandle] = React.useState(presenceDoc.handle)
  const [sprite, setSprite] = React.useState(presenceDoc.sprite)
  const [isGenerating, setIsGenerating] = React.useState(false)

  const emitReaction = async (emoji) => {
     if (!presenceDoc.active) return
     await database.put({
       type: "reaction",
       handle: presenceDoc.handle,
       emoji: emoji,
       timestamp: Date.now()
     })
  }

  const handleConnect = (e) => {
    e.preventDefault();
    merge({
       handle: handle || "ANON",
       sprite: sprite || "[?]",
       active: true,
       pingTime: Date.now()
    })
    submit()
  }

  const handleGenSprite = async () => {
    setIsGenerating(true)
    try {
      const res = await callAI("Generate a single weird cool ascii emoticon/kaomoji using max 6 vertical chars. E.g. (O_o) or [x_x] or ಠ_ಠ.", {
        schema: {
          properties: {
             glyph: { type: "string" }
          }
        }
      })
      const data = JSON.parse(res)
      if (data.glyph) setSprite(data.glyph)
    } finally {
      setIsGenerating(false)
    }
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
          --yellow-dark: oklch(0.75 0.16 85);
          --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
          --radius: 4px;
          --shadow: 4px 4px 0px var(--border);
          --shadow-sm: 3px 3px 0px var(--border);
          --shadow-lg: 8px 8px 0px var(--border);
          --shadow-hover: 6px 6px 0px var(--border);
        }
        body { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        button, input { transition: all 0.15s ease-out; }
        button:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-hover); }
        button:active { transform: translate(2px, 2px); box-shadow: none; }

        @keyframes drift-spin {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(20px, 15px) rotate(180deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        @keyframes drift-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
      `}</style>
      <MainApp />
    </>
  );
}

function MainApp() {
  const c = {
    page: "min-h-screen relative w-full flex flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--text)] font-sans",
    ambient: "absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.04]",
    container: "relative z-10 w-full max-w-4xl mx-auto p-4 flex flex-col gap-6",
    
    nav: "flex items-center justify-between p-4 border-[3px] border-[var(--border)] rounded-[var(--radius)] bg-[var(--card-bg)] shadow-[var(--shadow)]",
    navLogo: "flex items-center gap-2 font-bold uppercase tracking-tight text-lg",
    navLogoDots: "flex gap-[2px]",
    navLogoDot: "w-3 h-3 border-[3px] border-[var(--border)]",
    navLinks: "flex gap-3",
    navPill: "px-3 py-1 border-[3px] border-[var(--border)] rounded-[var(--radius)] font-mono text-xs uppercase font-bold tracking-widest bg-[var(--bg)]",

    hero: "flex flex-col items-center justify-center py-12 px-8 border-[3px] border-[var(--border)] rounded-[var(--radius)] bg-[var(--card-bg)] text-center relative shadow-[var(--shadow)] z-10 box-border overflow-hidden mt-2",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex border-b-[3px] border-[var(--border)]",
    heroBarSegment: "flex-1",
    heroTitleWrap: "relative inline-block mt-4",
    heroTitle: "text-4xl md:text-5xl font-black uppercase m-0 tracking-tight",
    heroTitleShadow: "text-4xl md:text-5xl font-black uppercase m-0 absolute top-[5px] left-[5px] text-[var(--red)] opacity-50 select-none",
    heroSub: "mt-6 font-mono text-sm max-w-md font-medium px-4",

    workspace: "grid grid-cols-1 md:grid-cols-2 gap-8 my-4",

    panel: "flex flex-col border-[3px] border-[var(--border)] rounded-[var(--radius)] bg-[var(--card-bg)] shadow-[var(--shadow)] p-5 relative",
    panelHeader: "text-[0.65rem] font-black uppercase mb-5 pb-3 border-b-[3px] border-[var(--border)] tracking-[0.15em] text-[var(--muted)]",
    
    inputGroup: "flex flex-col gap-2 mb-5",
    label: "font-mono text-xs font-bold uppercase tracking-widest text-[var(--text)]",
    input: "px-3 py-2 border-[3px] border-[var(--border)] rounded-[var(--radius)] w-full font-mono text-sm bg-[var(--card-bg)] focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[var(--shadow-sm)] transition-all placeholder:text-[var(--muted)]",
    
    btnPrimary: "px-4 py-3 mt-2 border-[3px] border-[var(--border)] rounded-[var(--radius)] font-bold uppercase text-center bg-[var(--red)] text-white shadow-[var(--shadow-sm)] tracking-widest text-[0.8rem]",
    btnSecondary: "px-4 py-3 mt-2 border-[3px] border-[var(--border)] rounded-[var(--radius)] font-bold uppercase text-center bg-[var(--yellow)] shadow-[var(--shadow-sm)] tracking-widest text-[0.8rem]",
    btnGhost: "text-left text-xs uppercase font-bold tracking-widest text-[var(--blue)] underline decoration-2 underline-offset-4 mt-1 bg-transparent border-none p-0 w-fit hover:text-[var(--red)] cursor-pointer shadow-none",

    gridWrap: "flex flex-col gap-5",
    avatarCard: "flex items-start gap-4 p-4 border-[3px] border-[var(--border)] rounded-[var(--radius)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]",
    avatarSpriteWrap: "w-16 h-16 border-[3px] border-[var(--border)] rounded-[var(--radius)] flex items-center justify-center shrink-0 bg-[var(--yellow)]",
    avatarSprite: "font-mono text-xl whitespace-pre text-center leading-[1.2] font-black tracking-tighter",
    avatarData: "flex flex-col flex-1",
    avatarName: "font-bold uppercase tracking-tight text-lg leading-tight",
    avatarStatusRow: "flex flex-wrap gap-2 mt-2",
    avatarBadge: "text-[0.65rem] font-bold font-mono px-2 py-[2px] border-[2px] border-[var(--border)] rounded-[var(--radius)] uppercase bg-[var(--bg)]",
    
    controlsGroup: "flex flex-wrap gap-3 mt-4",
    toggleBtn: "px-3 py-3 border-[3px] border-[var(--border)] rounded-[var(--radius)] flex-1 text-center font-bold text-[0.7rem] uppercase tracking-widest shadow-[var(--shadow-sm)] bg-[var(--bg)] cursor-pointer select-none",
    reactionBtn: "w-14 h-14 flex items-center justify-center border-[3px] border-[var(--border)] rounded-[var(--radius)] font-black text-2xl shadow-[var(--shadow-sm)] bg-[var(--bg)] cursor-pointer select-none",
  }

  return (
    <div className={c.page}>
      <div className={c.ambient}>
        <div className="absolute top-[10%] left-[5%] w-[40px] h-[40px] bg-[var(--yellow)] border-[3px] border-[var(--border)] opacity-30 shadow-[var(--shadow-sm)]" style={{animation: 'drift-spin 8s infinite linear'}}></div>
        <div className="absolute top-[60%] right-[10%] w-[60px] h-[60px] bg-[var(--red)] border-[3px] border-[var(--border)] rounded-full opacity-20" style={{animation: 'drift-bounce 6s infinite ease-in-out'}}></div>
        <div className="absolute bottom-[20%] left-[15%] w-[30px] h-[30px] bg-[var(--blue)] border-[3px] border-[var(--border)] opacity-25" style={{animation: 'drift-spin 10s infinite linear reverse'}}></div>
      </div>

      <main className={c.container} id="app">
        <header className={c.nav} id="app-header">
          <div className={c.navLogo}>
            <div className={c.navLogoDots}>
              <div className={`${c.navLogoDot} bg-[var(--red)]`}></div>
              <div className={`${c.navLogoDot} bg-[var(--yellow)]`}></div>
              <div className={`${c.navLogoDot} bg-[var(--green)]`}></div>
            </div>
            <span>RELAY-DASH</span>
          </div>
          <div className={c.navLinks}>
            <div className={c.navPill}>NET: OK</div>
            <div className={c.navPill}>VER: 2.1</div>
          </div>
        </header>

        <section className={c.hero} id="section-hero">
          <div className={c.heroBar}>
            <div className={`${c.heroBarSegment} bg-[var(--red)]`}></div>
            <div className={`${c.heroBarSegment} bg-[var(--yellow)]`}></div>
            <div className={`${c.heroBarSegment} bg-[var(--green)]`}></div>
            <div className={`${c.heroBarSegment} bg-[var(--blue)]`}></div>
          </div>
          <div className={c.heroTitleWrap}>
            <h1 className={c.heroTitleShadow} aria-hidden="true">AVATAR MATRIX</h1>
            <h1 className={c.heroTitle}>AVATAR MATRIX</h1>
          </div>
          <p className={c.heroSub}>Establish local link. Transmit symbolic presence to the network array.</p>
        </section>

        <section className={c.workspace} id="section-workspace">
          
          <div className="flex flex-col gap-6">
            <div className={c.panel}>
              <h2 className={c.panelHeader}>STATION CONFIG</h2>
              <form onSubmit={handleConnect}>
                <div className={c.inputGroup}>
                  <label className={c.label}>OPERATOR HANDLE</label>
                  <input className={c.input} placeholder="CALLSIGN" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={12} />
                </div>
                <div className={c.inputGroup}>
                  <label className={c.label}>SPRITE GLYPH (4-6 CHARS)</label>
                  <input className={c.input} placeholder="(ʘ_ʘ)" value={sprite} onChange={(e) => setSprite(e.target.value)} maxLength={8} />
                  <button type="button" className={c.btnGhost} onClick={handleGenSprite} disabled={isGenerating}> 
                    {isGenerating ? (
                       <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        COMPUTING...
                       </span>
                    ) : "AI GLYPH SUGGEST"} 
                  </button>
                </div>
                <button type="submit" className={c.btnPrimary}>
                  {presenceDoc.active ? "UPDATE CALIBRATION" : "ENGAGE TRANSMISSION"}
                </button>
              </form>
            </div>

            <div className={c.panel}>
              <h2 className={c.panelHeader}>MANUAL OVERRIDES</h2>
              <div className={c.controlsGroup}>
                <button 
                  onClick={() => database.put({ ...presenceDoc, talk: !presenceDoc.talk, pingTime: Date.now() })}
                  disabled={!presenceDoc.active}
                  className={`${c.toggleBtn} ${presenceDoc.talk ? 'bg-[var(--green)] shadow-none transform translate-x-[2px] translate-y-[2px]' : ''}`}>
                  TALK {presenceDoc.talk ? '[ON]' : '[OFF]'}
                </button>
                <button 
                  onClick={() => database.put({ ...presenceDoc, blink: !presenceDoc.blink, pingTime: Date.now() })}
                  disabled={!presenceDoc.active}
                  className={`${c.toggleBtn} ${presenceDoc.blink ? 'bg-[var(--yellow)] shadow-none transform translate-x-[2px] translate-y-[2px]' : ''}`}>
                  BLINK {presenceDoc.blink ? '[ON]' : '[OFF]'}
                </button>
                <button 
                  onClick={() => database.put({ ...presenceDoc, tilt: presenceDoc.tilt === 'LEFT' ? 'NONE' : 'LEFT', pingTime: Date.now() })}
                  disabled={!presenceDoc.active}
                  className={`${c.toggleBtn} ${presenceDoc.tilt === 'LEFT' ? 'bg-[var(--blue)] text-white shadow-none transform translate-x-[2px] translate-y-[2px]' : ''}`}>
                  TILT [L]
                </button>
                <button 
                  onClick={() => database.put({ ...presenceDoc, tilt: presenceDoc.tilt === 'RIGHT' ? 'NONE' : 'RIGHT', pingTime: Date.now() })}
                  disabled={!presenceDoc.active}
                  className={`${c.toggleBtn} ${presenceDoc.tilt === 'RIGHT' ? 'bg-[var(--blue)] text-white shadow-none transform translate-x-[2px] translate-y-[2px]' : ''}`}>
                  TILT [R]
                </button>
              </div>
              <h2 className={c.panelHeader} style={{marginTop: '1.5rem'}}>EMIT REACTION</h2>
              <div className={c.controlsGroup}>
                <button onClick={() => emitReaction("⚡")} disabled={!presenceDoc.active} className={`${c.reactionBtn} hover:bg-[var(--blue)] hover:text-white`}>⚡</button>
                <button onClick={() => emitReaction("❤️")} disabled={!presenceDoc.active} className={`${c.reactionBtn} hover:bg-[var(--red)]`}>❤️</button>
                <button onClick={() => emitReaction("💀")} disabled={!presenceDoc.active} className={`${c.reactionBtn} hover:bg-[var(--border)] hover:text-white`}>💀</button>
                <button onClick={() => emitReaction("⚠️")} disabled={!presenceDoc.active} className={`${c.reactionBtn} hover:bg-[var(--yellow)]`}>⚠️</button>
              </div>
            </div>
          </div>

          <div className={c.panel}>
            <div className="flex justify-between items-end mb-5 border-b-[3px] border-[var(--border)] pb-3">
              <h2 className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-[var(--muted)] m-0">ACTIVE MATRIX</h2>
              <div className="flex gap-2 h-6 items-center">
                 {activeReactions.map(r => (
                   <span key={r._id} className="text-sm font-bold animate-bounce" title={r.handle}>{r.emoji}</span>
                 ))}
                 {activeReactions.length === 0 && <span className="text-[0.6rem] font-mono text-[var(--muted)] animate-pulse">AWAITING SIG...</span>}
              </div>
            </div>
            
            <div className={c.gridWrap}>
              {onlineOps.filter(op => op.active).length === 0 && (
                <div className="bg-[var(--bg)] border-[3px] border-[var(--border)] border-dashed p-6 text-center shadow-[var(--shadow-sm)]">
                   <p className="text-sm font-mono font-bold text-[var(--muted)] tracking-widest uppercase">Array Empty.</p>
                   <p className="text-xs font-mono text-[var(--muted)] mt-1">Calibrate configuration to engage.</p>
                </div>
              )}
              {onlineOps.filter(op => op.active).map(op => (
                <div key={op._id} className={c.avatarCard}>
                  <div className={`${c.avatarSpriteWrap} ${op.talk ? 'bg-[var(--green)]' : op.blink ? 'bg-[var(--bg)]' : 'bg-[var(--yellow)]'}`}>
                    <span className={c.avatarSprite} style={{
                      transform: op.tilt === 'LEFT' ? 'rotate(-15deg)' : op.tilt === 'RIGHT' ? 'rotate(15deg)' : 'none',
                      transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                      {op.sprite}
                    </span>
                  </div>
                  <div className={c.avatarData}>
                    <span className={c.avatarName}>{op.handle}</span>
                    <div className={c.avatarStatusRow}>
                      <span className={`${c.avatarBadge} ${op.talk ? 'border-[var(--green)] bg-[#d1fae5]' : ''}`}>
                         {op.talk ? 'TALK' : 'SILENT'}
                      </span>
                      {op.blink && <span className={`${c.avatarBadge} border-[var(--text)]`}>BLINK</span>}
                      {op.tilt !== 'NONE' && <span className={c.avatarBadge}>TILT</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>
    </div>
  )
}