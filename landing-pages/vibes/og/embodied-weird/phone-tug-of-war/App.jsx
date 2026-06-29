import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

import { useState, useEffect, useRef } from "react"

export default function App() {
  const c = {
    page: "min-h-screen bg-[#020406] text-[#b0c4cc] font-['Cormorant_Garamond',Georgia,serif] flex flex-col p-4 sm:p-6 md:p-8 w-full max-w-2xl mx-auto",
    header: "text-center mb-8 flex flex-col items-center gap-2",
    h1: "font-['Cinzel',serif] text-4xl sm:text-5xl font-bold uppercase tracking-[0.15em] text-[#00ffcc] drop-shadow-[0_0_12px_rgba(0,255,204,0.6)]",
    subtitle: "font-['Cinzel',serif] text-sm uppercase tracking-[0.2em] text-[#4a6070] mt-2",
    h2: "font-['Cinzel',serif] text-xl sm:text-2xl font-bold uppercase tracking-[0.15em] text-[#9d4eff] mt-8 mb-4",
    panel: "bg-[#05101a] border border-[#1c2b38] rounded-none p-6 sm:p-8 flex flex-col gap-6 shadow-xl",
    inputRow: "flex flex-col items-center gap-2 w-full max-w-xs mx-auto",
    input: "bg-transparent w-full border-b border-[#005f52] pb-2 outline-none text-center uppercase tracking-[0.2em] text-2xl text-[#b0c4cc] focus:border-[#00ffcc] focus:drop-shadow-[0_0_8px_rgba(0,255,204,0.4)] transition-all placeholder-[#1c2b38]",
    buttonRow: "flex flex-wrap gap-6 mt-4 justify-center",
    button: "font-['Cinzel',serif] font-bold tracking-[0.15em] text-sm uppercase px-4 py-2 cursor-pointer select-none whitespace-nowrap text-[#b0c4cc] hover:bg-[#00ffcc] hover:text-[#020406] transition-colors border border-transparent hover:border-[#00ffcc] active:bg-[#005f52]",
    knotArea: "relative w-full h-16 border border-[#1c2b38] bg-[#0d161f] flex items-center justify-between px-2 overflow-hidden my-8 rounded-none",
    track: "absolute inset-x-8 top-1/2 h-[1px] bg-[#1c2b38]",
    knot: "absolute top-1/2 w-8 h-8 flex items-center justify-center font-bold text-2xl -translate-y-1/2 -ml-4 text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.8)] z-10",
    rule: "h-[1px] w-full bg-[#1c2b38] my-8 flex items-center justify-center text-[#00ffcc] text-xs leading-none",
    runeList: "flex flex-col gap-3",
    runeRow: "flex justify-between items-center p-3 border border-[#1c2b38] bg-[#05101a] hover:bg-[#0d161f] transition-colors",
    rowMain: "flex items-center gap-3 font-['Cinzel',serif] text-sm tracking-widest text-[#b0c4cc]",
    rowStats: "flex items-center gap-4 text-right",
    muted: "font-['Cinzel',serif] text-xs uppercase tracking-widest text-[#4a6070]",
    cyanEmphasis: "font-semibold italic text-[#00ffcc]",
    statusBox: "text-center p-4 text-sm uppercase tracking-widest border border-[#1c2b38] bg-[#020406] text-[#9d4eff]",
  }

  const [matchId, setMatchId] = useState(null)
  const [joinCode, setJoinCode] = useState("")
  const { database, useLiveQuery } = useFireproof("aether-tug-v1")
  
  const { docs: activeMatches } = useLiveQuery("type", { key: "match" })
  const { docs: pastMatches } = useLiveQuery("status", { key: "finished", descending: true, limit: 10 })

  const currentMatch = activeMatches.find(m => m._id === matchId)

  // Win condition checker
  useEffect(() => {
    if (!currentMatch || currentMatch.status !== "active") return
    
    // Calculate tug balance. 50 is center. >100 is P1 win, <0 is P2 win.
    const tugBalance = 50 + (currentMatch.p1_score - currentMatch.p2_score)
    
    if (tugBalance >= 100 && currentMatch.winner === null) {
      if (playerRole === "p1") { // Let P1 commit the win state
        database.put({ ...currentMatch, status: "finished", winner: "p1" })
      }
    } else if (tugBalance <= 0 && currentMatch.winner === null) {
      if (playerRole === "p2") { // Let P2 commit the win state
        database.put({ ...currentMatch, status: "finished", winner: "p2" })
      }
    }
  }, [currentMatch, database, playerRole])

  // Sync loop: send our accumulated local force to the shared document
  useEffect(() => {
    if (!currentMatch || currentMatch.status !== "active") return
    
    const interval = setInterval(() => {
      const addedPull = localPullRef.current
      if (addedPull > 0) {
        localPullRef.current = 0 // consume
        database.put({
          ...currentMatch,
          [`${playerRole}_score`]: currentMatch[`${playerRole}_score`] + addedPull,
          [`${playerRole}_peak`]: Math.max(currentMatch[`${playerRole}_peak`], addedPull)
        })
      }
    }, 250)
    
    return () => clearInterval(interval)
  }, [currentMatch, database, playerRole])

  const [playerRole, setPlayerRole] = useState(null) // 'p1' or 'p2'

  // Ref to track local force accumulation before syncing
  const localPullRef = useRef(0)

  function startSensor() {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().then(state => {
        if (state === "granted") window.addEventListener("devicemotion", handleMotion)
      }).catch(console.error)
    } else {
      window.addEventListener("devicemotion", handleMotion)
    }
  }

  function handleMotion(e) {
    if (!e.accelerationIncludingGravity) return
    const { x, y, z } = e.accelerationIncludingGravity
    const mag = Math.sqrt(x*x + y*y + z*z)
    const force = Math.max(0, mag - 9.8)
    if (force > 1.5) {
      localPullRef.current += force * 0.1
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    startSensor()
    const code = Math.random().toString(36).substring(2, 6).toUpperCase()
    await database.put({
      _id: `match_${code}`,
      type: "match",
      status: "waiting",
      p1: code,
      p1_score: 0,
      p2_score: 0,
      p1_peak: 0,
      p2_peak: 0,
      winner: null,
      start_time: Date.now()
    })
    setMatchId(`match_${code}`)
    setPlayerRole("p1")
  }

  async function handleJoin(e) {
    e.preventDefault()
    const code = joinCode.toUpperCase()
    const targetMatch = activeMatches.find(m => m._id === `match_${code}`)
    if (targetMatch && targetMatch.status === "waiting") {
      startSensor()
      await database.put({
        ...targetMatch,
        status: "active",
        p2: code,
        start_time: Date.now()
      })
      setMatchId(`match_${code}`)
      setPlayerRole("p2")
    } else {
      alert("Binding not found or already sealed.")
    }
  }

  function handleTug(e) {
    e.preventDefault()
    // Manual fallback for desktop testing
    localPullRef.current += 3.5
  }

  async function leaveMatch(e) {
    e.preventDefault()
    if (currentMatch) {
      // End game on forfeit
      await database.put({
        ...currentMatch,
        status: "finished",
        winner: "severed"
      })
    }
    setMatchId(null)
    setPlayerRole(null)
    localPullRef.current = 0
  }

  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=optional');`}
      </style>
      <div className={c.page}>
        <header className={c.header}>
          <div className={c.h1}>Ætheric Tug</div>
          <div className={c.subtitle}>Kinetic Resonance Required</div>
        </header>

        <main className="flex-1 flex flex-col gap-8">
          {!matchId && (
            <section id="lobby" className={c.panel}>
            <div className="text-center">
              <p>Bind a new session or attune to an existing frequency.</p>
            </div>
            
            <form onSubmit={handleJoin} className={c.inputRow}>
              <label className={c.muted}>Enter Rune Code to Join</label>
              <input 
                className={c.input} 
                placeholder="ᛗ ᛒ ᚠ ᚱ" 
                maxLength={4}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
              />
              <div className={c.buttonRow}>
                <button type="submit" className={c.button}>
                  [ ATTUNE ]
                </button>
              </div>
            </form>

            <div className={c.rule}>
              <span>◊</span>
            </div>

            <div className="text-center">
              <button onClick={handleCreate} className={c.button}>
                [ INVOKE NEW BINDING ]
              </button>
            </div>
          </section>
          )}

          {matchId && currentMatch && (
          <section id="match" className={c.panel}>
            <div className="flex justify-between items-center">
              <span className={c.muted}>Binding: {currentMatch._id.replace('match_', '')}</span>
              <button onClick={leaveMatch} className={c.muted}>[ SEVER ]</button>
            </div>
            
            <div className={c.statusBox}>
              {currentMatch.status === "waiting" && "WAITING FOR OPPONENT..."}
              {currentMatch.status === "active" && "THE BINDING HOLDS. PULL!"}
              {currentMatch.status === "finished" && (
                <span className="text-[#00ffcc]">
                  BOND BROKEN. {currentMatch.winner === playerRole ? "VICTORY ACHIEVED." : "YOU WERE DEFEATED."}
                </span>
              )}
            </div>

            <div className={c.knotArea}>
              <div className={c.track}></div>
              <span className={`font-bold z-10 ${playerRole === 'p1' ? 'text-[#00ffcc]' : 'text-[#4a6070]'}`}>ᚠ</span>
              
              {/* Knot position formula clamps to edges to prevent overflow visually before the exact tick we commit winner */}
              <div 
                className={c.knot} 
                style={{ left: `${Math.max(5, Math.min(95, 50 + (currentMatch.p1_score - currentMatch.p2_score)))}%` }}
              >
                ◊
              </div>
              
              <span className={`font-bold z-10 ${playerRole === 'p2' ? 'text-[#00ffcc]' : 'text-[#4a6070]'}`}>ᛗ</span>
            </div>

            <div className="text-center relative">
               {currentMatch.status === "active" && (
                 <>
                  <p className={c.muted}>Channel physical energy. Shake to pull.</p>
                  <button onPointerDown={handleTug} className={`${c.button} mt-4 border-[#1c2b38]`}>
                    [ MANUAL CHUK ]
                  </button>
                 </>
               )}
               {currentMatch.status === "finished" && (
                 <button onClick={leaveMatch} className={`${c.button} mt-4`}>
                    [ RETURN TO LOBBY ]
                  </button>
               )}
            </div>
          </section>
          )}

          {/* LEADERBOARD SECTION */}
          {!matchId && (
            <section id="archive">
              <h2 className={c.h2}>The Archive of Clashes</h2>
              <div className={c.runeList}>
                {pastMatches.length === 0 && <p className={c.muted}>The ledger is silent.</p>}
                
                {pastMatches.map(game => (
                  <div key={game._id} className={c.runeRow}>
                    <div className={c.rowMain}>
                      <span className="font-bold text-[#9d4eff]">ᛗ</span>
                      <span>BOND: {game._id.replace('match_', '')}</span>
                      {game.winner && game.winner !== "severed" && (
                        <span className="text-[#00ffcc] ml-2">VICTOR: {game.winner.toUpperCase()}</span>
                      )}
                    </div>
                    <div className={c.rowStats}>
                      <span className={c.muted}>
                        Peak: {Math.max(game.p1_peak || 0, game.p2_peak || 0).toFixed(1)}e
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  )
}