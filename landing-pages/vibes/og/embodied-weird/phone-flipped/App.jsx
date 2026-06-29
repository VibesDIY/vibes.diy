import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // --- HOOKS & STATE ---
  const { database, useLiveQuery } = useFireproof("flip-dash-db");
  const { docs: logs } = useLiveQuery("type", { key: "status_log", descending: true, limit: 30 });
  
  const [userName, setUserName] = useState("PLAYER_1");
  const [myStatus, setMyStatus] = useState("ACTIVE");
  const [isArmed, setIsArmed] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // --- HANDLERS ---
  function handleStartSensors() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response == 'granted') {
            setPermissionGranted(true);
            setIsArmed(true);
          }
        })
        .catch(console.error);
    } else {
      setPermissionGranted(true);
      setIsArmed(true);
    }
  }

  const lastLoggedStatus = useRef(null);

  function logStatusChange(status) {
    if (lastLoggedStatus.current === status) return;
    lastLoggedStatus.current = status;
    database.put({
      type: "status_log",
      userName: userName || "ANON",
      status: status,
      message: customMessage || (status === "ACTIVE" ? "Online" : "Do Not Disturb"),
      ts: Date.now()
    });
  }

  function handleSimulateFlip() {
    setMyStatus(prev => {
      const next = prev === "ACTIVE" ? "BUSY" : "ACTIVE";
      logStatusChange(next);
      return next;
    });
  }

  useEffect(() => {
    if (!isArmed || !permissionGranted) return;
    const handleOrientation = (event) => {
      // Beta usually ranges from -180 to 180. Flat face up is ~0. Flat face down is near ~180 or ~-180.
      const beta = event.beta;
      if (beta === null) return; 
      
      const isFaceDown = Math.abs(beta) > 135;
      setMyStatus(prev => {
        const next = isFaceDown ? "BUSY" : "ACTIVE";
        if (prev !== next) logStatusChange(next);
        return next;
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isArmed, permissionGranted]);

  function handleSaveMessage(e) {
    e.preventDefault();
    if (myStatus === "BUSY") {
       logStatusChange("BUSY"); // Just force an update log with new msg
    }
  }

  async function handleGenerateExcuse() {
    setIsAILoading(true);
    try {
      const resp = await callAI("Generate a short, snarky, retro-arcade or hacker themed 'Do Not Disturb' auto-reply. Keep it under 6 words.", {
        schema: { type: "object", properties: { excuse: { type: "string" } } }
      });
      const data = JSON.parse(resp);
      setCustomMessage(data.excuse.toUpperCase());
    } catch (e) {
      console.error(e);
    } finally {
      setIsAILoading(false);
    }
  }

  // Derive Roster from Logs: newest log per unique user
  const rosterMap = {};
  logs.forEach(log => {
    if (!rosterMap[log.userName] || rosterMap[log.userName].ts < log.ts) {
      rosterMap[log.userName] = log;
    }
  });
  const roster = Object.values(rosterMap).sort((a,b) => b.ts - a.ts);

  // --- STYLES & GLOBALS ---
  if (typeof document !== 'undefined' && !document.getElementById('neobrutalist-theme')) {
    const style = document.createElement('style');
    style.id = 'neobrutalist-theme';
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
        --accent-light: oklch(0.55 0.24 28 / 0.1);
      }
      body {
        background-color: var(--bg);
        color: var(--text);
        font-family: 'Space Grotesk', sans-serif;
      }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      #ambient-bg {
        background-image: 
          linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
        background-size: 60px 60px;
      }
      .n-shadow { box-shadow: 4px 4px 0px var(--border); }
      .n-shadow-sm { box-shadow: 3px 3px 0px var(--border); }
      .n-shadow-lg { box-shadow: 8px 8px 0px var(--border); }
      .hover-lift:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
      .active-press:active { transform: translate(2px, 2px); box-shadow: none; }
    `;
    document.head.appendChild(style);
  }

  const c = {
  const c = {
    page: "min-h-screen relative overflow-hidden",
    ambientWrapper: "fixed inset-0 pointer-events-none z-0",
    container: "relative z-[10] max-w-[920px] mx-auto px-6 py-12 flex flex-col gap-10",
    
    navCard: "flex flex-col md:flex-row items-center justify-between p-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] n-shadow",
    navLogoGroup: "flex items-center gap-3",
    navLogoDots: "flex gap-1.5",
    navDot: "w-3 h-3 block border-2 border-[var(--border)]",
    navBrand: "font-black tracking-[-0.02em] uppercase text-xl text-[var(--text)]",
    navControls: "flex gap-3 w-full md:w-auto mt-4 md:mt-0",
    navInput: "flex-1 md:w-48 px-3 py-2 text-sm uppercase font-bold outline-none border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--bg)] focus:bg-[var(--yellow)] focus:hover-lift transition-transform placeholder-[var(--muted)]",

    heroCard: "flex flex-col items-center justify-center p-10 md:p-20 text-center bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] n-shadow relative transition-all duration-300",
    heroAccentBar: "absolute top-0 left-0 right-0 h-[6px] flex border-b-[3px] border-[var(--border)]",
    heroAccentSegment: "flex-1",
    heroTitle: "text-6xl md:text-8xl font-black uppercase tracking-[-0.04em] mb-8 relative z-10",
    heroTitleShadow: "absolute top-[5px] left-[5px] pointer-events-none text-[var(--red)] opacity-50 z-[-1]",
    heroActionRow: "flex flex-wrap justify-center gap-4 mt-8",
    btnPrimary: "px-8 py-4 font-bold uppercase tracking-[0.08em] text-[0.8rem] bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] flex items-center gap-2 n-shadow hover-lift active-press transition-all duration-150",
    btnSecondary: "px-8 py-4 font-bold uppercase tracking-[0.08em] text-[0.8rem] bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] n-shadow hover-lift active-press transition-all duration-150",

    sectionTitle: "text-[0.65rem] font-black uppercase tracking-[0.15em] text-[var(--muted)] mb-4",
    
    statGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6",
    statCard: "flex flex-col bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] n-shadow hover-lift transition-all duration-150 overflow-hidden",
    statHeader: "px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.05em] border-b-[3px] border-[var(--border)]",
    statBody: "p-6 flex flex-col items-center justify-center flex-1 bg-[var(--bg)]",
    statNumber: "text-4xl font-mono font-bold tracking-[-0.05em] text-[var(--text)]",
    statLabel: "text-[0.65rem] uppercase tracking-[0.1em] text-[var(--muted)] mt-2 font-bold",

    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-8",
    formCard: "p-8 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] n-shadow flex flex-col gap-6",
    fieldGroup: "flex flex-col gap-3",
    label: "text-[0.65rem] font-black uppercase tracking-[0.15em] text-[var(--muted)]",
    input: "px-4 py-3 font-mono text-[0.82rem] font-bold text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--bg)] outline-none focus:bg-[var(--card-bg)] focus:hover-lift transition-all duration-150 n-shadow-sm placeholder-[var(--muted)]",
    btnGhost: "px-6 py-4 font-bold uppercase tracking-[0.08em] text-[0.8rem] bg-[var(--card-bg)] text-[var(--text)] border-[3px] border-transparent rounded-[4px] hover:border-[var(--border)] hover:n-shadow-sm transition-all duration-150 text-center",
    
    tableCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] w-full overflow-x-auto n-shadow",
    table: "w-full text-left border-collapse min-w-[600px]",
    th: "px-5 py-4 text-[0.65rem] font-black uppercase tracking-[0.15em] text-[var(--muted)] border-b-[3px] border-[var(--border)] bg-[var(--bg)]",
    td: "px-5 py-4 text-[0.82rem] font-mono font-bold border-b border-[var(--muted)] group-last:border-b-0",
    tableRow: "transition-all duration-75 hover:bg-[var(--yellow)] group",
    badge: "inline-block px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] border-[2px] border-[var(--border)] rounded-[4px] n-shadow-sm"
  }

  // --- RENDER ---
  return (
    <div className={c.page}>
      {/* Ambient background container */}
      <div className={c.ambientWrapper} id="ambient-bg" />

      <main className={c.container}>
        {/* NAV */}
        <nav className={c.navCard}>
          <div className={c.navLogoGroup}>
            <div className={c.navLogoDots}>
              <span className={`${c.navDot} bg-[var(--red)]`} />
              <span className={`${c.navDot} bg-[var(--yellow)]`} />
              <span className={`${c.navDot} bg-[var(--green)]`} />
            </div>
            <span className={c.navBrand}>Flip.Dash</span>
          </div>
          <div className={c.navControls}>
            <input 
              type="text" 
              placeholder="YOUR HANDLE..." 
              className={c.navInput}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
        </nav>

        {/* HERO */}
        <section className={`${c.heroCard} ${myStatus === 'BUSY' ? 'bg-[var(--text)] border-[var(--text)]' : ''}`}>
          <div className={c.heroAccentBar}>
            <div className={`${c.heroAccentSegment} bg-[var(--red)]`} />
            <div className={`${c.heroAccentSegment} bg-[var(--yellow)]`} />
            <div className={`${c.heroAccentSegment} bg-[var(--green)]`} />
            <div className={`${c.heroAccentSegment} bg-[var(--blue)]`} />
          </div>
          
          <h1 className={`${c.heroTitle} ${myStatus === 'BUSY' ? 'text-white' : 'text-[var(--text)]'}`}>
            {myStatus}
            <span className={c.heroTitleShadow} aria-hidden="true">{myStatus}</span>
          </h1>

          <div className={c.heroActionRow}>
            <button 
               className={isArmed ? c.btnSecondary : c.btnPrimary} 
               onClick={handleStartSensors}
               disabled={isArmed}
            >
              {!isArmed && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              )}
              {isArmed ? 'RADAR ARMED' : 'ARM SENSORS'}
            </button>
            <button className={c.btnSecondary} onClick={handleSimulateFlip}>
              MANUAL FLIP
            </button>
          </div>
        </section>

        {/* ROSTER / STATS */}
        <section>
          <h2 className={c.sectionTitle}>Squad Status</h2>
          <div className={c.statGrid}>
            {roster.length === 0 ? (
              <div className="text-sm font-bold text-[var(--muted)] col-span-full">NO SIGNALS DETECTED YET.</div>
            ) : roster.map(p => {
              const isActive = p.status === 'ACTIVE';
              return (
                <div key={p.userName} className={c.statCard}>
                  <div className={`${c.statHeader} ${isActive ? 'bg-[var(--green)] text-[var(--text)]' : 'bg-[var(--red)] text-white'}`}>
                    {p.userName}
                  </div>
                  <div className={c.statBody}>
                    <div className={c.statNumber}>{isActive ? 'ON' : 'OFF'}</div>
                    <div className={c.statLabel}>{isActive ? 'Radar Hot' : 'Radio Silence'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* CONTROLS / MSG */}
        <section className={c.formGrid}>
          <div className={c.formCard}>
            <h2 className={c.sectionTitle}>Away Message</h2>
            <form onSubmit={handleSaveMessage} className={c.fieldGroup}>
              <label className={c.label}>Custom Auto-Reply</label>
              <input 
                type="text" 
                className={c.input} 
                placeholder="E.g. In the zone..." 
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button type="submit" className={c.btnSecondary}>Save Config</button>
                <button 
                  type="button" 
                  className={c.btnGhost} 
                  onClick={handleGenerateExcuse}
                  disabled={isAILoading}
                >
                  {isAILoading ? (
                    <div className="flex items-center gap-2">
                       <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                         <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                         <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                       </svg>
                       <span>LOADING...</span>
                    </div>
                  ) : "AI SUGGESTION"}
                </button>
              </div>
            </form>
          </div>
          <div className={c.formCard}>
            <h2 className={c.sectionTitle}>Settings</h2>
            <div className={c.fieldGroup}>
              <label className={c.label}>Sensitivity</label>
              <input type="range" className="w-full" />
            </div>
          </div>
        </section>

        {/* LOG TABLE */}
        <section>
          <h2 className={c.sectionTitle}>Signal Log</h2>
          <div className={c.tableCard}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>Time</th>
                  <th className={c.th}>Handle</th>
                  <th className={c.th}>State</th>
                  <th className={c.th}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                   <tr className={c.tableRow}>
                     <td className={c.td} colSpan={4}>Awaiting signals...</td>
                   </tr>
                )}
                {logs.map(log => {
                  const isActive = log.status === 'ACTIVE';
                  const t = new Date(log.ts);
                  return (
                    <tr key={log._id} className={c.tableRow}>
                      <td className={c.td}>{t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className={c.td}>{log.userName}</td>
                      <td className={c.td}>
                        <span className={`${c.badge} ${isActive ? 'bg-[var(--green)] text-[var(--text)]' : 'bg-[var(--red)] text-white'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className={c.td}>{log.message || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}