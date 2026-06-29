import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif] text-[#1a1625]",
  header: "max-w-2xl mx-auto mb-6",
  title: "text-4xl font-bold uppercase tracking-tight",
  feature: "max-w-2xl mx-auto mb-5 p-5 bg-white border-[3px] border-[#1a1625] rounded-[4px] shadow-[4px_4px_0px_#1a1625]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] mb-3 text-[#6b6478]",
};

function Generator({ headline, setHeadline, onGenerate, onSuggest, isLoading, isSuggesting }) {
  return (
    <section id="generator" className={c.feature}>
      <h2 className={c.featureTitle}>Paste Headline Or Summary</h2>
      <textarea
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="e.g. VP of Synergy @ BigCorp | Thought Leader | Keynote Speaker | Dad"
        rows={4}
        className="w-full p-3 border-[3px] border-[#1a1625] rounded-[4px] font-mono text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1625] transition-all duration-150"
      />
      <div className="flex gap-3 mt-3 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={isLoading || !headline.trim()}
          className="px-5 py-2 bg-[#d94a3d] text-white border-[3px] border-[#1a1625] rounded-[4px] font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42 60" /></svg>
              Grovelling
            </span>
          ) : "Generate 5"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="px-4 py-2 bg-[#e8c547] text-[#1a1625] border-[3px] border-[#1a1625] rounded-[4px] font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 disabled:opacity-50"
        >
          {isSuggesting ? "..." : "Suggest Example"}
        </button>
      </div>
    </section>
  );
}

function Results({ lines, copiedIdx, onCopy }) {
  return (
    <section id="results" className={c.feature}>
      <h2 className={c.featureTitle}>Generated Openers</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-[#6b6478] italic font-mono">No openers yet. Paste a headline above and unleash the grovel.</p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line, i) => (
            <li key={i} className="p-3 border-[3px] border-[#1a1625] rounded-[4px] bg-[#f5f2e8] flex gap-3 items-start">
              <span className="font-mono font-bold text-xs bg-[#3d6fd9] text-white px-2 py-1 rounded-[4px] border-[2px] border-[#1a1625] shrink-0">0{i+1}</span>
              <p className="text-sm flex-1 leading-relaxed">{line}</p>
              <button
                onClick={() => onCopy(line, i)}
                className="px-3 py-1 bg-white border-[3px] border-[#1a1625] rounded-[4px] text-xs font-bold uppercase shadow-[2px_2px_0px_#1a1625] hover:bg-[#e8c547] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#1a1625] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-150 shrink-0"
              >
                {copiedIdx === i ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function History() {
  return (
    <section id="history" className={c.feature}>
      <h2 className={c.featureTitle}>Past Cringe</h2>
      {/* saved list lands here */}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("suck-up-gen");
  const { docs } = useLiveQuery("_id", { descending: true, limit: 50 });
  const [headline, setHeadline] = useState("");
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleGenerate = async () => {
    if (!headline.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Write 5 absurdly over-the-top, parody sycophantic LinkedIn connection request opening lines for someone whose headline/summary is: "${headline}". They should be so obviously fawning and cringe they feel like satire — compare them to historical geniuses, claim their post changed your life, invoke unearned emotional intimacy. Keep each under 40 words. Do NOT be genuinely professional.`,
        { schema: { properties: { openers: { type: "array", items: { type: "string" } } } } }
      );
      const parsed = JSON.parse(res);
      const openers = (parsed.openers || []).slice(0, 5);
      setLines(openers);
      if (openers.length) await database.put({ headline, openers, createdAt: Date.now() });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await callAI(
        `Invent one plausible, slightly pompous LinkedIn headline for a fictional person. Include title, company, and 2 buzzwordy self-descriptors separated by pipes.`,
        { schema: { properties: { headline: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      if (parsed.headline) setHeadline(parsed.headline);
    } catch (e) { console.error(e); } finally { setIsSuggesting(false); }
  };

  const handleCopy = async (line, i) => {
    try { await navigator.clipboard.writeText(line); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1500); } catch (e) {}
  };

  const handleSelect = (d) => { setHeadline(d.headline); setLines(d.openers || []); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handleDelete = (id) => database.del(id);

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex h-[6px] border-[3px] border-[#1a1625] rounded-[4px] overflow-hidden mb-4 shadow-[3px_3px_0px_#1a1625]">
          <div className="flex-1 bg-[#d94a3d]"></div>
          <div className="flex-1 bg-[#e8c547]"></div>
          <div className="flex-1 bg-[#4ea862]"></div>
          <div className="flex-1 bg-[#3d6fd9]"></div>
        </div>
        <div className="relative">
          <h1 className={c.title + " relative z-10"}>Suck-Up Generator</h1>
          <h1 aria-hidden="true" className={c.title + " absolute top-[5px] left-[5px] text-[#d94a3d] opacity-50 z-0"}>Suck-Up Generator</h1>
        </div>
        <p className="text-xs mt-4 text-[#6b6478] uppercase tracking-[0.15em] font-mono">Parody Only // Do Not Send</p>
      </header>
      <Generator headline={headline} setHeadline={setHeadline} onGenerate={handleGenerate} onSuggest={handleSuggest} isLoading={isLoading} isSuggesting={isSuggesting} />
      <Results lines={lines} copiedIdx={copiedIdx} onCopy={handleCopy} />
      <History docs={docs} onSelect={handleSelect} onDelete={handleDelete} />
    </main>
  );
}