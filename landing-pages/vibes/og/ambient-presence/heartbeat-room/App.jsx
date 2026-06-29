App.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("heartbeat-room")
  
  const [userName, setUserName] = useState("OP-" + Math.floor(Math.random() * 9999))
  const [localBpm, setLocalBpm] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [mode, setMode] = useState("idle") // idle, camera, tap
  const [taps, setTaps] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameId = useRef(null)
  const [signalLog, setSignalLog] = useState([])

  useEffect(() => {
    if (!document.getElementById("theme-styles")) {
      const style = document.createElement("style")
      style.id = "theme-styles"
      style.textContent = `
        :root {
          --bg: oklch(0.96 0.01 90); --card-bg: oklch(1.00 0 0);
          --text: oklch(0.15 0.02 280); --border: oklch(0.15 0.02 280);
          --muted: oklch(0.50 0.02 280); --red: oklch(0.55 0.24 28);
          --yellow: oklch(0.85 0.18 85); --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
        }
        @keyframes throb {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.2); }
        }
        @keyframes drift { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }
        body { font-family: 'Space Grotesk', sans-serif; background: var(--bg); color: var(--text); }
      `
      document.head.appendChild(style)
    }
  }, [])

  const startCamera = async () => {
    try {
      setMode("camera")
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        processFrame()
      }
    } catch (e) {
      console.error(e)
      setMode("idle")
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    cancelAnimationFrame(animFrameId.current)
    setMode("idle")
  }

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext("2d")
    ctx.drawImage(videoRef.current, 0, 0, 32, 32) // Low res is fine for brightness block
    const frame = ctx.getImageData(0, 0, 32, 32).data
    let redSum = 0
    // Skip by 4 (RGBA)
    for (let i = 0; i < frame.length; i += 4) {
       redSum += frame[i]
    }
    
    // Naive signal processing - store recent sums to detect peaks
    const now = performance.now()
    setSignalLog(prev => {
      const window = prev.filter(s => now - s.time < 3000) // 3 second window
      window.push({ time: now, val: redSum })
      
      if (window.length > 30) {
         // Find crossing of average
         const avg = window.reduce((a, b) => a + b.val, 0) / window.length
         // We look for beats rising above the mean distinctly
         const beats = window.filter(s => s.val > avg * 1.05) 
         if (beats.length > 2) {
           const rate = (beats.length / 3) * 60 // est bpm based on 3 sec window peaks above threshold
           if (rate > 50 && rate < 180) {
             setLocalBpm(prevBpm => Math.round((prevBpm * 4 + rate) / 5)) // smooth it
           }
         }
      }
      return window
    })

    animFrameId.current = requestAnimationFrame(processFrame)
  }

  const { docs: historyDocs } = useLiveQuery("type", { key: "bpm_entry", descending: true, limit: 100 })
  const [isBroadcasting, setIsBroadcasting] = useState(false)

  const broadcastReading = async () => {
    if (localBpm === 0) return
    setIsBroadcasting(true)
    try {
      await database.put({
        type: "bpm_entry",
        userName: userName || "ANON",
        bpm: localBpm,
        timestamp: Date.now()
      })
      setLocalBpm(0)
      setMode("idle")
      setTaps([])
      stopCamera()
    } finally {
      setIsBroadcasting(false)
    }
  }

  const handleTap = () => {
    setMode("tap")
    const now = performance.now()
    setTaps(prev => {
      // Keep last 8 taps within 5 seconds for moving average
      const recent = prev.filter(t => now - t < 5000)
      recent.push(now)
      if (recent.length > 1) {
        const intervals = []
        for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1])
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const newBpm = Math.round(60000 / avgInterval)
        if (newBpm > 40 && newBpm < 220) setLocalBpm(newBpm)
      }
      return recent
    })
  }

  const c = {
    wrapper: "flex flex-col min-h-screen pb-24",
    page: "flex-1 w-full max-w-[920px] mx-auto px-8 py-12 flex flex-col gap-10 relative z-10",
    nav: "flex items-center justify-between p-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[4px_4px_0px_var(--border)] rounded-[4px] mt-4 mx-4 md:mx-auto max-w-[920px]",
    navLogo: "text-[1rem] font-[700] tracking-[-0.02em] uppercase flex items-center gap-2",
    hero: "p-8 md:p-12 bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[8px_8px_0px_var(--border)] rounded-[4px] flex flex-col items-center text-center gap-6 relative mt-4",
    title: "text-[2.5rem] md:text-[3.5rem] font-[700] uppercase tracking-[-0.02em] text-[var(--text)] relative z-10",
    heroBar: "absolute top-0 left-0 w-full h-[6px] flex z-20",
    inputGroup: "flex flex-col gap-2 w-full max-w-sm text-left",
    label: "text-[0.65rem] font-[600] uppercase tracking-[0.15em] text-[var(--muted)]",
    input: "w-full bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[4px] px-4 py-3 font-[600] focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_var(--border)] transition-all duration-150",
    btnPrimary: "bg-[var(--red)] text-white font-[700] uppercase tracking-[0.05em] text-[0.8rem] border-[3px] border-[var(--border)] rounded-[4px] px-6 py-4 shadow-[4px_4px_0px_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150",
    btnSecondary: "bg-[var(--yellow)] text-[var(--text)] font-[700] uppercase tracking-[0.05em] text-[0.8rem] border-[3px] border-[var(--border)] rounded-[4px] px-6 py-4 shadow-[3px_3px_0px_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6",
    statCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[4px_4px_0px_var(--border)] rounded-[4px] flex flex-col overflow-hidden",
    statHeader1: "bg-[var(--red)] text-white px-3 py-2 text-[0.65rem] font-[700] uppercase tracking-[0.1em] border-b-[3px] border-[var(--border)]",
    statHeader2: "bg-[var(--yellow)] text-[var(--text)] px-3 py-2 text-[0.65rem] font-[700] uppercase tracking-[0.1em] border-b-[3px] border-[var(--border)]",
    statHeader3: "bg-[var(--blue)] text-white px-3 py-2 text-[0.65rem] font-[700] uppercase tracking-[0.1em] border-b-[3px] border-[var(--border)]",
    statHeader4: "bg-[var(--green)] text-[var(--text)] px-3 py-2 text-[0.65rem] font-[700] uppercase tracking-[0.1em] border-b-[3px] border-[var(--border)]",
    statBody: "px-4 py-6 text-[2rem] font-['JetBrains_Mono'] font-[700] text-center flex-1 flex flex-col justify-center items-center",
    roomGrid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4",
    roomTile: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[4px_4px_0px_var(--border)] rounded-[4px] p-4 aspect-square flex flex-col items-center justify-center relative overflow-hidden transition-all duration-150",
    tilePulseRing: "absolute inset-4 rounded-full border-[3px] border-[var(--red)] opacity-30 pointer-events-none",
    tileName: "font-[700] text-[0.7rem] uppercase tracking-widest z-10 text-[var(--muted)] mb-1 font-['Space_Grotesk']",
    tileBpm: "text-[2.5rem] font-['JetBrains_Mono'] font-[700] z-10 leading-none",
    sectionLabel: "text-[0.65rem] font-[600] uppercase tracking-[0.15em] text-[var(--muted)] block mb-4 border-b-[3px] border-[var(--border)] pb-2",
    tableCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[4px_4px_0px_var(--border)] rounded-[4px] overflow-x-auto",
    table: "w-full text-left border-collapse min-w-[500px]",
    th: "px-4 py-3 border-b-[2px] border-[var(--border)] text-[0.6rem] font-[700] uppercase tracking-[0.1em]",
    td: "px-4 py-3 border-b-[1px] border-[var(--muted)] text-[0.82rem] font-['JetBrains_Mono']",
  }

  return (
    <div className={c.wrapper}>
      <header className={c.nav}>
        <div className={c.navLogo}>
          <div className="flex gap-1 mr-2">
            <div className="w-3 h-3 bg-[var(--red)] border-2 border-[var(--border)]"></div>
            <div className="w-3 h-3 bg-[var(--yellow)] border-2 border-[var(--border)]"></div>
            <div className="w-3 h-3 bg-[var(--green)] border-2 border-[var(--border)]"></div>
          </div>
          <span>HRTBT / DASHBOARD</span>
        </div>
      </header>

      <main className={c.page}>
        <section id="measure" className={c.hero}>
          <div className={c.heroBar}>
            <div className="flex-1 bg-[var(--red)] border-b-[3px] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--yellow)] border-b-[3px] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--green)] border-b-[3px] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--blue)] border-b-[3px] border-[var(--border)]" />
          </div>
          <div className="relative mb-2">
            <h1 className={c.title}>Telemetry Uplink</h1>
            <h1 className="text-[2.5rem] md:text-[3.5rem] font-[700] uppercase tracking-[-0.02em] text-[var(--red)] opacity-50 absolute top-[5px] left-[5px] z-0" aria-hidden="true">Telemetry Uplink</h1>
          </div>
          
          <div className="flex flex-col gap-4 w-full items-center">
            <div className={c.inputGroup}>
              <label className={c.label}>Operator Callsign</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="GUEST-01" className={c.input} />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              {mode === "camera" ? (
                <button onClick={stopCamera} className={c.btnSecondary}>Stop Lens</button>
              ) : (
                <button onClick={startCamera} className={c.btnSecondary}>Enable Lens</button>
              )}
              <button onClick={handleTap} className={c.btnSecondary}>Tap Tempo</button>
            </div>
            
            <div className="w-full max-w-sm aspect-video bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[4px] relative overflow-hidden flex items-center justify-center shadow-inner">
              {mode === "camera" && (
                 <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" playsInline muted />
              )}
              <canvas ref={canvasRef} width={32} height={32} className="hidden" />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none drop-shadow-md">
                {localBpm > 0 ? (
                  <>
                    <span className="text-[3rem] font-['JetBrains_Mono'] font-[700] leading-none mb-1 text-[var(--red)]">{localBpm}</span>
                    <span className="text-[0.65rem] font-[700] tracking-widest bg-white/80 px-2 py-1 rounded">LOCAL PROBE</span>
                  </>
                ) : (
                  <span className="text-sm font-[600] text-[var(--muted)] mix-blend-difference">{mode === 'camera' ? 'Acquiring PPG signal over lens...' : 'Tap or Camera for signal'}</span>
                )}
              </div>
            </div>

            <button 
              onClick={broadcastReading} 
              disabled={localBpm === 0 || isBroadcasting} 
              className={`${c.btnPrimary} w-full max-w-sm disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isBroadcasting ? (
                 <span className="flex items-center justify-center gap-2">
                   <svg className="w-4 h-4 animate-spin -ml-1 text-white border-[3px] border-white/30 border-t-white rounded-full" viewBox="0 0 24 24"></svg>
                   TRANSMITTING...
                 </span>
              ) : 'Broadcast to Room'}
            </button>
          </div>
        </section>

        <section id="room-stats" className={c.statRow}>
          <div className={c.statCard}>
            <div className={c.statHeader1}>Active Nodes</div>
            <div className={c.statBody}>{activeNodes.length} <span className="text-[0.8rem] mt-1 text-[var(--muted)] tracking-widest">USERS</span></div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader2}>Room Avg</div>
            <div className={c.statBody}>{roomAvg} <span className="text-[0.8rem] mt-1 text-[var(--muted)] tracking-widest">BPM</span></div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader3}>Peak Rate</div>
            <div className={c.statBody}>{roomPeak} <span className="text-[0.8rem] mt-1 text-[var(--muted)] tracking-widest">BPM</span></div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader4}>Status</div>
            <div className={c.statBody}><span className={`text-[1rem] font-['Space_Grotesk'] font-[700] ${activeNodes.length > 0 ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>{activeNodes.length > 0 ? "LIVE" : "STNDBY"}</span></div>
          </div>
        </section>

        <section id="room-grid" className="mt-12">
          <h2 className={c.sectionLabel}>Live Operator Grid</h2>
          <div className={c.roomGrid}>
            {activeNodes.length === 0 ? (
              <div className="col-span-full py-12 text-center text-[var(--muted)] font-[700] text-[0.8rem] uppercase tracking-[0.1em] border-[3px] border-dashed border-[var(--border)] rounded-[4px]">
                No signal detected
              </div>
            ) : (
              activeNodes.map(node => (
                <div key={node._id} className={c.roomTile}>
                  <div 
                    className={c.tilePulseRing} 
                    style={{ animation: `throb ${60 / node.bpm}s ease-in-out infinite` }}
                  ></div>
                  <div className={c.tileName}>{node.userName}</div>
                  <div className={c.tileBpm}>{node.bpm}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section id="history" className="mt-12">
           <h2 className={c.sectionLabel}>Transmission Log</h2>
           <div className={c.tableCard}>
             <table className={c.table}>
               <thead>
                 <tr>
                   <th className={c.th}>Time</th>
                   <th className={c.th}>Operator</th>
                   <th className={c.th}>Rate</th>
                 </tr>
               </thead>
               <tbody>
                 {historyDocs.length === 0 ? (
                   <tr>
                     <td colSpan="3" className="p-4 text-center text-[0.82rem] font-[700] text-[var(--muted)] uppercase tracking-widest">No log entries</td>
                   </tr>
                 ) : (
                   historyDocs.map(doc => (
                     <tr key={doc._id} className="hover:bg-[var(--yellow)] transition-colors duration-0">
                       <td className={c.td}>{new Date(doc.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                       <td className={c.td}>{doc.userName}</td>
                       <td className={c.td}>{doc.bpm}</td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </section>
      </main>
    </div>
  )
}