import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-2xl mx-auto mb-6 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1625]",
  sub: "text-xs uppercase tracking-widest text-[#7a7588] mt-1",
  feature: "max-w-2xl mx-auto mb-4 p-5 bg-white border-[3px] border-[#1a1625] rounded shadow-[4px_4px_0px_#1a1625]",
  featureTitle: "text-sm font-bold uppercase tracking-widest mb-3 text-[#1a1625]",
};

function InputForm({ anecdote, setAnecdote, onGenerate, isLoading, onSuggest, isSuggesting }) {
  return (
    <section id="input-form" className={c.feature}>
      <h2 className={c.featureTitle}>Paste The Moment</h2>
      <textarea
        value={anecdote}
        onChange={(e) => setAnecdote(e.target.value)}
        placeholder="The intern asked why we have so many meetings..."
        className="w-full h-28 p-3 border-[3px] border-[#1a1625] rounded text-sm resize-none focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1625] transition-all bg-[#f5f2e8]"
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={isLoading || !anecdote.trim()}
          className="px-4 py-2 bg-[#e63946] text-white border-[3px] border-[#1a1625] rounded font-bold uppercase text-xs tracking-wider shadow-[4px_4px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 42"/></svg>
              Cringing...
            </span>
          ) : "Cringe It"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="px-3 py-2 bg-[#f4d35e] text-[#1a1625] border-[3px] border-[#1a1625] rounded font-bold uppercase text-xs tracking-wider shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isSuggesting ? "..." : "Suggest"}
        </button>
      </div>
    </section>
  );
}

function LatestPost({ latest }) {
  if (!latest) return null;
  return (
    <section id="latest-post" className="max-w-2xl mx-auto mb-4 p-5 bg-white border-[3px] border-[#1a1625] rounded shadow-[4px_4px_0px_#1a1625] relative">
      <div className="absolute top-0 left-0 right-0 h-[6px] flex">
        <div className="flex-1 bg-[#e63946]"/><div className="flex-1 bg-[#f4d35e]"/><div className="flex-1 bg-[#2a9d8f]"/><div className="flex-1 bg-[#3a86ff]"/>
      </div>
      <h2 className={c.featureTitle + " mt-2"}>Freshly Cringed</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#1a1625] bg-[#f5f2e8] p-4 border-[3px] border-[#1a1625] rounded">
        {latest}
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(latest)}
        className="mt-3 px-3 py-1.5 bg-[#2a9d8f] text-white border-[3px] border-[#1a1625] rounded font-bold uppercase text-xs tracking-wider shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
      >
        Copy
      </button>
    </section>
  );
}

function Archive({ posts, database }) {
  return (
    <section id="archive" className={c.feature}>
      <h2 className={c.featureTitle}>The Archive ({posts.length})</h2>
      {posts.length === 0 && (
        <div className="text-xs uppercase tracking-widest text-[#7a7588]">No cringe yet. Be the thought leader.</div>
      )}
      <ul className="space-y-3">
        {posts.map((d) => (
          <li key={d._id} className="p-3 bg-[#f5f2e8] border-[3px] border-[#1a1625] rounded">
            <div className="text-[10px] uppercase tracking-widest text-[#7a7588] mb-1">Source</div>
            <div className="text-xs italic mb-2 text-[#1a1625]">"{d.source}"</div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#1a1625] border-t-[2px] border-[#1a1625] pt-2">{d.post}</div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => navigator.clipboard.writeText(d.post)}
                className="px-2 py-1 bg-[#3a86ff] text-white border-[2px] border-[#1a1625] rounded font-bold uppercase text-[10px] tracking-wider hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
              >Copy</button>
              <button
                onClick={() => database.del(d._id)}
                className="px-2 py-1 bg-[#e63946] text-white border-[2px] border-[#1a1625] rounded font-bold uppercase text-[10px] tracking-wider hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
              >Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringe-cliff-db");
  const [anecdote, setAnecdote] = useState("");
  const [latest, setLatest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { docs } = useLiveQuery("_id", { descending: true, limit: 50 });
  const posts = docs.filter(d => d.type === "post");

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const r = await callAI("Generate a mundane workplace anecdote (1-2 sentences) that would be funny to dramatize on LinkedIn. Keep it boring and specific.", {
        schema: { properties: { anecdote: { type: "string" } } }
      });
      setAnecdote(JSON.parse(r).anecdote);
    } finally { setIsSuggesting(false); }
  };

  const handleGenerate = async () => {
    if (!anecdote.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Rewrite this mundane anecdote as an over-the-top melodramatic LinkedIn thread post. Rules: start with "🧵 1/", every sentence on its own line with blank lines between, use cringe corporate buzzwords (synergy, pivot, journey, humbled, grateful), include at least two fake cliffhangers like "But then..." or "What happened next changed everything.", end with a generic call-to-engagement question. Do NOT use real names.\n\nANECDOTE: ${anecdote}`;
      const r = await callAI(prompt, { schema: { properties: { post: { type: "string" } } } });
      const { post } = JSON.parse(r);
      setLatest(post);
      await database.put({ type: "post", source: anecdote, post, createdAt: Date.now() });
      setAnecdote("");
    } finally { setIsLoading(false); }
  };

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Cringe Cliff</h1>
        <div className={c.sub}>Professional Melodrama Generator</div>
      </header>
      <InputForm
        anecdote={anecdote}
        setAnecdote={setAnecdote}
        onGenerate={handleGenerate}
        isLoading={isLoading}
        onSuggest={handleSuggest}
        isSuggesting={isSuggesting}
      />
      <LatestPost latest={latest} />
      <Archive posts={posts} database={database} />
    </main>
  );
}