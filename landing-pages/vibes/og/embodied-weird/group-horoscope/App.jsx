import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("astro-mutator");
  const [basePrompt, setBasePrompt] = React.useState(null);
  const [activeParent, setActiveParent] = React.useState(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const { docs: prompts } = useLiveQuery("type", { key: "prompt", descending: true, limit: 1 });
  const { docs: remixes } = useLiveQuery("type", { key: "remix", descending: true });

  const handleSuggest = async () => {
    if (!activeParent) return;
    setIsSuggesting(true);
    try {
      const prompt = `Rewrite this sentence, changing only one or two words to radically shift the meaning, make it funny or darker: "${activeParent.text}"`;
      const res = await callAI(prompt, {
        schema: { properties: { mutation: { type: "string" } } }
      });
      const data = JSON.parse(res);
      setDraft(data.mutation);
    } catch(err) {
      console.error(err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft.trim() || !activeParent) return;
    await database.put({
      type: "remix",
      text: draft.trim(),
      parentId: activeParent._id,
      promptId: basePrompt?._id,
      votes: 1,
      createdAt: Date.now()
    });
    setDraft("");
  };

  const handleGenerateSeed = async () => {
    setIsGenerating(true);
    try {
      const res = await callAI("Generate a single sentence horoscope that is slightly absurd but ominous. No intro, no emojis.", {
        schema: { properties: { prophecy: { type: "string" } } }
      });
      const data = JSON.parse(res);
      await database.put({ type: "prompt", text: data.prophecy, createdAt: Date.now() });
    } catch(err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (prompts.length > 0 && !basePrompt) {
      setBasePrompt(prompts[0]);
      if (!activeParent) setActiveParent(prompts[0]);
    }
  }, [prompts, basePrompt, activeParent]);

  React.useEffect(() => {
    if (!document.getElementById("neobrutalist-theme")) {
      const style = document.createElement("style");
      style.id = "neobrutalist-theme";
      style.innerHTML = `
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
        }
        body { background-color: var(--bg); color: var(--text); }
        .float-block { animation: drift-spin 12s ease-in-out infinite alternate; }
        @keyframes drift-spin { 0% { transform: translate(0,0) rotate(0deg); } 100% { transform: translate(30px, 40px) rotate(45deg); } }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const upvote = async (doc) => {
    await database.put({ ...doc, votes: (doc.votes || 0) + 1 });
  };

  const Spinner = ({ size = 16 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="16" strokeLinecap="round" />
    </svg>
  );

  const c = {
    wrapper: "relative min-h-screen overflow-x-hidden font-[Space_Grotesk,sans-serif]",
    ambient: "fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(var(--text)_1px,transparent_1px),linear-gradient(90deg,var(--text)_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.04]",
    floatLayer: "fixed inset-0 pointer-events-none z-0 overflow-hidden",
    layout: "relative z-10 mx-auto max-w-[920px] px-8 py-12 flex flex-col gap-12",
    
    nav: "flex items-center justify-between p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)]",
    logoBox: "flex items-center gap-2",
    logoSquares: "flex gap-1",
    logoSquare: "w-3 h-3 border-[3px] border-[var(--border)]",
    brandText: "font-black uppercase tracking-[-0.02em] text-xl leading-none",
    navLinks: "flex gap-4",
    navLink: "px-4 py-2 border-[3px] border-[var(--border)] rounded-[4px] font-bold uppercase text-xs tracking-[0.05em] bg-[var(--card-bg)] shadow-[3px_3px_0_var(--border)] transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none cursor-pointer",

    hero: "p-8 md:p-12 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[8px_8px_0_var(--border)] relative flex flex-col items-center text-center gap-6 mt-8 overflow-hidden",
    heroBar: "absolute top-0 left-0 right-0 h-2 md:h-3 flex",
    heroBarSeg: "flex-1",
    heroTitle: "text-4xl md:text-[3.5rem] font-black uppercase tracking-[-0.02em] leading-tight relative z-10",
    heroTitleShadow: "absolute top-[5px] left-[5px] text-4xl md:text-[3.5rem] font-black uppercase tracking-[-0.02em] leading-tight text-[var(--red)] opacity-50 select-none",
    heroTitleMuted: "text-[0.65rem] font-bold uppercase tracking-[0.15em] mb-3 text-[var(--muted)]",
    heroActions: "flex gap-4",

    grid: "grid grid-cols-1 md:grid-cols-2 gap-8",
    card: "p-6 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)] flex flex-col gap-4",
    cardTitle: "text-[0.65rem] uppercase tracking-[0.15em] text-[var(--muted)] font-bold",
    
    inputGroup: "flex flex-col gap-2 relative",
    label: "text-[0.7rem] uppercase font-bold tracking-[0.05em] text-[var(--text)]",
    input: "w-full p-3 border-[3px] border-[var(--border)] rounded-[4px] font-[JetBrains_Mono,monospace] text-[0.85rem] bg-[var(--bg)] focus:bg-[var(--card-bg)] transition-all duration-150 outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0_var(--border)]",
    
    btnPrimary: "px-6 py-3 border-[3px] border-[var(--border)] rounded-[4px] font-black uppercase tracking-[0.05em] text-sm flex items-center justify-center gap-2 bg-[var(--red)] text-white shadow-[4px_4px_0_var(--border)] transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    btnSecondary: "px-6 py-3 border-[3px] border-[var(--border)] rounded-[4px] font-black uppercase tracking-[0.05em] text-sm flex items-center justify-center gap-2 bg-[var(--yellow)] text-[var(--text)] shadow-[3px_3px_0_var(--border)] transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "px-6 py-3 font-black uppercase tracking-[0.05em] text-sm flex items-center justify-center gap-2 bg-transparent text-[var(--text)] transition-transform duration-150 hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[3px_3px_0_var(--border)] cursor-pointer disabled:opacity-50",
    btnSmall: "px-3 py-1 border-[3px] border-[var(--border)] rounded-[4px] font-bold uppercase text-[0.65rem] bg-[var(--card-bg)] shadow-[2px_2px_0_var(--border)] transition-transform duration-150 hover:-translate-y-[2px] hover:-translate-x-[2px] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none cursor-pointer",

    feed: "flex flex-col gap-6",
    feedItem: "p-6 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)] flex flex-col gap-3 transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0_var(--border)]",
    feedContext: "text-[0.65rem] uppercase tracking-[0.15em] flex items-center gap-2 text-[var(--muted)]",
    feedText: "text-lg md:text-xl font-bold leading-relaxed tracking-[-0.01em]",
    feedActions: "flex items-center gap-4 mt-2 pt-4 border-t-[2px] border-dashed border-[var(--border)]",
    voteCount: "font-[JetBrains_Mono,monospace] font-bold text-lg min-w-[2rem] text-center",
  }

  return (
    <div className={c.wrapper}>
      <div className={c.ambient}></div>
      <div className={c.floatLayer}>
        <div className="float-block absolute top-10 left-10 w-12 h-12 rounded-full border-[3px] border-[var(--border)] bg-[var(--red)] opacity-20"></div>
        <div className="float-block absolute bottom-20 right-10 w-20 h-20 border-[3px] border-[var(--border)] bg-[var(--yellow)] opacity-20" style={{animationDelay: '-2s'}}></div>
        <div className="float-block absolute top-1/2 right-4 w-8 h-8 rounded-full border-[3px] border-[var(--border)] bg-[var(--blue)] opacity-30" style={{animationDelay: '-5s'}}></div>
        <div className="float-block absolute bottom-1/4 left-5 w-16 h-16 border-[3px] border-[var(--border)] bg-[var(--green)] opacity-20" style={{animationDelay: '-8s', rotate: '15deg'}}></div>
      </div>

      <main className={c.layout}>
        <nav className={c.nav}>
          <div className={c.logoBox}>
            <div className={c.logoSquares}>
              <div className={`${c.logoSquare} bg-[var(--red)]`}></div>
              <div className={`${c.logoSquare} bg-[var(--yellow)]`}></div>
              <div className={`${c.logoSquare} bg-[var(--green)]`}></div>
            </div>
            <span className={c.brandText}>Astro Mutator</span>
          </div>
          <div className={c.navLinks}>
            <button className={c.navLink}>Archive</button>
          </div>
        </nav>

        <header className={c.hero}>
          <div className={c.heroBar}>
            <div className={`${c.heroBarSeg} bg-[var(--red)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--yellow)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--green)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--blue)]`}></div>
          </div>
          {basePrompt ? (
            <>
              <div className="relative isolate">
                <div className={c.heroTitleMuted}>{new Date(basePrompt.createdAt).toLocaleDateString()} Oracle</div>
                <span aria-hidden="true" className={c.heroTitleShadow}>{basePrompt.text}</span>
                <h1 className={c.heroTitle}>{basePrompt.text}</h1>
              </div>
              <div className={c.heroActions}>
                <button className={c.btnPrimary} onClick={() => setActiveParent(basePrompt)}>Remix This</button>
              </div>
            </>
          ) : (
            <>
              <div className="relative isolate">
                <div className={c.heroTitleMuted}>Awaiting Signal</div>
                <h1 className={c.heroTitle}>The baseline is quiet.</h1>
              </div>
              <div className={c.heroActions}>
                <button className={c.btnSecondary} onClick={handleGenerateSeed} disabled={isGenerating}>
                  {isGenerating ? (
                    <><Spinner size={16} /> Tuning...</>
                  ) : "Generate Today's Seed"}
                </button>
              </div>
            </>
          )}
        </header>

        <div className={c.grid}>
          <section className={c.card}>
            <h2 className={c.cardTitle}>Forge Mutation</h2>
            <form className="flex flex-col gap-4">
              <div className={c.inputGroup}>
                <div className="flex justify-between items-center">
                  <label className={c.label}>Altering Subject</label>
                  <button type="button" className={c.btnSmall} onClick={() => setActiveParent(basePrompt)}>Reset Base</button>
                </div>
                <div className="p-3 border-[3px] border-[var(--border)] bg-[var(--bg)] rounded-[4px] text-[0.85rem] font-[JetBrains_Mono,monospace]">
                  {activeParent?.text || "No active signal."}
                </div>
              </div>
              <div className={c.inputGroup}>
                <div className="flex justify-between items-center">
                  <label className={c.label}>Your Twist</label>
                  <button type="button" className={c.btnSmall} onClick={handleSuggest} disabled={isSuggesting || !activeParent}>
                    {isSuggesting ? <Spinner size={12} /> : "AI Suggest"}
                  </button>
                </div>
                <textarea 
                  className={c.input} 
                  rows="3" 
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Change a word, flip the meaning..."
                ></textarea>
              </div>
              <button type="button" className={c.btnPrimary} onClick={handleSubmit} disabled={!draft.trim()}>Inject Mutation</button>
            </form>
          </section>

          <section className={c.card}>
            <h2 className={c.cardTitle}>Mutation Status</h2>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center p-2 border-b-[2px] border-[var(--border)]">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider">Active Vectors</span>
                <span className="font-[JetBrains_Mono,monospace] font-bold">{remixes.length.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between items-center p-2 border-b-[2px] border-[var(--border)]">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider">Total Mass</span>
                <span className="font-[JetBrains_Mono,monospace] font-bold text-[var(--red)]">{remixes.reduce((acc, r) => acc + (r.votes || 0), 0)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 border-[3px] border-[var(--border)] rounded-[4px] text-[0.65rem] font-bold uppercase bg-[var(--green)] text-[var(--text)] shadow-[2px_2px_0_var(--border)]">#wild</span>
              <span className="px-3 py-1 border-[3px] border-[var(--border)] rounded-[4px] text-[0.65rem] font-bold uppercase bg-[var(--yellow)] shadow-[2px_2px_0_var(--border)]">#doom</span>
              <span className="px-3 py-1 border-[3px] border-[var(--border)] rounded-[4px] text-[0.65rem] font-bold uppercase bg-[var(--blue)] text-white shadow-[2px_2px_0_var(--border)]">#money</span>
            </div>
          </section>
        </div>

        <section className={c.feed}>
          <h2 className={c.cardTitle}>Live Chain</h2>
          
          {remixes.length === 0 ? (
            <div className="p-8 text-center border-[3px] border-[var(--border)] border-dashed rounded-[4px] text-[var(--muted)] opacity-50 font-bold uppercase tracking-wider text-sm">
              No mutations detected in this timeline.
            </div>
          ) : remixes.map(doc => (
            <div key={doc._id} className={c.feedItem}>
              <div className={c.feedContext}>
                {doc.parentId === basePrompt?._id ? "Mutates Baseline" : "Mutates Sibling"}
              </div>
              <p className={c.feedText}>{doc.text}</p>
              <div className={c.feedActions}>
                <button className={c.btnSecondary} onClick={() => upvote(doc)}>Upvote</button>
                <span className={c.voteCount}>{doc.votes.toString().padStart(2, '0')}</span>
                <button className={c.btnSmall} onClick={() => { setActiveParent(doc); setDraft(""); window.scrollTo({ top: 400, behavior: 'smooth' }); }}>Remix This</button>
              </div>
            </div>
          ))}
        </section>

      </main>
    </div>
  )
}