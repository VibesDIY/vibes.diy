import React, { useState, useEffect, useRef } from "react";
import { useFireproof } from "use-fireproof";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";

export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
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
      }
      body {
        background-color: var(--bg);
        color: var(--text);
        font-family: 'Space Grotesk', sans-serif;
      }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      
      .shadow-hard { box-shadow: 4px 4px 0px var(--border); }
      .shadow-hard-sm { box-shadow: 3px 3px 0px var(--border); }
      .shadow-hard-lg { box-shadow: 8px 8px 0px var(--border); }
      
      .hover-lift:hover {
        transform: translate(-2px, -2px);
        box-shadow: 6px 6px 0px var(--border);
      }
      .active-press:active {
        transform: translate(2px, 2px);
        box-shadow: none !important;
      }
      
      .bg-grid {
        background-image: linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
                          linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
        background-size: 60px 60px;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [isHost, setIsHost] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [localCheerCount, setLocalCheerCount] = useState(0);
  
  const { database, useLiveQuery } = useFireproof("kinetic-cheer-db");
  const audioCtxRef = useRef(null);

  const playChime = () => {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor();
    const ctx = audioCtxRef.current;
    if (ctx.state !== "running") ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const baseFreq = 440 + Math.random() * 400;
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  };

  const eventsQuery = useLiveQuery("type", { key: "event", descending: true });
  const actionsQuery = useLiveQuery("type", { key: "cheer_action" });

  const activeEvent = eventsQuery.docs.find(e => e.status === "active");
  const isExpired = activeEvent && activeEvent.expiresAt <= Date.now();

  useEffect(() => {
    if (!activeEvent) {
      setCountdown(null);
      setLocalCheerCount(0);
      return;
    }
    
    const tickId = setInterval(async () => {
      const remaining = Math.max(0, activeEvent.expiresAt - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      
      if (remaining === 0 && isHost && activeEvent.status === "active") {
        const matchingCheers = actionsQuery.docs.filter(d => d.eventId === activeEvent._id).length;
        await database.put({ ...activeEvent, status: "completed", count: matchingCheers });
      }
    }, 100);
    
    return () => clearInterval(tickId);
  }, [activeEvent, isHost, actionsQuery.docs]);
  const recentEvents = eventsQuery.docs.filter(e => e.status === "completed").slice(0, 5);

  const handleShakeAction = async () => {
    if (!activeEvent || isHost) return;
    playChime();
    setLocalCheerCount(c => c + 1);
    await database.put({
      type: "cheer_action",
      eventId: activeEvent._id,
      timestamp: Date.now()
    });
  };

  useEffect(() => {
    const handleMotion = (e) => {
      if (!activeEvent || isHost || !e.acceleration) return;
      const { x, y, z } = e.acceleration;
      const total = Math.abs(x) + Math.abs(y) + Math.abs(z);
      // Debounce checks lightly, ~15 m/s^2 is a robust shake
      if (total > 15 && Math.random() > 0.8) {
        handleShakeAction();
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [activeEvent, isHost]);
  const globalCount = actionsQuery.docs.length;
  
  const handleStart = async () => {
    if (!promptInput.trim()) return;
    const eventId = "ev_" + Date.now();
    await database.put({
      _id: eventId,
      type: "event",
      prompt: promptInput,
      status: "active",
      expiresAt: Date.now() + 5000,
      count: 0
    });
    setPromptInput("");
  };

  const toggleRole = () => setIsHost(!isHost);

  const handleSuggest = async () => {
    setIsLoadingAI(true);
    try {
      const resp = await callAI("Suggest a very short, punchy reason to cheer, max 4 words. Examples: BIRTHDAY HERO, SURVIVING MONDAY, FREE PIZZA", {
        schema: {
          properties: {
            suggestion: { type: "string" }
          }
        }
      });
      const data = JSON.parse(resp);
      setPromptInput(data.suggestion);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const c = {
    page: "min-h-screen relative flex flex-col items-center py-12 px-8 overflow-hidden font-sans",
    background: "absolute inset-0 pointer-events-none z-0 bg-grid",
    container: "w-full max-w-[920px] relative z-10 flex flex-col gap-10",
    
    nav: "flex items-center justify-between p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-hard",
    navLogoGroup: "flex items-center gap-3",
    navLogoBoxes: "flex gap-1",
    navBox: "w-3 h-3 border-[3px] border-[var(--border)] rounded-[4px]",
    navTitle: "font-black text-xl uppercase tracking-tighter leading-none text-[var(--text)]",
    navLinks: "flex gap-3",
    navLink: "px-4 py-2 text-xs uppercase font-bold border-[3px] border-[var(--border)] rounded-[4px] cursor-pointer bg-[var(--card-bg)] hover-lift active-press transition-[0.15s]",
    
    hero: "p-8 pt-12 border-[3px] border-[var(--border)] rounded-[4px] flex flex-col items-center text-center relative bg-[var(--card-bg)] shadow-hard border-t-0",
    heroBar: "absolute top-0 left-[-3px] right-[-3px] h-[9px] flex border-[3px] border-[var(--border)] rounded-t-[4px] overflow-hidden",
    heroBarSeg: "flex-1 border-r-[3px] border-[var(--border)] last:border-r-0",
    heroTitle: "text-5xl md:text-6xl font-black uppercase tracking-[-0.02em] leading-none relative z-10 mt-4 text-[var(--text)] drop-shadow-[5px_5px_0_var(--red)]",
    heroSub: "mt-6 max-w-md text-sm md:text-base font-bold uppercase tracking-widest text-[var(--muted)]",
    
    controlsGroup: "mt-8 flex flex-col items-center gap-5 w-full max-w-md",
    inputWrap: "w-full relative hover-lift transition-[0.15s]",
    inputField: "w-full p-4 text-center text-xl font-bold uppercase border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--bg)] focus:outline-none focus:bg-[var(--yellow)] transition-colors placeholder:text-[var(--muted)]",
    aiBtn: "absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--blue)] text-white hover:bg-[var(--yellow)] hover:text-black cursor-pointer shadow-hard-sm active-press transition-[0.15s]",
    aiIcon: "w-5 h-5",
    
    primaryBtn: "w-full py-5 text-xl font-black uppercase tracking-widest border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--red)] text-white cursor-pointer hover-lift active-press transition-[0.15s] shadow-hard",
    shakeArea: "w-full py-16 text-3xl font-black uppercase tracking-widest border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--yellow)] cursor-pointer hover-lift active-press transition-[0.15s] shadow-hard flex items-center justify-center mt-6",
    
    statsGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    statCard: "border-[3px] border-[var(--border)] rounded-[4px] flex flex-col bg-[var(--card-bg)] shadow-hard",
    statHeader: "px-4 py-2 border-b-[3px] border-[var(--border)] text-[0.65rem] uppercase font-bold tracking-[0.15em] bg-[var(--blue)] text-white",
    statHeaderAlt: "px-4 py-2 border-b-[3px] border-[var(--border)] text-[0.65rem] uppercase font-bold tracking-[0.15em] bg-[var(--green)] text-black",
    statBody: "p-8 flex flex-col items-center justify-center",
    statNum: "font-mono text-6xl font-black tracking-tight text-[var(--text)]",
    statUnit: "text-xs font-bold uppercase mt-2 text-[var(--muted)] tracking-widest",
    
    historySection: "flex flex-col gap-6 w-full mt-4",
    historyLabel: "text-[0.7rem] uppercase font-bold tracking-[0.15em] text-[var(--text)]",
    historyCard: "flex items-center justify-between border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] p-5 hover:bg-[var(--yellow)] transition-colors shadow-hard-sm cursor-default",
    historyTitle: "font-bold uppercase text-lg tracking-tight",
    historyMeta: "text-[0.65rem] uppercase tracking-widest mt-1 text-[var(--muted)] font-bold",
    historyRight: "font-mono text-2xl font-bold bg-[var(--green)] px-5 py-3 border-[3px] border-[var(--border)] rounded-[4px] shadow-hard-sm",
  };

  return (
    <div className={c.page}>
      
      <div className={c.background}>
        <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] border-[3px] border-[var(--border)] rounded-full opacity-30 bg-[var(--red)]" />
        <div className="absolute bottom-[20%] right-[10%] w-[80px] h-[80px] border-[3px] border-[var(--border)] opacity-20 rotate-12 bg-[var(--blue)]" />
        <div className="absolute top-[40%] right-[5%] w-[30px] h-[30px] border-[3px] border-[var(--border)] rotate-45 opacity-30 bg-[var(--yellow)] shadow-hard-sm" />
        <div className="absolute bottom-[10%] left-[8%] w-[40px] h-[40px] border-[3px] border-[var(--border)] opacity-25 bg-[var(--green)] rounded-full" />
      </div>

      <div className={c.container}>
        <header className={c.nav}>
          <div className={c.navLogoGroup}>
            <div className={c.navLogoBoxes}>
              <div className={`${c.navBox} bg-[var(--red)]`} />
              <div className={`${c.navBox} bg-[var(--yellow)]`} />
              <div className={`${c.navBox} bg-[var(--green)]`} />
            </div>
            <h1 className={c.navTitle}>Kinetic Cheer</h1>
          </div>
          <div className={c.navLinks}>
            <button className={c.navLink} onClick={toggleRole}>
              Switch to {isHost ? "Participant" : "Host"}
            </button>
          </div>
        </header>

        <main className="flex flex-col gap-10">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar}>
              <div className={`${c.heroBarSeg} bg-[var(--red)]`} />
              <div className={`${c.heroBarSeg} bg-[var(--yellow)]`} />
              <div className={`${c.heroBarSeg} bg-[var(--green)]`} />
              <div className={`${c.heroBarSeg} bg-[var(--blue)]`} />
            </div>

            <h2 className={c.heroTitle}>Drop the Beat</h2>
            
            {isHost ? (
              <div className={c.controlsGroup}>
                <p className={c.heroSub}>Create a new cheer event. All connected devices will sync and listen.</p>
                <div className={c.inputWrap}>
                  <input 
                    className={c.inputField} 
                    placeholder="CHEER PROMPT" 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                  />
                  <button className={c.aiBtn} onClick={handleSuggest} disabled={isLoadingAI}>
                    {isLoadingAI ? (
                      <svg className={`animate-spin ${c.aiIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeDasharray="30" strokeDashoffset="0"></circle></svg>
                    ) : (
                      <svg className={c.aiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
                    )}
                  </button>
                </div>
                <button className={c.primaryBtn} onClick={handleStart}>
                  Start 5s Countdown
                </button>
              </div>
            ) : (
              <div className={c.controlsGroup}>
                {activeEvent ? (
                  <>
                    <h3 className="text-4xl font-black uppercase mt-4 mb-2 tracking-tighter text-[var(--red)] drop-shadow-[2px_2px_0_var(--border)]">{countdown}s</h3>
                    <p className={c.heroSub}>SHAKE YOUR DEVICE NOW!</p>
                    <button className={c.shakeArea} onClick={handleShakeAction}>
                      SHAKE or TAP!
                    </button>
                    {localCheerCount > 0 && <p className="mt-4 font-bold text-sm tracking-widest text-[var(--green)]">YOU CHEERED {localCheerCount} TIMES!</p>}
                  </>
                ) : (
                  <p className={c.heroSub}>Waiting for host to start a cheer. Hold your device ready.</p>
                )}
              </div>
            )}
          </section>

          <section id="stats" className={c.statsGrid}>
            <div className={c.statCard}>
              <div className={c.statHeader}>Total Sessions</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{eventsQuery.docs.length}</div>
                <div className={c.statUnit}>Events Hosted</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={c.statHeaderAlt}>Global Noise</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{globalCount}</div>
                <div className={c.statUnit}>Cheers Registered</div>
              </div>
            </div>
          </section>

          <section id="history" className={c.historySection}>
            <h3 className={c.historyLabel}>Recent Cheers</h3>
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center uppercase font-bold text-sm tracking-widest border-[3px] border-[var(--border)] border-dashed text-[var(--muted)]">
                No history yet
              </div>
            ) : (
              recentEvents.map((ev, i) => (
                <div key={i} className={c.historyCard}>
                  <div>
                    <h4 className={c.historyTitle}>{ev.prompt}</h4>
                    <div className={c.historyMeta}>Finished</div>
                  </div>
                  <div className={c.historyRight}>
                    {ev.count}
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}