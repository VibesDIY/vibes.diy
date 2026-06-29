import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  wrap: "max-w-3xl mx-auto",
  header: "mb-6 p-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "mb-6 p-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
  featureTitle: "text-sm font-bold uppercase tracking-[0.15em] mb-3",
};

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="14 40"/>
    </svg>
  );
}

function InputPanel({ fact, setFact, onGenerate, onSuggest, isLoading, isSuggesting }) {
  return (
    <section id="input" className={c.feature}>
      <h2 className={c.featureTitle}>Drop A Boring Fact</h2>
      <textarea
        value={fact}
        onChange={e => setFact(e.target.value)}
        placeholder="e.g. I drank water this morning"
        className="w-full h-24 p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_oklch(0.15_0.02_280)] transition-all resize-none"
      />
      <div className="flex gap-3 mt-3 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={isLoading || !fact.trim()}
          className="px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white font-bold uppercase tracking-wider text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isLoading ? (<span className="inline-flex items-center gap-2"><Spinner/>Forging...</span>) : "Generate"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="px-4 py-2 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isSuggesting ? (<span className="inline-flex items-center gap-2"><Spinner/>...</span>) : "Suggest Fact"}
        </button>
      </div>
    </section>
  );
}

function Preview({ post, onSave, onCopy, copied }) {
  if (!post) return (
    <section id="preview" className={c.feature}>
      <h2 className={c.featureTitle}>Generated Post</h2>
      <p className="text-sm text-[oklch(0.50_0.02_280)] italic">Your masterpiece of thought leadership will appear here.</p>
    </section>
  );
  return (
    <section id="preview" className={c.feature}>
      <h2 className={c.featureTitle}>Generated Post</h2>
      <div className="p-4 bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] whitespace-pre-wrap text-sm leading-relaxed">{post}</div>
      <div className="flex gap-3 mt-3 flex-wrap">
        <button onClick={onSave} className="px-4 py-2 bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">Save</button>
        <button onClick={onCopy} className="px-4 py-2 bg-white text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">{copied ? "Copied!" : "Copy"}</button>
      </div>
    </section>
  );
}

function Feed({ posts, onDelete }) {
  return (
    <section id="feed" className={c.feature}>
      <h2 className={c.featureTitle}>Saved Cringe ({posts.length})</h2>
      {posts.length === 0 && <p className="text-sm text-[oklch(0.50_0.02_280)] italic">No saved posts yet. Forge some thought leadership above.</p>}
      <ul className="space-y-4">
        {posts.map(p => (
          <li key={p._id} className="p-4 bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)]">
            <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-2">Fact: {p.fact}</div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed mb-3">{p.post}</div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(p.post)} className="px-3 py-1 bg-white text-xs font-bold uppercase tracking-wider border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">Copy</button>
              <button onClick={() => onDelete(p)} className="px-3 py-1 bg-[oklch(0.55_0.24_28)] text-white text-xs font-bold uppercase tracking-wider border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("til-forge-db");
  const { docs: posts } = useLiveQuery("type", { key: "til-post", descending: true });
  const [fact, setFact] = React.useState("");
  const [post, setPost] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const generate = async () => {
    setIsLoading(true);
    try {
      const prompt = `Turn this mundane fact into an insufferable self-important LinkedIn "Today I Learned" post. Use corporate buzzwords (synergy, alignment, leverage, journey, unpack, lean in), fake vulnerability, overdramatic line breaks (each sentence on its own line), at least one "🧵" or arrow emoji, humblebragging, and end with an engagement-farming question. Keep it under 180 words. Fact: "${fact}"`;
      const res = await callAI(prompt, { schema: { properties: { post: { type: "string", description: "The cringe LinkedIn post" } } } });
      const data = JSON.parse(res);
      setPost(data.post);
    } finally { setIsLoading(false); }
  };

  const suggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await callAI("Generate one extremely mundane, boring everyday fact a person might learn (like 'my coffee was cold' or 'the elevator was slow today'). One sentence, first person.", { schema: { properties: { fact: { type: "string" } } } });
      setFact(JSON.parse(res).fact);
    } finally { setIsSuggesting(false); }
  };

  const save = async () => {
    if (!post) return;
    await database.put({ type: "til-post", fact, post, createdAt: Date.now() });
    setPost(""); setFact("");
  };

  const copy = () => {
    navigator.clipboard?.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main id="app" className={c.page}>
      <div className={c.wrap}>
        <header id="app-header" className={c.header}>
          <div className="h-[6px] -mx-4 -mt-4 mb-3 flex">
            <div className="flex-1 bg-[oklch(0.55_0.24_28)]"/>
            <div className="flex-1 bg-[oklch(0.85_0.18_85)]"/>
            <div className="flex-1 bg-[oklch(0.62_0.19_145)]"/>
            <div className="flex-1 bg-[oklch(0.52_0.18_255)]"/>
          </div>
          <h1 className={c.title}>TIL Post Forge</h1>
          <p className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-2">Turn Nothing Into Thought Leadership</p>
        </header>
        <InputPanel fact={fact} setFact={setFact} onGenerate={generate} onSuggest={suggest} isLoading={isLoading} isSuggesting={isSuggesting} />
        <Preview post={post} onSave={save} onCopy={copy} copied={copied} />
        <Feed posts={posts} onDelete={(p) => database.del(p._id)} />
      </div>
    </main>
  );
}