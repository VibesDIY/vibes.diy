import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

import { useState, useRef, useEffect } from "react"

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("crayon-room");
  const { docs: snaps } = useLiveQuery("type", { key: "snap", descending: true });
  const [density, setDensity] = useState("Medium");
  const [camActive, setCamActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const densityRef = useRef(density);

  useEffect(() => { densityRef.current = density; }, [density]);

  const applyCrayonEffect = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      const d = densityRef.current;
      const step = d === "Wax Chunk" ? 4 : d === "Medium" ? 2 : 1;
      
      for(let y=0; y<canvas.height; y+=step) {
        for(let x=0; x<canvas.width; x+=step) {
          const i = (y * canvas.width + x) * 4;
          const noise = (Math.random() - 0.5) * 80;
          
          let r = data[i] + noise;
          let g = data[i+1] + noise;
          let b = data[i+2] + noise;
          
          if (x < canvas.width - step && y < canvas.height - step) {
            const rx = (y * canvas.width + (x + step)) * 4;
            const dy = ((y + step) * canvas.width + x) * 4;
            const edge = Math.abs(data[i] - data[rx]) + Math.abs(data[i] - data[dy]);
            if (edge > 60) {
              r -= 100; g -= 100; b -= 100;
            }
          }
          
          for(let dy=0; dy<step; dy++) {
            for(let dx=0; dx<step; dx++) {
              if (y+dy < canvas.height && x+dx < canvas.width) {
                 const i2 = ((y+dy) * canvas.width + (x+dx)) * 4;
                 data[i2] = r; data[i2+1] = g; data[i2+2] = b;
              }
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    requestAnimationFrame(applyCrayonEffect);
  };

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCamActive(true);
          requestAnimationFrame(applyCrayonEffect);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    if (!canvasRef.current || isCapturing) return;
    setIsCapturing(true);
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) { setIsCapturing(false); return; }
      const file = new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" });
      await database.put({
        type: "snap",
        density: densityRef.current,
        timestamp: Date.now(),
        _files: { image: file }
      });
      setIsCapturing(false);
    }, "image/jpeg", 0.8);
  };

  const c = {
    page: "min-h-screen relative overflow-hidden font-sans p-4 md:p-12 pb-32 flex flex-col items-center",
    styleBlock: "",
    ambientBase: "absolute inset-0 pointer-events-none z-0",
    appWrapper: "w-full max-w-[920px] relative z-10 flex flex-col gap-10",
    
    // Nav
    nav: "w-full flex justify-between items-center p-3 border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)] rounded-[4px] flex-col sm:flex-row gap-4",
    navLeft: "flex items-center gap-3",
    navLogoGroup: "flex items-center gap-1",
    logoBox1: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--red)]",
    logoBox2: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--yellow)]",
    logoBox3: "w-3 h-3 border-[2px] border-[var(--border)] bg-[var(--green)]",
    navTitle: "text-lg font-bold uppercase tracking-tight ml-2 text-[var(--text)]",
    navRight: "flex gap-2",
    navPill: "px-4 py-2 text-[0.75rem] font-bold uppercase tracking-widest border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[3px_3px_0_var(--border)] rounded-[4px] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--border)] transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",

    // Hero
    hero: "w-full p-8 md:p-16 border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[8px_8px_0_var(--border)] rounded-[4px] relative flex flex-col items-center justify-center overflow-hidden text-center",
    heroBar: "absolute top-[0] left-[0] right-[0] h-[6px] flex border-b-[3px] border-[var(--border)]",
    heroSplit: "flex-1 h-full first:bg-[var(--red)] [&:nth-child(2)]:bg-[var(--yellow)] [&:nth-child(3)]:bg-[var(--green)] last:bg-[var(--blue)] border-r-[3px] border-[var(--border)] last:border-r-0",
    heroTitleWrap: "relative mt-4",
    heroTitle: "text-5xl md:text-7xl font-bold uppercase tracking-tight relative z-10 text-[var(--text)]",
    heroTitleShadow: "text-5xl md:text-7xl font-bold uppercase tracking-tight absolute top-[5px] left-[5px] z-0 opacity-50 select-none text-[var(--red)]",

    // Main Workspace
    workspace: "w-full grid grid-cols-1 md:grid-cols-2 gap-8",
    videoCard: "col-span-1 border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)] rounded-[4px] flex flex-col overflow-hidden",
    cardHeader: "p-2 border-b-[3px] border-[var(--border)] flex justify-between items-center bg-[var(--yellow)]",
    cardBadge: "text-[0.65rem] font-bold uppercase tracking-widest px-2 py-1 border-[2px] border-[var(--border)] rounded-[4px] bg-[var(--green)] text-[var(--text)] shadow-[2px_2px_0_var(--border)]",
    cardTitle: "text-[0.7rem] font-bold uppercase tracking-widest text-[var(--text)]",
    canvasWrapper: "w-full aspect-video bg-[var(--bg)] relative border-b-[3px] border-[var(--border)] overflow-hidden",
    hiddenVideo: "absolute opacity-0 w-px h-px pointer-events-none",
    canvas: "absolute inset-0 w-full h-full object-cover",
    controls: "p-4 flex flex-col gap-4",
    segmentedControl: "flex border-[3px] border-[var(--border)] rounded-[4px] overflow-hidden w-full relative",
    segment: "flex-1 py-2 text-[0.75rem] font-bold uppercase border-r-[3px] border-[var(--border)] last:border-r-0 text-center cursor-pointer transition-colors duration-150 z-10",
    segmentActive: "bg-[var(--yellow)] text-[var(--text)] shadow-[inset_3px_3px_0_rgba(0,0,0,0.1)]",
    segmentIdle: "bg-[var(--card-bg)] text-[var(--text)] hover:bg-[var(--bg)]",
    
    // Buttons
    btnPrimary: "w-full py-4 text-[0.8rem] text-white font-bold uppercase tracking-widest border-[3px] border-[var(--border)] bg-[var(--red)] rounded-[4px] flex items-center justify-center gap-2 shadow-[4px_4px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed",
    btnStart: "py-3 px-6 text-[0.8rem] text-white font-bold uppercase tracking-widest border-[3px] border-[var(--border)] bg-[var(--blue)] rounded-[4px] flex items-center gap-2 mx-auto mt-4 shadow-[4px_4px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer",

    // Gallery
    galleryHeader: "text-2xl font-bold uppercase border-b-[3px] border-[var(--border)] pb-2 mb-6 mt-8 text-[var(--text)]",
    galleryLayout: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full",
    snapCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)] rounded-[4px] flex flex-col hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_var(--border)] transition-all duration-150",
    snapImg: "w-full aspect-video object-cover border-b-[3px] border-[var(--border)] bg-[var(--bg)]",
    snapMeta: "p-3 flex justify-between items-center",
    snapTime: "font-mono text-[0.75rem] font-bold text-[var(--text)]",
    snapTag: "text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--blue)] text-white",
    
    emptyState: "col-span-full py-12 text-center border-[3px] border-dashed border-[var(--muted)] rounded-[4px] bg-[var(--card-bg)] flex flex-col items-center justify-center gap-4"
  };

  return (
    <div className={c.page}>
      {/* Design System Injection */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');

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
            
            font-family: 'Space Grotesk', sans-serif;
            color: var(--text);
            background-color: var(--bg);
          }

          .font-mono { font-family: 'JetBrains Mono', monospace; }

          body {
            background-image: 
              linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
            background-size: 60px 60px;
          }

          /* Floating Geometries */
          .drift-1 { animation: drift 8s ease-in-out infinite alternate; }
          .drift-2 { animation: drift 11s ease-in-out infinite alternate-reverse; }
          .drift-3 { animation: driftSpin 15s linear infinite; }
          
          @keyframes drift {
            0% { transform: translateY(0) translateX(0); }
            100% { transform: translateY(-20px) translateX(15px); }
          }
          @keyframes driftSpin {
            0% { transform: rotate(0deg) translate(20px) rotate(0deg); }
            100% { transform: rotate(360deg) translate(20px) rotate(-360deg); }
          }
        `}
      </style>

      {/* Ambient Deco */}
      <div className={c.ambientBase}>
        <div className="drift-1 absolute top-20 left-[10%] w-12 h-12 bg-[var(--red)] border-[3px] border-[var(--border)] rounded-full opacity-20" />
        <div className="drift-2 absolute bottom-40 right-[15%] w-16 h-16 bg-[var(--blue)] border-[3px] border-[var(--border)] opacity-20" />
        <div className="drift-3 absolute top-1/3 right-[5%] w-8 h-8 bg-[var(--yellow)] border-[3px] border-[var(--border)] rotate-45 opacity-30" />
      </div>

      <div className={c.appWrapper}>
        <header className={c.nav}>
          <div className={c.navLeft}>
            <div className={c.navLogoGroup}>
              <div className={c.logoBox1} />
              <div className={c.logoBox2} />
              <div className={c.logoBox3} />
            </div>
            <h1 className={c.navTitle}>CrayonCast</h1>
          </div>
          <div className={c.navRight}>
            <button className={c.navPill}>Local User</button>
            <button className={c.navPill}>Live</button>
          </div>
        </header>

        <section className={c.hero}>
          <div className={c.heroBar}>
            <div className={c.heroSplit} />
            <div className={c.heroSplit} />
            <div className={c.heroSplit} />
            <div className={c.heroSplit} />
          </div>
          <div className={c.heroTitleWrap}>
            <div className={c.heroTitleShadow} aria-hidden="true">The Room</div>
            <h2 className={c.heroTitle}>The Room</h2>
          </div>
          <p className="mt-6 font-medium text-lg max-w-lg mx-auto">
            Visual presence only. No audio. Your stream is processed locally and snapshots sync to the shared paper board.
          </p>
          <button onClick={initializeCamera} className={c.btnStart}>
            Initialize Camera
          </button>
        </section>

        <section className={c.workspace}>
          {/* Local Feed */}
          <div className={c.videoCard}>
            <div className={c.cardHeader}>
              <div className={c.cardBadge}>Active</div>
              <div className={c.cardTitle}>Station 01</div>
            </div>
            
            <div className={c.canvasWrapper}>
              <video ref={videoRef} playsInline autoPlay muted className={c.hiddenVideo} />
              <canvas ref={canvasRef} className={c.canvas} />
              {!camActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]">
                  <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] animate-pulse">Offline</span>
                </div>
              )}
            </div>

            <div className={c.controls}>
              <div className={c.segmentedControl}>
                {["Fine", "Medium", "Wax Chunk"].map(lvl => (
                  <div 
                    key={lvl} 
                    onClick={() => setDensity(lvl)}
                    className={`${c.segment} ${density === lvl ? c.segmentActive : c.segmentIdle}`}
                  >
                    {lvl}
                  </div>
                ))}
              </div>
              <button onClick={handleSaveClick} disabled={!camActive || isCapturing} className={c.btnPrimary}>
                {isCapturing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    RECORDING...
                  </>
                ) : "[ Snap Frame ]"}
              </button>
            </div>
          </div>

          {/* Placeholder for Remote Feed */}
          <div className={c.videoCard}>
            <div className={c.cardHeader}>
              <div className={c.cardBadge}>Standby</div>
              <div className={c.cardTitle}>Station 02</div>
            </div>
            <div className="w-full aspect-video border-b-[3px] bg-gray-100 flex items-center justify-center p-8 text-center">
              <span className="font-mono text-sm uppercase text-gray-400">Awaiting visual transmission...</span>
            </div>
            <div className={c.controls}>
              <div className="h-10 bg-gray-200 border-[3px] border-dashed rounded-[4px]" />
            </div>
          </div>
        </section>

        <section>
          <h3 className={c.galleryHeader}>Scrapbook</h3>
          <div className={c.galleryLayout}>
            {snaps.map(snap => (
              <div key={snap._id} className={c.snapCard}>
                {snap._files?.image?.url ? (
                  <img src={snap._files.image.url} alt={`Snap at ${snap.timestamp}`} className={c.snapImg} />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-[var(--bg)]">
                    <svg className="animate-spin h-6 w-6 text-[var(--muted)]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                )}
                <div className={c.snapMeta}>
                  <span className={c.snapTime}>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                  <span className={c.snapTag}>{snap.density}</span>
                </div>
              </div>
            ))}

            {snaps.length === 0 && (
              <div className={c.emptyState}>
                <span className="font-mono text-sm">No snaps recorded yet.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}