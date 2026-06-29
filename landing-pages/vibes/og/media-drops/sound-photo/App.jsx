import React, { useState, useRef } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, useDocument } = useFireproof("sound-photo-archive");
  const { doc, merge, submit } = useDocument({ caption: "", location: "", _files: {} });
  const { docs } = useLiveQuery("type", { key: "sound", descending: true });

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlobURL, setAudioBlobURL] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const mediaRef = useRef(null);
  const audioRef = useRef(null);

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
    :root {
      --bg: oklch(0.96 0.01 90); --card-bg: oklch(1.00 0 0);
      --text: oklch(0.15 0.02 280); --border: oklch(0.15 0.02 280);
      --muted: oklch(0.50 0.02 280); --red: oklch(0.55 0.24 28);
      --yellow: oklch(0.85 0.18 85); --green: oklch(0.62 0.19 145);
      --blue: oklch(0.52 0.18 255);
      --shadow: 4px 4px 0px var(--border);
      --shadow-sm: 3px 3px 0px var(--border);
      --shadow-hover: 6px 6px 0px var(--border);
    }
    body { background-color: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; }
  `;

  const c = {
    appWrapper: "w-full min-h-screen p-8 flex flex-col items-center overflow-x-hidden relative",
    container: "w-full max-w-[920px] flex flex-col gap-8 relative z-10",
    nav: "flex items-center justify-between px-4 py-3 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow)] z-10",
    navLogo: "text-lg font-bold uppercase tracking-tighter flex gap-2 items-center",
    navBadge: "text-[0.7rem] uppercase tracking-widest px-3 py-1 font-bold border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--yellow)] shadow-[var(--shadow-sm)]",
    hero: "w-full flex-col border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] p-8 relative shadow-[var(--shadow)] overflow-hidden z-10",
    heroTitle: "text-clamp-5xl font-bold uppercase tracking-tighter relative z-10 text-[var(--text)]",
    heroTitleShadow: "absolute top-1 left-1 text-[var(--red)] opacity-50 z-0",
    heroSubtitle: "text-sm uppercase tracking-[0.15em] text-[var(--muted)] font-bold mt-2",
    recorderCard: "border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] p-6 flex flex-col gap-6 shadow-[var(--shadow)] z-10",
    recordBtn: "px-6 py-6 text-2xl font-bold uppercase tracking-widest border-[3px] border-[var(--border)] rounded-[4px] flex justify-center items-center bg-[var(--red)] text-white shadow-[var(--shadow-hover)] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150",
    previewBox: "flex items-center gap-4 p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[oklch(0.96_0.01_90)]",
    playBtn: "w-12 h-12 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--yellow)] shadow-[var(--shadow-sm)] flex items-center justify-center font-bold text-xl cursor-pointer hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[var(--shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    vizBox: "flex-1 h-12 flex items-center justify-center gap-[2px] overflow-hidden",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    inputGroup: "flex flex-col gap-2",
    labelBlock: "flex justify-between items-end mb-1",
    label: "text-[0.65rem] uppercase font-bold text-[var(--muted)] tracking-[0.15em]",
    aiBtn: "text-[10px] uppercase font-bold px-2 py-1 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--green)] shadow-[var(--shadow-sm)] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    input: "w-full border-[3px] border-[var(--border)] rounded-[4px] px-4 py-3 text-sm font-bold bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[var(--shadow-hover)] transition-all",
    submitBtn: "px-8 py-4 font-bold uppercase tracking-widest border-[3px] border-[var(--border)] rounded-[4px] mt-4 bg-[var(--text)] text-white shadow-[var(--shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow-hover)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex justify-center items-center gap-2",
    catalogTitle: "text-[0.65rem] uppercase font-bold mt-8 mb-4 tracking-[0.15em] text-[var(--muted)] border-b-[3px] border-[var(--border)] pb-2",
    grid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    card: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] p-5 bg-[var(--card-bg)] shadow-[var(--shadow)] relative group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[var(--shadow-hover)] transition-all",
    cardTop: "flex gap-4 items-center mb-4",
    cardPlay: "w-10 h-10 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--yellow)] shadow-[var(--shadow-sm)] flex items-center justify-center font-bold cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    cardViz: "flex-1 h-10 flex items-center gap-[2px] overflow-hidden bg-[oklch(0.96_0.01_90)] border-[3px] border-[var(--border)] rounded-[4px] px-2",
    cardMeta: "flex flex-col gap-1 border-t-[3px] border-[var(--border)] pt-4",
    cardCaption: "text-[1.1rem] font-bold uppercase tracking-tight",
    cardLocation: "text-[0.7rem] font-['JetBrains_Mono'] uppercase flex items-center gap-2 text-[var(--muted)]"
  }

  async function handleRecord() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlobURL(URL.createObjectURL(blob));
        merge({ _files: { audio: blob }, type: "sound", createdAt: Date.now() });
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
      };
      mediaRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 3000);
    } catch (err) { console.error("Mic access denied", err); }
  }

  function handleDocSubmit(e) {
    e.preventDefault();
    if (!doc._files?.audio) return;
    submit();
    setAudioBlobURL(null);
  }

  function playPreview() {
    if (!audioBlobURL) return;
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(audioBlobURL);
    audioRef.current = a;
    a.onplay = () => setIsPlayingPreview(true);
    a.onended = () => setIsPlayingPreview(false);
    a.play();
  }

  function togglePlayArchive(id, url) {
    if (!url) return;
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    audioRef.current = a;
    setPlayingId(id);
    a.onended = () => setPlayingId(null);
    a.play();
  }

  async function generateIdeas() {
    setIsAiLoading(true);
    try {
      const res = await callAI("Generate a short, punchy 1-line caption for a 3-second field recording. e.g. 'Coffee machine whistling'. Return JSON.", { schema: { properties: { caption: { type: "string" } } } });
      merge({ caption: JSON.parse(res).caption });
    } catch (e) {} finally { setIsAiLoading(false); }
  }

  async function generateLocation() {
    setIsAiLoading(true);
    try {
      const res = await callAI("Generate a short neobrutalist location tag, e.g. 'Platform 3 // Berlin', 'Subway L Line'. Return JSON.", { schema: { properties: { location: { type: "string" } } } });
      merge({ location: JSON.parse(res).location });
    } catch (e) {} finally { setIsAiLoading(false); }
  }

  return (
    <div className={c.appWrapper}>
      <style>{styles}</style>
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
      <div className={c.container}>
        <nav className={c.nav}>
          <div className={c.navLogo}>
            <div className="flex gap-1"><div className="w-3 h-3 bg-[var(--red)] border-[2px] border-[var(--border)]"></div><div className="w-3 h-3 bg-[var(--yellow)] border-[2px] border-[var(--border)]"></div><div className="w-3 h-3 bg-[var(--green)] border-[2px] border-[var(--border)]"></div></div>
            Sound Photo
          </div>
          <div className={c.navBadge}>Archive</div>
        </nav>

        <section className={c.hero}>
          <div className="absolute top-0 left-0 right-0 h-[6px] flex">
            <div className="flex-1 bg-[var(--red)] border-b-[3px] border-r-[1.5px] border-[var(--border)]"></div>
            <div className="flex-1 bg-[var(--yellow)] border-b-[3px] border-x-[1.5px] border-[var(--border)]"></div>
            <div className="flex-1 bg-[var(--green)] border-b-[3px] border-x-[1.5px] border-[var(--border)]"></div>
            <div className="flex-1 bg-[var(--blue)] border-b-[3px] border-l-[1.5px] border-[var(--border)]"></div>
          </div>
          <div className="relative inline-block">
            <h1 className={c.heroTitle} aria-hidden="true" style={{color: 'var(--red)', opacity: 0.5, transform: 'translate(5px, 5px)', position: 'absolute'}}>Drop a Sound</h1>
            <h1 className={c.heroTitle}>Drop a Sound</h1>
          </div>
          <p className={c.heroSubtitle}>Capture 3 seconds of audio</p>
        </section>

        <section className={c.recorderCard}>
          <button className={c.recordBtn} onClick={handleRecord} disabled={isRecording}>
             {isRecording ? <span className="animate-pulse">Capturing...</span> : "Record 3s"}
          </button>
          
          {audioBlobURL && (
            <div className={c.previewBox}>
              <button type="button" className={c.playBtn} onClick={playPreview}>
                {isPlayingPreview ? '■' : '►'}
              </button>
              <div className={c.vizBox}>
                 {Array.from({length: 40}).map((_, i) => (
                   <div key={i} className="w-[4px] bg-[var(--text)] transition-all duration-75" style={{ height: isPlayingPreview ? `${Math.max(20, Math.random() * 100)}%` : '20%' }}></div>
                 ))}
              </div>
            </div>
          )}

          <form className={c.formGrid} onSubmit={handleDocSubmit}>
            <div className={c.inputGroup}>
                <div className={c.labelBlock}>
                  <label className={c.label}>Caption</label>
                  <button type="button" className={c.aiBtn} onClick={generateIdeas} disabled={isAiLoading || isRecording}>
                     {isAiLoading ? '...' : 'Ideas'}
                  </button>
                </div>
                <input className={c.input} type="text" value={doc.caption} onChange={e => merge({ caption: e.target.value })} placeholder="What's happening?" />
            </div>
            <div className={c.inputGroup}>
                <div className={c.labelBlock}>
                  <label className={c.label}>Location</label>
                  <button type="button" className={c.aiBtn} onClick={generateLocation} disabled={isAiLoading || isRecording}>
                     {isAiLoading ? '...' : 'Auto'}
                  </button>
                </div>
                <input className={c.input} type="text" value={doc.location} onChange={e => merge({ location: e.target.value })} placeholder="Where are you?" />
            </div>
          </form>
          <button className={c.submitBtn} onClick={handleDocSubmit} disabled={!audioBlobURL}>
            {audioBlobURL ? "Save Entry" : "Record First"}
          </button>
        </section>

        <section>
          <h2 className={c.catalogTitle}>Current Archive</h2>
          <div className={c.grid}>
             {docs.length === 0 && (
                <div className="col-span-1 md:col-span-2 text-[var(--muted)] text-sm font-bold uppercase tracking-widest border-[3px] border-[var(--border)] border-dashed p-8 rounded-[4px] text-center">
                  Archive empty. Drop a sound.
                </div>
             )}
             {docs.map(d => (
               <div className={c.card} key={d._id}>
                 <div className={c.cardTop}>
                   <button className={c.cardPlay} onClick={() => togglePlayArchive(d._id, d._files?.audio?.url)}>
                     {playingId === d._id ? '■' : '►'}
                   </button>
                   <div className={c.cardViz}>
                      {Array.from({length: 15}).map((_, i) => (
                        <div key={i} className="w-[4px] bg-[var(--text)] transition-all duration-75" style={{ height: playingId === d._id ? `${Math.max(20, Math.random() * 100)}%` : '30%' }}></div>
                      ))}
                   </div>
                 </div>
                 <div className={c.cardMeta}>
                   <div className={c.cardCaption}>{d.caption || "Untitled"}</div>
                   <div className={c.cardLocation}>{d.location || "Unknown"}</div>
                 </div>
               </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  )
}