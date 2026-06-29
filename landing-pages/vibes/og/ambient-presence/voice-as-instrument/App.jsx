import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useState, useEffect, useRef, useMemo } from "react"
import { useFireproof } from "use-fireproof"

const FREQS = { C: 130.81, D: 146.83, E: 164.81, G: 196.00, A: 220.00 };
const PRESETS = [
  { value: "C", label: "Note C3 (Root)" },
  { value: "D", label: "Note D3 (Second)" },
  { value: "E", label: "Note E3 (Third)" },
  { value: "G", label: "Note G3 (Fifth)" },
  { value: "A", label: "Note A3 (Sixth)" }
];

export default function App() {
  const { database, useLiveQuery } = useFireproof("aether-resonance");
  
  const [myFreq, setMyFreq] = useState("C");
  const [micActive, setMicActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loadingOmen, setLoadingOmen] = useState(false);

  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const { docs: presences } = useLiveQuery("type", { key: "presence" });
  const { docs: tapes } = useLiveQuery("type", { key: "tape", descending: true });

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const myOscRef = useRef(null);
  const analyzerRef = useRef(null);
  const streamRef = useRef(null);
  const voicesRef = useRef({}); // track other users' oscillators
  const micIntervalRef = useRef(null);

  const c = {
    page: "min-h-screen p-4 md:p-8 flex flex-col items-center font-['Special_Elite'] text-[#3e2723]",
    container: "w-full max-w-5xl flex flex-col gap-8 relative z-10",
    header: "w-full text-center p-8 bg-[#c4a482] border-[3px] border-[#745428] outline outline-1 outline-offset-[-6px] outline-[#745428] shadow-[4px_4px_0px_#745428]",
    title: "font-['Cinzel_Decorative'] text-4xl md:text-5xl font-bold text-[#745428] tracking-[0.08em] uppercase",
    subtitle: "text-[#3e2723] font-['Homemade_Apple'] text-xl mt-4 opacity-90",
    mainGrid: "w-full grid grid-cols-1 md:grid-cols-2 gap-8",
    card: "p-6 md:p-8 bg-[#c4a482] border-2 border-[#745428] outline outline-1 outline-offset-[-4px] outline-[#745428] flex flex-col gap-5 shadow-[6px_6px_0px_#745428] relative",
    cardTitle: "font-['Cinzel_Decorative'] text-2xl font-bold text-[#745428] border-b-2 border-dashed border-[#745428] pb-3 mb-2 tracking-widest uppercase",
    ctrlRow: "flex flex-wrap items-center gap-4",
    label: "font-bold text-[#3e2723] uppercase text-sm tracking-wider min-w-[100px]",
    select: "p-2 bg-transparent border-b-2 border-[#3e2723] text-[#3e2723] outline-none focus:bg-[#dcbfa6] transition-colors rounded-none appearance-none cursor-pointer",
    btnPrimary: "px-6 py-3 border-2 border-[#745428] font-bold text-[#3e2723] cursor-pointer hover:bg-[#745428] hover:text-[#dcbfa6] transition-all rounded-none uppercase tracking-widest shadow-[3px_3px_0px_#3e2723] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    btnSecondary: "px-4 py-2 border border-[#745428] font-bold text-[#745428] cursor-pointer hover:bg-[#cfa562] hover:text-[#3e2723] transition-colors rounded-none text-sm uppercase",
    btnGhost: "px-3 py-1 border border-transparent underline cursor-pointer text-[#745428] hover:text-[#ffaa00] transition-colors font-['Homemade_Apple'] text-lg",
    visualizer: "w-full aspect-square bg-[#3e2723] border-[3px] border-[#cfa562] outline outline-1 outline-offset-[-6px] outline-[#cfa562] relative flex items-center justify-center overflow-hidden shadow-[inset_0px_0px_20px_black]",
    nodeGroup: "absolute w-full h-full",
    node: "absolute w-4 h-4 rounded-full border transform -translate-x-1/2 -translate-y-1/2",
    logList: "flex flex-col gap-4",
    logItem: "p-4 bg-[#dcbfa6] border border-[#745428] flex flex-col gap-2 shadow-[2px_2px_0px_#3e2723]",
    logHeader: "flex justify-between items-start mb-2 border-b border-[#745428]/30 pb-2 flex-wrap gap-2",
    audioPlayer: "w-full mt-2 h-[30px] rounded-none filter sepia contrast-125"
  };

  async function handleMicToggle(e) {
    e.preventDefault();
    if (micActive) {
      clearInterval(micIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (myOscRef.current) { myOscRef.current.stop(); myOscRef.current.disconnect(); }
      if (audioCtxRef.current) await audioCtxRef.current.close();
      database.del(`presence:${sessionId}`);
      setMicActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = 0.5;
      masterGainRef.current.connect(ctx.destination);

      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      setMicActive(true);

      const pcmData = new Uint8Array(analyzer.frequencyBinCount);
      micIntervalRef.current = setInterval(() => {
        analyzer.getByteTimeDomainData(pcmData);
        let sumSquares = 0;
        for (const amp of pcmData) {
          const norm = (amp / 128.0) - 1.0;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / pcmData.length);
        const level = Math.min(1.0, rms * 5.0); // signal boost multiplier
        
        database.put({
          _id: `presence:${sessionId}`,
          type: "presence",
          session: sessionId,
          freq: myFreq,
          level: level > 0.05 ? level : 0, // noise gate
          updatedAt: Date.now()
        });
      }, 200);

    } catch (err) {
      console.error("Mic error:", err);
    }
  }

  useEffect(() => {
    if (!audioCtxRef.current || !micActive) return;
    const ctx = audioCtxRef.current;
    
    // Create oscillators for OTHERS who are actively humming
    const activeSessions = new Set();

    presences.forEach(p => {
      if (p.session === sessionId) return; // Skip self in synthesis!
      if (Date.now() - p.updatedAt > 5000) return; // Discard stale connections
      if (p.level <= 0.01) return; // Skip silent participants

      activeSessions.add(p.session);
      let voice = voicesRef.current[p.session];
      if (!voice) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = FREQS[p.freq] || FREQS.C;
        gain.gain.value = 0;
        
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 800; // Warm ambient roll-off

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainRef.current);
        osc.start();
        
        voice = { osc, gain, filter };
        voicesRef.current[p.session] = voice;
      }

      voice.osc.frequency.setTargetAtTime(FREQS[p.freq] || FREQS.C, ctx.currentTime, 0.1);
      voice.gain.gain.setTargetAtTime(p.level * 0.3, ctx.currentTime, 0.1);
    });

    Object.keys(voicesRef.current).forEach(sid => {
      if (!activeSessions.has(sid)) {
        const voice = voicesRef.current[sid];
        voice.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => {
          try { voice.osc.stop(); voice.osc.disconnect(); voice.gain.disconnect(); } catch(e){}
          delete voicesRef.current[sid];
        }, 300);
      }
    });

  }, [presences, micActive]);

  useEffect(() => {
    // Keep internal presence state synced immediately if user changes pitch
    if (micActive) {
      database.put({
        _id: `presence:${sessionId}`,
        type: "presence",
        session: sessionId,
        freq: myFreq,
        level: 0,
        updatedAt: Date.now()
      });
    }
  }, [myFreq]);

  // Clean up device hardware on unmount
  useEffect(() => {
    return () => {
      clearInterval(micIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      database.del(`presence:${sessionId}`);
    };
  }, []);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function handleRecord(e) {
    e.preventDefault();
    if (!micActive || !audioCtxRef.current) {
      alert("Must connect microphone to hear and engrave the room.");
      return;
    }
    
    setIsRecording(true);
    chunksRef.current = [];
    
    const ctx = audioCtxRef.current;
    const dest = ctx.createMediaStreamDestination();
    masterGainRef.current.connect(dest); // Capture the master mix
    
    // Pipe the user's active mic directly into the mix destination
    const userMicGain = ctx.createGain();
    userMicGain.gain.value = 0.5;
    const source = ctx.createMediaStreamSource(streamRef.current);
    source.connect(userMicGain);
    userMicGain.connect(dest);

    const recorder = new MediaRecorder(dest.stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      userMicGain.disconnect();
      
      const file = new File([blob], `segment-${Date.now()}.webm`, { type: "audio/webm" });
      await database.put({
        type: "tape",
        createdAt: Date.now(),
        omen: "Awaiting interpretation...",
        _files: { audio: file }
      });
      setIsRecording(false);
    };

    recorder.start();
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }, 30000); // Wait 30 seconds before halting
  }

  async function handleAiName(tapeDoc) {
    if (loadingOmen === tapeDoc._id) return;
    setLoadingOmen(tapeDoc._id);
    try {
      const prompt = "Generate a short, cryptic, poetic title for an ambient audio drone recording made across a dusty, magical aetheric radio network. Just 4 to 8 words. E.g. 'Whispers of the ancient dial' or 'Static sea over a rusted hull'.";
      const res = await callAI(prompt, {
        schema: {
          properties: {
            omen: { type: "string" }
          }
        }
      });
      const data = JSON.parse(res);
      await database.put({ ...tapeDoc, omen: data.omen });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOmen(false);
    }
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Homemade+Apple&family=Special+Elite&display=optional');
        body { 
          background-color: #dcbfa6;
          background-image: repeating-linear-gradient(45deg, rgba(62,39,35,0.02) 0px, rgba(62,39,35,0.02) 1px, transparent 1px, transparent 4px);
        }
      `}</style>
      <main className={c.container}>
        <header className={c.header}>
          <h1 className={c.title}>Aether Resonance</h1>
          <p className={c.subtitle}>A Shared Ambient Instrument</p>
        </header>

        <div className={c.mainGrid}>
          <section id="controls" className={c.card}>
            <h2 className={c.cardTitle}>Station Controls</h2>
            
            <div className={c.ctrlRow}>
              <span className={c.label}>Frequency:</span>
              <select 
                className={c.select} 
                value={myFreq} 
                onChange={e => setMyFreq(e.target.value)}
                disabled={isRecording}
              >
                {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className={c.ctrlRow}>
              <button className={c.btnPrimary} onClick={handleMicToggle}>
                {micActive ? "Disconnect Station" : "Connect Microphone"}
              </button>
            </div>

            <p className="text-sm">Hum into your microphone to cast your frequency into the ether.</p>

            <div className={`mt-auto pt-4 border-t ${c.ctrlRow}`}>
              <button 
                className={`${c.btnPrimary} flex items-center gap-2`} 
                onClick={handleRecord} 
                disabled={isRecording || !micActive}
              >
                {isRecording ? (
                  <>
                    <svg className="w-5 h-5 animate-spin text-[#3e2723]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/>
                    </svg>
                    Engraving (30s)...
                  </>
                ) : "Engrave to Tape (30s)"}
              </button>
            </div>
          </section>

          <section id="visualizer" className={c.card}>
            <h2 className={c.cardTitle}>Etheric Presence</h2>
            <div className={c.visualizer}>
              <div className="absolute top-4 left-4 text-xs text-[#cfa562]">
                {micActive ? "Broadcasting into the void..." : "Device Dormant"}
              </div>
              
              <div className={`w-[80%] h-[80%] border border-[#745428]/50 rounded-full relative flex items-center justify-center ${isRecording ? 'animate-pulse bg-[#745428]/20' : ''}`}>
                {/* Center point - Us */}
                <div 
                  className={`w-6 h-6 rounded-full border-2 border-[#ffaa00] bg-[#cfa562] absolute transition-all duration-200 z-10 ${micActive ? 'shadow-[0_0_20px_#ffaa00]' : 'opacity-30'}`} 
                />
                <div className="mt-12 text-[#ffaa00] text-xs font-bold">{myFreq}</div>

                {/* Orbiter points - Others */}
                {presences.map((p, i) => {
                  if (p.session === sessionId) return null;
                  if (Date.now() - p.updatedAt > 5000) return null;

                  // Distribute in a circle
                  const angle = (i / Math.max(1, presences.length - 1)) * Math.PI * 2;
                  const radius = 40; // percentage
                  const x = 50 + radius * Math.cos(angle);
                  const y = 50 + radius * Math.sin(angle);
                  const size = 10 + (p.level * 20); // pulse size based on level
                  const active = p.level > 0.01;

                  return (
                    <div 
                      key={p.session}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 flex flex-col items-center"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div 
                        className="rounded-full border border-[#cfa562] transition-colors"
                        style={{
                          width: `${size}px`, 
                          height: `${size}px`,
                          boxShadow: active ? '0 0 15px #cfa562' : 'none',
                          backgroundColor: active ? '#cfa562' : 'transparent'
                        }}
                      />
                      <span className="text-[10px] text-[#cfa562] mt-1">{p.freq}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <section id="logbook" className={c.card}>
          <h2 className={c.cardTitle}>Tape Logbook</h2>
          {tapes.length === 0 ? (
            <p className="text-sm italic opacity-70">The tape vault is empty. Silence reigns.</p>
          ) : (
            <div className={c.logList}>
              {tapes.map(tape => (
                <div key={tape._id} className={c.logItem}>
                  <div className={c.logHeader}>
                    <span className="font-bold">Segment #{tape._id.slice(-4)}</span>
                    <span className="text-xs">{new Date(tape.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm italic text-[#745428]">"{tape.omen}"</p>
                    <button 
                      className={`${c.btnGhost} flex items-center gap-2`} 
                      onClick={() => handleAiName(tape)}
                      disabled={loadingOmen === tape._id}
                    >
                      {loadingOmen === tape._id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-[#745428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/>
                          </svg>
                          Consulting...
                        </>
                      ) : "Augur"}
                    </button>
                  </div>
                  {tape._files?.audio?.url && (
                    <audio src={tape._files.audio.url} controls className={c.audioPlayer} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}