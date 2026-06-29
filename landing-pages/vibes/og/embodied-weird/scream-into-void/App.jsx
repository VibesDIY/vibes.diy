import React, { useState, useEffect, useRef } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("void-tuesday");
  
  const { doc: sessionDoc, merge: mergeSession, submit: submitSession } = useDocument({
    type: "scream",
    intention: "",
    duration: 0,
    createdAt: Date.now(),
    _files: {}
  });

  const { docs: archive } = useLiveQuery("type", { key: "scream", descending: true });

  const [isRecording, setIsRecording] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const animFrameRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  async function startVoidScream(e) {
    e.preventDefault();
    if (isRecording) return stopVoidScream(e);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `scream-${Date.now()}.webm`, { type: "audio/webm" });
        mergeSession({ _files: { audio: file }, duration: 60 - timeLeft, createdAt: Date.now() });
        setTimeout(() => submitSession(), 100);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimeLeft(60);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        setVolumeLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopVoidScream();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Mic access denied.", err);
    }
  }

  function stopVoidScream(e) {
    if (e) e.preventDefault();
    if (!isRecording) return;
    setIsRecording(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (audioCtxRef.current && audioCtxRef.current.state === "running") {
      audioCtxRef.current.close().catch(() => {});
    }
    
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    setVolumeLevel(0);
  }

  async function handleSuggestIntention(e) {
    e.preventDefault();
    setIsSuggesting(true);
    try {
      const res = await callAI("Suggest a short, deep emotional intention for a cathartic scream into the void.", {
        schema: { properties: { intention: { type: "string" } } }
      });
      const data = JSON.parse(res);
      mergeSession({ intention: data.intention });
    } finally {
      setIsSuggesting(false);
    }
  }

  const c = {
    pageContainer: "relative w-full min-h-screen flex flex-col items-center py-12 px-8 z-10 font-[Space_Grotesk,sans-serif] bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    contentCol: "w-full max-w-[920px] flex flex-col gap-10",
    
    ambientBg: "fixed inset-0 pointer-events-none z-0",
    
    navCard: "w-full flex items-center justify-between p-4 rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] z-20",
    logoGroup: "flex items-center gap-2",
    logoBoxRow: "flex gap-1",
    logoBox: "w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    navBrand: "font-bold tracking-[-0.02em] text-xl uppercase",
    navChip: "px-3 py-1 text-[0.7rem] uppercase tracking-[0.08em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] font-bold",

    heroCard: "w-full flex flex-col items-center rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] p-10 overflow-hidden relative shadow-[8px_8px_0px_oklch(0.15_0.02_280)]",
    heroRibbon: "absolute top-0 left-0 w-full h-[6px] flex border-b-[3px] border-[oklch(0.15_0.02_280)]",
    heroRibbonSeg: "h-full flex-1 border-r-[3px] border-[oklch(0.15_0.02_280)] last:border-r-0",
    heroTitleWrap: "relative mb-6 mt-4",
    heroTitle: "text-4xl md:text-6xl font-[700] tracking-[-0.02em] uppercase relative z-10",
    heroSubtitle: "text-[0.8rem] uppercase tracking-widest max-w-md text-center mb-10 text-[oklch(0.50_0.02_280)]",
    
    visualizationArea: "w-full h-48 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] rounded-[4px] mb-8 flex items-center justify-center relative overflow-hidden shadow-[inset_4px_4px_0_oklch(0.15_0.02_280)]",
    visualizationCore: "w-24 h-24 rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all duration-75",
    
    primaryBtn: "px-8 py-4 font-[700] text-lg uppercase tracking-[0.05em] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-[oklch(1.00_0_0)] rounded-[4px] flex items-center gap-3 shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-transform duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer",
    
    statsGrid: "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "flex flex-col border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] overflow-hidden shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    statHeader: "px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] font-[700] border-b-[3px] border-[oklch(0.15_0.02_280)] text-center",
    statBody: "p-4 flex flex-col justify-center items-center gap-1 bg-[oklch(1.00_0_0)]",
    statValue: "text-3xl font-[700] font-[JetBrains_Mono,monospace] tracking-tighter text-[oklch(0.15_0.02_280)]",
    statLabel: "text-[0.65rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)] font-bold text-center",

    formGrid: "w-full grid grid-cols-1 md:grid-cols-2 gap-8",
    formCard: "border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] p-6 flex flex-col gap-4 shadow-[4px_4px_0px_oklch(0.15_0.02_280)] relative z-10",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-[700] text-[oklch(0.50_0.02_280)]",
    inputGroup: "flex gap-2",
    input: "flex-1 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 text-sm transition-all focus:translate-y-[-2px] focus:translate-x-[-2px] focus:shadow-[4px_4px_0_oklch(0.15_0.02_280)] outline-none font-[700]",
    ghostBtn: "px-4 py-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] text-xs font-[700] uppercase tracking-[0.05em] transition-transform duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer text-[oklch(0.15_0.02_280)] disabled:opacity-50",
    
    archiveCard: "w-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] overflow-hidden shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    archiveHeader: "px-6 py-4 border-b-[3px] border-[oklch(0.15_0.02_280)] flex items-center justify-between bg-[oklch(0.52_0.18_255)]",
    archiveTitle: "font-[700] uppercase tracking-[-0.02em] text-[oklch(1.00_0_0)]",
    table: "w-full text-left bg-[oklch(1.00_0_0)]",
    th: "px-6 py-2 text-[0.6rem] uppercase tracking-[0.15em] border-b-[2px] border-[oklch(0.15_0.02_280)] text-[oklch(0.50_0.02_280)] font-bold",
    td: "px-6 py-4 text-[0.82rem] border-b-[1px] border-[oklch(0.15_0.02_280)] transition-colors hover:bg-[oklch(0.85_0.18_85)]",
    badgeRow: "flex items-center gap-2",
    badge: "px-2 py-0.5 text-[0.6rem] uppercase font-bold border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[2px_2px_0px_oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]",
    audioPlayer: "h-8 w-full max-w-[200px] outline-none"
  };

  return (
    <div className={c.pageContainer}>
      <div className={c.ambientBg}>
        <div className="absolute inset-0 bg-[linear-gradient(oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        <div className="fixed top-12 left-10 w-16 h-16 rounded-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] opacity-20"></div>
        <div className="fixed bottom-20 right-14 w-20 h-20 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] rotate-[15deg] opacity-25"></div>
      </div>
      
      <main className={c.contentCol}>
        
        <nav className={c.navCard}>
          <div className={c.logoGroup}>
            <div className={c.logoBoxRow}>
              <div className={`${c.logoBox} bg-[oklch(0.55_0.24_28)]`}></div>
              <div className={`${c.logoBox} bg-[oklch(0.85_0.18_85)]`}></div>
              <div className={`${c.logoBox} bg-[oklch(0.62_0.19_145)]`}></div>
            </div>
            <span className={c.navBrand}>Void Control</span>
          </div>
          <div className={c.navChip}>v. 1.0.4</div>
        </nav>

        <section id="hero" className={c.heroCard}>
          <div className={c.heroRibbon}>
            <div className={`${c.heroRibbonSeg} bg-[oklch(0.55_0.24_28)]`}></div>
            <div className={`${c.heroRibbonSeg} bg-[oklch(0.85_0.18_85)]`}></div>
            <div className={`${c.heroRibbonSeg} bg-[oklch(0.62_0.19_145)]`}></div>
            <div className={`${c.heroRibbonSeg} bg-[oklch(0.52_0.18_255)]`}></div>
          </div>
          
          <div className={c.heroTitleWrap}>
            <h1 className={c.heroTitle}>Enter the Void</h1>
            <h1 aria-hidden="true" className="absolute top-[5px] left-[5px] text-4xl md:text-6xl font-[700] tracking-[-0.02em] uppercase z-0 text-[oklch(0.55_0.24_28)] opacity-50 select-none">
              Enter the Void
            </h1>
          </div>
          <p className={c.heroSubtitle}>Ensure acoustic isolation. The ritual accepts audio transmissions for a maximum of 60 seconds.</p>

          <div className={c.visualizationArea}>
            <div 
              className={c.visualizationCore} 
              style={{
                transform: `scale(${1 + (volumeLevel / 256) * 1.5})`,
                backgroundColor: isRecording ? "oklch(0.55 0.24 28)" : "oklch(1.00 0 0)",
                borderColor: isRecording ? "oklch(0.96 0.01 90)" : "oklch(0.15 0.02 280)",
              }}
            ></div>
          </div>

          <button 
            className={`${c.primaryBtn} ${isRecording ? 'bg-[oklch(0.62_0.19_145)]' : ''}`} 
            onClick={startVoidScream}
          >
            {isRecording ? `TRANSMITTING (${timeLeft}s) - STOP` : "Initiate Sequence"}
          </button>
        </section>

        <section id="stats" className={c.statsGrid}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.55_0.24_28)] text-[oklch(1.00_0_0)]`}>Status</div>
            <div className={c.statBody}>
              <span className={c.statValue}>READY</span>
              <span className={c.statLabel}>SYSTEM NOMINAL</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]`}>Global Output</div>
            <div className={c.statBody}>
              <span className={c.statValue}>{isRecording ? Math.floor(volumeLevel * 10) : 0}</span>
              <span className={c.statLabel}>Intensity Metric</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.52_0.18_255)] text-[oklch(1.00_0_0)]`}>Next Window</div>
            <div className={c.statBody}>
              <span className={c.statValue}>{isRecording ? timeLeft : "00"}</span>
              <span className={c.statLabel}>{isRecording ? "SECONDS REMAINING" : "BYPASS ACTIVE"}</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]`}>Local Vault</div>
            <div className={c.statBody}>
              <span className={c.statValue}>{archive.length}</span>
              <span className={c.statLabel}>Total Entries</span>
            </div>
          </div>
        </section>

        <section id="prep" className={c.formGrid}>
          <div className={c.formCard}>
            <h2 className={c.label}>Target Intention</h2>
            <div className={c.inputGroup}>
              <input 
                type="text" 
                className={c.input} 
                placeholder="Focus of the scream..." 
                value={sessionDoc.intention}
                onChange={(e) => mergeSession({ intention: e.target.value })}
              />
              <button 
                className={c.ghostBtn} 
                onClick={handleSuggestIntention}
                disabled={isSuggesting}
              >
                {isSuggesting ? (
                  <svg className="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" strokeDasharray="16 16" strokeLinecap="round"/>
                  </svg>
                ) : "Suggest"}
              </button>
            </div>
          </div>
          <div className={c.formCard}>
             <h2 className={c.label}>Telemetry Status</h2>
             <div className="flex gap-4 items-center">
                <div className="w-12 h-6 border-[3px] rounded-[4px] relative bg-gray-200">
                   <div className="absolute top-1 left-1 w-3 h-3 border-[2px] rounded-[2px] bg-black"></div>
                </div>
                <span className="text-xs uppercase font-bold tracking-wider">Save Telemetry</span>
             </div>
          </div>
        </section>

        <section id="archive" className={c.archiveCard}>
          <div className={c.archiveHeader}>
            <h2 className={c.archiveTitle}>Past Transmissions</h2>
          </div>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Date</th>
                <th className={c.th}>Intention</th>
                <th className={c.th}>Playback</th>
                <th className={c.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {archive.length === 0 ? (
                <tr>
                  <td colSpan="4" className={`${c.td} text-center font-bold tracking-widest text-[oklch(0.50_0.02_280)]`}>
                    THE VAULT IS EMPTY
                  </td>
                </tr>
              ) : archive.map(doc => (
                <tr key={doc._id}>
                  <td className={c.td}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className={`${c.td} font-[700]`}>{doc.intention || "UNTARGETED"}</td>
                  <td className={c.td}>
                    {doc._files?.audio?.url ? (
                      <audio controls className={c.audioPlayer} src={doc._files.audio.url} />
                    ) : (
                      <span className="text-[0.6rem] font-bold">N/A</span>
                    )}
                  </td>
                  <td className={c.td}>
                    <div className={c.badgeRow}>
                      <span className={c.badge}>Archived</span>
                      <button 
                        className={`text-[0.6rem] uppercase tracking-wider font-bold border-b-[2px] border-[oklch(0.15_0.02_280)] hover:text-[oklch(0.55_0.24_28)] hover:border-[oklch(0.55_0.24_28)] transition-colors`}
                        onClick={() => database.del(doc._id)}
                      >
                        Purge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        
      </main>
    </div>
  );
}