import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"
import { useState, useEffect, useRef, useMemo } from "react"

const NOTES = { 'C4': 261.63, 'E4': 329.63, 'G4': 392.00, 'A4': 440.00, 'C5': 523.25 };

function autoCorrelate(buf, sampleRate) {
  let size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / size) < 0.01) return -1;
  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }
  buf = buf.slice(r1, r2);
  size = buf.length;
  let c = new Array(size).fill(0);
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let t0 = maxpos;
  return sampleRate / t0;
}

export default function App() {
  const [activeNote, setActiveNote] = useState('C4');
  const [isMicActive, setIsMicActive] = useState(false);
  const [myCents, setMyCents] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  
  const { database, useLiveQuery } = useFireproof("hum-tuner");
  
  const myId = useMemo(() => "user-" + Math.random().toString(36).slice(2,7), []);
  const { docs: activeUsers } = useLiveQuery("type", { key: 'presence' });
  const { docs: lockLogs } = useLiveQuery("type", { key: 'lockLog', descending: true });

  const lockStartRef = useRef(0);
  const [lockedOverlay, setLockedOverlay] = useState(false);

  useEffect(() => {
    if (!isMicActive || activeUsers.length < 1) {
      lockStartRef.current = 0;
      return;
    }
    
    const allInTune = activeUsers.every(u => Math.abs(u.cents) <= 20);
    
    if (allInTune) {
      if (lockStartRef.current === 0) {
        lockStartRef.current = Date.now();
      } else if (Date.now() - lockStartRef.current > 1500 && !lockedOverlay) {
        setLockedOverlay(true);
        const notes = activeUsers.map(u => u.note);
        database.put({
          type: 'lockLog',
          notes,
          timestamp: Date.now(),
          duration: 'held 1.5s',
          participants: activeUsers.length
        });
        setTimeout(() => setLockedOverlay(false), 3000);
        lockStartRef.current = Date.now() + 5000;
      }
    } else {
      lockStartRef.current = 0;
    }
  }, [activeUsers, isMicActive, lockedOverlay, database]);

  useEffect(() => {
    let lastWrite = Date.now();
    const tick = () => {
      if (!analyserRef.current) return;
      const buf = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(buf);
      const ac = autoCorrelate(buf, audioCtxRef.current.sampleRate);
      
      let currentCents = 1000; // default far off
      if (ac !== -1) {
        const targetHz = NOTES[activeNote];
        currentCents = Math.floor(1200 * Math.log2(ac / targetHz));
        if (currentCents > 100) currentCents = 100;
        if (currentCents < -100) currentCents = -100;
      }
      
      setMyCents(currentCents);
      
      if (Date.now() - lastWrite > 250) {
        lastWrite = Date.now();
        database.put({ _id: myId, type: 'presence', note: activeNote, cents: currentCents, updatedAt: Date.now() });
      }
      
      rafRef.current = requestAnimationFrame(tick);
    };
    if (isMicActive) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [isMicActive, activeNote, myId, database]);

  useEffect(() => {
    return () => {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(()=>{});
    };
  }, []);

  const toggleMic = async () => {
    if (isMicActive) {
      setIsMicActive(false);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      database.del(myId).catch(()=>{});
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Actx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Actx();
      micStreamRef.current = stream;
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      await audioCtxRef.current.resume();
      setIsMicActive(true);
      await database.put({ _id: myId, type: 'presence', note: activeNote, cents: 1000, updatedAt: Date.now() });
    } catch (e) {
      console.error(e);
      alert('Mic access denied. Please click allow and ensure you aren\'t in another call.');
    }
  };

  const spawnFakeSinger = () => {
    const fakeId = "fake-" + Math.random().toString(36).slice(2,7);
    const notesArray = Object.keys(NOTES);
    const fakeNote = notesArray[Math.floor(Math.random() * notesArray.length)];
    let simulatedCents = 100; 
    
    const jitter = async () => {
      if (Math.abs(simulatedCents) > 15) simulatedCents -= Math.sign(simulatedCents) * (5 + Math.random()*5);
      else simulatedCents += (Math.random() * 8 - 4); 
      
      try {
        await database.put({ _id: fakeId, type: 'presence', note: fakeNote, cents: simulatedCents, updatedAt: Date.now(), isFake: true });
        if (Math.random() > 0.02) setTimeout(jitter, 300); 
        else await database.del(fakeId);
      } catch (err) {}
    };
    jitter();
  };

  const c = {
    fontLoader: "hidden",
    page: "min-h-screen p-4 flex flex-col items-center overflow-x-hidden bg-[oklch(0.93_0.03_130)] text-[oklch(0.12_0.01_0)] font-sans",
    header: "w-full max-w-2xl mb-6 flex flex-col items-center mt-8",
    title: "text-6xl text-center font-bold tracking-tight mb-2",
    subtitle: "text-sm text-[oklch(0.45_0.01_0)] text-center uppercase tracking-widest font-semibold font-sans",
    setupArea: "w-full max-w-2xl flex flex-col gap-4 justify-center items-center mb-8",
    controlsRow: "flex flex-wrap gap-4 justify-center",
    noteBtn: "px-5 py-2 font-bold text-lg font-sans cursor-pointer border-2 border-[oklch(0.12_0.01_0)] border-dashed bg-transparent transition-all active:scale-95 hover:rotate-2 hover:bg-[oklch(0.97_0.01_80)]",
    toggleBtn: "px-8 py-3 mt-4 text-lg font-bold font-sans border-2 border-[oklch(0.12_0.01_0)] bg-[oklch(0.12_0.01_0)] text-[oklch(0.97_0.01_80)] transition-all hover:-rotate-1 hover:scale-105 active:scale-95",
    room: "w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 px-4",
    tile: "relative p-6 flex flex-col items-center shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-[oklch(0.12_0.01_0)]",
    tileYellow: "bg-[oklch(0.93_0.12_95)] -rotate-1",
    tilePink: "bg-[oklch(0.90_0.06_10)] rotate-2",
    tileBlue: "bg-[oklch(0.90_0.05_240)] -rotate-2",
    tileTape: "absolute w-14 h-4 bg-[oklch(0.85_0.03_90)] opacity-80 backdrop-blur-sm shadow-sm z-10",
    tileTapeTopLeft: "-top-2 -left-3 -rotate-45",
    tileTapeTopRight: "-top-2 -right-3 rotate-45",
    tileHeader: "w-full flex justify-between items-center mb-4",
    tileName: "text-sm font-bold uppercase",
    tileTarget: "text-3xl font-bold",
    meter: "w-full h-6 relative border-2 border-[oklch(0.12_0.01_0)] border-dashed mt-4 bg-[oklch(0.97_0.01_80)]",
    meterCenterLine: "absolute top-0 bottom-0 left-1/2 w-[2px] bg-[oklch(0.12_0.01_0)] z-10",
    meterZone: "absolute top-0 bottom-0 left-[30%] right-[30%] bg-[oklch(0.90_0.06_10)] opacity-30",
    meterNeedle: "absolute top-[-6px] bottom-[-6px] w-[4px] bg-[oklch(0.12_0.01_0)] transition-transform duration-100 ease-linear shadow-sm z-20",
    centsLabel: "text-xs mt-2 font-mono flex gap-2 items-center",
    lockedOverlay: "fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center pointer-events-none transition-opacity duration-300 bg-[oklch(0.93_0.03_130_/_0.8)] backdrop-blur-sm",
    lockedOverlayHidden: "opacity-0",
    lockedOverlayVisible: "opacity-100",
    lockedText: "text-6xl md:text-8xl font-bold border-8 border-[oklch(0.55_0.24_28)] text-[oklch(0.55_0.24_28)] p-8 -rotate-6 shadow-2xl bg-[oklch(0.97_0.01_80)] uppercase tracking-tighter",
    logArea: "w-full max-w-2xl flex flex-col gap-4 relative",
    logHeader: "text-4xl mb-4 font-bold text-center",
    logItem: "p-4 flex justify-between items-center shadow-[0_3px_8px_rgba(0,0,0,0.08)] border border-[oklch(0.12_0.01_0)] relative bg-[oklch(0.97_0.01_80)] odd:rotate-1 even:-rotate-1 mb-2",
    logTime: "text-xs uppercase font-sans text-[oklch(0.45_0.01_0)] font-semibold",
    logNotes: "text-xl font-bold flex gap-3 font-sans",
    logDuration: "text-sm font-sans italic",
    addFakeBtn: "mt-16 px-4 py-2 border border-[oklch(0.12_0.01_0)] border-dashed text-xs uppercase cursor-pointer font-sans bg-transparent hover:bg-[oklch(0.97_0.01_80)] mb-12"
  };

  return (
    <div className={c.page} style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className={c.fontLoader}>
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;600;700&display=swap');
        `}} />
      </div>

      <header className={c.header}>
        <h1 className={c.title} style={{ fontFamily: "'Caveat', cursive" }}>Group Hum Tuner</h1>
        <p className={c.subtitle}>Match the pitch. Lock the chord.</p>
      </header>

      <section className={c.setupArea} id="setup">
        <div className={c.controlsRow}>
          {Object.keys(NOTES).map(note => (
            <button 
              key={note}
              className={`${c.noteBtn} ${activeNote === note ? 'bg-[oklch(0.90_0.06_10)] border-solid scale-105 rotate-1 shadow-sm' : ''}`} 
              onClick={() => {
                setActiveNote(note);
                if (isMicActive) database.put({ _id: myId, type: 'presence', note, cents: myCents, updatedAt: Date.now() });
              }}
            >
              {note}
            </button>
          ))}
        </div>
        <button className={c.toggleBtn} onClick={toggleMic}>
          {isMicActive ? "Stop Pitch Detection" : "Start Pitch Detection"}
        </button>
      </section>

      <section className={c.room} id="room">
        {activeUsers.length === 0 && !isMicActive && (
          <div className="w-full text-center col-span-full opacity-50 font-sans italic my-12 tracking-wide font-medium text-sm">
            Waiting for singers. Pick a note, click start, and begin humming...
          </div>
        )}
        
        {activeUsers.map((u, i) => {
          const isMe = u._id === myId;
          const userCents = u.cents || 0;
          const bgClass = [c.tileYellow, c.tilePink, c.tileBlue][i % 3];
          const tapeClass = i % 2 === 0 ? c.tileTapeTopLeft : c.tileTapeTopRight;
          
          let needlePct = ((userCents + 100) / 200) * 100;
          if (needlePct < 0) needlePct = 0; if (needlePct > 100) needlePct = 100;
          
          return (
            <div key={u._id} className={`${c.tile} ${bgClass}`}>
              <div className={`${c.tileTape} ${tapeClass}`}></div>
              <div className={c.tileHeader}>
                <span className={c.tileName}>{isMe ? "Me" : (u.isFake ? "Guest (Bot)" : "Guest")}</span>
              </div>
              <div className={c.tileTarget}>{u.note}</div>
              <div className={c.meter}>
                <div className={c.meterZone}></div>
                <div className={c.meterCenterLine}></div>
                <div className={c.meterNeedle} style={{ left: `${needlePct}%` }}></div>
              </div>
              <div className={c.centsLabel}>
                <span>{userCents > 0 ? '+' : ''}{Math.round(userCents)}¢</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className={c.logArea} id="logs">
        <h2 className={c.logHeader} style={{ fontFamily: "'Caveat', cursive" }}>Room History</h2>
        {lockLogs.length === 0 && (
          <div className="w-full text-center opacity-50 font-sans italic my-8">No locked chords yet. Try matching pitches!</div>
        )}
        {lockLogs.map(log => {
          const t = new Date(log.timestamp);
          const timeStr = t.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
          return (
            <div key={log._id} className={c.logItem}>
              <div className={c.logTime}>{timeStr}</div>
              <div className={c.logNotes}>
                {(log.notes || []).map((n, i) => <span key={i}>{n}</span>)}
              </div>
              <div className={c.logDuration}>{log.duration} • {log.participants} voices</div>
            </div>
          );
        })}
      </section>
      
      <button className={c.addFakeBtn} onClick={spawnFakeSinger}>Spawn Fake Singer</button>

      <div className={`${c.lockedOverlay} ${lockedOverlay ? c.lockedOverlayVisible : c.lockedOverlayHidden}`}>
        <div className={c.lockedText}>CHORD LOCKED</div>
      </div>
    </div>
  )
}