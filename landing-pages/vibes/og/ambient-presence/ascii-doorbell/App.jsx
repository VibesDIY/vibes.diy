import React, { useState, useEffect, useRef } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  // 1. Hooks and document shapes
  const { useLiveQuery, database } = useFireproof("sentinel-grid-ledger");

  const [role, setRole] = useState("viewer"); 
  const [isLoadingRing, setIsLoadingRing] = useState(false);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  
  const [currentAscii, setCurrentAscii] = useState("");
  const frameBufferRef = useRef([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const { docs: logs } = useLiveQuery("type", { key: "ring", descending: true, limit: 12 });

  useEffect(() => {
    let intervalId;
    let stream;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        
        const chars = " .:-=+*#%@".split('');
        const w = 48, h = 32; // Low-res aspect grid
        
        intervalId = setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = w;
          canvas.height = h;
          
          ctx.drawImage(videoRef.current, 0, 0, w, h);
          const px = ctx.getImageData(0, 0, w, h).data;
          
          let frame = "";
          for (let y = 0; y < h; y+=2) { // crude terminal char ratio adjustment
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const brightness = (px[i] + px[i+1] + px[i+2]) / 3;
              const charIdx = Math.floor((brightness / 255) * (chars.length - 1));
              frame += chars[charIdx];
            }
            frame += "\n";
          }
          setCurrentAscii(frame);
          
          // maintain ~3 sec rolling buffer (assuming interval ~150ms -> ~20 frames)
          frameBufferRef.current.push(frame);
          if (frameBufferRef.current.length > 25) frameBufferRef.current.shift();
        }, 150);
        
      } catch (err) {
        console.error("Camera denied", err);
        setCurrentAscii("CAMERA ACCESS REQUIRED");
      }
    };

    if (role === "door") {
      setCurrentAscii("booting optic sensor...");
      startCamera();
    } else {
      setCurrentAscii("");
      frameBufferRef.current = [];
    }

    return () => {
      clearInterval(intervalId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [role]);

  // 2. Event handlers
  const toggleRole = () => setRole((r) => (r === "viewer" ? "door" : "viewer"));

  const handleRing = async (e) => {
    e.preventDefault();
    if (frameBufferRef.current.length === 0) return;
    setIsLoadingRing(true);
    try {
      await database.put({
        type: "ring",
        ts: Date.now(),
        frames: [...frameBufferRef.current],
        status: "unanswered"
      });
      // Flash a quick message on the cam
      setCurrentAscii("TRANSMISSION BURST SENT\n\nAWAITING RESPONSE...");
      setTimeout(() => frameBufferRef.current = [], 2000); 
    } finally {
      setIsLoadingRing(false);
    }
  };

  const handleAnswer = async (e, doc) => {
    e.preventDefault();
    setIsLoadingAnswer(true);
    try {
      await database.put({ ...doc, status: "answered", answeredAt: Date.now() });
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  // Animate playback of the latest unanswered ring for viewers
  useEffect(() => {
    if (role === "door" || logs.length === 0) return;
    
    const latestRing = logs[0];
    if (latestRing.status === "answered" || !latestRing.frames) {
      setCurrentAscii("[ AWAITING DATA TRANSMISSION ]");
      return;
    }

    let frameIdx = 0;
    const interval = setInterval(() => {
      setCurrentAscii(latestRing.frames[frameIdx] + "\n\n>> INCOMING SIGNAL <<");
      frameIdx = (frameIdx + 1) % latestRing.frames.length;
    }, 150);

    return () => clearInterval(interval);
  }, [role, logs]);

  // 3. ClassNames object (Layout Only, no color/theme tokens yet)
  const c = {
    page: "relative min-h-screen flex flex-col items-center w-full px-4 py-8 md:p-12 overflow-x-hidden bg-[var(--bg)] text-[var(--text)]",
    ambientGrid: "fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]",
    floaters: "fixed inset-0 pointer-events-none z-0 overflow-hidden",
    mainContent: "relative z-10 w-full max-w-[920px] flex flex-col gap-6",
    
    navBar: "flex flex-col sm:flex-row justify-between items-center p-4 rounded-[4px] border-[3px] border-[var(--border)] shadow-[4px_4px_0_var(--border)] bg-[var(--card-bg)] gap-4 w-full z-10",
    navLogoBox: "flex items-center gap-3",
    navLogoDots: "flex gap-[2px]",
    navLogoDot: "w-3 h-3 border-[3px] border-[var(--border)] rounded-[4px]",
    navTitle: "font-bold text-[1rem] uppercase tracking-[-0.02em]",
    navToggles: "flex gap-2",
    navPill: "px-3 py-1.5 border-[3px] border-[var(--border)] rounded-[4px] uppercase text-[0.75rem] font-bold tracking-[0.05em] bg-[var(--card-bg)] shadow-[3px_3px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer",
    
    heroCard: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] overflow-hidden bg-[var(--card-bg)] w-full z-10",
    heroAccentBar: "h-[6px] w-full flex",
    heroAccentSegment: "flex-1 border-b-[3px] border-[var(--border)]",
    heroBody: "p-6 flex flex-col gap-6",
    heroHeaderBox: "flex flex-col text-center relative z-0",
    heroTitle: "text-4xl md:text-[3.5rem] font-black uppercase tracking-[-0.02em] leading-none z-10",
    heroShadowText: "absolute inset-0 top-[5px] left-[5px] text-4xl md:text-[3.5rem] font-black uppercase tracking-[-0.02em] leading-none text-[var(--red)] opacity-50 z-[-1]",
    
    asciiWrapper: "w-full aspect-[4/3] sm:aspect-video border-[3px] border-[var(--border)] rounded-[4px] shadow-[inset_4px_4px_0_oklch(0.15_0.02_280/0.05)] bg-[var(--bg)] flex items-center justify-center overflow-hidden relative",
    asciiPre: "font-mono whitespace-pre leading-[0.8] text-[8px] sm:text-[10px] md:text-[14px] text-center select-none flex items-center justify-center font-bold",
    
    actionRow: "flex flex-wrap items-center justify-center gap-4 pt-4",
    btnPrimary: "px-6 py-3 border-[3px] border-[var(--border)] rounded-[4px] uppercase font-bold text-[0.8rem] tracking-[0.05em] bg-[var(--red)] text-white shadow-[4px_4px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 flex items-center gap-2",
    btnSecondary: "px-6 py-3 border-[3px] border-[var(--border)] rounded-[4px] uppercase font-bold text-[0.8rem] tracking-[0.05em] bg-[var(--yellow)] shadow-[3px_3px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    btnGhost: "px-4 py-2 uppercase font-bold text-[0.8rem] tracking-[0.05em] transition-all bg-transparent hover:bg-[var(--bg)] rounded-[4px] border-[3px] border-transparent hover:border-[var(--border)] hover:shadow-[3px_3px_0_var(--border)]",
    
    logGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full z-10",
    logCard: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] overflow-hidden bg-[var(--card-bg)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)] transition-all duration-150",
    logCardHeader: "px-3 py-2 border-b-[3px] border-[var(--border)] font-mono text-[0.65rem] tracking-[0.15em] uppercase font-bold flex justify-between",
    logCardBody: "p-4 flex flex-col gap-3 items-center justify-center text-center font-mono",
    logCardIcon: "w-8 h-8",
    logCardStatus: "text-[0.7rem] font-bold uppercase tracking-[0.05em] mt-1 px-3 py-1.5 border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] cursor-pointer hover:bg-[var(--green)] transition-all",
    logCardStatusAnswered: "text-[0.7rem] uppercase font-bold tracking-[0.05em] mt-1 px-3 py-1.5 opacity-50",
    
    statusPill: "px-2 py-1 text-[0.65rem] uppercase font-bold tracking-[0.15em] rounded-[4px] border-[3px] border-[var(--border)] inline-flex items-center gap-1 shadow-[2px_2px_0_var(--border)]",
    spinnerBox: "w-[16px] h-[16px] border-[3px] rounded-full border-[var(--border)] border-t-transparent animate-spin"
  };

  // 4. JSX return
  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
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
        body { font-family: 'Space Grotesk', sans-serif; background: var(--bg); color: var(--text); }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        @keyframes modal-pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        /* Drift keyframes */
        @keyframes drift-spin { 0% { transform: rotate(0deg) translate(20px) rotate(0deg); } 100% { transform: rotate(360deg) translate(20px) rotate(-360deg); } }
        @keyframes drift-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }
      `}</style>
      
      <div className={c.ambientGrid}></div>
      <div className={c.floaters}>
        <div className="absolute top-[10%] left-[8%] w-12 h-12 border-[3px] border-[var(--border)] rounded-full opacity-20 bg-[var(--red)] animate-[drift-spin_9s_linear_infinite]" />
        <div className="absolute bottom-[20%] right-[10%] w-16 h-16 border-[3px] border-[var(--border)] opacity-20 bg-[var(--blue)] animate-[drift-bounce_7s_ease-in-out_infinite]" />
        <div className="absolute top-[40%] right-[5%] w-8 h-8 border-[3px] border-[var(--border)] rotate-45 opacity-30 bg-[var(--yellow)] animate-[drift-spin_12s_linear_infinite_reverse]" />
        <div className="absolute top-[70%] left-[5%] w-[40px] h-[40px] before:content-[''] before:absolute before:inset-y-0 before:left-[15px] before:w-[10px] before:bg-[var(--border)] after:content-[''] after:absolute after:inset-x-0 after:top-[15px] after:h-[10px] after:bg-[var(--border)] opacity-10 animate-[drift-bounce_10s_ease-in-out_infinite]"/>
      </div>

      <div className={c.mainContent}>
        
        {/* NAV */}
        <header className={c.navBar}>
          <div className={c.navLogoBox}>
            <div className={c.navLogoDots}>
              <div className={`${c.navLogoDot} bg-[var(--red)]`}></div>
              <div className={`${c.navLogoDot} bg-[var(--yellow)]`}></div>
              <div className={`${c.navLogoDot} bg-[var(--green)]`}></div>
            </div>
            <h1 className={c.navTitle}>Sentinel Grid</h1>
          </div>
          <div className={c.navToggles}>
            <button className={c.navPill} onClick={toggleRole}>
              Role: {role}
            </button>
          </div>
        </header>

        {/* MAIN FEED / DOOR CAPTURE */}
        <section className={c.heroCard}>
          <div className={c.heroAccentBar}>
            <div className={`${c.heroAccentSegment} bg-[var(--red)]`}></div>
            <div className={`${c.heroAccentSegment} bg-[var(--yellow)]`}></div>
            <div className={`${c.heroAccentSegment} bg-[var(--green)]`}></div>
            <div className={`${c.heroAccentSegment} bg-[var(--blue)]`}></div>
          </div>
          
          <div className={c.heroBody}>
            <div className={c.heroHeaderBox}>
              <h2 className={c.heroTitle} aria-hidden="true">Live Matrix</h2>
              <h2 className={c.heroTitle}>Live Matrix</h2>
            </div>
            
            <div className={`${c.asciiWrapper} ${role === 'viewer' && logs[0]?.status === 'unanswered' ? 'shadow-[inset_4px_4px_0_var(--red)] animate-pulse' : ''}`}>
              <pre className={c.asciiPre}>
                {currentAscii || "[ ASCII FEED OFFLINE ]"}
              </pre>
              <video ref={videoRef} playsInline autoPlay muted className="hidden" />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className={c.actionRow}>
              {role === "door" ? (
                <button className={c.btnPrimary} onClick={handleRing} disabled={isLoadingRing}>
                  {isLoadingRing ? <div className={c.spinnerBox} /> : null}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  Transmit Ring
                </button>
              ) : (
                logs[0] && logs[0].status === "unanswered" ? (
                  <button className={c.btnPrimary} onClick={(e) => handleAnswer(e, logs[0])} disabled={isLoadingAnswer}>
                     {isLoadingAnswer ? <div className={c.spinnerBox} /> : null}
                     Acknowledge Activity
                  </button>
                ) : (
                  <div className="font-mono font-bold text-xs uppercase tracking-widest text-[var(--muted)]">
                    Standby mode active
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* LOG GRID */}
        <section className={c.logGrid}>
          {logs.map((doc, idx) => {
            const time = new Date(doc.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={doc._id} className={c.logCard}>
                <div className={`${c.logCardHeader} ${doc.status === 'unanswered' ? 'bg-[var(--yellow)] text-[var(--text)]' : 'bg-[var(--border)] text-white'}`}>
                  <span>EVENT-{String(logs.length - idx).padStart(3, '0')}</span>
                  <span>{time}</span>
                </div>
                <div className={c.logCardBody}>
                  {doc.status === 'unanswered' ? (
                    <>
                      <svg className={`stroke-[var(--red)] ${c.logCardIcon}`} viewBox="0 0 24 24" fill="none" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      <button className={c.logCardStatus} onClick={(e) => handleAnswer(e, doc)} disabled={isLoadingAnswer}>Claim Task</button>
                    </>
                  ) : (
                    <>
                      <svg className={`stroke-[var(--green)] ${c.logCardIcon}`} viewBox="0 0 24 24" fill="none" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className={c.logCardStatusAnswered}>Acknowledged</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="col-span-full border-[3px] border-[var(--border)] p-6 bg-[var(--card-bg)] text-center font-mono text-[var(--muted)] border-dashed uppercase text-xs tracking-wider">
               No recent events recorded in ledger.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}