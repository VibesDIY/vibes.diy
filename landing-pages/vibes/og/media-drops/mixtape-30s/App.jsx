import React, { useState, useRef, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const c = {
    page: "min-h-screen flex flex-col items-center p-4 md:p-12 bg-[oklch(0.92_0.01_65)] text-[oklch(0.15_0.02_50)] font-['Inter',sans-serif]",
    container: "w-full max-w-[920px] flex flex-col gap-12 relative z-10",
    header: "w-full flex flex-col items-center text-center gap-6 border-b border-[oklch(0.20_0.02_50)] pb-12 mb-4",
    h1: "text-4xl md:text-6xl font-bold tracking-tight font-['Playfair_Display',serif] text-[oklch(0.15_0.02_50)]",
    lead: "text-lg md:text-xl max-w-2xl leading-relaxed text-left text-[oklch(0.15_0.02_50)]",
    sectionLabel: "text-[0.65rem] font-bold uppercase tracking-[0.12em] border-b border-[oklch(0.20_0.02_50)] pb-2 mb-6 block w-full text-[oklch(0.55_0.02_50)]",
    grid: "w-full grid grid-cols-1 md:grid-cols-12 gap-12",
    colLeft: "md:col-span-7 flex flex-col gap-8",
    colRight: "md:col-span-5 flex flex-col gap-6 items-start",
    card: "w-full border border-[oklch(0.20_0.02_50)] p-6 flex flex-col gap-4 bg-[oklch(0.95_0.01_70)] rounded-none",
    row: "w-full border-b border-[oklch(0.20_0.02_50)] pb-4 flex flex-col gap-2",
    inputGroup: "w-full flex flex-col gap-2 mb-4",
    input: "w-full outline-none py-2 border-b border-[oklch(0.20_0.02_50)] bg-transparent font-['Playfair_Display',serif] text-lg text-[oklch(0.15_0.02_50)] placeholder-[oklch(0.55_0.02_50)] focus:border-[oklch(0.35_0.04_50)] transition-colors",
    buttonContainer: "w-full flex gap-3 mt-2",
    button: "w-full px-4 py-3 font-bold uppercase tracking-[0.12em] text-[0.7rem] outline-none transition-all flex justify-center items-center gap-2 bg-[oklch(0.35_0.04_50)] text-[oklch(0.95_0.01_70)] hover:bg-[oklch(0.15_0.02_50)]",
    secondaryButton: "px-4 py-3 font-bold uppercase tracking-[0.12em] text-[0.7rem] outline-none transition-all border border-[oklch(0.20_0.02_50)] text-[oklch(0.15_0.02_50)] hover:bg-[oklch(0.15_0.02_50)] hover:text-[oklch(0.95_0.01_70)]",
    aiBtn: "self-start text-[0.6rem] uppercase tracking-wider border border-[oklch(0.20_0.02_50)] px-2 py-1 cursor-pointer flex items-center gap-1 hover:bg-[oklch(0.20_0.02_50)] hover:text-[oklch(0.95_0.01_70)] transition-colors",
    audioPlayer: "w-full mt-2 h-10",
    archiveList: "w-full grid grid-cols-1 md:grid-cols-2 gap-8",
    archiveItem: "border border-[oklch(0.20_0.02_50)] p-4 flex flex-col gap-2 bg-[oklch(0.95_0.01_70)]",
  }

  const { database, useLiveQuery, useDocument } = useFireproof("mixtape-archive");

  // Determine current week string (e.g., 2023-W42)
  const getWeekString = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  };
  const currentWeek = getWeekString();

  const { doc, merge, submit } = useDocument({ 
    type: 'clip', 
    week: currentWeek, 
    author: '', 
    title: '', 
    createdAt: Date.now(),
    _files: {} 
  });

  const { docs: currentClips } = useLiveQuery((d) => d.type === 'clip' ? d.week : undefined, { key: currentWeek });
  // Query for archive: group all non-current weeks
  const { docs: allClips } = useLiveQuery("type", { key: 'clip' });
  const archiveGroups = allClips
    .filter(c => c.week !== currentWeek)
    .reduce((acc, clip) => {
      if (!acc[clip.week]) acc[clip.week] = [];
      acc[clip.week].push(clip);
      return acc;
    }, {});

  const [isRecording, setIsRecording] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const [isAI, setIsAI] = useState(false);

  async function handleRecord(e) {
    e.preventDefault();
    if (isRecording) {
      mediaRecorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `mic-${Date.now()}.webm`, { type: 'audio/webm' });
        merge({ _files: { audio: file } });
        setLocalAudioUrl(URL.createObjectURL(file));
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
      setTimeout(() => { if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop(); }, 30000);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or unavailable.");
    }
  }

  async function suggestTitle() {
    setIsAI(true);
    try {
      const prompt = `Generate a single short poetic title for a sound snippet (1-4 words). Like an exhibit label. E.g. "Morning Ritual", "Suburban Hums", "Distant Siren". Just generate a good sounding title.`;
      const response = await callAI(prompt, {
        schema: { properties: { title: { type: "string" } } }
      });
      const data = JSON.parse(response);
      if (data.title) merge({ title: data.title });
    } catch (err) {
      console.error(err);
    } finally {
      setIsAI(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      merge({ _files: { audio: file } });
      setLocalAudioUrl(URL.createObjectURL(file));
    }
  }

  function handleSubmit(e) { 
    e.preventDefault(); 
    if (!doc._files?.audio) return alert("Please capture or upload audio.");
    submit();
    setLocalAudioUrl(null);
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        .drop-cap::first-letter {
          font-family: 'Playfair Display', serif;
          font-size: 4rem;
          font-weight: 700;
          float: left;
          line-height: 1;
          margin-right: 0.5rem;
          margin-top: -0.25rem;
        }
      `}</style>

      <div className={c.container}>
        <header className={c.header}>
          <span className={c.sectionLabel}>Exhibition 04 — Audio Catalog</span>
          <h1 className={c.h1}>30-Second Mixtape</h1>
          <p className={`${c.lead} drop-cap`}>
            A collective assemblage of sonic fragments. Each week, contributors lodge a single half-minute recording into the ledger. Sequenced chronologically, these disjointed pieces form a fragile, evolving document of shared time. Listen from the beginning, or leave your mark below.
          </p>
        </header>

        <main className={c.grid}>
          <section className={c.colLeft}>
            <span className={c.sectionLabel}>Current Installment</span>
            
            <div className={c.card}>
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-xl font-bold">Week {currentWeek.split('-W')[1]} Mix</h3>
                <span className="text-sm">{currentClips.length} Tracks</span>
              </div>
              <p className="text-sm border-l-2 pl-3 italic mb-4 text-[oklch(0.35_0.04_50)]">
                {"\"Our collective rhythm emerges in the pauses between voices.\""}
              </p>

              <div className="flex flex-col gap-4 mt-2">
                {currentClips.length === 0 ? (
                  <p className="text-sm italic text-[oklch(0.55_0.02_50)] py-4">No submissions this week yet. Be the first.</p>
                ) : (
                  currentClips.map((clip, index) => (
                    <div className={c.row} key={clip._id}>
                      <div className="flex justify-between w-full items-baseline">
                        <span className="font-bold">{index + 1}. {clip.title || "Untitled Artifact"}</span>
                        <span className="text-xs text-[oklch(0.55_0.02_50)]">by {clip.author || "Anonymous"}</span>
                      </div>
                      {clip._files?.audio?.url && (
                        <audio controls src={clip._files.audio.url} className={c.audioPlayer} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className={c.colRight}>
            <span className={c.sectionLabel}>Contribute (Max 30s)</span>
            
            <form onSubmit={handleSubmit} className={c.card}>
              <div className={c.inputGroup}>
                <label className="text-xs font-bold uppercase tracking-widest">Contributor</label>
                <input type="text" placeholder="Your Name or Moniker" value={doc.author || ''} onChange={e => merge({ author: e.target.value })} className={c.input} required />
              </div>

              <div className={c.inputGroup}>
                <label className="text-xs font-bold uppercase tracking-widest flex justify-between items-center">
                  Title
                  <button type="button" onClick={suggestTitle} disabled={isAI} className={c.aiBtn}>
                    {isAI ? (
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    )}
                    Suggest
                  </button>
                </label>
                <input type="text" placeholder="Artifact Title" value={doc.title || ''} onChange={e => merge({ title: e.target.value })} className={c.input} required />
              </div>

              <div className="w-full flex flex-col gap-2 mt-4 border-t pt-4">
                <span className="text-xs uppercase tracking-widest">Capture</span>
                <div className={c.buttonContainer}>
                  <button type="button" onClick={handleRecord} className={isRecording ? c.secondaryButton : c.button}>
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[oklch(0.35_0.04_50)] animate-pulse border border-[oklch(0.20_0.02_50)] shadow-[0_0_0_1px_oklch(0.35_0.04_50)]"></span>
                        Stop Rec
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                        Start Mic
                      </>
                    )}
                  </button>
                  <label className={c.secondaryButton + " flex-1 text-center cursor-pointer flex justify-center items-center"}>
                    <input type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
                    File
                  </label>
                </div>
                {localAudioUrl && (
                  <div className="mt-4 border border-[oklch(0.20_0.02_50)] p-2 flex flex-col gap-1">
                    <span className="text-[0.6rem] uppercase tracking-widest px-1 text-[oklch(0.55_0.02_50)]">Preview</span>
                    <audio src={localAudioUrl} controls className={c.audioPlayer} />
                  </div>
                )}
              </div>

              <div className="w-full mt-6">
                <button type="submit" className={c.button}>Lodge into Ledger</button>
              </div>
            </form>
          </aside>
        </main>

        <section className="w-full mt-12 mb-24">
          <span className={c.sectionLabel}>The Archives</span>
          {Object.keys(archiveGroups).length === 0 ? (
            <p className="text-sm italic text-[oklch(0.55_0.02_50)]">No archival records survive at this level.</p>
          ) : (
            <div className={c.archiveList}>
              {Object.entries(archiveGroups).sort((a,b) => b[0].localeCompare(a[0])).map(([weekTag, clips]) => (
                <div className={c.archiveItem} key={weekTag}>
                  <h4 className="font-bold border-b border-[oklch(0.20_0.02_50)] pb-1 mb-2 flex justify-between items-baseline">
                    Week {weekTag.split('-W')[1]}
                    <span className="font-normal text-xs">{clips.length} Tracks</span>
                  </h4>
                  <p className="text-xs flex flex-col gap-2 mt-1">
                    {clips.map(c => (
                      <span key={c._id} className="flex flex-col gap-1 w-full border-b border-[oklch(0.20_0.02_50)] last:border-0 pb-2 last:pb-0">
                        <span>
                          <strong className="text-[oklch(0.35_0.04_50)]">{c.title || "Untitled"}</strong> 
                          <span className="text-[oklch(0.55_0.02_50)]"> by {c.author || "Anonymous"}</span>
                        </span>
                        {c._files?.audio?.url && (
                          <audio controls src={c._files.audio.url} className="w-full h-8 opacity-80" />
                        )}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}