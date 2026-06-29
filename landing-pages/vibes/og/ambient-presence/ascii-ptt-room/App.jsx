import React, { useState, useRef, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // 1. Hooks & State
  const { useLiveQuery, database } = useFireproof("ascii-ptt-room");
  const [handle, setHandle] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const frameIntervalRef = useRef(null);
  const [activeSession, setActiveSession] = useState(null);
  
  const { docs: activeSignals } = useLiveQuery("type", { key: "live_frame" });
  const { docs: historyClips } = useLiveQuery("type", { key: "clip", descending: true, limit: 12 });
  
  // ASCII Palette mapping brightest (index 11) to darkest (index 0)
  const ASCII_MAP = ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', '.', ' '];

  // 2. Handlers
  function handleJoin(e) {
    e.preventDefault();
    if (inputVal.trim()) {
      setHandle(inputVal.trim().toUpperCase());
      setIsJoined(true);
    }
  }

  async function handleSuggestHandle() {
    setIsGenerating(true);
    try {
      const res = await callAI("Suggest a creative 1-2 word retro sci-fi radio callsign, max 10 chars", {
        schema: { properties: { callsign: { type: "string" } } }
      });
      const data = JSON.parse(res);
      setInputVal(data.callsign.toUpperCase());
    } finally {
      setIsGenerating(false);
    }
  }

  async function startPTT() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      const session = Date.now().toString();
      setActiveSession(session);
      setIsRecording(true);

      const video = document.getElementById('webcam');
      video.srcObject = stream;
      await video.play();

      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Start capturing frames at ~10fps
      let lastAscii = "";
      frameIntervalRef.current = setInterval(() => {
        ctx.drawImage(video, 0, 0, 50, 25);
        const imgData = ctx.getImageData(0, 0, 50, 25).data;
        let asciiStr = "";
        for (let y = 0; y < 25; y++) {
          for (let x = 0; x < 50; x++) {
            const idx = (y * 50 + x) * 4;
            const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
            let brightness = (r + g + b) / 3;
            let charIdx = Math.floor((brightness / 255) * (ASCII_MAP.length - 1));
            asciiStr += ASCII_MAP[charIdx];
          }
          asciiStr += "\n";
        }
        
        lastAscii = asciiStr;
        // Broadcast single latest frame per user
        database.put({
          _id: `live_frame_${handle}`,
          type: "live_frame",
          handle,
          ascii: asciiStr,
          ts: Date.now(),
          session
        });
      }, 100);

      // Start Audio
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => saveClip(lastAscii, session);
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("Mic/Cam Error:", err);
    }
  }

  function stopPTT() {
    if (!isRecording) return;
    setIsRecording(false);
    
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    
    // Stop all tracks to turn off camera light
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    // Clear live transmission indicator
    database.del(`live_frame_${handle}`);
  }

  async function saveClip(posterAscii, session) {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    await database.put({
      type: "clip",
      handle,
      ts: Date.now(),
      poster: posterAscii,
      _files: {
        audio: audioBlob
      }
    });
  }

  const [activeAudioObj, setActiveAudioObj] = useState(null);
  
  function playAudioUrl(url) {
    if (activeAudioObj) {
      activeAudioObj.pause();
    }
    const audio = new Audio(url);
    setActiveAudioObj(audio);
    audio.play();
  }

  // 3. ClassNames (Layout only pass 1)
  const c = {
    app: "min-h-screen relative font-sans p-4 md:p-8 flex flex-col items-center overflow-x-hidden bg-[var(--bg)] text-[var(--text)]",
    ambient: "fixed inset-0 pointer-events-none z-0 opacity-40",
    page: "w-full max-w-[920px] relative z-10 flex flex-col gap-6",
    
    // Nav
    nav: "flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-[3px] border-[var(--border)] rounded bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] my-4",
    navLogo: "font-bold text-xl uppercase tracking-tighter flex items-center gap-2 text-[var(--text)]",
    logoSquares: "flex gap-1",
    logoSq: "w-3 h-3 border-[2px] border-[var(--border)]",
    navRight: "flex gap-2 mt-4 sm:mt-0",
    navPill: "px-3 py-1 text-xs font-bold uppercase tracking-wider border-[3px] border-[var(--border)] rounded bg-[var(--bg)] text-[var(--muted)]",
    
    // Screens
    joinCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded p-8 max-w-[400px] w-full mx-auto mt-12 flex flex-col gap-6 shadow-[8px_8px_0px_var(--border)]",
    title: "text-3xl font-black uppercase tracking-tighter relative",
    formGroup: "flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "border-[3px] border-[var(--border)] rounded px-4 py-3 font-mono text-sm w-full bg-[var(--card-bg)] text-[var(--text)] outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_var(--border)] transition-all",
    btnPrimary: "border-[3px] border-[var(--border)] bg-[var(--red)] text-[var(--card-bg)] rounded px-6 py-4 uppercase font-bold tracking-widest flex justify-center items-center gap-2 shadow-[4px_4px_0px_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer disabled:opacity-50",
    btnSecondary: "border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] rounded px-4 py-2 uppercase text-xs font-bold shadow-[3px_3px_0px_var(--border)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_var(--border)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer disabled:opacity-50",
    
    // Live Room
    roomGrid: "grid grid-cols-1 md:grid-cols-3 gap-6",
    liveCol: "md:col-span-2 flex flex-col gap-6",
    liveCard: "border-[3px] border-[var(--border)] rounded bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] p-1 flex flex-col relative overflow-hidden",
    heroAccent: "absolute top-0 left-0 right-0 h-[6px] flex z-10 border-b-[3px] border-[var(--border)]",
    heroSegment: "flex-1 h-full",
    asciiDisplay: "font-mono text-[8px] sm:text-[10px] leading-[8px] sm:leading-[10px] whitespace-pre p-4 pt-8 overflow-hidden flex items-center justify-center min-h-[300px] bg-[var(--bg)] text-[var(--text)]",
    
    // Roster & Controls
    controlCol: "flex flex-col gap-6",
    pttCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] rounded p-6 flex flex-col items-center justify-center gap-4 text-center h-[200px] md:h-auto md:flex-1",
    pttBtn: "w-32 h-32 rounded border-[3px] border-[var(--border)] bg-[var(--red)] text-[var(--card-bg)] shadow-[6px_6px_0px_var(--border)] flex items-center justify-center font-black uppercase text-xl select-none cursor-pointer hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[8px_8px_0px_var(--border)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:bg-[var(--muted)]",
    rosterCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] rounded p-4 flex flex-col gap-4",
    rosterItem: "flex items-center gap-2 font-mono text-sm uppercase py-1 text-[var(--text)] border-b-[2px] border-b-transparent hover:border-[var(--border)]",
    pulseDot: "w-3 h-3 rounded-full border-[2px] border-[var(--border)]",
    
    // History
    historyHeader: "mt-8 text-xl font-black uppercase tracking-tighter border-b-[3px] border-[var(--border)] pb-2 text-[var(--text)]",
    historyGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6",
    clipCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] rounded flex flex-col hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_var(--border)] transition-transform",
    clipHeader: "px-3 py-2 text-xs font-bold uppercase flex justify-between items-center border-b-[3px] border-[var(--border)] bg-[var(--yellow)]",
    clipBody: "p-4 font-mono text-[6px] leading-[6px] whitespace-pre overflow-hidden flex justify-center items-center bg-[var(--bg)] text-[var(--text)] min-h-[100px]",
    clipFooter: "p-2 flex justify-center border-t-[3px] border-[var(--border)] bg-[var(--card-bg)]",
  };

  return (
    <div className={c.app}>
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
        body { font-family: "Space Grotesk", sans-serif; }
        .font-mono { font-family: "JetBrains Mono", monospace; }
        .float-block { position: absolute; border: 3px solid var(--border); }
        .plus-shape { position: absolute; width: 40px; height: 40px; opacity: 0.2; }
        .plus-shape::before, .plus-shape::after { content: ''; position: absolute; background: var(--border); }
        .plus-shape::before { top: 15px; left: 0; width: 40px; height: 10px; }
        .plus-shape::after { top: 0; left: 15px; width: 10px; height: 40px; }
      `}</style>

      {/* Ambient BG */}
      <div className={c.ambient}>
        {/* Subtle grid base */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.04 }} />
        <div className="float-block bg-[var(--red)] opacity-20" style={{ width: 40, height: 40, top: '10%', left: '5%', borderRadius: '50%' }} />
        <div className="float-block bg-[var(--yellow)] opacity-30" style={{ width: 60, height: 60, bottom: '20%', right: '10%' }} />
        <div className="plus-shape" style={{ top: '30%', right: '15%' }} />
        <div className="plus-shape" style={{ bottom: '15%', left: '8%' }} />
        <div className="float-block bg-[var(--blue)] opacity-20" style={{ width: 30, height: 30, top: '60%', left: '40%', transform: 'rotate(45deg)' }} />
      </div>

      <div className={c.page}>
        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className={c.logoSquares}>
              <div className={`${c.logoSq} bg-[var(--red)]`} />
              <div className={`${c.logoSq} bg-[var(--yellow)]`} />
              <div className={`${c.logoSq} bg-[var(--green)]`} />
            </div>
            ASCII PTT
          </div>
          <div className={c.navRight}>
            <div className={`${c.navPill} ${isJoined ? 'bg-[var(--green)] text-[var(--card-bg)] shadow-[3px_3px_0px_var(--border)]' : ''}`}>
              {isJoined ? `ID: ${handle}` : 'Status: Offline'}
            </div>
          </div>
        </header>

        {/* --- JOIN VIEW --- */}
        {!isJoined && (
        <section id="join" className={c.joinCard}>
          <h1 className={c.title}>Enter Channel</h1>
          <form className={c.formGroup} onSubmit={handleJoin}>
            <label className={c.label}>Operator Handle</label>
            <input 
              className={c.input} 
              type="text" 
              placeholder="e.g. VIPER_1" 
              maxLength={12}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button className={`${c.btnPrimary} flex-1`} type="submit" disabled={!inputVal.trim() || isGenerating}>
                Connect
              </button>
              <button 
                type="button" 
                className={c.btnSecondary}
                onClick={handleSuggestHandle}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 20"/></svg>
                ) : "Auto"}
              </button>
            </div>
          </form>
        </section>
        )}

        {/* --- MAIN ROOM VIEW --- */}
        {isJoined && (
        <section id="room" className={c.roomGrid}>
           <div className={c.liveCol}>
              <div className={c.liveCard}>
                <div className={c.heroAccent}>
                  <div className={`${c.heroSegment} bg-[var(--red)]`} />
                  <div className={`${c.heroSegment} bg-[var(--yellow)]`} />
                  <div className={`${c.heroSegment} bg-[var(--green)]`} />
                  <div className={`${c.heroSegment} bg-[var(--blue)]`} />
                </div>
                <div className={c.asciiDisplay}>
                  {activeSignals.length > 0 
                     ? activeSignals.sort((a,b) => b.ts - a.ts)[0].ascii 
                     : "NO_SIGNAL\n".repeat(15)}
                </div>
              </div>
           </div>

           <div className={c.controlCol}>
              <div className={c.pttCard}>
                <h2 className={c.label}>Transmitter</h2>
                <button 
                  className={c.pttBtn}
                  onMouseDown={startPTT}
                  onMouseUp={stopPTT}
                  onTouchStart={startPTT}
                  onTouchEnd={stopPTT}
                  style={isRecording ? { transform: 'translate(4px, 4px)', boxShadow: 'none', backgroundColor: 'var(--yellow)', color: 'var(--text)' } : {}}
                >
                  {isRecording ? 'LIVE' : 'Hold'}
                </button>
              </div>

              <div className={c.rosterCard}>
                <h3 className={c.label}>Active Signals</h3>
                <ul className="flex flex-col gap-2 mt-2">
                  <li className={c.rosterItem}>
                    <div className={`${c.pulseDot} ${isRecording ? 'bg-[var(--red)] animate-pulse' : 'bg-[var(--card-bg)]'}`} />
                    {handle} (You)
                  </li>
                  {activeSignals.filter(s => s.handle !== handle).map(sig => (
                    <li key={sig._id} className={c.rosterItem}>
                      <div className={`${c.pulseDot} bg-[var(--green)] animate-pulse`} />
                      {sig.handle}
                    </li>
                  ))}
                </ul>
              </div>
           </div>
        </section>
        )}

        {/* --- HISTORY FEED --- */}
        {isJoined && (
        <section id="history">
          <h2 className={c.historyHeader}>Transmission Log</h2>
          <div className={c.historyGrid}>
            
            {historyClips.length === 0 && (
              <div className="col-span-full p-8 text-center border-[3px] border-[var(--border)] border-dashed text-[var(--muted)] text-sm font-bold uppercase">
                No logs detected on current frequency.
              </div>
            )}
            
            {historyClips.map(clip => (
               <div key={clip._id} className={c.clipCard}>
                 <div className={c.clipHeader}>
                   <span>{clip.handle}</span>
                   <span>{new Date(clip.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className={c.clipBody}>
                   {clip.poster || `###\n###\n###`}
                 </div>
                 <div className={c.clipFooter}>
                   <button 
                     className={c.btnSecondary} 
                     onClick={() => clip._files?.audio?.url && playAudioUrl(clip._files.audio.url)}
                     disabled={!clip._files?.audio}
                   >
                     {clip._files?.audio ? 'Play Log' : 'No Data'}
                   </button>
                 </div>
               </div>
            ))}

          </div>
        </section>
        )}

        {/* Hidden media elements */}
        <video id="webcam" style={{ display: 'none' }} autoPlay playsInline muted />
        <canvas id="canvas" style={{ display: 'none' }} width="50" height="25" />
      </div>
    </div>
  )
}