import React from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  React.useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=optional';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.innerHTML = `
      body { font-family: 'Space Grotesk', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
    `;
    document.head.appendChild(style);
  }, []);

  const [activeTag, setActiveTag] = React.useState("LINT");
  const [handle, setHandle] = React.useState("");
  const [isReady, setIsReady] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  const { useLiveQuery, database } = useFireproof("uv-evidence-log");
  const { docs: evidenceItems } = useLiveQuery("type", { key: "scan", descending: true });

  const c = {
    page: "min-h-screen relative font-sans flex flex-col items-center bg-[#f5f5f5] text-[#262626]",
    ambientGrid: "fixed inset-0 z-0 pointer-events-none [background-image:linear-gradient(oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] [background-size:60px_60px]",
    ambientBlocks: "fixed inset-0 z-0 pointer-events-none overflow-hidden",
    main: "w-full max-w-[920px] p-[3rem_2rem] relative z-10 flex flex-col gap-8",
    header: "p-4 flex flex-col md:flex-row justify-between items-center rounded-[4px] border-[3px] border-[#262626] bg-white shadow-[4px_4px_0px_#262626]",
    logoRow: "flex flex-row items-center gap-3",
    logoSquares: "flex gap-1",
    logoSq: "w-3 h-3 rounded-sm border-[3px] border-[#262626] first:bg-[#df5642] [&:nth-child(2)]:bg-[#f5c250] last:bg-[#43ba7f]",
    titleText: "font-bold uppercase tracking-[-0.02em] text-xl md:text-2xl",
    navLinks: "flex gap-2 mt-4 md:mt-0",
    navPill: "px-4 py-2 text-[0.7rem] uppercase tracking-[0.05em] font-bold rounded-[4px] border-[3px] border-[#262626] bg-[#f5f5f5] shadow-[3px_3px_0px_#262626] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_#262626] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all duration-150",
    hero: "flex flex-col border-[3px] border-[#262626] rounded-[4px] bg-white shadow-[8px_8px_0px_#262626] relative transition-transform",
    heroBar: "h-[6px] w-full flex flex-row absolute top-0 left-0 z-20 rounded-t-[2px] overflow-hidden",
    heroBarSeg: "h-full flex-1 first:bg-[#df5642] [&:nth-child(2)]:bg-[#f5c250] [&:nth-child(3)]:bg-[#43ba7f] last:bg-[#2c5fed]",
    videoPanel: "relative w-full aspect-square md:aspect-video overflow-hidden pt-[6px]",
    video: "w-full h-full object-cover",
    overlayUI: "absolute top-4 right-4 flex flex-col gap-2 z-20",
    statusPill: "px-3 py-1 font-mono text-xs uppercase rounded-[4px] border-[3px] border-[#262626] bg-[#f5f5f5] text-[#262626] shadow-[3px_3px_0px_#262626] flex items-center gap-2 font-bold",
    statusDot: "w-2 h-2 rounded-full bg-[#43ba7f] animate-pulse",
    controlsRow: "p-4 md:p-6 flex flex-col md:flex-row gap-6 items-end border-t-[3px]",
    inputWrapper: "flex-1 flex flex-col gap-2 w-full",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold",
    input: "w-full p-3 border-[3px] border-[#262626] bg-[#f5f5f5] rounded-[4px] font-mono text-sm h-12 outline-none transition-transform focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_#262626]",
    btnGroup: "flex flex-row rounded-[4px] border-[3px] border-[#262626] h-12 overflow-hidden w-full md:w-auto shadow-[4px_4px_0px_#262626]",
    toggleBtn: "px-4 py-2 font-bold uppercase text-[0.7rem] tracking-[0.05em] border-r-[3px] border-[#262626] last:border-r-0 flex-1 md:flex-none text-center transition-colors hover:bg-[#f5c250]",
    scanBtnWrap: "w-full md:w-auto",
    scanBtn: "h-12 px-8 font-bold uppercase tracking-[0.08em] text-sm rounded-[4px] border-[3px] border-[#262626] bg-[#df5642] text-white flex items-center justify-center gap-2 w-full transition-all duration-150 shadow-[4px_4px_0px_#262626] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_#262626] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none",
    sectionTitle: "text-2xl font-bold uppercase tracking-[-0.02em]",
    galleryGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
    card: "flex flex-col rounded-[4px] border-[3px] border-[#262626] bg-white shadow-[4px_4px_0px_#262626] overflow-hidden hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_#262626] transition-all duration-150",
    cardHeader: "p-2 flex justify-between items-center border-b-[3px] border-[#262626] bg-[#f5f5f5]",
    cardTag: "text-[0.65rem] text-[#262626] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded-[4px] border-[3px] border-[#262626] bg-white shadow-[2px_2px_0px_#262626]",
    cardTime: "font-mono text-[0.65rem]",
    cardImgWrap: "w-full aspect-square relative bg-[#262626] border-b-[3px] border-[#262626] flex items-center justify-center overflow-hidden",
    cardImg: "w-full h-full object-cover filter brightness-110 contrast-125 saturate-150 sepia-[0.3] hue-rotate-[240deg]",
    cardFoot: "p-3 flex justify-between items-center bg-white",
    cardAuthorWrapper: "flex flex-col",
    cardAuthorLabel: "text-[0.6rem] uppercase tracking-[0.1em]",
    cardAuthorName: "font-mono text-sm font-bold truncate max-w-[150px]",
    emptyState: "col-span-1 sm:col-span-2 lg:col-span-3 p-12 text-center border-[3px] border-[#262626] bg-[#f5f5f5] rounded-[4px] flex flex-col items-center justify-center shadow-[4px_4px_0px_#262626]"
  };

  React.useEffect(() => {
    let streamRef = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          streamRef = stream;
          setIsReady(true);
        }
      })
      .catch(err => console.error("Camera access denied", err));
      
    return () => {
      if (streamRef) streamRef.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function handleScan(e) {
    e.preventDefault();
    if (!videoRef.current || !canvasRef.current || !isReady || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      // Draw exact frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      await database.put({
        type: "scan",
        tag: activeTag,
        by: handle || "ANONYMOUS",
        timestamp: Date.now(),
        _files: { frame: file }
      });
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  }

  function toggleTag(tag) {
    setActiveTag(tag);
  }

  return (
    <div className={c.page}>
      <div className={c.ambientGrid}></div>
      <div className={c.ambientBlocks}>
        {/* Decorative blocks will be styled securely in CSS/Tailwind later */}
        <div className="absolute top-10 left-10 w-12 h-12 border-[3px] rounded-full hidden md:block"></div>
        <div className="absolute top-40 right-10 w-8 h-8 border-[3px] rotate-45 hidden md:block"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 border-[3px] hidden lg:block"></div>
      </div>

      <main className={c.main}>
        <header className={c.header}>
          <div className={c.logoRow}>
            <div className={c.logoSquares}>
              <div className={c.logoSq}></div>
              <div className={c.logoSq}></div>
              <div className={c.logoSq}></div>
            </div>
            <h1 className={c.titleText}>UV Detector</h1>
          </div>
          <div className={c.navLinks}>
            <button className={c.navPill}>Live Feed</button>
            <button className={c.navPill}>Evidence</button>
          </div>
        </header>

        <section id="scanner" className={c.hero}>
          <div className={c.heroBar}>
            <div className={c.heroBarSeg}></div>
            <div className={c.heroBarSeg}></div>
            <div className={c.heroBarSeg}></div>
            <div className={c.heroBarSeg}></div>
          </div>
          
          <div className={c.videoPanel}>
            <video ref={videoRef} playsInline muted autoPlay className={`${c.video} filter saturate-200 contrast-125 sepia-[0.5] hue-rotate-[240deg] brightness-90`}></video>
            <canvas ref={canvasRef} className="hidden" />
            <div className={c.overlayUI}>
              <div className={c.statusPill}>
                <div className={c.statusDot}></div>
                UV ACTIVE
              </div>
            </div>
          </div>

          <div className={c.controlsRow}>
            <div className={c.inputWrapper}>
              <label className={c.label}>Target Signature</label>
              <div className={c.btnGroup}>
                <button onClick={() => toggleTag('LINT')} className={`${c.toggleBtn} ${activeTag === 'LINT' ? 'bg-[#f5c250] shadow-inner' : 'bg-white'}`}>LINT</button>
                <button onClick={() => toggleTag('GLOW')} className={`${c.toggleBtn} border-l-[3px] border-[#262626] ${activeTag === 'GLOW' ? 'bg-[#f5c250] shadow-inner' : 'bg-white'}`}>GLOW</button>
                <button onClick={() => toggleTag('SECRET')} className={`${c.toggleBtn} border-l-[3px] border-[#262626] ${activeTag === 'SECRET' ? 'bg-[#f5c250] shadow-inner' : 'bg-white'}`}>SECRET</button>
              </div>
            </div>

            <div className={c.inputWrapper}>
              <label className={c.label}>Operative Handle</label>
              <input type="text" placeholder="GUEST-001" value={handle} onChange={e => setHandle(e.target.value.toUpperCase())} className={c.input} />
            </div>

            <div className={c.scanBtnWrap}>
              <label className={c.label}>&nbsp;</label>
              <button disabled={!isReady || isCapturing} onClick={handleScan} className={`${c.scanBtn} ${!isReady ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isCapturing ? (
                   <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                  </svg>
                )}
                {isCapturing ? 'SAVING...' : 'SCAN'}
              </button>
            </div>
          </div>
        </section>

        <h2 className={c.sectionTitle}>Field Evidence</h2>

        <section id="gallery" className={c.galleryGrid}>
          {evidenceItems.length > 0 ? (
            evidenceItems.map(doc => {
              const date = new Date(doc.timestamp || Date.now());
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <article key={doc._id} className={c.card}>
                  <div className={c.cardHeader}>
                    <span className={`${c.cardTag} ${doc.tag === 'SECRET' ? 'bg-[#df5642] text-white' : doc.tag === 'GLOW' ? 'bg-[#43ba7f]' : ''}`}>
                      {doc.tag || "UNK"}
                    </span>
                    <span className={c.cardTime}>{timeStr}</span>
                  </div>
                  <div className={c.cardImgWrap}>
                    {doc._files?.frame?.url ? (
                      <img src={doc._files.frame.url} alt="Scan trace" loading="lazy" className={c.cardImg} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50 font-mono uppercase">DEGRADED SIGNAL</div>
                    )}
                  </div>
                  <div className={c.cardFoot}>
                    <div className={c.cardAuthorWrapper}>
                      <span className={c.cardAuthorLabel}>Logged by</span>
                      <span className={c.cardAuthorName}>{doc.by}</span>
                    </div>
                    <button onClick={() => database.del(doc._id)} className="text-[0.65rem] border-[3px] border-[#262626] rounded px-2 hover:bg-[#df5642] hover:text-white font-bold transition-colors">DEL</button>
                  </div>
                </article>
              );
            })
          ) : (
             <div className={c.emptyState}>
               <p className="font-mono text-sm uppercase font-bold text-[#262626] mb-2">Awaiting Signal...</p>
               <p className="text-xs text-[#262626]/80 max-w-xs">No current evidence logged on this frequency. Aim scanner and capture to log artifacts.</p>
             </div>
          )}
        </section>
      </main>
    </div>
  );
}