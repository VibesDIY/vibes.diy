import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [handleInfo, setHandleInfo] = useState({ name: "", connected: false })
  const [handleInput, setHandleInput] = useState("")
  const [friends, setFriends] = useState(["STATION ZERO", "THE ARCHIVIST"])
  const [friendInput, setFriendInput] = useState("")
  const [pattern, setPattern] = useState("SINGLE")
  const [activeToast, setActiveToast] = useState(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const sessionStart = useRef(Date.now())

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Homemade+Apple&family=Special+Elite&display=swap');
      .font-brass-title { font-family: 'Cinzel Decorative', serif; }
      .font-brass-script { font-family: 'Homemade Apple', cursive; }
      .font-brass-mono { font-family: 'Special Elite', monospace; }
      .bg-parchment-grain {
        background-color: #dcbfa6;
        background-image: repeating-linear-gradient(45deg, rgba(62,39,35,0.02) 0px, rgba(62,39,35,0.02) 2px, transparent 2px, transparent 4px);
      }
      .double-rule {
        position: relative;
        border: 2px solid #745428;
      }
      .double-rule::before {
        content: "";
        position: absolute;
        inset: 4px;
        border: 1px solid #745428;
        pointer-events: none;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const { database, useLiveQuery } = useFireproof("aether-knocks-v1")
  const { docs: knocks } = useLiveQuery("type", { key: "knock", descending: true, limit: 20 })

  useEffect(() => {
    if (!handleInfo.connected || !handleInfo.name) return
    if (knocks.length === 0) return
    const newest = knocks[0]
    if (newest.to === handleInfo.name && newest.ts > sessionStart.current) {
      triggerVibration(newest.pattern)
      setActiveToast(newest)
      sessionStart.current = newest.ts // Only trigger once per new knock
    }
  }, [knocks, handleInfo])

  function triggerVibration(pat) {
    if (!navigator.vibrate) return
    switch (pat) {
      case "SINGLE": navigator.vibrate(200); break;
      case "DOUBLE": navigator.vibrate([150, 100, 150]); break;
      case "LONG BUZZ": navigator.vibrate(800); break;
      case "S.O.S.": navigator.vibrate([100, 100, 100, 100, 100, 200, 200, 200, 200, 200, 200, 100, 100, 100, 100, 100]); break;
      default: navigator.vibrate(200)
    }
  }

  const c = {
    page: "min-h-screen p-4 flex flex-col md:p-8 items-center max-w-3xl mx-auto font-brass-mono text-[#3e2723] bg-parchment-grain",
    header: "w-full text-center mb-8",
    title: "text-4xl font-bold uppercase tracking-widest font-brass-title text-[#745428]",
    subtitle: "text-xl mt-2 font-brass-script text-[#3e2723]",
    section: "bg-[#c4a482] p-6 w-full mb-8 double-rule shadow-[4px_4px_0px_#3e2723]",
    sectionInner: "w-full relative z-10",
    h2: "text-xl font-bold uppercase mb-4 text-[#745428] tracking-widest",
    inputGrp: "flex gap-2 w-full",
    input: "flex-1 border-b-2 border-[#3e2723] bg-transparent p-2 outline-none text-[#3e2723] placeholder-[#745428]/50",
    btn: "border-2 border-[#cfa562] bg-[#c4a482] px-6 py-2 uppercase font-bold text-[#3e2723] hover:bg-[#745428] hover:text-[#dcbfa6] hover:border-[#745428] transition-colors shadow-[2px_2px_0px_#3e2723] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    grid: "grid grid-cols-2 md:grid-cols-3 gap-4",
    tile: "border-2 border-[#cfa562] bg-[#c4a482] p-4 text-center cursor-pointer flex flex-col items-center justify-center min-h-[100px] hover:bg-[#ffaa00] transition-colors shadow-[3px_3px_0px_#3e2723] active:translate-y-[3px] active:translate-x-[3px] active:shadow-none",
    patternRow: "flex flex-wrap gap-2 mb-6",
    patternBtn: "border-2 border-[#cfa562] px-3 py-1 cursor-pointer bg-[#c4a482] text-[#3e2723] transition-colors",
    patternBtnActive: "border-[#745428] bg-[#745428] text-[#dcbfa6] font-bold shadow-inner",
    logList: "flex flex-col gap-2 h-48 overflow-y-auto pr-2 scrollbar-thin",
    logItem: "flex justify-between border-b border-[#745428]/30 pb-2 text-sm",
    toast: "fixed bottom-6 left-1/2 -translate-x-1/2 p-4 double-rule bg-[#dcbfa6] text-[#3e2723] flex items-center gap-4 z-50 shadow-[6px_6px_0px_#3e2723] animate-bounce",
    spinner: "animate-spin w-4 h-4 rounded-full border-2 border-t-transparent"
  }

  function handleConnect(e) {
    e.preventDefault()
    if (!handleInput.trim()) return
    setHandleInfo({ name: handleInput.trim().toUpperCase(), connected: true })
  }

  function handleAddFriend(e) {
    e.preventDefault()
    if (!friendInput.trim()) return
    const add = friendInput.trim().toUpperCase()
    if (!friends.includes(add)) setFriends([...friends, add])
    setFriendInput("")
  }

  function handleTapTile(name) {
    if (!handleInfo.connected) return
    database.put({
      type: "knock",
      from: handleInfo.name,
      to: name,
      pattern,
      ts: Date.now()
    })
  }

  async function suggestHandle() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Suggest a mysterious, late-night radio telegraph handle (e.g. NIGHT OWL, GHOST PROTOCOL, STATIC). Return just 2-3 words, uppercase.", {
        schema: { type: "object", properties: { handle: { type: "string" } } }
      })
      const data = JSON.parse(res)
      setHandleInput(data.handle)
    } finally {
      setIsSuggesting(false)
    }
  }

  return (
    <div className={c.page}>
      <header className={c.header}>
        <h1 className={c.title}>KNOCK</h1>
        <p className={c.subtitle}>Telegraphic Communication Station</p>
      </header>

      <main className="w-full">
        {/* Setup Section */}
        <section className={c.section}>
          <div className={c.sectionInner}>
            <h2 className={c.h2}>Operator Registration</h2>
            <form onSubmit={handleConnect} className={c.inputGrp}>
              <input 
                type="text" 
                placeholder="Enter your handle..." 
                className={c.input}
                value={handleInput}
                onChange={e => setHandleInput(e.target.value)}
                disabled={handleInfo.connected}
              />
              {!handleInfo.connected && (
                <button type="button" className={c.btn} onClick={suggestHandle} disabled={isSuggesting}>
                  {isSuggesting ? <div className={c.spinner} /> : "?"}
                </button>
              )}
              <button type="submit" className={c.btn} disabled={handleInfo.connected}>
                {handleInfo.connected ? "Active" : "Connect"}
              </button>
            </form>
          </div>
        </section>

        {/* Directory Section */}
        <section className={c.section}>
          <div className={c.sectionInner}>
            <h2 className={c.h2}>Transmission Directory</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 uppercase">Pattern Select</label>
              <div className={c.patternRow}>
                {["SINGLE", "DOUBLE", "LONG BUZZ", "S.O.S."].map(p => (
                  <button 
                    key={p} 
                    className={`${c.patternBtn} ${pattern === p ? c.patternBtnActive : ""}`}
                    onClick={() => setPattern(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className={c.grid}>
              {friends.map(f => (
                <button key={f} className={c.tile} onClick={() => handleTapTile(f)}>
                  <span className="font-bold">{f}</span>
                  <span className="text-xs uppercase mt-2">[ TAP TO SEND ]</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleAddFriend} className={`mt-6 ${c.inputGrp}`}>
              <input 
                type="text" 
                placeholder="Add contact handle..." 
                className={c.input}
                value={friendInput}
                onChange={e => setFriendInput(e.target.value)}
              />
              <button type="submit" className={c.btn}>Add</button>
            </form>
          </div>
        </section>

        {/* Ledger Section */}
        <section className={c.section}>
          <div className={c.sectionInner}>
            <h2 className={c.h2}>Station Logbook</h2>
            <div className={c.logList}>
              {knocks.length === 0 && <div className="text-[#3e2723]/50 text-sm">No transmissions recorded today.</div>}
              {knocks.map(k => {
                const isSent = k.from === handleInfo.name
                const time = new Date(k.ts).toLocaleTimeString('en-US', { hour12: false })
                return (
                  <div key={k._id} className={c.logItem}>
                    <span>[{time}] {isSent ? `TX to ${k.to}` : `RX from ${k.from}`}</span>
                    <span>{k.pattern}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      {activeToast && (
        <div className={c.toast}>
          <span>{activeToast.from} knocked! ({activeToast.pattern})</span>
          <button className={c.btn} onClick={() => {
            handleTapTile(activeToast.from)
            setActiveToast(null)
          }}>Knock Back</button>
          <button className={c.btn} onClick={() => setActiveToast(null)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}