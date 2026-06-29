import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [localName, setLocalName] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [myGuess, setMyGuess] = useState("")
  const [isLoadingHint, setIsLoadingHint] = useState(false)

  const { database, useDocument, useLiveQuery } = useFireproof("cam-roll-trivia")

  const { doc: gameState, merge: mergeGameState } = useDocument({
    _id: "game_main",
    phase: "setup", // setup, guessing, reveal
    host: "",
    round: 1,
    blur: 50,
    startTime: 0
  })

  const { doc: photoDoc, merge: mergePhoto } = useDocument({
    _id: "round_photo",
    _files: {}
  })

  // Guesses for current round
  const { docs: allGuesses } = useLiveQuery("type", { key: "guess", descending: true })
  const currentGuesses = allGuesses.filter(g => g.round === gameState.round)

  const handleJoin = () => {
    if (localName.trim()) setPlayerName(localName.trim())
  }

  const handlePhotoUpload = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      mergePhoto({ _files: { photo: f } })
      mergeGameState({ phase: "guessing", host: playerName, blur: 50, startTime: Date.now() })
    }
  }

  const submitGuess = (e) => {
    e.preventDefault()
    if (!myGuess.trim()) return
    database.put({
      type: "guess",
      round: gameState.round,
      player: playerName,
      text: myGuess,
      award: null,
      createdAt: Date.now()
    })
    setMyGuess("")
  }

  const handleReveal = () => {
    mergeGameState({ phase: "reveal", blur: 0 })
  }

  const handleEndRound = () => {
    mergeGameState({ phase: "setup", host: "", round: gameState.round + 1, blur: 50 })
    mergePhoto({ _files: {} })
  }

  const awardGuess = (guessDoc, awardType) => {
    database.put({ ...guessDoc, award: awardType })
  }

  const hintPrompt = `We are playing a game where we guess what a blurry photo is. Suggest a funny, creative, single-line guess (max 8 words). Return JSON: { "guess": "A sandwich making a run for it" }`
  const getAIHint = async () => {
    setIsLoadingHint(true)
    try {
      const res = await callAI(hintPrompt, { schema: { properties: { guess: { type: "string" } } } })
      const data = JSON.parse(res)
      setMyGuess(data.guess)
    } finally {
      setIsLoadingHint(false)
    }
  }

  // Calculate scores based on awards
  const playerScores = {}
  allGuesses.forEach(g => {
    if (!playerScores[g.player]) playerScores[g.player] = 0
    if (g.award === 'closest') playerScores[g.player] += 3
    if (g.award === 'funniest') playerScores[g.player] += 2
    if (g.award === 'meh') playerScores[g.player] += 1
  })
  const leaderboard = Object.entries(playerScores).sort((a, b) => b[1] - a[1])

  const c = {
    page: "min-h-screen p-4 md:p-12 relative z-10 font-sans",
    ambient: "fixed inset-0 pointer-events-none -z-10",
    container: "max-w-[920px] mx-auto flex flex-col gap-8",
    nav: "flex items-center justify-between p-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    logoRow: "flex items-center gap-1",
    logoText: "font-bold text-lg uppercase tracking-tight ml-2 text-[var(--text)]",
    navLink: "px-4 py-2 text-xs font-bold uppercase bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150",
    
    heroCard: "flex flex-col relative p-6 gap-6 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[8px_8px_0_var(--border)]",
    heroBar: "absolute top-0 left-0 w-full flex h-[6px] border-b-[3px] border-[var(--border)]",
    heroTitle: "text-3xl md:text-[3rem] font-bold uppercase tracking-[-0.02em] leading-none text-[var(--text)] relative z-10",
    heroTitleMuted: "text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-2",
    
    uploadBox: "w-full min-h-[200px] flex flex-col items-center justify-center p-6 gap-4 cursor-pointer text-center relative bg-[var(--bg)] border-[3px] border-dashed border-[var(--border)] rounded-[4px] hover:bg-[var(--yellow)] transition-colors",
    imagePreview: "w-full max-h-[400px] object-contain border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    filterControls: "flex flex-col gap-2 mt-4",
    
    formRow: "flex flex-col md:flex-row gap-4 w-full items-start md:items-end",
    inputGroup: "flex flex-col gap-2 flex-grow",
    label: "text-xs font-bold uppercase tracking-wider text-[var(--text)]",
    input: "w-full p-3 font-medium bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0_var(--border)] transition-all",
    
    btnPrimary: "px-6 py-3 font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    btnSecondary: "px-6 py-3 font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "px-4 py-2 font-bold uppercase tracking-wider text-xs border-[3px] border-transparent hover:border-[var(--border)] rounded-[4px] hover:shadow-[3px_3px_0_var(--border)] hover:bg-[var(--card-bg)] transition-all cursor-pointer",
    
    statGrid: "grid grid-cols-1 md:grid-cols-4 gap-6",
    statCard: "flex flex-col overflow-hidden relative bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    statBarRed: "h-6 w-full flex items-center px-2 text-[0.6rem] font-bold uppercase bg-[var(--red)] text-white border-b-[3px] border-[var(--border)]",
    statBarYellow: "h-6 w-full flex items-center px-2 text-[0.6rem] font-bold uppercase bg-[var(--yellow)] text-[var(--text)] border-b-[3px] border-[var(--border)]",
    statBarBlue: "h-6 w-full flex items-center px-2 text-[0.6rem] font-bold uppercase bg-[var(--blue)] text-white border-b-[3px] border-[var(--border)]",
    statBarGreen: "h-6 w-full flex items-center px-2 text-[0.6rem] font-bold uppercase bg-[var(--green)] text-[var(--text)] border-b-[3px] border-[var(--border)]",
    statBody: "p-4 flex flex-col items-center justify-center gap-1",
    statValue: "text-3xl font-bold font-mono",
    statLabel: "text-[0.65rem] font-bold uppercase tracking-wider",
    
    tableCard: "w-full overflow-hidden",
    table: "w-full text-left border-collapse",
    th: "p-3 text-[0.6rem] font-bold uppercase tracking-widest",
    td: "p-3 text-[0.82rem] font-medium",
    
    guessCard: "flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)]",
    guessText: "font-bold text-lg text-[var(--text)]",
    guessAuthor: "text-xs uppercase font-bold text-[var(--muted)]",
    
    badgeClosest: "px-2 py-1 text-[0.65rem] font-bold uppercase bg-[var(--green)] text-[var(--text)] border-[2px] border-[var(--border)] rounded-[4px] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[2px_2px_0_var(--border)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all cursor-pointer",
    badgeFunniest: "px-2 py-1 text-[0.65rem] font-bold uppercase bg-[var(--yellow)] text-[var(--text)] border-[2px] border-[var(--border)] rounded-[4px] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[2px_2px_0_var(--border)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all cursor-pointer",
    badgeMeh: "px-2 py-1 text-[0.65rem] font-bold uppercase bg-[var(--bg)] text-[var(--text)] border-[2px] border-[var(--border)] rounded-[4px] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[2px_2px_0_var(--border)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all cursor-pointer",
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
        
        body {
          font-family: 'Space Grotesk', sans-serif;
          color: var(--text);
          background-color: var(--bg);
        }
        
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>

      <div className={c.page}>
        <div className={c.ambient} style={{
          backgroundImage: 'linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}>
          <div className="absolute top-10 left-10 w-16 h-16 rounded-full border-[3px] border-[var(--border)] bg-[var(--red)] opacity-20 transform -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-20 right-20 w-12 h-12 border-[3px] border-[var(--border)] bg-[var(--yellow)] rotate-45 opacity-20" />
          <div className="absolute top-1/2 right-10 w-10 h-10 rounded-full border-[3px] border-[var(--border)] bg-[var(--blue)] opacity-20" />
          <div className="absolute bottom-1/3 left-12 w-14 h-14 border-[3px] border-[var(--border)] bg-[var(--green)] opacity-20" />
        </div>

        <div className={c.container}>
          <header className={c.nav}>
            <div className={c.logoRow}>
              <div className="w-3 h-3 bg-[var(--red)] border-2 border-[var(--border)]"></div>
              <div className="w-3 h-3 bg-[var(--yellow)] border-2 border-[var(--border)]"></div>
              <div className="w-3 h-3 bg-[var(--green)] border-2 border-[var(--border)]"></div>
              <span className={c.logoText}>Camera-Roll Trivia</span>
            </div>
            <div>
              <button className={c.navLink}>Rules</button>
            </div>
          </header>

          <main className="flex flex-col gap-12">
            
            {/* Player Setup Section */}
            {!playerName && (
              <section id="auth" className={c.heroCard}>
                <div className={c.heroBar}>
                  <div className="flex-1 bg-[var(--red)]"></div>
                  <div className="flex-1 bg-[var(--yellow)]"></div>
                  <div className="flex-1 bg-[var(--green)]"></div>
                  <div className="flex-1 bg-[var(--blue)]"></div>
                </div>
                <div>
                  <h2 className={c.heroTitleMuted}>Welcome Player</h2>
                  <h1 className={c.heroTitle}>Enter Your Alias</h1>
                </div>
                <form className={c.formRow} onSubmit={(e) => { e.preventDefault(); handleJoin(); }}>
                  <div className={c.inputGroup}>
                    <label className={c.label}>Player Name</label>
                    <input 
                      className={c.input} 
                      type="text" 
                      placeholder="e.g. PixelPeeper" 
                      value={localName}
                      onChange={(e) => setLocalName(e.target.value)}
                    />
                  </div>
                  <button className={c.btnPrimary} type="submit" disabled={!localName.trim()}>Join Game</button>
                </form>
              </section>
            )}

            {/* Active Round Section - Host / Guessing */}
            {playerName && (
            <section id="round" className={c.heroCard}>
              <div className={c.heroBar}>
                <div className="flex-1 bg-[var(--red)]"></div>
                <div className="flex-1 bg-[var(--yellow)]"></div>
                <div className="flex-1 bg-[var(--green)]"></div>
                <div className="flex-1 bg-[var(--blue)]"></div>
              </div>
              
              <div>
                <h2 className={c.heroTitleMuted}>Round {gameState.round} • {gameState.phase}</h2>
                <h1 className={c.heroTitle}>
                  {gameState.phase === 'setup' ? 'Waiting for Host' : (gameState.phase === 'reveal' ? 'The Reveal!' : 'What is this?')}
                </h1>
              </div>

              {/* Upload & Obfuscate (Setup phase) */}
              {gameState.phase === 'setup' && (
                <div className="flex flex-col gap-4">
                  <label className={c.uploadBox}>
                    <span className="font-bold uppercase tracking-wider text-[var(--red)]">Tap to Host & Upload Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  <p className="text-xs font-bold text-center text-[var(--muted)]">Any player can host the next round!</p>
                </div>
              )}

              {/* Photo Preview (Guessing / Reveal phase) */}
              {gameState.phase !== 'setup' && photoDoc?._files?.photo?.url && (
                <div className="flex flex-col gap-4">
                  <img 
                    src={photoDoc._files.photo.url} 
                    className={c.imagePreview} 
                    style={{ filter: `blur(${gameState.blur}px)`, transition: 'filter 0.5s ease' }} 
                  />
                  {playerName === gameState.host && gameState.phase === 'guessing' && (
                    <div className={c.filterControls}>
                      <label className={c.label}>Adjust Blur Drop</label>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={gameState.blur}
                        onChange={(e) => mergeGameState({ blur: parseInt(e.target.value) })}
                        className="accent-[var(--red)] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Guessing Form */}
              {gameState.phase === 'guessing' && playerName !== gameState.host && (
                <form className={c.formRow} onSubmit={submitGuess}>
                  <div className={c.inputGroup}>
                    <label className={c.label}>Your Guess</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        className={c.input} 
                        type="text" 
                        placeholder="A majestic sandwich..." 
                        value={myGuess}
                        onChange={e => setMyGuess(e.target.value)}
                      />
                      <button type="button" className={c.btnSecondary} onClick={getAIHint} disabled={isLoadingHint}>
                        {isLoadingHint ? (
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="32" strokeLinecap="square"></circle>
                          </svg>
                        ) : 'AI Hint'}
                      </button>
                    </div>
                  </div>
                  <button className={c.btnPrimary} type="submit" disabled={!myGuess.trim()}>Submit</button>
                </form>
              )}
              
              {/* Host Actions */}
              {gameState.phase === 'guessing' && playerName === gameState.host && (
                <div className="flex gap-4 mt-2">
                  <button className={c.btnPrimary} onClick={handleReveal}>Reveal Photo</button>
                </div>
              )}
              {gameState.phase === 'reveal' && playerName === gameState.host && (
                <div className="flex gap-4 mt-2">
                  <button className={c.btnGhost} onClick={handleEndRound}>End Round</button>
                </div>
              )}

              {/* Tally / Guesses List */}
              {gameState.phase !== 'setup' && (
                <div className="flex flex-col gap-3 mt-6">
                  <h3 className={c.label}>Guesses ({currentGuesses.length})</h3>
                  {currentGuesses.map(g => (
                    <div key={g._id} className={c.guessCard}>
                      <div>
                        <div className={c.guessText}>{g.text}</div>
                        <div className={c.guessAuthor}>— {g.player}</div>
                      </div>
                      
                      {gameState.phase === 'reveal' && (
                        <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                          {playerName === gameState.host ? (
                            <>
                              <button onClick={() => awardGuess(g, g.award === 'closest' ? null : 'closest')} className={g.award === 'closest' ? c.badgeClosest : c.badgeMeh}>
                                {g.award === 'closest' ? '★ Closest' : 'Closest'}
                              </button>
                              <button onClick={() => awardGuess(g, g.award === 'funniest' ? null : 'funniest')} className={g.award === 'funniest' ? c.badgeFunniest : c.badgeMeh}>
                                {g.award === 'funniest' ? '★ Funniest' : 'Funniest'}
                              </button>
                              <button onClick={() => awardGuess(g, g.award === 'meh' ? null : 'meh')} className={g.award === 'meh' ? c.badgeMeh + " bg-[var(--blue)] text-white" : c.badgeMeh}>
                                Meh
                              </button>
                            </>
                          ) : (
                            g.award && (
                              <span className={g.award === 'closest' ? c.badgeClosest : g.award === 'funniest' ? c.badgeFunniest : c.badgeMeh + " bg-[var(--blue)] text-white"}>
                                {g.award}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {currentGuesses.length === 0 && <p className="text-sm font-medium text-[var(--muted)]">No guesses yet.</p>}
                </div>
              )}
            </section>
            )}

            {/* Leaderboard Section */}
            {playerName && leaderboard.length > 0 && (
              <section id="leaderboard">
                <h2 className={`${c.heroTitleMuted} mb-4`}>Leaderboard</h2>
                <div className={c.statGrid}>
                  {leaderboard.map(([player, score], index) => (
                    <div key={player} className={c.statCard}>
                      <div className={index === 0 ? c.statBarRed : index === 1 ? c.statBarYellow : index === 2 ? c.statBarBlue : c.statBarGreen}>
                        Rank {index + 1}
                      </div>
                      <div className={c.statBody}>
                        <div className={c.statValue}>{score}</div>
                        <div className={c.statLabel}>{player}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </main>
        </div>
      </div>
    </>
  )
}