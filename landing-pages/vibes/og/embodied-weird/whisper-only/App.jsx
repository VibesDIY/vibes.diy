import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const THEME = `
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
  body { background-color: var(--bg); color: var(--text); }
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
`;

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isPenalty, setIsPenalty] = useState(false);
  
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const reqRef = useRef(null);
  
  const THRESHOLD = 65; // ~25% of 255 byte scale

  const { useLiveQuery, database } = useFireproof("whisper-net");
  const { docs: logs } = useLiveQuery("type", { key: "penalty", descending: true, limit: 10 });
  const [vibe, setVibe] = useState("");
  const [isVibeLoading, setIsVibeLoading] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = THEME;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const handleConnect = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } 
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      setIsActive(true);
      checkVolume();
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const getRoomVibe = async () => {
    setIsVibeLoading(true);
    try {
      const summary = logs.map(l => l.peak).join(", ");
      const prompt = `Based on these recent DB peaks: ${summary || "none"}. Generate a dramatic, short, 10-word overseer assessment of the agents' discipline.`;
      const response = await callAI(prompt, {
        schema: { properties: { assessment: { type: "string" } } }
      });
      const data = JSON.parse(response);
      setVibe(data.assessment);
    } finally {
      setIsVibeLoading(false);
    }
  };

  const triggerPenalty = async (peak) => {
    if (isPenalty) return;
    setIsPenalty(true);
    
    await database.put({
      type: "penalty",
      subject: "LOCAL USER",
      peak: peak.toFixed(1),
      timestamp: Date.now()
    });
    
    setTimeout(() => {
      setIsPenalty(false);
    }, 3000);
  };

  const penaltyRef = useRef(false);
  useEffect(() => { penaltyRef.current = isPenalty; }, [isPenalty]);

  const checkVolume = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate simple average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    
    setVolume(avg);

    if (avg > THRESHOLD && !penaltyRef.current) {
      triggerPenalty(avg);
    }
    
    reqRef.current = requestAnimationFrame(checkVolume);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(reqRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
    };
  }, []);
  const c = {
    page: "min-h-screen p-4 md:p-8 max-w-[920px] mx-auto flex flex-col gap-6 font-['Space_Grotesk'] z-10 relative text-[var(--text)]",
    title: "font-bold tracking-tight uppercase leading-none",
    mono: "font-['JetBrains_Mono'] uppercase",
    nav: "flex items-center justify-between p-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)]",
    logoRow: "flex items-center gap-2 font-bold uppercase tracking-widest",
    logoBox: "w-3 h-3 block border-2 border-[var(--border)]",
    navChips: "flex gap-2 text-[0.7rem] uppercase font-bold tracking-widest",
    navChip: "px-2 py-1 border-[2px] border-[var(--border)] rounded-[4px] bg-[var(--bg)]",
    hero: "p-6 md:p-[3rem_2rem] flex flex-col gap-4 relative bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[6px_6px_0px_var(--border)] mt-4",
    heroBar: "absolute top-0 left-0 w-full h-1.5 flex border-b-[3px] border-[var(--border)] overflow-hidden rounded-t-[1px]",
    heroSegment: "flex-1 h-full",
    gridRow: "grid grid-cols-1 md:grid-cols-2 gap-6",
    tileCard: "p-4 flex flex-col gap-2 relative overflow-hidden h-48 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_var(--border)] transition-all",
    tileHeader: "flex justify-between items-center pb-2 border-b-[3px] border-[var(--border)] uppercase font-bold text-[0.65rem] tracking-[0.15em] text-[var(--muted)]",
    tileMeterWrap: "w-full h-8 mt-auto flex items-end border-[3px] border-[var(--border)] bg-[var(--bg)] rounded-[2px]",
    tileMeterBar: "w-full transition-all duration-75 ease-out",
    tableCard: "p-0 overflow-hidden bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)]",
    table: "w-full text-left border-collapse",
    th: "p-3 text-[0.6rem] uppercase tracking-[0.15em] text-[var(--muted)] border-b-[3px] border-[var(--border)]",
    td: "p-3 text-[0.82rem] border-b-[2px] border-[var(--bg)]",
    btnPrimary: "px-4 py-2 text-[0.8rem] uppercase tracking-wider font-bold cursor-pointer transition-all bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none",
    btnSecondary: "px-4 py-2 text-[0.8rem] uppercase tracking-wider font-bold cursor-pointer transition-all bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none",
    inputGroup: "flex flex-col gap-2",
    input: "px-3 py-2 w-full",
  }

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.nav}>
        <div className={c.logoRow}>
          <div className="flex gap-1">
            <span className={c.logoBox}></span>
            <span className={c.logoBox}></span>
            <span className={c.logoBox}></span>
          </div>
          <h2>WHISPER-NET</h2>
        </div>
        <div className={c.navChips}>
          <div className={c.navChip}>v1.0.4</div>
          <div className={c.navChip}>STATUS: ONLINE</div>
        </div>
      </header>

      <section id="hero" className={c.hero}>
        <div className={c.heroBar}>
          <div className={`${c.heroSegment} bg-[var(--red)]`}></div>
          <div className={`${c.heroSegment} bg-[var(--yellow)]`}></div>
          <div className={`${c.heroSegment} bg-[var(--green)]`}></div>
          <div className={`${c.heroSegment} bg-[var(--blue)]`}></div>
        </div>
        <div className="relative z-10 py-4">
          <h1 className={`${c.title} text-4xl md:text-5xl mb-4 relative`}>
            WHISPER OVERSEER
            <span aria-hidden="true" className="absolute top-0 left-0 -z-10 text-[var(--red)] opacity-50 translate-x-[5px] translate-y-[5px]">WHISPER OVERSEER</span>
          </h1>
          <p className="font-medium text-[1rem] leading-relaxed max-w-xl text-[var(--muted)]">
            Keep volume below the threshold (max {THRESHOLD} units). Violations result in an immediate alarm state, 3-second lockout, and an immutable log entry.
          </p>
        </div>
        <div className="flex gap-4">
          {!isActive ? (
            <button className={c.btnPrimary} onClick={handleConnect}>CONNECT AUDIO</button>
          ) : (
            <button className={c.btnSecondary} onClick={() => {
              cancelAnimationFrame(reqRef.current);
              if (audioCtxRef.current) audioCtxRef.current.close();
              setIsActive(false);
              setVolume(0);
            }}>DISCONNECT</button>
          )}
          <button className={c.btnSecondary} onClick={() => triggerPenalty(88.8)}>TEST ALARM</button>
        </div>
      </section>

      <section id="grid" className={c.gridRow}>
        {/* Local User */}
        <div className={`${c.tileCard} ${isPenalty ? "bg-[var(--red)] text-white shadow-[0px_0px_0px_var(--red)] translate-y-1 translate-x-1" : ""}`}>
          <div className={`${c.tileHeader} ${isPenalty ? "border-white text-white" : ""}`}>
            <h3>LOCAL USER</h3>
            <span>{volume.toFixed(1)} dB</span>
          </div>
          <div className={`${isPenalty ? "font-bold text-lg tracking-widest" : ""}`}>
            {isPenalty ? "LOCKOUT ENFORCED" : (isActive ? "LISTENING..." : "READY")}
          </div>
          <div className={`${c.tileMeterWrap} ${isPenalty ? "border-white" : ""}`}>
            <div 
              className={`${c.tileMeterBar} ${volume > THRESHOLD ? "bg-[var(--red)]" : "bg-[var(--green)]"}`} 
              style={{ height: `${Math.min(100, (volume / 255) * 100 * 3)}%` }} // Boost visual height
            ></div>
          </div>
        </div>

        {/* Remote Mock 1 */}
        <div className={c.tileCard}>
          <div className={c.tileHeader}>
            <h3>AGENT_X</h3>
            <span className={c.mono}>24 dB</span>
          </div>
          <div>LISTENING...</div>
          <div className={c.tileMeterWrap}>
            <div className={`${c.tileMeterBar} bg-[var(--green)]`} style={{ height: "30%" }}></div>
          </div>
        </div>

        {/* Remote Mock 2 */}
        <div className={c.tileCard}>
          <div className={c.tileHeader}>
            <h3>AGENT_Y</h3>
            <span className={c.mono}>10 dB</span>
          </div>
          <div>LISTENING...</div>
          <div className={c.tileMeterWrap}>
            <div className={`${c.tileMeterBar} bg-[var(--green)]`} style={{ height: "10%" }}></div>
          </div>
        </div>

        {/* Remote Mock 3 */}
        <div className={c.tileCard}>
          <div className={c.tileHeader}>
            <h3>AGENT_Z</h3>
            <span className={c.mono}>45 dB</span>
          </div>
          <div>LISTENING...</div>
          <div className={c.tileMeterWrap}>
            <div className={`${c.tileMeterBar} bg-[var(--green)]`} style={{ height: "70%" }}></div>
          </div>
        </div>
      </section>

      <section id="logs" className={c.tableCard}>
        <div className="p-4 flex items-center justify-between border-b-[3px] border-[var(--border)]">
          <h3 className="font-bold uppercase tracking-widest text-[0.8rem]">INCIDENT LOGS</h3>
          <button 
            className="px-3 py-1 bg-[var(--blue)] text-white text-[0.7rem] uppercase font-bold border-[2px] border-[var(--border)] rounded-[2px] shadow-[2px_2px_0px_var(--border)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
            onClick={getRoomVibe}
            disabled={isVibeLoading}
          >
            {isVibeLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                ANALYZING...
              </div>
            ) : "ASSESS VIBE"}
          </button>
        </div>
        {vibe && (
          <div className="p-3 bg-[var(--bg)] border-b-[3px] border-[var(--border)] text-[0.8rem] font-medium font-['JetBrains_Mono']">
            OVERSEER: "{vibe}"
          </div>
        )}
        <table className={c.table}>
          <thead>
            <tr>
              <th className={c.th}>TIMESTAMP</th>
              <th className={c.th}>SUBJECT</th>
              <th className={c.th}>PEAK (dB)</th>
              <th className={c.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td className={c.td} colSpan="4">NO INCIDENTS RECORDED</td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log._id} className="hover:bg-[var(--yellow)] hover:text-black transition-colors">
                  <td className={c.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className={c.td}>{log.subject}</td>
                  <td className={c.td}>{log.peak}</td>
                  <td className={c.td}>PENALTY APPLIED</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}