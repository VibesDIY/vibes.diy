import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

import { useState } from "react";

export default function App() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { useLiveQuery, useDocument, database } = useFireproof("lexicon-forge");
  
  const { doc: newTerm, merge: mergeTerm, submit: submitTerm } = useDocument({
    _type: "term",
    gibberish: "",
    meaning: ""
  });

  const { docs: dictionary } = useLiveQuery("_type", {
    key: "term",
    descending: true
  });

  const translateText = (rawVal) => {
    let out = rawVal;
    if (dictionary.length > 0 && rawVal.trim()) {
      const sorted = [...dictionary].sort((a,b) => (b.gibberish?.length || 0) - (a.gibberish?.length || 0));
      sorted.forEach(t => {
        if (!t.gibberish || !t.meaning) return;
        const reg = new RegExp(`\\b${t.gibberish}\\b`, 'gi');
        out = out.replace(reg, match => {
          const isCaps = match === match.toUpperCase() && match.length > 1;
          const isTitle = match[0] === match[0].toUpperCase() && match.length > 1;
          if (isCaps) return t.meaning.toUpperCase();
          if (isTitle) return t.meaning.charAt(0).toUpperCase() + t.meaning.slice(1);
          return t.meaning;
        });
      });
    }
    setOutputText(out);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setInputText(val);
    translateText(val);
  }

  const generateTerms = async () => {
    setIsGenerating(true);
    try {
      const res = await callAI("Generate 3 funny, weird, realistic inside-joke 'gibberish' words a couple might use for mundane things (like being hungry, a fuzzy blanket, going to sleep, etc). Return JSON with an array of objects having 'gibberish' and 'meaning'.", {
        schema: {
          properties: {
            terms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  gibberish: { type: "string" },
                  meaning: { type: "string" }
                }
              }
            }
          }
        }
      });
      const data = JSON.parse(res);
      for (const t of data.terms) {
        if(t.gibberish && t.meaning) {
          await database.put({ _type: "term", gibberish: t.gibberish.toLowerCase(), meaning: t.meaning.toLowerCase() });
        }
      }
      // Re-trigger translation if there is text
      if (inputText) setTimeout(() => translateText(inputText), 200);
      
    } catch(e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const c = {
    appWrapper: "w-full min-h-screen relative flex justify-center bg-[var(--bg)] text-[var(--text)]",
    contentCol: "w-full max-w-[920px] px-6 py-12 flex flex-col z-10 relative gap-10",
    
    nav: "w-full flex justify-between items-center p-3 px-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal",
    navLogo: "flex items-center gap-3",
    navBrand: "font-black text-lg tracking-tight uppercase",
    navSquares: "flex gap-0.5",
    navSquare: "w-3 h-3 border-[2px] border-[var(--border)]",
    navLinks: "flex gap-3",
    navPill: "px-3 py-1 text-[0.7rem] uppercase tracking-widest font-bold border-[2px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-sm-brutal cursor-pointer",

    hero: "w-full p-8 md:p-12 flex flex-col gap-4 relative bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal overflow-hidden",
    heroAccentWrap: "w-full h-[6px] flex absolute top-0 left-0 border-b-[3px] border-[var(--border)]",
    heroAccent1: "w-1/4 h-full bg-[var(--red)]",
    heroAccent2: "w-1/4 h-full bg-[var(--yellow)]",
    heroAccent3: "w-1/4 h-full bg-[var(--green)]",
    heroAccent4: "w-1/4 h-full bg-[var(--blue)]",
    heroTitle: "text-4xl md:text-6xl font-black relative leading-none uppercase tracking-[-0.02em]",
    heroTitleShadow: "absolute top-0 left-0 text-4xl md:text-6xl font-black leading-none uppercase tracking-[-0.02em] text-[var(--red)] opacity-50 translate-x-[5px] translate-y-[5px]",
    heroSub: "text-lg font-medium max-w-xl mt-2 leading-relaxed text-[var(--text)]",

    editorGrid: "w-full flex flex-col md:flex-row gap-8",
    pane: "w-full flex flex-col",
    paneHeader: "flex justify-between items-center pb-2 px-1 border-b-[3px] border-[var(--border)] mb-4",
    paneTitle: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    textArea: "w-full min-h-[200px] p-4 font-mono text-base resize-none bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] transition-transform",
    
    controlsGrid: "w-full grid grid-cols-1 md:grid-cols-2 gap-8",
    formCard: "w-full flex flex-col p-6 gap-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal",
    formTitle: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-3",
    formRow: "flex flex-col gap-2",
    label: "text-[0.7rem] font-bold uppercase tracking-[0.05em]",
    input: "w-full px-3 py-3 text-sm font-mono bg-white border-[3px] border-[var(--border)] rounded-[4px] shadow-sm-brutal focus:outline-none focus:-translate-y-[2px] transition-transform",
    btnRow: "flex flex-wrap gap-4 mt-6",
    btnPrimary: "px-5 py-3 text-[0.8rem] text-white bg-[var(--red)] font-black uppercase tracking-[0.08em] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    btnGhost: "px-5 py-3 text-[0.8rem] text-[var(--text)] bg-[var(--card-bg)] font-black uppercase tracking-[0.08em] border-[3px] border-[var(--border)] rounded-[4px] hover:shadow-sm-brutal cursor-pointer disabled:opacity-50",
    
    dictCard: "w-full flex flex-col bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-brutal overflow-hidden",
    table: "w-full text-left border-collapse relative",
    th: "py-3 px-4 text-[0.6rem] uppercase tracking-[0.15em] font-black border-b-[3px] border-[var(--border)] bg-[var(--blue)] text-white top-0 sticky",
    td: "py-3 px-4 text-[0.82rem] font-bold border-b-[2px] border-[var(--border)]",
    tdMono: "py-3 px-4 text-[0.82rem] font-mono border-b-[2px] border-[var(--border)] bg-[var(--bg)]",
    iconBtn: "p-2 hover:bg-[var(--red)] hover:text-white rounded-[4px] transition-colors cursor-pointer text-[var(--muted)]"
  };

  return (
    <div className={c.appWrapper} style={{
      '--bg': 'oklch(0.96 0.01 90)',
      '--card-bg': 'oklch(1.00 0 0)',
      '--text': 'oklch(0.15 0.02 280)',
      '--border': 'oklch(0.15 0.02 280)',
      '--muted': 'oklch(0.50 0.02 280)',
      '--red': 'oklch(0.55 0.24 28)',
      '--yellow': 'oklch(0.85 0.18 85)',
      '--green': 'oklch(0.62 0.19 145)',
      '--blue': 'oklch(0.52 0.18 255)',
    }}>
      <style>{`
        body { font-family: 'Space Grotesk', sans-serif; background-color: var(--bg); color: var(--text); }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .shadow-brutal { box-shadow: 4px 4px 0px var(--border); }
        .shadow-brutal:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); transition: all 0.15s ease; }
        .shadow-brutal:active { transform: translate(2px, 2px); box-shadow: none; transition: all 0.15s ease; }
        .shadow-sm-brutal { box-shadow: 3px 3px 0px var(--border); }
        .bg-grid { background-image: linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px); background-size: 60px 60px; }
      `}</style>
      <div className="fixed inset-0 bg-grid z-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-12 h-12 bg-[var(--red)] opacity-20 rotate-12 border-[3px] border-[var(--border)] rounded-full"></div>
        <div className="absolute bottom-40 right-10 w-16 h-16 bg-[var(--blue)] opacity-15 rotate-45 border-[3px] border-[var(--border)]"></div>
        <div className="absolute top-1/2 right-[5%] w-8 h-8 bg-[var(--green)] opacity-20 rounded-full border-[3px] border-[var(--border)]"></div>
      </div>
      <main className={c.contentCol}>
        
        <header className={c.nav}>
          <div className={c.navLogo}>
            <div className={c.navSquares}>
              <div className={`${c.navSquare} bg-[var(--red)]`}></div>
              <div className={`${c.navSquare} bg-[var(--yellow)]`}></div>
              <div className={`${c.navSquare} bg-[var(--green)]`}></div>
            </div>
            <span className={c.navBrand}>LEXICON FORGE</span>
          </div>
          <div className={c.navLinks}>
            <button className={c.navPill}>TRANSLATE</button>
            <button className={c.navPill}>DATABASE</button>
          </div>
        </header>

        <section className={c.hero}>
          <div className={c.heroAccentWrap}>
            <div className={c.heroAccent1}></div>
            <div className={c.heroAccent2}></div>
            <div className={c.heroAccent3}></div>
            <div className={c.heroAccent4}></div>
          </div>
          <div className="relative inline-block mt-4">
            <h1 className={c.heroTitleShadow} aria-hidden="true">Gibberish Translator</h1>
            <h1 className={c.heroTitle}>Gibberish Translator</h1>
          </div>
          <p className={c.heroSub}>Define your private dialect. The engine will instantly convert recognized structural anomalies into standard protocol language.</p>
        </section>

        <section className={c.editorGrid}>
          <div className={c.pane}>
            <div className={c.paneHeader}>
              <span className={c.paneTitle}>Input: Anomaly</span>
            </div>
            <textarea 
              className={`${c.textArea} focus:border-[var(--green)] shadow-brutal`}
              placeholder="Paste or type raw gibberish here..."
              value={inputText}
              onChange={handleInput}
            ></textarea>
          </div>
          
          <div className={c.pane}>
            <div className={c.paneHeader}>
              <span className={c.paneTitle}>Output: Standard</span>
            </div>
            <textarea 
              className={`${c.textArea} border-[var(--blue)] bg-[var(--yellow)] bg-opacity-10 focus:border-[var(--border)]`}
              readOnly
              placeholder="Awaiting input..."
              value={outputText}
            ></textarea>
          </div>
        </section>

        <section className={c.controlsGrid}>
          
          <div className={c.formCard}>
            <h2 className={c.formTitle}>Define Custom Anomaly</h2>
            <form onSubmit={(e) => { e.preventDefault(); submitTerm(); setInputText(inputText); }}>
              <div className={c.formRow}>
                <label className={c.label}>Gibberish Term</label>
                <input 
                  type="text" 
                  className={c.input} 
                  placeholder="e.g. blorpo" 
                  value={newTerm.gibberish}
                  onChange={(e) => mergeTerm({ gibberish: e.target.value.toLowerCase() })}
                  required
                />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Standard Translation</label>
                <input 
                  type="text" 
                  className={c.input} 
                  placeholder="e.g. hungry" 
                  value={newTerm.meaning}
                  onChange={(e) => mergeTerm({ meaning: e.target.value.toLowerCase() })}
                  required
                />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Save Definition</button>
                <button type="button" onClick={generateTerms} disabled={isGenerating} className={c.btnGhost}>
                  {isGenerating ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--text)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"></path><path d="m14 7 3 3"></path><path d="M5 6v4"></path><path d="M19 14v4"></path><path d="M10 2v2"></path><path d="M7 8H3"></path><path d="M21 16h-4"></path><path d="M11 3H9"></path></svg>}
                  {isGenerating ? 'Forging...' : 'Auto-Generate'}
                </button>
              </div>
            </form>
          </div>

          <div className={c.dictCard}>
            <div className="flex justify-between items-center px-5 py-4 bg-[var(--card-bg)] border-b-[3px] border-[var(--border)]">
              <h2 className={c.formTitle} style={{marginBottom: 0, fontSize: '0.75rem'}}>Active Lexicon</h2>
              <span className="text-[0.65rem] font-mono font-bold bg-[var(--yellow)] px-2 py-1 rounded-[4px] border-[2px] border-[var(--border)] shadow-sm-brutal block">STATUS: ONLINE</span>
            </div>
            <div className="overflow-x-auto">
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Term</th>
                    <th className={c.th}>Meaning</th>
                    <th className={c.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {dictionary.length === 0 ? (
                    <tr><td colSpan="3" className="py-8 text-center text-[var(--muted)] font-mono text-sm">NO ANOMALIES LOGGED YET</td></tr>
                  ) : (
                    dictionary.map((entry) => (
                      <tr key={entry._id} className="hover:bg-[var(--yellow)] transition-colors group">
                        <td className={`${c.tdMono} group-hover:bg-transparent transition-colors`}>{entry.gibberish}</td>
                        <td className={c.td}>{entry.meaning}</td>
                        <td className={`${c.td} w-10`} style={{paddingRight: '6px', paddingLeft: '6px'}}>
                          <button type="button" onClick={() => database.del(entry._id)} className={c.iconBtn}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </section>
      </main>
    </div>
  );
}