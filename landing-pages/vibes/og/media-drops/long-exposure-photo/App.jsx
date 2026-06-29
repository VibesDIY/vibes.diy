import React, { useState, useRef, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [sessionId, setSessionId] = useState("GHOST-PROTO")
  const [progress, setProgress] = useState(0)
  const [isExposing, setIsExposing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [isCompositing, setIsCompositing] = useState(false)
  
  const { useLiveQuery, database } = useFireproof("ghost-sync-db")
  
  const sessionDocs = useLiveQuery("type", { key: "exposure", descending: true })
  const filteredDocs = sessionDocs.docs.filter(d => (d.session || "DEFAULT") === (sessionId.trim() ||"DEFAULT"))

  const runExposure = () => {
    if (!videoRef.current || !canvasRef.current) return
    setIsExposing(true)
    setProgress(0)
    
    const v = videoRef.current
    const cvs = canvasRef.current
    const ctx = cvs.getContext("2d", { willReadFrequently: true })
    const w = cvs.width
    const h = cvs.height
    
    // Accumulator array for HDR pixel summation
    const sumLen = w * h * 4
    const sumData = new Float32Array(sumLen)
    
    const maxFrames = 100 // 10 seconds at 10fps
    let frame = 0
    
    const timerId = setInterval(() => {
      ctx.drawImage(v, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      
      for (let i = 0; i < sumLen; i += 4) {
        sumData[i] += data[i]
        sumData[i+1] += data[i+1]
        sumData[i+2] += data[i+2]
      }
      
      frame++
      setProgress((frame / maxFrames) * 100)
      
      if (frame >= maxFrames) {
        clearInterval(timerId)
        finalizeExposure(sumData, w, h, maxFrames, ctx, cvs)
      }
    }, 100)
  }

  const finalizeExposure = async (sumData, w, h, totalFrames, ctx, cvs) => {
    const finalData = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < sumData.length; i += 4) {
      finalData[i] = sumData[i] / totalFrames
      finalData[i+1] = sumData[i+1] / totalFrames
      finalData[i+2] = sumData[i+2] / totalFrames
      finalData[i+3] = 255 
    }
    ctx.putImageData(new ImageData(finalData, w, h), 0, 0)
    
    cvs.toBlob(blob => {
      saveExposure(blob)
    }, 'image/jpeg', 0.85)
  }

  const suggestSessionName = async () => {
    setAiLoading(true)
    try {
      const res = await callAI("Suggest a very short (1-2 word), punchy, all-caps codename for a night long-exposure photography session. Something gritty, cyberpunk or mechanical.", {
        schema: { properties: { tag: { type: "string" } } }
      })
      const data = JSON.parse(res)
      setSessionId(data.tag)
    } catch(e) { /* ignore */ }
    finally { setAiLoading(false) }
  }

  const buildComposite = async () => {
    if (selectedDocs.size < 2) return
    setIsCompositing(true)
    
    try {
      // 1. Gather files
      const toMerge = filteredDocs.filter(d => selectedDocs.has(d._id))
      const imgs = await Promise.all(toMerge.map(async d => {
        const file = await d._files.frame.file()
        const url = URL.createObjectURL(file)
        return new Promise(res => {
           const i = new Image()
           i.onload = () => res(i)
           i.src = url
        })
      }))
      
      if (!imgs.length) return
      
      const w = imgs[0].width
      const h = imgs[0].height
      
      const cvs = document.createElement("canvas")
      cvs.width = w; cvs.height = h;
      const ctx = cvs.getContext("2d", { willReadFrequently: true })
      
      const sumLen = w * h * 4
      const sumData = new Float32Array(sumLen)
      
      imgs.forEach(img => {
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        for (let i = 0; i < sumLen; i += 4) {
          sumData[i] += data[i]
          sumData[i+1] += data[i+1]
          sumData[i+2] += data[i+2]
        }
      })
      
      const finalData = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < sumData.length; i += 4) {
        finalData[i] = sumData[i] / imgs.length
        finalData[i+1] = sumData[i+1] / imgs.length
        finalData[i+2] = sumData[i+2] / imgs.length
        finalData[i+3] = 255 
      }
      
      ctx.putImageData(new ImageData(finalData, w, h), 0, 0)
      
      cvs.toBlob(async blob => {
        const file = new File([blob], `ghost-comp-${Date.now()}.jpg`, { type: 'image/jpeg' })
        await database.put({
          type: "exposure",
          session: sessionId.trim() || "DEFAULT",
          isComp: true,
          createdAt: Date.now(),
          _files: { frame: file }
        })
        setSelectedDocs(new Set())
      }, 'image/jpeg', 0.90)
      
    } catch(err) {
      console.warn("Composite failed", err)
    } finally {
      setIsCompositing(false)
    }
  }

  const saveExposure = async (blob) => {
    const file = new File([blob], `ghost-${Date.now()}.jpg`, { type: 'image/jpeg' })
    await database.put({
      type: "exposure",
      session: sessionId.trim() || "DEFAULT",
      createdAt: Date.now(),
      _files: { frame: file }
    })
    setIsExposing(false)
    setProgress(0)
  }

  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } } 
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err) {
        console.error("Optics unavailable:", err)
      }
    }
    initCamera()
  }, [])

  const c = {
    layout: "min-h-screen w-full relative overflow-x-hidden p-4 md:p-8 flex justify-center bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    container: "max-w-[920px] w-full flex flex-col gap-6 relative z-10",
    
    ambientGrid: "fixed inset-0 z-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(to_right,oklch(0.15_0.02_280)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.15_0.02_280)_1px,transparent_1px)] bg-[size:60px_60px]",
    
    nav: "w-full p-4 flex justify-between items-center border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    navLogo: "flex items-center gap-2 font-bold uppercase tracking-[-0.02em]",
    navLink: "px-3 py-1 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs uppercase font-bold tracking-widest bg-[oklch(0.96_0.01_90)] shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    
    hero: "w-full p-6 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] flex flex-col gap-4 relative overflow-hidden bg-[oklch(1.00_0_0)] shadow-[6px_6px_0px_oklch(0.15_0.02_280)]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroTitle: "text-3xl md:text-5xl font-bold uppercase tracking-[-0.02em] relative w-full leading-none",
    
    cameraWrap: "w-full aspect-video md:aspect-[21/9] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] relative bg-[oklch(0.15_0.02_280)] text-white overflow-hidden",
    videoEl: "w-full h-full object-cover",
    progressWrap: "absolute bottom-0 left-0 right-0 h-4 border-t-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] z-20",
    progressBar: "h-full bg-[oklch(0.62_0.19_145)] border-r-[3px] border-[oklch(0.15_0.02_280)] transition-all duration-75",
    
    cameraActions: "flex flex-col md:flex-row items-center gap-4 mt-2 w-full",
    btnPrimary: "px-6 py-4 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-bold uppercase text-center w-full md:w-auto flex-1 text-sm md:text-base tracking-widest bg-[oklch(0.55_0.24_28)] text-white shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50",
    btnSecondary: "px-6 py-4 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-bold uppercase text-center w-full md:w-auto text-sm md:text-base tracking-widest bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50",
    
    inputRow: "flex w-full items-stretch gap-2",
    inputBox: "flex-1 px-4 py-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] font-mono text-sm outline-none focus:translate-y-[-2px] focus:translate-x-[-2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] focus:bg-[oklch(1.00_0_0)] transition-all",
    
    galleryWrap: "w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-6 flex flex-col gap-4 bg-[oklch(1.00_0_0)] shadow-[6px_6px_0px_oklch(0.15_0.02_280)]",
    galleryHeader: "flex flex-col md:flex-row justify-between items-start md:items-end border-b-[3px] border-[oklch(0.15_0.02_280)] pb-4 gap-4",
    galleryTitle: "text-xl font-bold uppercase tracking-[-0.02em]",
    
    galleryGrid: "grid grid-cols-2 md:grid-cols-4 gap-4",
    imageCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden aspect-square relative flex flex-col bg-[oklch(1.00_0_0)] transition-transform group shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] cursor-pointer",
    imageEl: "w-full flex-1 object-cover bg-[#000]",
    imageMeta: "p-2 border-t-[3px] border-[oklch(0.15_0.02_280)] flex justify-between items-center bg-[oklch(0.96_0.01_90)]",
    imageLabel: "text-[0.65rem] uppercase font-bold tracking-widest truncate font-mono",
    checkWrap: "absolute top-2 left-2 w-6 h-6 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] flex items-center justify-center z-10",
    checkActive: "w-3 h-3 bg-[oklch(0.62_0.19_145)]",
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
        body { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
      <div className={c.ambientGrid}></div>
      <div className={c.layout}>
        <div className={c.container}>
          
          <header className={c.nav}>
            <div className={c.navLogo}>
              <div className="flex gap-1">
                <div className="w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)]"></div>
                <div className="w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)]"></div>
                <div className="w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]"></div>
              </div>
              GHOST-SYNC
            </div>
            <div className={c.navLink}>
              Live Roll
            </div>
          </header>

          <section id="capture" className={c.hero}>
            <div className={c.heroBar}>
              <div className="flex-1 bg-[oklch(0.55_0.24_28)] border-b-[3px] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
              <div className="flex-1 bg-[oklch(0.85_0.18_85)] border-b-[3px] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
              <div className="flex-1 bg-[oklch(0.62_0.19_145)] border-b-[3px] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
              <div className="flex-1 bg-[oklch(0.52_0.18_255)] border-b-[3px] border-[oklch(0.15_0.02_280)]"></div>
            </div>
            
            <h1 className={c.heroTitle}>
              <span className="absolute top-[4px] left-[4px] text-[oklch(0.55_0.24_28)] opacity-70 select-none z-0" aria-hidden="true">ACCUMULATE LIGHT</span>
              <span className="relative z-10">ACCUMULATE LIGHT</span>
            </h1>

            <div className={c.inputRow}>
              <input 
                className={c.inputBox} 
                value={sessionId}
                onChange={e => setSessionId(e.target.value.toUpperCase())}
                placeholder="SESSION ID (e.g. NEON-RUN)" 
              />
              <button 
                className={c.btnSecondary}
                onClick={suggestSessionName}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <svg className="animate-spin h-5 w-5 text-[oklch(0.15_0.02_280)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : "AI SUGGEST"}
              </button>
            </div>

            <div className={c.cameraWrap}>
              <video ref={videoRef} playsInline muted className={c.videoEl}></video>
              {!videoRef.current?.srcObject && (
                <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold bg-[oklch(0.15_0.02_280)] text-white">
                  INITIALIZING OPTICS...
                </div>
              )}
              <div className={c.progressWrap}>
                <div className={c.progressBar} style={{ width: `${progress}%` }}></div>
              </div>
            </div>
            {/* Hidden canvas for off-screen accumulation */}
            <canvas ref={canvasRef} width={640} height={480} className="hidden"></canvas>

            <div className={c.cameraActions}>
              <button 
                className={c.btnPrimary} 
                onClick={runExposure}
                disabled={isExposing || !videoRef.current?.srcObject}
              >
                {isExposing ? `CAPTURING...` : `[ EXPOSE 10s ]`}
              </button>
            </div>
          </section>

          <section id="gallery" className={c.galleryWrap}>
            <div className={c.galleryHeader}>
              <h2 className={c.galleryTitle}>Contact Sheet</h2>
              <button 
                className={c.btnSecondary} 
                onClick={buildComposite}
                disabled={selectedDocs.size < 2 || isCompositing}
              >
                {isCompositing ? (
                  <svg className="animate-spin h-5 w-5 text-[oklch(0.15_0.02_280)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : `COMPOSITE (${selectedDocs.size})`}
              </button>
            </div>
            
            <div className={c.galleryGrid}>
              {filteredDocs.map((doc, idx) => {
                const isSelected = selectedDocs.has(doc._id)
                return (
                  <div 
                    key={doc._id} 
                    className={c.imageCard}
                    onClick={() => {
                      const next = new Set(selectedDocs)
                      if (next.has(doc._id)) next.delete(doc._id)
                      else next.add(doc._id)
                      setSelectedDocs(next)
                    }}
                  >
                    <div className={c.checkWrap}>
                      {isSelected && <div className={c.checkActive}></div>}
                    </div>
                    {doc._files?.frame?.url ? (
                       <img src={doc._files.frame.url} className={c.imageEl} alt="Exposure" />
                    ) : (
                       <div className={c.imageEl} />
                    )}
                    <div className={c.imageMeta}>
                      <span className={c.imageLabel}>{doc.isComp ? "COMPOSITE" : `FRM-${String(idx).padStart(3, '0')}`}</span>
                    </div>
                  </div>
                )
              })}
              
              {filteredDocs.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm font-mono tracking-widest text-[#555]">
                  NO DATA GATHERED YET IN ({sessionId || 'DEFAULT'})
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}