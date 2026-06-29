import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#faf9f6] p-8 font-light text-[#1a1a1a]",
  header: "max-w-2xl mx-auto mb-16 text-center",
  title: "text-3xl tracking-widest uppercase",
  feature: "max-w-2xl mx-auto mb-16",
  featureTitle: "text-xs uppercase tracking-[0.2em] text-neutral-500 mb-4",
};
const c = {
  page: "min-h-screen bg-[#f5f3ec] p-6 md:p-10 text-[#1a1a2e]",
  shell: "max-w-2xl mx-auto",
  header: "mb-10 border-[3px] border-[#1a1a2e] bg-white shadow-[4px_4px_0_#1a1a2e]",
  headerInner: "p-5",
  title: "text-2xl md:text-3xl font-bold uppercase tracking-tight",
  subtitle: "text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a8c] mt-1",
  card: "mb-8 border-[3px] border-[#1a1a2e] bg-white p-5 shadow-[4px_4px_0_#1a1a2e]",
  label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a8c] mb-3 block",
  textarea: "w-full border-[3px] border-[#1a1a2e] bg-[#faf9f6] p-3 text-sm font-['JetBrains_Mono',monospace] focus:outline-none transition-all",
  btnPrimary: "mt-3 px-5 py-2 border-[3px] border-[#1a1a2e] bg-[#c94a3f] text-white text-xs uppercase tracking-[0.08em] font-bold shadow-[4px_4px_0_#1a1a2e] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60",
  btnGhost: "px-3 py-1 border-[3px] border-[#1a1a2e] bg-white text-[0.65rem] uppercase tracking-[0.1em] hover:bg-[#e8c547] transition-colors",
  haiku: "font-['JetBrains_Mono',monospace] text-base leading-[2] whitespace-pre-line",
  original: "text-sm text-[#4a4a5c] leading-relaxed max-h-40 overflow-auto pr-2",
  stat: "font-['JetBrains_Mono',monospace] text-[0.75rem] text-[#1a1a2e] border-t-[2px] border-[#1a1a2e] pt-2 mt-3 flex justify-between",
  archiveItem: "border-[3px] border-[#1a1a2e] bg-white p-4 mb-3 shadow-[3px_3px_0_#1a1a2e] hover:bg-[#e8c547] transition-colors cursor-pointer",
  bar: "h-[6px] flex",
  grid: "grid md:grid-cols-2 gap-4",
};

function Distiller({ input, setInput, onDistill, onSuggest, isLoading, isSuggesting }) {
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  return (
    <section className={c.card}>
      <div className="flex justify-between items-center mb-3">
        <span className={c.label}>Paste corporate post</span>
        <button onClick={onSuggest} disabled={isSuggesting} className={c.btnGhost}>
          {isSuggesting ? "..." : "Example"}
        </button>
      </div>
      <textarea
        className={c.textarea}
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Excited to announce that I'm thrilled to share..."
      />
      <div className="flex justify-between items-center">
        <button onClick={onDistill} disabled={isLoading || !input.trim()} className={c.btnPrimary}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42 60" strokeLinecap="round" />
              </svg>
              Distilling
            </span>
          ) : "Distill →"}
        </button>
        <span className="font-['JetBrains_Mono',monospace] text-xs text-[#7a7a8c]">{words} words</span>
      </div>
    </section>
  );
}

function Result({ result }) {
  if (!result) return null;
  return (
    <section className={c.card}>
      <div className={c.grid}>
        <div>
          <span className={c.label}>Before</span>
          <div className={c.original}>{result.original}</div>
        </div>
        <div>
          <span className={c.label}>After</span>
          <div className={c.haiku}>{result.haiku}</div>
        </div>
      </div>
      <div className={c.stat}>
        <span>{result.wordCount} words</span>
        <span>→</span>
        <span>{result.syllables} syllables</span>
      </div>
    </section>
  );
}

function Archive({ docs, onPick }) {
  if (!docs.length) return null;
  return (
    <section className={c.card}>
      <span className={c.label}>Archive · {docs.length}</span>
      {docs.map((d) => (
        <div key={d._id} onClick={() => onPick(d)} className={c.archiveItem}>
          <div className={c.haiku}>{d.haiku}</div>
          <div className="font-['JetBrains_Mono',monospace] text-[0.7rem] text-[#7a7a8c] mt-2">
            {d.wordCount}w → {d.syllables}s
          </div>
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("haiku-distill");
  const { docs } = useLiveQuery("_id", { descending: true, limit: 50 });
  const [input, setInput] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const handleDistill = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const raw = await callAI(
        `Read this corporate/LinkedIn post and write a sincere (not parody) 5-7-5 haiku that captures the real underlying human message beneath the buzzwords. Also count syllables.\n\nPOST:\n${input}`,
        { schema: { properties: { haiku: { type: "string", description: "Three lines separated by \\n, 5-7-5 syllables" }, syllables: { type: "number", description: "Total syllable count (should be 17)" } } } }
      );
      const parsed = JSON.parse(raw);
      const wordCount = input.trim().split(/\s+/).length;
      const doc = { type: "haiku", original: input, haiku: parsed.haiku, syllables: parsed.syllables || 17, wordCount, createdAt: Date.now() };
      const saved = await database.put(doc);
      setResult({ ...doc, _id: saved.id });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const raw = await callAI(
        "Generate one realistic bloated LinkedIn-style corporate post (120-200 words) full of buzzwords, humblebrags, and vague inspirational language. Return just the post text.",
        { schema: { properties: { post: { type: "string" } } } }
      );
      setInput(JSON.parse(raw).post);
    } catch (e) { console.error(e); } finally { setIsSuggesting(false); }
  };

  return (
    <main id="app" className={c.page}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional" rel="stylesheet" />
      <div className={c.shell} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        <header className={c.header}>
          <div className={c.bar}>
            <div className="flex-1 bg-[#c94a3f]" />
            <div className="flex-1 bg-[#e8c547]" />
            <div className="flex-1 bg-[#4a9f5f]" />
            <div className="flex-1 bg-[#3a6fc4]" />
          </div>
          <div className={c.headerInner}>
            <h1 className={c.title}>Haiku Distill</h1>
            <div className={c.subtitle}>Corporate noise → three lines of truth</div>
          </div>
        </header>
        <Distiller input={input} setInput={setInput} onDistill={handleDistill} onSuggest={handleSuggest} isLoading={isLoading} isSuggesting={isSuggesting} />
        <Result result={result} />
        <Archive docs={docs.filter(d => d.type === "haiku")} onPick={(d) => { setInput(d.original); setResult(d); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      </div>
    </main>
  );
}