import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("glancer-db");
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const { docs: glances } = useLiveQuery("type", { key: "glance", descending: true, limit: 15 });
  const { docs: allGlances } = useLiveQuery("type", { key: "glance", descending: true });

  const recordGlance = async () => {
    await database.put({
      type: "glance",
      timestamp: Date.now(),
      confidence: Math.round(75 + Math.random() * 25), // Mock metric
    });
  };

  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState(null);

  useEffect(() => {
    let interval;
    if (isMonitoring) {
      interval = setInterval(() => {
        if (Math.random() > 0.6) { // 40% chance every 3 seconds to look away
          recordGlance();
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, database]);

  const runAnalysis = async () => {
    if (allGlances.length === 0) return;
    setAiLoading(true);
    try {
      const times = allGlances.slice(0, 10).map(g => new Date(g.timestamp).toLocaleTimeString()).join(", ");
      const prompt = `User logged ${allGlances.length} glances away from their screen. Recent times: ${times}. Give a punchy, single sentence brutalist critique of their attention span.`;
      const res = await callAI(prompt, {
        schema: { properties: { critique: { type: "string" } } }
      });
      setInsight(JSON.parse(res).critique);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!document.getElementById("neobrut-styles")) {
      const style = document.createElement("style");
      style.id = "neobrut-styles";
      style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
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
          --radius: 4px;
        }
        body { font-family: 'Space Grotesk', sans-serif; background-color: var(--bg); color: var(--text); }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .shadow-brut { box-shadow: 4px 4px 0px var(--border); }
        .shadow-brut-sm { box-shadow: 3px 3px 0px var(--border); }
        .shadow-brut-mod { box-shadow: 8px 8px 0px var(--border); }
        .brut-hover { transition: transform 0.15s, box-shadow 0.15s; }
        .brut-hover:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
        .brut-hover:active { transform: translate(2px, 2px); box-shadow: none; }
        
        /* Grid background & shapes */
        .ambient-bg {
          background-image: linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
                            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        @keyframes drift { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } 100% { transform: translateY(0) rotate(0deg); } }
        .float-shape { animation: drift 8s ease-in-out infinite; opacity: 0.2; position: absolute; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const c = {
    // Scaffold structural classes
    pageWrapper: "min-h-screen w-full relative overflow-hidden flex flex-col items-center bg-[var(--bg)] text-[var(--text)]",
    ambientGrid: "absolute inset-0 z-0 ambient-bg",
    container: "w-full max-w-[920px] px-8 py-12 relative z-10 flex flex-col gap-12",
    
    // Nav
    nav: "w-full flex justify-between items-center px-5 py-3 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut",
    navLogo: "flex items-center gap-2 font-bold tracking-[-0.02em] uppercase text-lg",
    navRight: "flex items-center gap-3",
    navStatus: "text-[0.7rem] uppercase tracking-[0.08em] font-semibold bg-[var(--yellow)] px-3 py-1 border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut-sm",
    
    // Hero
    heroCard: "w-full flex flex-col md:flex-row justify-between items-center p-8 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut relative overflow-hidden",
    heroAccentBar: "absolute top-0 left-0 w-full h-[6px] flex",
    heroTitle: "text-5xl md:text-7xl font-bold uppercase tracking-tight flex flex-col relative z-10",
    heroTextShadow: "absolute top-[5px] left-[5px] text-[var(--red)] opacity-50 z-[-1]",
    heroControls: "flex flex-col gap-4 items-end",
    
    // Stats
    statGrid: "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "w-full flex flex-col overflow-hidden bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut",
    statHeader: "w-full px-3 py-2 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[var(--border)]",
    statBody: "w-full p-6 flex flex-col justify-center items-center",
    statNum: "text-5xl font-mono font-bold",
    statLabel: "text-[0.65rem] uppercase tracking-widest text-[var(--muted)] mt-2",
    
    // Table
    tableCard: "w-full flex flex-col overflow-hidden bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut",
    tableHeaderRow: "w-full grid grid-cols-4 items-center px-4 py-3 bg-[var(--card-bg)] border-b-[3px] border-[var(--border)]",
    tableHeaderCol: "text-[0.6rem] uppercase font-bold tracking-[0.15em] text-[var(--muted)]",
    tableRow: "w-full grid grid-cols-4 items-center px-4 py-3 border-b-2 border-[var(--border)] hover:bg-[var(--yellow)] transition-colors duration-0",
    tableCol: "text-[0.82rem] font-medium",
    tableColMono: "text-[0.82rem] font-mono",
    tableBadge: "inline-block px-2 py-1 text-[0.65rem] uppercase tracking-wide font-bold border-[2px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0px_var(--border)]",
    
    // Controls 
    controlsGrid: "w-full grid grid-cols-1 sm:grid-cols-2 gap-6",
    controlCard: "w-full p-6 flex flex-col gap-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut",
    controlTitle: "text-lg font-bold uppercase tracking-tight m-0",
    controlDesc: "text-[0.85rem] font-medium leading-[1.4] m-0 mb-2",
    btnPrimary: "px-6 py-3 flex items-center justify-center font-bold uppercase text-[0.8rem] tracking-[0.08em] bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut brut-hover cursor-pointer",
    btnSecondary: "px-4 py-2 flex items-center justify-center font-bold uppercase text-[0.7rem] tracking-[0.08em] bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-brut-sm brut-hover cursor-pointer",
    btnGhost: "px-4 py-2 flex items-center justify-center font-bold uppercase text-[0.7rem] tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[var(--radius)] transition-all duration-150 hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-brut-sm cursor-pointer",
    
    // Modal layer
    modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4",
    modalCard: "w-full max-w-md flex flex-col overflow-hidden flex flex-col",
    modalHeader: "w-full px-4 py-3 flex justify-between items-center",
    modalBody: "p-6 flex flex-col gap-4",
  }

  return (
    <div className={c.pageWrapper}>
      <div className={c.ambientGrid}>
        <div className="float-shape w-16 h-16 bg-[var(--red)] rounded-full top-[10%] left-[5%]" />
        <div className="float-shape w-12 h-12 bg-[var(--yellow)] border-[3px] border-[var(--border)] top-[30%] right-[10%] drop-shadow-md" style={{animationDelay: '1s'}} />
        <div className="float-shape w-20 h-20 bg-[var(--blue)] top-[70%] left-[15%] rounded-[4px]" style={{animationDelay: '2s'}} />
        <div className="float-shape w-10 h-10 bg-[var(--green)] rounded-full top-[80%] right-[25%]" style={{animationDelay: '3s'}} />
      </div>

      <main className={c.container}>
        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-[var(--red)] border-2 border-[var(--border)]" />
              <div className="w-3 h-3 bg-[var(--yellow)] border-2 border-[var(--border)]" />
              <div className="w-3 h-3 bg-[var(--green)] border-2 border-[var(--border)]" />
            </div>
            <span className="mt-[2px]">GLANCER</span>
          </div>
          <div className={c.navRight}>
            {isMonitoring ? (
              <span className={`${c.navStatus} !bg-[var(--green)] !text-[var(--text)] flex items-center gap-2`}>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> SENSOR ACTIVE
              </span>
            ) : (
              <span className={`${c.navStatus} bg-[var(--yellow)]`}>STANDBY</span>
            )}
          </div>
        </header>

        <section id="hero" className={c.heroCard}>
          <div className={c.heroAccentBar}>
            <div className="flex-1 bg-[var(--red)]" />
            <div className="flex-1 bg-[var(--yellow)]" />
            <div className="flex-1 bg-[var(--green)]" />
            <div className="flex-1 bg-[var(--blue)]" />
          </div>
          <div className={c.heroTitle}>
            <span aria-hidden="true" className={c.heroTextShadow}>ATTENTION<br/>MONITOR</span>
            <span className="leading-[0.95]">ATTENTION<br/>MONITOR</span>
          </div>
          <div className={`${c.heroControls} z-10 md:mt-0 mt-8`}>
            <button 
              className={isMonitoring ? c.btnGhost : c.btnPrimary}
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              {isMonitoring ? "STANDBY SYSTEM" : "ACTIVATE SENSOR"}
            </button>
            {isMonitoring && (
              <p className="text-[0.7rem] font-bold text-[var(--red)] uppercase tracking-widest mt-2 animate-pulse">
                Tracking Visual Focus Drops...
              </p>
            )}
          </div>
        </section>

        <section id="stats" className={c.statGrid}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--red)] text-white`}>TOTAL TODAY</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{allGlances.length}</span>
              <span className={c.statLabel}>GLANCES</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--yellow)] text-[var(--text)]`}>RATE / HR</div>
            <div className={c.statBody}>
              <span className={c.statNum}>
                {allGlances.length > 0 ? (allGlances.length / (Math.max(1, (Date.now() - allGlances[allGlances.length-1].timestamp)/3600000))).toFixed(1) : "0"}
              </span>
              <span className={c.statLabel}>LAPSES</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--blue)] text-white`}>LAST EVENT</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{glances[0] ? new Date(glances[0].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}</span>
              <span className={c.statLabel}>TIME LOGGED</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--green)] text-[var(--text)]`}>DEVICE</div>
            <div className={c.statBody}>
              <span className={c.statNum}>C-1</span>
              <span className={c.statLabel}>SENSOR ID</span>
            </div>
          </div>
        </section>

        <section id="logs" className={c.tableCard}>
          <div className={c.tableHeaderRow}>
            <div className={c.tableHeaderCol}>REF</div>
            <div className={c.tableHeaderCol}>TYPE</div>
            <div className={c.tableHeaderCol}>TIMESTAMP</div>
            <div className={c.tableHeaderCol}>STATUS</div>
          </div>
          {glances.length === 0 ? (
            <div className={c.tableRow}>
              <div className="col-span-4 text-center text-sm py-4">No glances logged yet. Maintain focus.</div>
            </div>
          ) : (
            glances.map((g, i) => (
              <div className={c.tableRow} key={g._id || i}>
                <div className={c.tableColMono}>#{g._id?.slice(-4) || '???'}</div>
                <div className={c.tableCol}>EYE_DRIFT</div>
                <div className={c.tableColMono}>{new Date(g.timestamp).toLocaleTimeString()}</div>
                <div className={c.tableCol}>
                  <span className={`${c.tableBadge} ${g.confidence > 90 ? 'bg-[var(--red)] text-white' : 'bg-[var(--yellow)]'}`}>
                    {g.confidence}% CONF
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        <section id="controls" className={c.controlsGrid}>
          <div className={c.controlCard}>
            <div>
              <h3 className={c.controlTitle}>MANUAL OVERRIDE</h3>
              <p className={c.controlDesc}>Force-log an attention lapse directly into the secure ledger.</p>
            </div>
            <div className="mt-auto flex gap-2">
              <button className={c.btnPrimary} onClick={recordGlance}>
                LOG GLANCE NOW
              </button>
            </div>
          </div>
          <div className={c.controlCard}>
            <div>
              <h3 className={c.controlTitle}>PATTERN ANALYSIS</h3>
              <p className={c.controlDesc}>Request an AI digest of your attention splits to find weak points.</p>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <button className={c.btnSecondary} onClick={runAnalysis} disabled={aiLoading || glances.length === 0}>
                {aiLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-[var(--text)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    CRUNCHING...
                  </span>
                ) : (
                  "RUN ANALYSIS"
                )}
              </button>
              {insight && (
                <div className="bg-[var(--bg)] border-2 border-[var(--border)] p-3 text-sm font-bold">
                  {insight}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}