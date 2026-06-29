import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const neobrutalStyles = `
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
    --radius: 4px;
    --shadow: 4px 4px 0px var(--border);
    --shadow-sm: 3px 3px 0px var(--border);
    --shadow-lg: 6px 6px 0px var(--border);
  }

  body {
    background-color: var(--bg);
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    background-image: 
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 60px 60px;
    background-position: center;
  }
  
  #ambient-bg {
    position: fixed;
    inset: 0;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
`;

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("couch-karaoke");
  
  // Singleton room state to keep everyone synced
  const { doc: room, merge: mergeRoom } = useDocument({ 
    _id: "global-stage",
    status: "idle", // 'idle' | 'playing'
    title: "",
    lyrics: [],
    currentLine: 0,
    historyIds: []
  });

  // Track scoring events globally
  const { docs: scoreEvents } = useLiveQuery("type", { key: "score", descending: true, limit: 100 });
  const { docs: historyDocs } = useLiveQuery("type", { key: "history", descending: true });

  const [isLoadingSuggestion, setIsLoadingSuggestion] = React.useState(false);
  const [localTitle, setLocalTitle] = React.useState("");
  const [localLyrics, setLocalLyrics] = React.useState("");

  React.useEffect(() => {
    // Basic automatic playback tick if running locally
    if (room.status === "playing" && room.lyrics.length > 0) {
      const timer = setInterval(() => {
        database.put({
          ...room,
          currentLine: Math.min(room.currentLine + 1, room.lyrics.length - 1)
        });
      }, 3500); // 3.5s per line pace for prototype
      return () => clearInterval(timer);
    }
  }, [room.status, room.currentLine, room.lyrics.length, room, database]);

  const [micActive, setMicActive] = React.useState(false);
  const avatarRef = React.useRef(null);
  const audioCtxRef = React.useRef(null);
  
  async function handleConnectMic() {
    if (micActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const actx = new AudioContext();
      audioCtxRef.current = actx;
      if (actx.state !== "running") await actx.resume();
      
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkVol = () => {
        if (!avatarRef.current) return requestAnimationFrame(checkVol);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        
        // Map average volume (0-100) to shadow intensity
        const intensity = Math.min(Math.max((avg / 80), 0.2), 1.5);
        avatarRef.current.style.boxShadow = `${intensity * 6}px ${intensity * 6}px 0px var(--red)`;
        avatarRef.current.style.transform = `scale(${1 + (intensity * 0.1)})`;
        avatarRef.current.style.borderColor = intensity > 0.8 ? 'var(--red)' : 'var(--border)';
        
        requestAnimationFrame(checkVol);
      };
      
      setMicActive(true);
      checkVol();
    } catch (e) { console.error("Mic failed", e); }
  }
  
  async function handleSuggestSong() {
    setIsLoadingSuggestion(true);
    try {
      const res = await callAI("Write a catchy, highly energetic verse for a karaoke track. Short lines.", {
        schema: {
          properties: {
            title: { type: "string" },
            lines: { type: "array", items: { type: "string" } }
          }
        }
      });
      const data = JSON.parse(res);
      setLocalTitle(data.title.toUpperCase());
      setLocalLyrics(data.lines.join('\n'));
    } catch(e) { console.error(e) } finally {
      setIsLoadingSuggestion(false);
    }
  }

  function handleStartSong(e) {
    e.preventDefault();
    if (!localTitle || !localLyrics) return;
    const lines = localLyrics.split('\n').filter(l => l.trim().length > 0);
    mergeRoom({
      status: "playing",
      title: localTitle,
      lyrics: lines,
      currentLine: 0
    });
  }

  function handleHype() {
    if (room.status !== "playing") return;
    database.put({
      type: "score",
      timestamp: Date.now(),
      line: room.currentLine,
      points: 1
    });
  }

  function handleEndSong() {
    if (room.status !== "playing") return;
    database.put({
      type: "history",
      title: room.title,
      date: new Date().toISOString().split('T')[0],
      totalHype: scoreEvents.length
    });
    mergeRoom({ status: "idle", currentLine: 0, lyrics: [], title: "" });
  }

  const c = {
    layout: "w-full max-w-[920px] mx-auto flex flex-col gap-12 relative z-10",
    nav: "flex items-center justify-between w-full p-4 mb-8 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)]",
    navBrand: "flex items-center gap-2",
    navLogoGroup: "flex items-center gap-1",
    navLogoSquare: "w-3 h-3 border-[3px] border-[var(--border)] rounded-sm",
    navLink: "px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow-lg)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    
    heroCard: "w-full p-6 md:p-10 relative flex flex-col items-center text-center bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden",
    heroBar: "absolute top-0 left-0 w-full h-1.5 flex",
    heroBarSeg: "flex-1 h-full border-b-[3px] border-[var(--border)]",
    heroTitleWrap: "relative mb-8 mt-4",
    heroTitle: "text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none relative z-10 text-[var(--text)]",
    heroShadow: "absolute top-[5px] left-[5px] text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none text-[var(--red)] opacity-50 z-0",
    
    lyricList: "w-full max-w-2xl flex flex-col gap-3 my-8",
    lyricLine: "text-lg md:text-2xl font-bold p-3 transition-colors duration-150 rounded-[var(--radius)] border-[3px] border-transparent font-['JetBrains_Mono']",
    lyricLineActive: "bg-[var(--yellow)] border-[var(--border)] shadow-[var(--shadow-sm)] translate-x-[-2px] translate-y-[-2px]",
    
    stageActions: "flex items-center justify-center gap-4 w-full mt-6",
    primaryBtn: "px-6 py-3 font-semibold uppercase tracking-wider cursor-pointer bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow-lg)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    secondaryBtn: "px-6 py-3 font-semibold uppercase tracking-wider cursor-pointer bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow-lg)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    iconBtn: "p-3 cursor-pointer flex items-center justify-center bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[var(--shadow-sm)] rounded-[var(--radius)]",
    
    statsGrid: "grid grid-cols-1 md:grid-cols-4 gap-4 w-full",
    statCard: "flex flex-col relative overflow-hidden bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)]",
    statHeader: "w-full p-2 text-[0.65rem] uppercase tracking-widest font-bold border-b-[3px] border-[var(--border)] text-white bg-[var(--muted)]",
    statBody: "p-4 flex items-center justify-between bg-[var(--card-bg)]",
    statNum: "text-3xl font-bold font-['JetBrains_Mono']",
    statLabel: "text-xs uppercase tracking-wider text-[var(--muted)]",
    
    avatarSquare: "w-12 h-12 flex items-center justify-center font-bold text-xl transition-all duration-150 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)]",
    
    gridTwoLayout: "grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-10",
    formCard: "flex flex-col p-6 w-full gap-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)]",
    formHeader: "text-xs uppercase tracking-widest font-bold mb-4 text-[var(--muted)]",
    inputGroup: "flex flex-col gap-2",
    label: "text-xs font-bold uppercase tracking-wider",
    input: "w-full p-3 font-['JetBrains_Mono'] text-sm transition-all focus:outline-none bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[var(--shadow)]",
    textarea: "w-full p-3 font-['JetBrains_Mono'] text-sm min-h-[120px] transition-all focus:outline-none resize-none bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[var(--shadow)]",
    
    tableCard: "w-full p-4 md:p-8 flex flex-col overflow-x-auto mt-10 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)]",
    table: "w-full text-left border-collapse",
    th: "p-2 text-[0.6rem] uppercase tracking-widest font-bold border-b-[2px] border-[var(--border)] text-[var(--muted)]",
    td: "p-3 text-sm font-medium border-b-[1px] border-[var(--border)] border-opacity-30",
    monoTd: "p-3 text-sm font-['JetBrains_Mono'] border-b-[1px] border-[var(--border)] border-opacity-30",
    badgeLabel: "inline-block px-2 py-1 text-[0.65rem] uppercase tracking-widest font-bold border-[2px] border-[var(--border)] rounded-[var(--radius)] bg-[var(--green)] text-[var(--text)] shadow-[var(--shadow-sm)]"
  };

  return (
    <>
      <style>{neobrutalStyles}</style>
      <div id="ambient-bg" />
      <div className={c.layout} style={{ padding: '3rem 2rem' }}>
        
        {/* NAV */}
        <header className={c.nav}>
          <div className={c.navBrand}>
            <div className={c.navLogoGroup}>
              <div className={`${c.navLogoSquare} bg-[var(--red)]`} />
              <div className={`${c.navLogoSquare} bg-[var(--yellow)]`} />
              <div className={`${c.navLogoSquare} bg-[var(--green)]`} />
            </div>
            <span className="font-bold text-lg uppercase tracking-tight ml-2">Couch Karaoke</span>
          </div>
          <div>
            <button className={c.navLink}>Connect Mic</button>
          </div>
        </header>

        {/* HERO LIVE STAGE */}
        <section id="stage" className={c.heroCard}>
          <div className={c.heroBar}>
            <div className={`${c.heroBarSeg} bg-[var(--red)]`} />
            <div className={`${c.heroBarSeg} bg-[var(--yellow)]`} />
            <div className={`${c.heroBarSeg} bg-[var(--green)]`} />
            <div className={`${c.heroBarSeg} bg-[var(--blue)]`} />
          </div>
          
          <div className={c.heroTitleWrap}>
            <h1 className={c.heroShadow} aria-hidden="true">{room.status === "playing" ? room.title : "WAITING FOR SET"}</h1>
            <h1 className={c.heroTitle}>{room.status === "playing" ? room.title : "WAITING FOR SET"}</h1>
          </div>
          
          <div className={c.lyricList}>
            {room.status === "playing" ? (
              room.lyrics.slice(Math.max(0, room.currentLine - 1), room.currentLine + 2).map((line, i) => {
                const globalLineIdx = Math.max(0, room.currentLine - 1) + i;
                const isActive = globalLineIdx === room.currentLine;
                return (
                  <div key={globalLineIdx} className={`${c.lyricLine} ${isActive ? c.lyricLineActive : ''}`}>
                    {line}
                  </div>
                )
              })
            ) : (
              <div className={`${c.lyricLine} text-[var(--muted)] opacity-50`}>
                &gt; HOST_WAITING_FOR_TRACK_DATA...
              </div>
            )}
          </div>
          
          <div className={c.stageActions}>
            <button onClick={handleHype} className={c.primaryBtn}>🔥 HYPE SINGER</button>
            <button onClick={handleEndSong} className={c.secondaryBtn}>END TRACK</button>
          </div>
        </section>

        {/* STAT ROW (PARTICIPANTS) */}
        <section id="room-status" className={c.statsGrid}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--blue)]`}>Local Mic</div>
            <div className={c.statBody}>
              <div ref={avatarRef} className={c.avatarSquare}>U</div>
              <div className="flex flex-col items-end">
                <span className={c.statNum}>{scoreEvents.length}</span>
                <span className={c.statLabel}>Hype</span>
              </div>
            </div>
          </div>
          
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--red)]`}>Stage Crowd</div>
            <div className={c.statBody}>
              <div className={c.avatarSquare}>C</div>
              <div className="flex flex-col items-end">
                <span className={c.statNum}>{room.status === "playing" ? room.currentLine : 0}</span>
                <span className={c.statLabel}>Lines</span>
              </div>
            </div>
          </div>

          <div className={c.statCard}>
            <div className={`${c.statHeader} text-[var(--text)] bg-[var(--yellow)]`}>Top Supporter</div>
            <div className={c.statBody}>
              <div className={c.avatarSquare}>*</div>
              <div className="flex flex-col items-end">
                <span className={c.statNum}>{scoreEvents.length > 5 ? 'VIP' : 'FAN'}</span>
                <span className={c.statLabel}>Rank</span>
              </div>
            </div>
          </div>
          
          <div className={c.statCard}>
            <div className={`${c.statHeader} text-[var(--text)] bg-[var(--green)]`}>Vibe Check</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{room.status === "playing" ? 'LIVE' : 'MAX'}</span>
              <span className={c.statLabel}>Sync</span>
            </div>
          </div>
        </section>

        {/* FORM GRID (HOST CONTROLS) */}
        <section id="host-tools" className={c.gridTwoLayout}>
          <form onSubmit={handleStartSong} className={c.formCard}>
            <h2 className={c.formHeader}>Host Setlist Tools</h2>
            
            <div className={c.inputGroup}>
              <label className={c.label}>Song Title</label>
              <input 
                type="text" 
                className={c.input} 
                value={localTitle} 
                onChange={(e) => setLocalTitle(e.target.value)} 
                placeholder="e.g. Thunder Road" 
              />
            </div>
            
            <div className={c.inputGroup}>
              <label className={c.label}>Lyrics (Line breaks matter)</label>
              <textarea 
                className={c.textarea} 
                value={localLyrics}
                onChange={(e) => setLocalLyrics(e.target.value)}
                placeholder="Paste lyrics here..." 
              />
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <button type="submit" className={c.primaryBtn} disabled={room.status === "playing"}>START SESSION</button>
              <button type="button" onClick={handleSuggestSong} disabled={isLoadingSuggestion} className={`${c.secondaryBtn} flex items-center justify-center gap-2`}>
                {isLoadingSuggestion ? (
                  <svg className="animate-spin h-4 w-4 text-[var(--text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeLinecap="square" />
                  </svg>
                ) : null}
                {isLoadingSuggestion ? "GENERATING..." : "AI GENERATE"}
              </button>
            </div>
          </form>
          
          <div className={c.formCard}>
            <h2 className={c.formHeader}>Room Configuration</h2>
            
            <div className="flex items-center gap-4 p-4 mt-4 bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)]">
              <div className={`${c.avatarSquare} bg-[var(--blue)] text-white`}>U</div>
              <div>
                <div className="font-bold uppercase tracking-wider text-sm">Audio Processor</div>
                <div className="text-xs font-['JetBrains_Mono'] mt-1 text-[var(--muted)]">Status: {micActive ? "Active" : "Disconnected"}</div>
              </div>
            </div>
            
            <button type="button" onClick={handleConnectMic} disabled={micActive} className={`${c.secondaryBtn} mt-4 opacity-${micActive ? '50' : '100'} cursor-${micActive ? 'not-allowed' : 'pointer'}`}>
              {micActive ? "AUDIO CONNECTED" : "AUTHORIZE AUDIO"}
            </button>
            
            <div className="mt-8 pt-6 border-t font-mono text-[0.65rem] uppercase">
              // AUDIO CONTEXT REQUIRES USER GESTURE.<br/>
              // WE USE ANALYSER NODE FOR VOL DETECT.<br/>
              // NO AUDIO RECORDINGS ARE STORED OR SENT.
            </div>
          </div>
        </section>

        {/* ARCHIVE TABLE */}
        <section id="archive" className={c.tableCard}>
          <h2 className="text-sm uppercase tracking-widest font-bold mb-6">Concert Archive</h2>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Track Title</th>
                <th className={c.th}>Status</th>
                <th className={c.th}>Total Hype</th>
                <th className={c.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {historyDocs.length === 0 && (
                <tr>
                  <td colSpan="4" className={`${c.td} text-center py-8 text-[var(--muted)]`}>No completed tracks yet. Grab the mic.</td>
                </tr>
              )}
              {historyDocs.map(doc => (
                <tr key={doc._id} className="hover:bg-[var(--yellow)] hover:bg-opacity-20 transition-colors">
                  <td className={c.td}>{doc.title}</td>
                  <td className={c.td}><span className={c.badgeLabel}>FINISHED</span></td>
                  <td className={c.monoTd}>{doc.totalHype}</td>
                  <td className={c.monoTd}>{doc.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </>
  )
}