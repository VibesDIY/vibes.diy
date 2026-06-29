import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // Ensure we define standard web fonts matching Neobrutalism
  React.useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const c = {
    fontBody: "font-['Space_Grotesk',sans-serif]",
    page: "min-h-screen relative overflow-hidden font-['Space_Grotesk',sans-serif] flex flex-col items-center pb-20 bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    bgPattern: "fixed inset-0 z-0 bg-[linear-gradient(to_right,oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]",
    floaters: "fixed inset-0 z-0 pointer-events-none opacity-20 animate-[spin_60s_linear_infinite]",
    content: "w-full max-w-[920px] px-4 py-8 relative z-10 flex flex-col gap-8",
    
    nav: "flex items-center justify-between p-3 rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] font-bold uppercase bg-[oklch(1.00_0_0)]",
    navLogo: "flex flex-row gap-2 items-center text-lg font-black tracking-tight",
    navLogoDots: "flex gap-1",
    navDot: "w-3 h-3 rounded-[2px] border-2 border-[oklch(0.15_0.02_280)]",
    navRight: "flex gap-3 items-center",
    navChip: "px-3 py-1 rounded-[4px] text-xs tracking-wider font-bold border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] transition-all",

    heroCard: "relative w-full rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] shadow-[8px_8px_0px_oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] p-10 flex flex-col items-center text-center gap-6",
    heroAccent: "absolute top-0 left-0 w-full h-2 flex border-b-[3px] border-[oklch(0.15_0.02_280)]",
    heroAccentChunk: "flex-1 h-full",
    heroTitleWrap: "relative mt-2",
    heroTitle: "text-6xl md:text-8xl font-black uppercase tracking-[-0.02em] relative z-10",
    heroShadowText: "absolute inset-0 text-6xl md:text-8xl font-black uppercase tracking-[-0.02em] ml-2 mt-2 select-none text-[oklch(0.55_0.24_28)] opacity-50",
    
    statGrid: "grid grid-cols-2 md:grid-cols-4 gap-4 w-full",
    statCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden flex flex-col bg-[oklch(1.00_0_0)]",
    statHeader: "px-3 py-2 text-[0.65rem] tracking-[0.15em] uppercase font-bold text-center border-b-[3px] border-[oklch(0.15_0.02_280)]",
    statBody: "p-4 flex flex-col items-center justify-center font-mono text-4xl font-bold",
    statLabel: "text-[0.6rem] font-sans uppercase tracking-[0.15em] mt-1 text-[oklch(0.50_0.02_280)]",

    dashboardGrid: "grid grid-cols-1 md:grid-cols-2 gap-6 w-full",
    formCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] p-6 flex flex-col gap-4 bg-[oklch(1.00_0_0)]",
    formLabel: "text-[0.65rem] tracking-[0.15em] uppercase font-bold mb-2 block text-[oklch(0.50_0.02_280)]",
    input: "w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-3 text-sm font-medium bg-[oklch(0.96_0.01_90)] focus:outline-none focus:bg-[oklch(1.00_0_0)] focus:-translate-x-1 focus:-translate-y-1 focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all",
    
    btnRow: "flex flex-wrap gap-4 mt-2",
    btnPrimary: "flex-1 py-3 px-4 font-bold uppercase text-xs tracking-[0.05em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-center text-white bg-[oklch(0.55_0.24_28)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-70",
    btnSecondary: "flex-1 py-3 px-4 font-bold uppercase text-xs tracking-[0.05em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-center text-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-70",
    btnGhost: "py-3 px-4 font-bold uppercase text-xs tracking-[0.05em] border-[3px] border-transparent rounded-[4px] text-center text-[oklch(0.50_0.02_280)] hover:border-[oklch(0.15_0.02_280)] hover:bg-[oklch(1.00_0_0)] hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:text-[oklch(0.15_0.02_280)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",

    tableCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] overflow-hidden overflow-x-auto w-full",
    table: "w-full text-left border-collapse whitespace-nowrap",
    th: "px-4 py-3 text-[0.65rem] uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] font-bold text-[oklch(0.50_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    td: "px-4 py-3 text-[0.82rem] border-b border-[oklch(0.15_0.02_280)/0.2] font-medium hover:bg-[oklch(0.85_0.18_85)/0.1]",
    tdMono: "px-4 py-3 text-[0.82rem] border-b border-[oklch(0.15_0.02_280)/0.2] font-mono font-bold",
    badge: "inline-block px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] shadow-[2px_2px_0px_oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer active:bg-[oklch(0.62_0.19_145)]",

    feedItem: "p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] flex justify-between items-center bg-[oklch(1.00_0_0)] mb-4 last:mb-1 transition-all"
  }

  // Hooks and State
  const { useLiveQuery, useDocument, database } = useFireproof("emojigma-live-game")
  
  const [playerName, setPlayerName] = useState("")
  const [draftName, setDraftName] = useState("")
  const [draftGuess, setDraftGuess] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Create Round Doc
  const { doc: newRound, merge: mergeRound, submit: submitRound } = useDocument({
    type: "round",
    title: "",
    emoji: "",
    status: "active",
    createdAt: Date.now()
  })

  // Queries
  const activeRounds = useLiveQuery("type", { key: "round", descending: true }).docs
  const currentRound = activeRounds.find(r => r.status === "active")
  
  // Guesses for current round
  const currentGuesses = useLiveQuery("roundId", { key: currentRound?._id }).docs

  // Calculate scores
  const allCompletedRounds = activeRounds.filter(r => r.status === "completed" && r.winner)
  const scores = allCompletedRounds.reduce((acc, round) => {
    acc[round.winner] = (acc[round.winner] || 0) + 1
    return acc
  }, {})
  
  // Sort leaderboard
  const topPlayers = Object.entries(scores)
    .sort((a,b) => b[1] - a[1])
    .map(([name, score]) => ({ name, score }))

  const handleLogin = (e) => {
    e.preventDefault()
    if(draftName.trim()) setPlayerName(draftName.trim().toUpperCase())
  }

  const handleGuess = (e) => { 
    e.preventDefault() 
    if(!draftGuess.trim() || !playerName || !currentRound) return;
    
    // Auto-check exact match
    const isCorrect = draftGuess.trim().toLowerCase() === currentRound.title.toLowerCase();
    
    database.put({
      type: "guess",
      roundId: currentRound._id,
      player: playerName,
      guessText: draftGuess.toUpperCase(),
      createdAt: Date.now(),
      status: isCorrect ? "correct" : "pending"
    })
    
    // If correct, end the round automatically
    if(isCorrect) {
      database.put({ ...currentRound, status: "completed", winner: playerName })
    }
    
    setDraftGuess("")
  }

  const handleHost = (e) => { 
    e.preventDefault()
    // Mark previous active as completed if abandoning it
    if(currentRound) database.put({ ...currentRound, status: "completed" })
    submitRound()
  }

  const generateAI = async () => {
    setIsGenerating(true)
    try {
      const res = await callAI("Generate a charades puzzle: give me the title of a very famous movie, TV show, or book, and a sequence of 3 to 5 emojis describing it perfectly. Keep it fun and guessable.", {
        schema: {
          properties: {
            title: { type: "string" },
            emoji: { type: "string", description: "Just the emojis, no text" }
          }
        }
      })
      const data = JSON.parse(res)
      mergeRound({ title: data.title, emoji: data.emoji })
    } finally {
      setIsGenerating(false)
    }
  }

  const acceptGuess = (guessDoc) => {
    if(!currentRound) return;
    database.put({ ...guessDoc, status: "correct" })
    database.put({ ...currentRound, status: "completed", winner: guessDoc.player })
  }

  return (
    <div className={c.page}>
      {/* Ambient Deco */}
      <div className={c.bgPattern} />
      <div className={c.floaters}>
        <div className="absolute top-10 left-10 w-12 h-12 rounded-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)]" />
        <div className="absolute top-40 right-20 w-16 h-16 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] rotate-12" />
        <div className="absolute bottom-20 left-1/4 w-8 h-8 rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]" />
        <div className="absolute top-1/2 right-10 w-10 h-10 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] rotate-45" />
      </div>

      <main className={c.content}>
        
        {/* NAV */}
        <nav className={c.nav}>
          <div className={c.navLogo}>
            <div className={c.navLogoDots}>
              <div className={`${c.navDot} bg-[oklch(0.55_0.24_28)]`} />
              <div className={`${c.navDot} bg-[oklch(0.85_0.18_85)]`} />
              <div className={`${c.navDot} bg-[oklch(0.62_0.19_145)]`} />
            </div>
            EMOJIGMA
          </div>
          <div className={c.navRight}>
            {!playerName ? (
              <form onSubmit={handleLogin} className="flex gap-2 items-center">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="NAME?" 
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  className="w-24 px-2 py-1 text-xs border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] uppercase font-bold focus:outline-none focus:bg-[oklch(0.85_0.18_85)/0.2]"
                />
                <button type="submit" className={c.navChip}>JOIN</button>
              </form>
            ) : (
              <div className="flex gap-3 items-center">
                <span className="text-xs uppercase font-bold">👤 {playerName}</span>
                <button onClick={() => setPlayerName("")} className="text-[0.6rem] border-b-2 border-transparent hover:border-[oklch(0.15_0.02_280)]">CHANGE</button>
              </div>
            )}
          </div>
        </nav>

        {/* HERO - Active Round */}
        <section className={c.heroCard}>
          <div className={c.heroAccent}>
            <div className={`${c.heroAccentChunk} bg-[oklch(0.55_0.24_28)]`} />
            <div className={`${c.heroAccentChunk} bg-[oklch(0.85_0.18_85)]`} />
            <div className={`${c.heroAccentChunk} bg-[oklch(0.62_0.19_145)]`} />
            <div className={`${c.heroAccentChunk} bg-[oklch(0.52_0.18_255)]`} />
          </div>
          
          {currentRound ? (
            <>
              <div className="text-[0.65rem] tracking-[0.15em] uppercase font-bold text-[oklch(0.50_0.02_280)]">CURRENT PUZZLE</div>
              <div className={c.heroTitleWrap}>
                <div className={c.heroShadowText} aria-hidden="true">{currentRound.emoji}</div>
                <h1 className={c.heroTitle}>{currentRound.emoji}</h1>
              </div>

              {!playerName ? (
                <div className="mt-4 text-sm font-bold uppercase p-3 bg-[oklch(0.85_0.18_85)/0.2] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px]">
                  JOIN TOP RIGHT TO GUESS!
                </div>
              ) : (
                <form onSubmit={handleGuess} className="w-full max-w-sm mt-4 flex flex-col gap-3 relative z-20">
                  <input 
                    type="text" 
                    placeholder="YOUR GUESS..." 
                    value={draftGuess}
                    onChange={e => setDraftGuess(e.target.value)}
                    className={c.input} 
                  />
                  <button type="submit" className={c.btnPrimary} disabled={!draftGuess.trim()}>
                    SUBMIT GUESS
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="py-12 flex flex-col items-center gap-4">
              <div className="text-4xl text-[oklch(0.50_0.02_280)] mb-2">🤷‍♂️</div>
              <h2 className="text-2xl font-black uppercase tracking-[-0.02em]">NO ACTIVE ROUND</h2>
              <p className="text-sm font-medium uppercase text-[oklch(0.50_0.02_280)]">WAITING FOR THE HOST to START ON THE DASHBOARD</p>
            </div>
          )}
        </section>

        {/* STATS */}
        <section className={c.statGrid}>
          {[
            { id: 1, color: "bg-[oklch(0.55_0.24_28)]", text: "text-white" },
            { id: 2, color: "bg-[oklch(0.85_0.18_85)]", text: "text-[oklch(0.15_0.02_280)]" },
            { id: 3, color: "bg-[oklch(0.52_0.18_255)]", text: "text-white" },
            { id: 4, color: "bg-[oklch(0.62_0.19_145)]", text: "text-[oklch(0.15_0.02_280)]" }
          ].map((p, idx) => {
            const playerStat = topPlayers[idx]
            return (
              <div key={p.id} className={c.statCard}>
                <div className={`${c.statHeader} ${p.color} ${p.text} truncate px-1`}>
                  {playerStat ? playerStat.name : `P${p.id} SCORE`}
                </div>
                <div className={c.statBody}>
                  {playerStat ? playerStat.score : 0}
                  <span className={c.statLabel}>PTS</span>
                </div>
              </div>
            )
          })}
        </section>

        {/* CONTROLS (Host / Feed) */}
        <section className={c.dashboardGrid}>
          {/* Host Setup */}
          <div className={c.formCard}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold uppercase tracking-tight">HOST CONTROLS</h2>
              {currentRound && <div className="text-[0.6rem] px-2 py-1 bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] font-bold rounded-[2px] tracking-widest border-2 border-[oklch(0.15_0.02_280)]">ROUND ACTIVE</div>}
            </div>
            <form onSubmit={handleHost} className="flex flex-col gap-4">
              <div>
                <label className={c.formLabel}>SECRET TITLE</label>
                <input 
                  type="text" 
                  value={newRound.title}
                  onChange={e => mergeRound({ title: e.target.value })}
                  placeholder="e.g. Jurassic Park" 
                  className={c.input} 
                />
              </div>
              <div>
                <label className={c.formLabel}>EMOJI CLUES</label>
                <input 
                  type="text" 
                  value={newRound.emoji}
                  onChange={e => mergeRound({ emoji: e.target.value })}
                  placeholder="e.g. 🦖🦕🏝️" 
                  className={c.input} 
                />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnSecondary} disabled={!newRound.title || !newRound.emoji}>
                  START NEW
                </button>
                <button type="button" onClick={generateAI} disabled={isGenerating} className={c.btnGhost}>
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-[oklch(0.50_0.02_280)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      GEN...
                    </span>
                  ) : "💡 AI IDEA"}
                </button>
              </div>
            </form>
          </div>

          {/* Live Feed */}
          <div className={c.formCard}>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-2">LIVE GUESSES</h2>
            <div className="flex-1 overflow-y-auto max-h-[300px] border-[3px] border-[oklch(0.15_0.02_280)] p-2 bg-[oklch(0.96_0.01_90)] rounded-[4px] relative shadow-inner">
              {!currentRound ? (
                 <div className="text-[0.65rem] tracking-widest font-bold text-center mt-6 text-[oklch(0.50_0.02_280)]">START TO SEE GUESSES</div>
              ) : currentGuesses.length === 0 ? (
                 <div className="text-[0.65rem] tracking-widest font-bold text-center mt-6 text-[oklch(0.50_0.02_280)]">LISTENING...</div>
              ) : (
                currentGuesses.sort((a,b)=>b.createdAt - a.createdAt).map(g => (
                  <div key={g._id} className={`${c.feedItem} ${g.status === 'correct' ? 'bg-[oklch(0.62_0.19_145)] border-[oklch(0.15_0.02_280)]' : ''}`}>
                   <div className="flex flex-col">
                     <span className="text-[0.6rem] uppercase tracking-widest font-bold text-[oklch(0.50_0.02_280)]">{g.player}</span>
                     <span className="font-mono font-bold text-lg leading-tight uppercase truncate max-w-[120px] md:max-w-[160px]">{g.guessText}</span>
                   </div>
                   <div className="flex gap-2">
                     {g.status === 'correct' ? (
                       <span className="font-black text-[oklch(0.55_0.24_28)] text-2xl rotate-12 drop-shadow-[2px_2px_0px_white]">WINNER!</span>
                     ) : (
                       <button onClick={() => acceptGuess(g)} className={c.badge}>ACCEPT</button>
                     )}
                   </div>
                 </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* HISTORY */}
        {allCompletedRounds.length > 0 && (
          <section className={c.tableCard}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>PUZZLE</th>
                  <th className={c.th}>ANSWER</th>
                  <th className={c.th}>WINNER</th>
                  <th className={c.th}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {allCompletedRounds.map(r => (
                  <tr key={r._id}>
                    <td className={`${c.tdMono} text-xl tracking-widest`}>{r.emoji}</td>
                    <td className={`${c.td} font-bold uppercase`}>{r.title}</td>
                    <td className={c.td}>{r.winner}</td>
                    <td className={c.td}>
                      <span className="inline-block px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)]">SOLVED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

      </main>
    </div>
  )
}