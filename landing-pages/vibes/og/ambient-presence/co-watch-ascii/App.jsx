import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [activeRoomId, setActiveRoomId] = React.useState("");
  const [username, setUsername] = React.useState("User" + Math.floor(Math.random() * 999));
  const [joinCode, setJoinCode] = React.useState("");
  const [customAscii, setCustomAscii] = React.useState("");
  const [viewTime, setViewTime] = React.useState(0);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [activeFloaters, setActiveFloaters] = React.useState([]);

  const { database, useLiveQuery, useDocument } = useFireproof("neowatch");

  // Room tracking
  const { doc: room } = useDocument({ 
    _id: activeRoomId || "setup_preview",
    type: "room",
    status: "paused",
    baseTime: 0
  });

  // Reaction ledger
  const { docs: reactions } = useLiveQuery("roomId", {
    key: activeRoomId || "setup_preview",
    descending: true,
    limit: 50
  });

  React.useEffect(() => {
    if (!room || room.type !== "room") return;
    const interval = setInterval(() => {
      if (room.status === "playing" && room.unpausedAt) {
        const elapsed = (Date.now() - room.unpausedAt) / 1000;
        setViewTime((room.baseTime || 0) + elapsed);
      } else {
        setViewTime(room.baseTime || 0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [room]);

  React.useEffect(() => {
    const now = Date.now();
    const fresh = reactions.filter(r => (now - r.createdAt) < 4000);
    setActiveFloaters(fresh);
  }, [reactions]);

  const handleSetup = async (e, mode) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (mode === "join") {
      setActiveRoomId(joinCode.trim().toUpperCase());
    } else {
      const newId = "RM-" + Math.random().toString(36).substr(2, 5).toUpperCase();
      await database.put({ _id: newId, type: "room", host: username, status: "paused", baseTime: 0 });
      setActiveRoomId(newId);
    }
  };

  const togglePlayback = async () => {
    if (room.status === "paused") {
      await database.put({ ...room, status: "playing", unpausedAt: Date.now() });
      sendReaction("▶ PLAY");
    } else {
      await database.put({ ...room, status: "paused", baseTime: viewTime, unpausedAt: null });
      sendReaction("⏸ PAUSE");
    }
  };

  const sendReaction = async (payload) => {
    if (!activeRoomId || !payload) return;
    await database.put({
      type: "reaction",
      roomId: activeRoomId,
      sender: username,
      ascii: payload,
      msOffset: Math.floor(viewTime * 1000),
      createdAt: Date.now(),
      xPos: 10 + Math.random() * 80
    });
    setCustomAscii("");
  };

  const suggestReaction = async () => {
    setIsSuggesting(true);
    try {
      const res = await callAI("Give me a cool kaomoji or small ASCII art struct", {
        schema: { properties: { ascii: { type: "string" } } }
      });
      const data = JSON.parse(res);
      setCustomAscii(data.ascii || "¯\\_(ツ)_/¯");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const pad = (num) => String(Math.floor(num)).padStart(2, "0");
  const timeString = `${pad(viewTime / 60)}:${pad(viewTime % 60)}:${pad((viewTime % 1) * 100)}`;

  const c = {
    app: "relative min-h-screen flex flex-col items-center py-6 px-4 overflow-hidden",
    header: "w-full max-w-[920px] mx-auto flex items-center justify-between mb-8 z-20 bg-[var(--card-bg)] border-[3px] border-[var(--border)] p-4 rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    logo: "flex items-center gap-3 font-bold uppercase text-lg tracking-[-0.02em]",
    logoSquares: "flex gap-1",
    logoSq1: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--red)] rounded-[2px]",
    logoSq2: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--yellow)] rounded-[2px]",
    logoSq3: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--green)] rounded-[2px]",
    statusChip: "px-3 py-1 text-[0.7rem] uppercase font-bold tracking-[0.05em] bg-[var(--text)] text-[var(--bg)] rounded-[4px]",
    main: "w-full max-w-[920px] flex flex-col gap-8 z-20",
    
    heroCard: "flex flex-col relative bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    heroAccent: "flex w-full h-[6px] border-b-[3px] border-[var(--border)]",
    heroAcc1: "h-full w-1/4 bg-[var(--red)] border-r-[3px] border-[var(--border)]",
    heroAcc2: "h-full w-1/4 bg-[var(--yellow)] border-r-[3px] border-[var(--border)]",
    heroAcc3: "h-full w-1/4 bg-[var(--green)] border-r-[3px] border-[var(--border)]",
    heroAcc4: "h-full w-1/4 bg-[var(--blue)]",
    
    screen: "w-full min-h-[400px] flex flex-col items-center justify-center p-8 relative overflow-hidden",
    screenBrand: "text-6xl md:text-8xl font-bold uppercase text-center relative z-10 tracking-tighter",
    screenShadow: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] text-6xl md:text-8xl font-bold uppercase tracking-tighter text-[var(--red)] opacity-50",
    timecode: "text-5xl mt-8 relative z-10 font-bold font-mono tracking-tighter uppercase",
    
    controlsGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    card: "p-6 flex flex-col bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    sectionLabel: "block mb-4 text-[0.65rem] uppercase tracking-[0.15em] text-[var(--muted)] font-bold",
    
    inputRow: "flex gap-2 w-full mb-2 items-stretch",
    input: "flex-1 px-4 py-3 outline-none uppercase font-mono text-sm border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--bg)] focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0_var(--border)] transition-transform",
    btnPrimary: "px-6 py-3 uppercase text-sm font-bold tracking-[0.05em] flex items-center justify-center whitespace-nowrap bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all",
    btnSecondary: "px-6 py-3 uppercase text-sm font-bold tracking-[0.05em] flex items-center justify-center whitespace-nowrap bg-[var(--yellow)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all",
    btnGhost: "px-3 py-2 uppercase text-xs font-bold bg-transparent hover:bg-[var(--bg)] transition-colors",
    btnSuggest: "mt-2 self-start px-3 py-2 uppercase text-[0.7rem] font-bold tracking-[0.05em] bg-[var(--blue)] text-white border-[3px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0_var(--border)] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",
    
    tagRow: "flex flex-wrap gap-2 mt-4",
    tagBtn: "px-3 py-2 uppercase text-xs font-bold font-mono bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0_var(--border)] hover:bg-[var(--yellow)] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",
    
    tableWrap: "w-full overflow-x-auto border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--bg)]",
    table: "w-full text-left border-collapse",
    th: "p-3 uppercase text-[0.6rem] tracking-[0.1em] text-[var(--muted)] border-b-[2px] border-[var(--border)]",
    td: "p-3 text-[0.82rem] font-bold border-b border-[var(--border)]/20",
    tdMono: "p-3 text-[0.82rem] font-mono font-bold border-b border-[var(--border)]/20"
  };

  return (
    <div id="app" className={c.app}>
      <style id="theme-styles">{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
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
          background-image: 
            linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        @keyframes modal-pop { 
          0% { transform: scale(0.95); opacity: 0; } 
          100% { transform: scale(1); opacity: 1; } 
        }
        @keyframes float-drift {
          0% { transform: translateY(100vh) scale(0.8) rotate(-10deg); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-20vh) scale(1.2) rotate(10deg); opacity: 0; }
        }
        .ascii-floater {
          animation: float-drift 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          text-shadow: 2px 2px 0 var(--yellow), -2px -2px 0 var(--yellow), 0px 4px 0px var(--border);
        }
      `}</style>

      {/* AMBIENT BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-16 h-16 rounded-full bg-[var(--red)] opacity-20 border-[3px] border-[var(--border)]" />
        <div className="absolute top-1/3 right-12 w-12 h-12 rotate-45 bg-[var(--yellow)] opacity-30 border-[3px] border-[var(--border)]" />
        <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-[var(--blue)] opacity-20 border-[3px] border-[var(--border)] rounded-[4px]" />
      </div>

      <header className={c.header}>
        <div className={c.logo}>
          <div className={c.logoSquares}>
             <div className={c.logoSq1}></div>
             <div className={c.logoSq2}></div>
             <div className={c.logoSq3}></div>
          </div>
          <span>SyncWatch</span>
        </div>
        <div className={c.statusChip}>
          {activeRoomId ? (room?.status === "playing" ? "🟢 Live Phase" : "🟡 Synced & Paused") : "🔴 Standing By"}
        </div>
      </header>

      <main className={c.main}>
        
        {!activeRoomId && (
        <section className={c.heroCard} id="setup">
          <div className={c.heroAccent}>
            <div className={c.heroAcc1}></div>
            <div className={c.heroAcc2}></div>
            <div className={c.heroAcc3}></div>
            <div className={c.heroAcc4}></div>
          </div>
          <div className={c.screen}>
            <h1 className={c.screenBrand}>Terminal</h1>
            <p className="mt-4 max-w-sm text-center">Join an active broadcast or start a new transmission instance.</p>
            <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-4 mt-8 w-full max-w-sm">
               <input value={username} onChange={e => setUsername(e.target.value)} type="text" placeholder="Username" className={c.input} required />
               <input value={joinCode} onChange={e => setJoinCode(e.target.value)} type="text" placeholder="Room Code" className={c.input} />
               <div className="flex gap-4 mt-2">
                  <button onClick={e => handleSetup(e, "join")} type="button" className={c.btnSecondary} disabled={!joinCode}>Join Event</button>
                  <button onClick={e => handleSetup(e, "create")} type="button" className={c.btnPrimary}>New Relay</button>
               </div>
            </form>
          </div>
        </section>
        )}

        {activeRoomId && (
        <section className={c.heroCard} id="theater">
           <div className={c.heroAccent}>
            <div className={c.heroAcc1}></div>
            <div className={c.heroAcc2}></div>
            <div className={c.heroAcc3}></div>
            <div className={c.heroAcc4}></div>
          </div>
          <div className={c.screen}>
            <div className={c.screenShadow} aria-hidden="true">{timeString}</div>
            <div className={c.timecode}>{timeString}</div>
            
            <div id="floater-layer" className="absolute inset-0 pointer-events-none overflow-hidden">
               {activeFloaters.map(r => (
                 <div key={r._id} className="ascii-floater absolute font-mono text-4xl md:text-5xl font-bold font-bold whitespace-nowrap" style={{ left: `${r.xPos}%`, bottom: '-10%' }}>
                   {r.ascii}
                 </div>
               ))}
            </div>
          </div>
        </section>

        {activeRoomId && (
        <section className={c.controlsGrid} id="controls">
          <div className={c.card}>
            <span className={c.sectionLabel}>Relay Link</span>
            <div className={c.inputRow}>
              <button onClick={togglePlayback} className={room?.status === 'playing' ? c.btnSecondary : c.btnPrimary}>
                {room?.status === 'playing' ? "⏸ PAUSE FEEDS" : "▶ START STREAM"}
              </button>
            </div>
            <div className="flex justify-between items-center mt-4">
               <p className="text-sm font-bold tracking-widest font-mono">CODE: {activeRoomId}</p>
               <button onClick={() => setActiveRoomId("")} className={c.btnGhost}>DISCONNECT</button>
            </div>
          </div>

          <div className={c.card}>
            <span className={c.sectionLabel}>Action Deck</span>
            <form onSubmit={(e) => { e.preventDefault(); sendReaction(customAscii); }} className="flex flex-col">
              <div className={c.inputRow}>
                <input value={customAscii} onChange={e => setCustomAscii(e.target.value)} type="text" placeholder="Custom Text..." className={c.input} />
                <button type="submit" className={c.btnSecondary} disabled={!customAscii}>FIRE</button>
              </div>
              <button type="button" onClick={suggestReaction} disabled={isSuggesting} className={c.btnSuggest}>
                {isSuggesting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="30 30" strokeLinecap="round"></circle></svg>
                    COMPUTING
                  </span>
                ) : '✨ Generate Vibe'}
              </button>
              
              <div className={c.tagRow}>
                <button type="button" onClick={() => sendReaction("(╯°□°)╯︵ ┻━┻")} className={c.tagBtn}>(╯°□°)╯︵ ┻━┻</button>
                <button type="button" onClick={() => sendReaction("ಠ_ಠ")} className={c.tagBtn}>ಠ_ಠ</button>
                <button type="button" onClick={() => sendReaction("ヽ(•‿•)ノ")} className={c.tagBtn}>ヽ(•‿•)ノ</button>
                <button type="button" onClick={() => sendReaction("BOOOOO")} className={c.tagBtn}>BOOOOO</button>
              </div>
            </form>
          </div>
        </section>
        )}

        {activeRoomId && (
        <section className={c.card} id="log">
           <span className={c.sectionLabel}>Terminal Ledger</span>
           <div className={c.tableWrap}>
             <table className={c.table}>
               <thead>
                 <tr>
                   <th className={c.th}>T+ Offset</th>
                   <th className={c.th}>Origin</th>
                   <th className={c.th}>Payload</th>
                 </tr>
               </thead>
               <tbody>
                 {reactions.map(r => (
                 <tr key={r._id} className="hover:bg-[var(--yellow)]/10 transition-colors">
                   <td className={c.tdMono}>
                     {pad((r.msOffset || 0) / 1000 / 60)}:{pad(((r.msOffset || 0) / 1000) % 60)}
                   </td>
                   <td className={c.td}>{r.sender}</td>
                   <td className={c.tdMono}>{r.ascii}</td>
                 </tr>
                 ))}
                 {reactions.length === 0 && (
                   <tr>
                     <td colSpan="3" className="p-4 text-center text-sm font-bold text-[var(--muted)]">NO TRAFFIC LOGGED</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </section>
        )}

      </main>
    </div>
  )
}