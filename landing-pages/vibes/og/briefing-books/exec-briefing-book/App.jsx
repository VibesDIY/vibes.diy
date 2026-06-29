import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("briefing-book");
  
  const { doc: draftSettings, merge: setSettings } = useDocument({ _id: "settings", status: "draft" });
  
  const { docs: exhibits } = useLiveQuery("type", { key: "exhibit", descending: false });

  const { doc: newExhibit, merge: mergeExhibit, submit: submitExhibit } = useDocument({
    type: "exhibit",
    category: "SCHEDULE",
    title: "",
    body: "",
    createdAt: Date.now()
  });

  const [isSynthLoading, setIsSynthLoading] = React.useState(false);
  const [isDelivering, setIsDelivering] = React.useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!newExhibit.title) return;
    submitExhibit();
  }

  async function handleDeliver() {
    setIsDelivering(true);
    try {
      await new Promise(r => setTimeout(r, 600)); // Simulate async freeze
      await setSettings({ status: draftSettings.status === "delivered" ? "draft" : "delivered" });
    } finally {
      setIsDelivering(false);
    }
  }

  async function handleAISynth() {
    if (!newExhibit.body.trim()) return;
    setIsSynthLoading(true);
    try {
      const resp = await callAI(`Format the following raw notes into a crisp executive-level list of action items or schedule points. Keep it highly concise, start each line with a bullet hyphen or time block, no fluff. Notes: ${newExhibit.body}`, {
        schema: { properties: { formattedCoreContent: { type: "string" } } }
      });
      const data = JSON.parse(resp);
      mergeExhibit({ body: data.formattedCoreContent });
    } finally {
      setIsSynthLoading(false);
    }
  }

  const c = {
    page: "[--bg:oklch(0.96_0.01_90)] [--card-bg:oklch(1.00_0_0)] [--text:oklch(0.15_0.02_280)] [--border:oklch(0.15_0.02_280)] [--muted:oklch(0.50_0.02_280)] [--red:oklch(0.55_0.24_28)] [--yellow:oklch(0.85_0.18_85)] [--yellow-dark:oklch(0.75_0.16_85)] [--green:oklch(0.62_0.19_145)] [--blue:oklch(0.52_0.18_255)] [--accent-light:oklch(0.55_0.24_28/0.1)] min-h-screen relative p-6 flex flex-col items-center bg-[var(--bg)] text-[var(--text)] font-sans",
    ambient: "fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[linear-gradient(to_right,oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]",
    container: "w-full max-w-[920px] flex flex-col gap-8 relative z-10",
    
    nav: "flex justify-between items-center p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    navLogo: "flex gap-2 items-center flex-row",
    navLogoBox: "w-[12px] h-[12px] border-[3px] border-[var(--border)] rounded-[2px]",
    navText: "font-black text-xl uppercase tracking-[-0.02em]",
    navActions: "flex gap-3",
    navPill: "px-4 py-2 border-[3px] border-[var(--border)] flex items-center justify-center font-bold uppercase text-[0.7rem] tracking-[0.05em] rounded-[4px] bg-[var(--yellow)] shadow-[3px_3px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--border)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer",
    
    hero: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] pt-12 pb-10 px-8 relative bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    heroAccentWrap: "absolute top-0 left-0 right-0 h-[6px] flex flex-row border-b-[3px] border-[var(--border)]",
    heroAccent: "flex-1",
    heroTitleWrap: "relative mb-6",
    heroTitle: "text-[clamp(2.5rem,6vw,4rem)] leading-[1] font-black uppercase tracking-[-0.02em] relative z-10 break-words text-[var(--text)]",
    heroTitleShadow: "text-[clamp(2.5rem,6vw,4rem)] leading-[1] font-black uppercase tracking-[-0.02em] absolute top-[5px] left-[5px] break-words pointer-events-none text-[var(--red)] opacity-50",
    heroMeta: "flex items-center gap-4 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]",
    
    mainGrid: "flex flex-col gap-6",
    
    exhibitCard: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] relative bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] transition-transform duration-150 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--border)]",
    exhibitHeader: "px-4 py-3 flex justify-between items-center border-b-[3px] border-[var(--border)]",
    exhibitLabelWrap: "flex items-center gap-3",
    exhibitNumber: "text-[0.65rem] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] shadow-[2px_2px_0px_var(--border)]",
    exhibitTitle: "font-black uppercase tracking-[-0.02em]",
    exhibitBody: "p-6 flex flex-col font-mono text-[0.82rem] leading-relaxed whitespace-pre-wrap text-[var(--text)]",
    
    actionsCard: "flex flex-wrap gap-4 p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    btnPrimary: "px-6 py-3 font-bold uppercase tracking-[0.08em] text-[0.75rem] rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--red)] text-white shadow-[4px_4px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center min-h-[44px] cursor-pointer cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    btnSecondary: "px-6 py-3 font-bold uppercase tracking-[0.08em] text-[0.75rem] rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] shadow-[3px_3px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center min-h-[44px] cursor-pointer disabled:opacity-50",
    btnGhost: "px-6 py-3 font-bold uppercase tracking-[0.08em] text-[0.75rem] rounded-[4px] border-[3px] border-transparent bg-transparent text-[var(--text)] hover:border-[var(--border)] hover:shadow-[3px_3px_0px_var(--border)] hover:bg-[var(--card-bg)] transition-all flex items-center justify-center min-h-[44px] cursor-pointer disabled:opacity-50",

    formWrap: "grid grid-cols-1 md:grid-cols-2 gap-6 mt-8",
    formCard: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] relative bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    formHeader: "p-3 px-4 border-b-[3px] border-[var(--border)] font-black uppercase tracking-[-0.02em] text-[0.9rem] bg-[var(--bg)]",
    formBody: "p-6 flex flex-col gap-5 bg-[var(--card-bg)]",
    formRow: "flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-[0.82rem] outline-none bg-[var(--bg)] transition-transform focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_var(--border)] focus:bg-[var(--card-bg)]",
    select: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-[0.82rem] outline-none appearance-none bg-[var(--bg)] transition-transform focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_var(--border)] focus:bg-[var(--card-bg)]",
    textarea: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-[0.82rem] outline-none resize-y min-h-[140px] bg-[var(--bg)] transition-transform focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_var(--border)] focus:bg-[var(--card-bg)]",
    
    spinner: "w-4 h-4 border-[3px] border-t-transparent rounded-full animate-spin",
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        html { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes drift-spin-1 { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } 100% { transform: translateY(0) rotate(360deg); } }
        @keyframes drift-spin-2 { 0% { transform: translateX(0) scale(1); } 50% { transform: translateX(20px) scale(1.1); } 100% { transform: translateX(0) scale(1); } }
        @keyframes drift-pulse { 0% { opacity: 0.15; } 50% { opacity: 0.3; } 100% { opacity: 0.15; } }
      `}</style>
      
      <div className={c.ambient}>
        {/* Abstract floating items */}
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full border-[3px] border-[var(--border)] bg-[var(--red)] opacity-20" style={{ animation: 'drift-spin-1 8s ease-in-out infinite' }}></div>
        <div className="absolute top-[30%] right-[10%] w-8 h-8 border-[3px] border-[var(--border)] bg-[var(--yellow)] opacity-30 rotate-45" style={{ animation: 'drift-spin-2 10s linear infinite' }}></div>
        <div className="absolute bottom-[20%] left-[20%] w-16 h-16 rounded-[4px] border-[3px] border-[var(--border)] bg-[var(--blue)] opacity-15" style={{ animation: 'drift-pulse 6s ease-in-out infinite' }}></div>
        <div className="absolute bottom-[10%] right-[25%] w-10 h-10 rounded-full border-[3px] border-[var(--border)] bg-[var(--green)] opacity-20" style={{ animation: 'drift-spin-1 12s ease-in-out infinite alternate' }}></div>
      </div>

      <main className={c.container}>
        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className={`${c.navLogoBox} bg-[var(--red)]`} />
            <div className={`${c.navLogoBox} bg-[var(--yellow)]`} />
            <div className={`${c.navLogoBox} bg-[var(--green)]`} />
            <span className={c.navText}>Briefing Book</span>
          </div>
          <div className={c.navActions}>
            <span className={`${c.navPill} ${draftSettings.status === 'delivered' ? 'bg-[var(--green)] text-[var(--card-bg)]' : ''}`}>
              {draftSettings.status === "delivered" ? "Deployed" : "Draft View"}
            </span>
          </div>
        </header>

        <section className={c.hero}>
          <div className={c.heroAccentWrap}>
            <div className={`${c.heroAccent} bg-[var(--red)]`} />
            <div className={`${c.heroAccent} bg-[var(--yellow)]`} />
            <div className={`${c.heroAccent} bg-[var(--green)]`} />
            <div className={`${c.heroAccent} bg-[var(--blue)]`} />
          </div>
          <div className={c.heroTitleWrap}>
            <h1 className={c.heroTitle}>Weekly Dossier</h1>
            <h1 className={c.heroTitleShadow} aria-hidden="true">Weekly Dossier</h1>
          </div>
          <div className={c.heroMeta}>
            <span>Status: {draftSettings.status}</span>
            <span>Items: {exhibits.length}</span>
          </div>
        </section>

        <section className={c.mainGrid}>
          {exhibits.length === 0 && (
            <div className="p-8 border-[3px] border-[var(--border)] border-dashed rounded-[4px] text-center font-mono text-[var(--muted)] text-[0.8rem]">
              No exhibits appended yet. Add one below.
            </div>
          )}
          {exhibits.map((item, idx) => (
            <article key={item._id} className={c.exhibitCard}>
              <div className={`${c.exhibitHeader} 
                ${idx % 4 === 0 ? 'bg-[var(--red)] text-white' : ''}
                ${idx % 4 === 1 ? 'bg-[var(--yellow)] text-[var(--text)]' : ''}
                ${idx % 4 === 2 ? 'bg-[var(--blue)] text-white' : ''}
                ${idx % 4 === 3 ? 'bg-[var(--green)] text-[var(--text)]' : ''}
              `}>
                <div className={c.exhibitLabelWrap}>
                  <span className={c.exhibitNumber}>EXHIBIT {String(idx + 1).padStart(2, '0')}</span>
                  <span className={c.exhibitTitle}>{item.category}</span>
                </div>
                <div className="flex items-center gap-3 w-full justify-between mt-1 md:mt-0 md:w-auto">
                    <h3 className={`${c.exhibitTitle} flex-1 text-right mr-3`}>{item.title}</h3>
                    {draftSettings.status !== "delivered" && (
                      <button onClick={() => database.del(item._id)} aria-label="Delete" className="w-6 h-6 border-[2px] border-current rounded flex items-center justify-center opacity-70 hover:opacity-100 hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                </div>
              </div>
              <div className={c.exhibitBody}>
                {item.body}
              </div>
            </article>
          ))}
        </section>

        <section className={c.actionsCard}>
          <button onClick={handleDeliver} disabled={isDelivering} className={c.btnPrimary}>
             {isDelivering ? <div className={c.spinner} /> : (draftSettings.status === 'delivered' ? 'Revert to Draft' : 'Deliver Briefing')}
          </button>
          <button className={c.btnGhost} onClick={() => { exhibits.forEach(e => database.del(e._id)); setSettings({status: 'draft'}); }}>
            Clear & Reset
          </button>
        </section>

        {draftSettings.status !== "delivered" && (
         <section className={c.formWrap}>
          <form onSubmit={handleSubmit} className={c.formCard}>
            <div className={c.formHeader}>Append Exhibit</div>
            <div className={c.formBody}>
              
              <div className={c.formRow}>
                <label className={c.label}>Category</label>
                <select className={c.select} value={newExhibit.category} onChange={e => mergeExhibit({ category: e.target.value })}>
                  <option value="SCHEDULE">SCHEDULE</option>
                  <option value="DECISIONS">DECISIONS</option>
                  <option value="TRAVEL">TRAVEL</option>
                  <option value="FOLLOW-UPS">FOLLOW-UPS</option>
                  <option value="NEWS">NEWS</option>
                </select>
              </div>

              <div className={c.formRow}>
                <label className={c.label}>Title</label>
                <input type="text" className={c.input} value={newExhibit.title} onChange={e => mergeExhibit({ title: e.target.value })} placeholder="e.g. Flight Intel" required />
              </div>

              <div className={c.formRow}>
                <label className={c.label}>Exhibit Content (Notes)</label>
                <textarea className={c.textarea} value={newExhibit.body} onChange={e => mergeExhibit({ body: e.target.value })} placeholder="- Departure 0800&#10;- Arrival 1130 LHR" />
              </div>

              <div className="flex gap-4 mt-2">
                <button type="submit" className={`flex-1 ${c.btnSecondary}`}>Save List</button>
                <button type="button" onClick={handleAISynth} disabled={isSynthLoading || !newExhibit.body.trim()} className={c.btnGhost}>
                  {isSynthLoading ? <div className={c.spinner} /> : "AI Synth"}
                </button>
              </div>
              
            </div>
          </form>

          <div className={c.formCard}>
            <div className={c.formHeader}>Quick Guidance</div>
            <div className={c.formBody}>
              <p className="font-mono text-[0.82rem] leading-relaxed">
                Add unformatted notes directly into the exhibit content. Use the [AI SYNTH] button to automatically clean up raw notes into professional bullet points formatted for executive consumption.
              </p>
            </div>
          </div>
         </section>
        )}

      </main>
    </div>
  )
}