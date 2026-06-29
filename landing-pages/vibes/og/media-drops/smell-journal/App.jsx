import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [activeFilter, setActiveFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  
  const { useLiveQuery, useDocument } = useFireproof("smell-journal");
  const { doc: newEntry, merge, submit } = useDocument({ 
    type: 'smell_entry', 
    date: Date.now(), 
    loc: '', 
    desc: '', 
    tag: 'NEUTRAL' 
  });

  const { docs: entries } = useLiveQuery("type", { key: 'smell_entry', descending: true });
  
  const mockEntries = [
    { _id: '1', date: Date.now() - 100000, loc: 'SUBWAY STATION', desc: 'Ozone, hot metal, and stale pretzel breath.', tag: 'OFFENSIVE' },
    { _id: '2', date: Date.now() - 86400000, loc: 'CHILDHOOD HOME', desc: 'Pine needles and old dust baking in the sun.', tag: 'NOSTALGIC' },
    { _id: '3', date: Date.now() - 172800000, loc: 'CORNER BAKERY', desc: 'Intense buttery exhaust overriding my senses.', tag: 'DELICIOUS' }
  ];

  const tags = ["NOSTALGIC", "OFFENSIVE", "NEUTRAL", "DELICIOUS", "WEIRD"];

  const themeVars = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    :root {
      --bg: oklch(0.96 0.01 90);
      --card-bg: oklch(1.00 0 0);
      --text: oklch(0.15 0.02 280);
      --border: oklch(0.15 0.02 280);
      --muted: oklch(0.50 0.02 280);
      --red: oklch(0.55 0.24 28);
      --yellow: oklch(0.85 0.18 85);
      --green: oklch(0.62 0.19 145);
      --blue: oklch(0.52 0.18 255);
      --shadow: 4px 4px 0px var(--border);
      --shadow-sm: 3px 3px 0px var(--border);
    }
    body { font-family: 'Space Grotesk', sans-serif; background-color: var(--bg); color: var(--text); }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .brutal-shadow { box-shadow: var(--shadow); }
    .brutal-shadow-sm { box-shadow: var(--shadow-sm); }
    .brutal-hover-lift:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
    .brutal-active-press:active { transform: translate(2px, 2px); box-shadow: none !important; }
    .ambient-grid { background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 60px 60px; opacity: 0.04; }
  `;

  const c = {
    page: "min-h-screen w-full flex flex-col items-center overflow-x-hidden relative z-10",
    layout: "w-full max-w-[920px] mx-auto px-8 py-12 flex flex-col gap-12",
    
    ambientContainer: "fixed inset-0 pointer-events-none z-0",
    
    header: "flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-[3px] border-[var(--border)] bg-[var(--card-bg)] brutal-shadow rounded-[4px]",
    logoContainer: "flex gap-2 items-center",
    logoBox: "w-3 h-3 border-[3px] border-[var(--border)]",
    logoText: "font-bold text-xl uppercase tracking-widest text-[var(--text)]",
    navLink: "px-3 py-1 font-bold text-xs uppercase cursor-pointer rounded-[4px] bg-[var(--muted)] text-white brutal-shadow-sm",
    
    hero: "p-8 border-[3px] border-[var(--border)] rounded-[4px] relative flex flex-col gap-6 bg-[var(--card-bg)] brutal-shadow",
    heroAccent: "absolute top-0 left-0 right-0 h-[6px] flex border-b-[3px] border-[var(--border)] rounded-t-[4px] overflow-hidden",
    heroSeg1: "flex-1 bg-[var(--red)]", heroSeg2: "flex-1 bg-[var(--yellow)]", heroSeg3: "flex-1 bg-[var(--green)]", heroSeg4: "flex-1 bg-[var(--blue)]",
    heroTitleWrap: "relative mt-4",
    heroTitleMain: "text-5xl md:text-7xl font-black uppercase tracking-tighter text-[var(--text)] relative z-10",
    heroTitleSub: "absolute top-1 left-1 text-5xl md:text-7xl font-black uppercase tracking-tighter text-[var(--red)] opacity-50 z-0",
    
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-8 mt-2",
    inputGroup: "flex flex-col gap-4 relative",
    fieldLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-sm outline-none bg-[var(--bg)] focus:bg-[var(--card-bg)] brutal-hover-lift transition-all",
    textarea: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-mono text-sm min-h-[140px] outline-none bg-[var(--bg)] focus:bg-[var(--card-bg)] brutal-hover-lift transition-all resize-none",
    
    tagGrid: "flex flex-col gap-2",
    tagToggle: "flex items-center justify-between p-3 border-[3px] border-[var(--border)] rounded-[4px] cursor-pointer transition-all bg-[var(--bg)] brutal-hover-lift brutal-active-press",
    tagActive: "font-bold uppercase tracking-wider text-[var(--text)]",
    tagInactive: "font-medium uppercase tracking-wider text-[var(--muted)]",
    
    actionRow: "flex flex-col sm:flex-row gap-4 mt-6",
    btnPrimary: "flex-1 px-6 py-4 border-[3px] border-[var(--border)] rounded-[4px] font-bold uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2 bg-[var(--red)] text-white brutal-shadow brutal-hover-lift brutal-active-press disabled:opacity-50",
    btnAi: "px-6 py-4 border-[3px] border-[var(--border)] rounded-[4px] font-bold uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2 bg-[var(--yellow)] text-[var(--text)] brutal-shadow brutal-hover-lift brutal-active-press disabled:opacity-50 flex-shrink-0",
    
    ctrlBar: "flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full",
    searchWrap: "flex-1 relative w-full max-w-md border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] brutal-shadow-sm focus-within:brutal-hover-lift transition-all",
    searchInput: "w-full p-3 font-mono text-sm outline-none bg-transparent",
    filterRow: "flex flex-wrap gap-2",
    filterChip: "px-3 py-1 border-[3px] border-[var(--border)] rounded-[4px] text-[0.7rem] font-bold uppercase cursor-pointer bg-[var(--bg)] brutal-shadow-sm brutal-hover-lift brutal-active-press",
    
    catalogWrap: "flex flex-col gap-6 w-full",
    catalogGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6",
    card: "flex flex-col border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] brutal-shadow brutal-hover-lift h-full",
    cardHeader: "p-2 border-b-[3px] border-[var(--border)] flex justify-between items-center",
    cardTagText: "font-sans text-[0.7rem] font-black uppercase tracking-widest",
    cardBody: "p-4 flex flex-col gap-4 flex-1",
    cardLoc: "font-mono text-[0.85rem] font-bold uppercase leading-tight text-[var(--text)]",
    cardDesc: "text-[0.85rem] leading-relaxed text-[var(--text)]",
    cardMeta: "text-[0.65rem] uppercase tracking-widest font-mono text-[var(--muted)] mt-auto pt-4 border-t-[3px] border-[var(--border)]",
  };

  function submitEntry(e) {
    e.preventDefault();
    if (!newEntry.loc || !newEntry.desc) return;
    submit();
    merge({ date: Date.now(), loc: '', desc: '', tag: 'NEUTRAL' });
  }

  async function handleSuggest() {
    setIsSuggesting(true);
    try {
      const res = await callAI("Generate a short, visceral smell log entry. Keep the description under two sentences. The location should be specific and punchy. Tag must be one of: NOSTALGIC, OFFENSIVE, NEUTRAL, DELICIOUS, WEIRD.", {
        schema: {
          properties: {
             loc: { type: "string" },
             desc: { type: "string" },
             tag: { type: "string" }
          }
        }
      });
      const data = JSON.parse(res);
      merge({ loc: data.loc, desc: data.desc, tag: data.tag });
    } finally {
      setIsSuggesting(false);
    }
  }

  const getTagColor = (tagStr) => {
    switch (tagStr) {
      case 'NOSTALGIC': return 'var(--yellow)';
      case 'OFFENSIVE': return 'var(--red)';
      case 'DELICIOUS': return 'var(--green)';
      case 'NEUTRAL': return 'var(--blue)';
      case 'WEIRD': return 'var(--text)';
      default: return 'var(--bg)';
    }
  };
  
  const getTagTextColors = (tagStr) => {
    return tagStr === 'WEIRD' || tagStr === 'OFFENSIVE' || tagStr === 'NEUTRAL' ? 'var(--card-bg)' : 'var(--text)';
  };

  return (
    <div className={c.page}>
      <style>{themeVars}</style>
      <div className={`${c.ambientContainer} ambient-grid`}></div>

      <main className={c.layout} id="app">
        
        <header id="app-header" className={c.header}>
          <div className={c.logoContainer}>
            <div className={`${c.logoBox} bg-[var(--red)]`} />
            <div className={`${c.logoBox} bg-[var(--yellow)]`} />
            <div className={`${c.logoBox} bg-[var(--green)]`} />
            <div className={c.logoText}>SCENT LOG</div>
          </div>
          <div className={c.navLink}>v1.0.4</div>
        </header>

        <section id="hero" className={c.hero}>
          <div className={c.heroAccent}>
            <div className={c.heroSeg1} />
            <div className={c.heroSeg2} />
            <div className={c.heroSeg3} />
            <div className={c.heroSeg4} />
          </div>

          <div className={c.heroTitleWrap}>
            <h1 className={c.heroTitleSub} aria-hidden="true">LOG A NEW SMELL</h1>
            <h1 className={c.heroTitleMain}>LOG A NEW SMELL</h1>
          </div>

          <form onSubmit={submitEntry} className={c.formGrid}>
            <div className={c.inputGroup}>
              <div>
                <label className={c.fieldLabel}>LOCATION</label>
                <input type="text" value={newEntry.loc} onChange={(e) => merge({loc: e.target.value})} placeholder="E.g. The 7 train..." className={c.input} />
              </div>
              <div>
                <label className={c.fieldLabel}>DESCRIPTION</label>
                <textarea value={newEntry.desc} onChange={(e) => merge({desc: e.target.value})} placeholder="Write exactly what it smelled like..." className={c.textarea}></textarea>
              </div>
            </div>

            <div className={c.tagGrid}>
              <label className={c.fieldLabel}>VIBE CLASSIFICATION</label>
              {tags.map(t => {
                const isActive = newEntry.tag === t;
                return (
                  <div key={t} onClick={() => merge({tag: t})} className={`${c.tagToggle} ${isActive ? 'brutal-shadow-sm' : ''}`} style={{ backgroundColor: isActive ? getTagColor(t) : 'var(--bg)', color: isActive ? getTagTextColors(t) : 'var(--text)'}}>
                    <span className={isActive ? c.tagActive : c.tagInactive}>{t}</span>
                    <div className="w-5 h-5 border-[3px] border-current rounded-[4px] relative" style={{ backgroundColor: isActive ? 'currentColor' : 'transparent'}}></div>
                  </div>
                )
              })}
            </div>
            
            <div className={`col-span-1 md:col-span-2 ${c.actionRow}`}>
              <button type="submit" className={c.btnPrimary}>SAVE LOG ENTRY</button>
              <button type="button" onClick={handleSuggest} disabled={isSuggesting} className={c.btnAi}>
                {isSuggesting ? (
                  <svg className="animate-spin" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <circle cx="12" cy="12" r="10" strokeDasharray="30 10"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                )}
                {isSuggesting ? 'SNIFFING...' : 'SUGGEST'}
              </button>
            </div>
          </form>
        </section>

        <section id="catalog-controls" className={c.ctrlBar}>
          <div className={c.filterRow}>
            <div onClick={() => setActiveFilter('ALL')} className={c.filterChip} style={{ backgroundColor: activeFilter === 'ALL' ? 'var(--text)' : 'var(--bg)', color: activeFilter === 'ALL' ? 'var(--card-bg)' : 'var(--text)'}}>ALL</div>
            {tags.map(t => (
                <div key={t} onClick={() => setActiveFilter(t)} className={c.filterChip} style={{ backgroundColor: activeFilter === t ? getTagColor(t) : 'var(--bg)', color: activeFilter === t ? getTagTextColors(t) : 'var(--text)'}}>{t}</div>
            ))}
          </div>
          <div className={c.searchWrap}>
            <input type="text" placeholder="Search logs..." className={c.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </section>

        <section id="catalog" className={c.catalogWrap}>
          <div className={c.catalogGrid}>
             {(entries.length > 0 ? entries : mockEntries)
                .filter(e => activeFilter === 'ALL' || e.tag === activeFilter)
                .filter(e => search.trim() === '' || e.desc.toLowerCase().includes(search.toLowerCase()) || e.loc.toLowerCase().includes(search.toLowerCase()))
                .map(entry => (
                <div key={entry._id} className={c.card}>
                  <div className={c.cardHeader} style={{ backgroundColor: getTagColor(entry.tag), color: getTagTextColors(entry.tag) }}>
                    <span className={c.cardTagText}>{entry.tag}</span>
                    <div className="w-3 h-3 border-[3px] border-current rounded-sm bg-transparent" />
                  </div>
                  <div className={c.cardBody}>
                    <div className={c.cardLoc}>{entry.loc}</div>
                    <div className={c.cardDesc}>{entry.desc}</div>
                    <div className={c.cardMeta}>{new Date(entry.date).toLocaleString()}</div>
                  </div>
                </div>
             ))}
          </div>
        </section>

      </main>
    </div>
  )
}