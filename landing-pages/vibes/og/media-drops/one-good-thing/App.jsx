import React, { useState, useEffect } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const { useDocument, useLiveQuery } = useFireproof("one-good-thing-v1");
  const { doc, merge, submit } = useDocument({ 
    type: "entry", 
    author: "", 
    text: "",
    dateKey: "" 
  });

  useEffect(() => {
    const d = new Date();
    setCurrentDateStr(d.toISOString().split("T")[0]);
  }, []);

  function handleSuggest(e) {
    e.preventDefault();
  }

  function handleSubmit(e) {
    e.preventDefault();
  }

  const c = {
    page: "min-h-screen w-full flex flex-col items-center px-4 py-[3rem] relative overflow-hidden bg-[oklch(0.92_0.01_65)] text-[oklch(0.15_0.02_50)] font-['Inter',sans-serif]",
    ambient: "hidden",
    content: "w-full max-w-[920px] flex flex-col gap-12 z-10 relative",
    
    navCard: "flex items-center justify-between pb-4 border-b border-[oklch(0.20_0.02_50)]",
    logoGroup: "flex items-center gap-3 font-['Playfair_Display',serif] font-bold text-2xl tracking-tight text-[oklch(0.15_0.02_50)]",
    logoSquares: "hidden",
    logoSq1: "hidden",
    logoSq2: "hidden",
    logoSq3: "hidden",
    navLink: "uppercase text-[0.65rem] tracking-[0.12em] text-[oklch(0.55_0.02_50)] hover:text-[oklch(0.15_0.02_50)] transition-colors",
    
    heroCard: "flex flex-col relative py-[2rem] overflow-hidden",
    heroAccent: "hidden",
    heroSeg1: "",
    heroSeg2: "",
    heroSeg3: "",
    heroSeg4: "",
    heroLabel: "text-[0.65rem] uppercase tracking-[0.12em] mb-4 text-[oklch(0.55_0.02_50)] block font-medium",
    heroTitle: "text-5xl md:text-6xl font-['Playfair_Display',serif] font-bold leading-tight mb-4 text-[oklch(0.15_0.02_50)]",
    heroSub: "text-base text-[oklch(0.55_0.02_50)] max-w-lg",

    gridCols: "grid grid-cols-1 md:grid-cols-2 gap-12 items-start",
    formCard: "flex flex-col bg-[oklch(0.95_0.01_70)] p-6 md:p-8",
    formHeader: "pb-4 mb-4 border-b border-[oklch(0.20_0.02_50)] font-['Playfair_Display',serif] font-bold text-lg",
    formBody: "flex flex-col gap-6",
    formGroup: "flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.55_0.02_50)]",
    input: "w-full py-2 bg-transparent border-b border-[oklch(0.20_0.02_50)] font-['Inter',sans-serif] text-base outline-none focus:border-[oklch(0.15_0.02_50)] transition-colors rounded-none text-[oklch(0.15_0.02_50)] placeholder-[oklch(0.70_0.02_50)]",
    textarea: "w-full min-h-[80px] py-2 bg-transparent border-b border-[oklch(0.20_0.02_50)] font-['Inter',sans-serif] text-base resize-none outline-none focus:border-[oklch(0.15_0.02_50)] transition-colors rounded-none text-[oklch(0.15_0.02_50)] placeholder-[oklch(0.70_0.02_50)]",
    actionRow: "flex gap-4 pt-4",
    btnPrimary: "flex-1 py-3 px-4 bg-[oklch(0.35_0.04_50)] text-[oklch(0.95_0.01_70)] font-bold uppercase text-[0.65rem] tracking-[0.12em] hover:bg-[oklch(0.25_0.03_50)] transition-colors disabled:opacity-50 flex justify-center items-center gap-2",
    btnSuggest: "px-4 border border-[oklch(0.20_0.02_50)] text-[oklch(0.35_0.04_50)] hover:bg-[oklch(0.20_0.02_50)] hover:text-[oklch(0.95_0.01_70)] transition-colors flex justify-center items-center disabled:opacity-50",

    catalogSection: "flex flex-col gap-6 pt-2",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.55_0.02_50)] pb-4 border-b border-[oklch(0.20_0.02_50)]",
    entryList: "grid grid-cols-1 gap-8",
    entryCard: "flex flex-col gap-3 pb-8 border-b border-[oklch(0.20_0.02_50)] last:border-0",
    entryTop: "flex justify-between items-center",
    entryAuthor: "font-['Inter',sans-serif] text-[0.75rem] uppercase tracking-[0.1em]",
    entryTime: "text-[0.7rem] text-[oklch(0.55_0.02_50)]",
    entryText: "font-['Playfair_Display',serif] italic text-2xl leading-snug",
  };

  return (
    <div className={c.page}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,700;1,700&display=optional');
      `}</style>

      <main className={c.content}>
        
        {/* NAV */}
        <header className={c.navCard}>
          <div className={c.logoGroup}>
            <div className={c.logoSquares}>
              <div className={c.logoSq1}></div>
              <div className={c.logoSq2}></div>
              <div className={c.logoSq3}></div>
            </div>
            <span>One Good Thing</span>
          </div>
          <button className={c.navLink}>Archive</button>
        </header>

        {/* HERO */}
        <section className={c.heroCard}>
          <div className={c.heroAccent}>
            <div className={c.heroSeg1}></div>
            <div className={c.heroSeg2}></div>
            <div className={c.heroSeg3}></div>
            <div className={c.heroSeg4}></div>
          </div>
          <span className={c.heroLabel}>Current Exhibition</span>
          <h1 className={c.heroTitle}>The Daily Archive</h1>
          <p className={c.heroSub}>Contribute one noteworthy detail from your day before the stroke of midnight closes the page.</p>
        </section>

        {/* MAIN GRID */}
        <div className={c.gridCols}>
          
          {/* INPUT FORM */}
          <form className={c.formCard} onSubmit={handleSubmit}>
            <div className={c.formHeader}>New Entry</div>
            <div className={c.formBody}>
              <div className={c.formGroup}>
                <label className={c.label}>Member Name</label>
                <input 
                  className={c.input} 
                  type="text" 
                  placeholder="Your Name" 
                  value={doc.author}
                  onChange={(e) => merge({ author: e.target.value })}
                />
              </div>
              <div className={c.formGroup}>
                <label className={c.label}>The Good Thing</label>
                <textarea 
                  className={c.textarea} 
                  placeholder="What went well today?"
                  value={doc.text}
                  onChange={(e) => merge({ text: e.target.value })}
                ></textarea>
              </div>
              <div className={c.actionRow}>
                <button type="button" className={c.btnSuggest} onClick={handleSuggest} disabled={isSuggesting}>
                  {isSuggesting ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  )}
                </button>
                <button type="submit" className={c.btnPrimary}>
                  Submit Entry
                </button>
              </div>
            </div>
          </form>

          {/* TODAY'S CATALOG */}
          <div className={c.catalogSection}>
            <h2 className={c.sectionLabel}>Catalog &mdash; {currentDateStr}</h2>
            <div className={c.entryList}>
              {todayEntries.length === 0 ? (
                <div className="text-[oklch(0.55_0.02_50)] italic text-sm py-4">
                  No entries recorded today.
                </div>
              ) : (
                todayEntries.map((entry) => (
                  <div key={entry._id} className={c.entryCard}>
                    <div className={c.entryTop}>
                      <span className={c.entryAuthor}>{entry.author}</span>
                      <span className={c.entryTime}>{entry.timeDisplay}</span>
                    </div>
                    <div className={c.entryText}>&ldquo;{entry.text}&rdquo;</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}