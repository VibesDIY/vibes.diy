import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 p-5 bg-white border-[3px] border-[#14121f] rounded-[4px] shadow-[4px_4px_0px_#14121f] flex items-center gap-3",
  logo: "flex gap-1",
  logoSq: "w-3 h-3 border-[2px] border-[#14121f]",
  title: "text-2xl font-bold uppercase tracking-tight text-[#14121f]",
  feature: "max-w-3xl mx-auto mb-5 p-5 bg-white border-[3px] border-[#14121f] rounded-[4px] shadow-[4px_4px_0px_#14121f]",
  featureLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6676] mb-2 font-semibold",
  featureTitle: "text-xl font-bold uppercase tracking-tight text-[#14121f] mb-4",
  input: "w-full p-3 border-[3px] border-[#14121f] rounded-[4px] bg-white text-[#14121f] font-medium focus:outline-none focus:shadow-[3px_3px_0px_#14121f] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all",
  btnPrimary: "px-5 py-3 bg-[#d94a2e] text-white border-[3px] border-[#14121f] rounded-[4px] shadow-[4px_4px_0px_#14121f] font-bold uppercase tracking-wider text-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#14121f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed",
  btnGhost: "px-3 py-2 bg-white text-[#14121f] border-[3px] border-[#14121f] rounded-[4px] font-bold uppercase tracking-wider text-xs hover:shadow-[3px_3px_0px_#14121f] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",
  btnSuggest: "px-3 py-1.5 bg-[#e8c547] text-[#14121f] border-[3px] border-[#14121f] rounded-[4px] font-bold uppercase tracking-wider text-[0.65rem] hover:shadow-[3px_3px_0px_#14121f] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-60",
  postCard: "p-4 mb-3 bg-[#f5f2e8] border-[3px] border-[#14121f] rounded-[4px] shadow-[3px_3px_0px_#14121f]",
  postText: "text-[0.9rem] text-[#14121f] leading-relaxed whitespace-pre-wrap mb-3",
  badge: "inline-block px-2 py-0.5 bg-[#4a8f5c] text-white text-[0.6rem] uppercase tracking-[0.15em] font-bold border-[2px] border-[#14121f] rounded-[2px]",


function AchievementForm({ database, setLatestBatch }) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  async function suggest() {
    setIsSuggesting(true);
    try {
      const res = await callAI("Give one short, real, unglamorous career or life achievement someone might actually have. One sentence, first person.", {
        schema: { properties: { achievement: { type: "string" } } }
      });
      setText(JSON.parse(res).achievement || "");
    } finally { setIsSuggesting(false); }
  }

  async function generate() {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(`Write 5 parody LinkedIn humblebrag posts about this achievement: "${text}". Maximum cringe corporate-inspirational energy. Each should open with something like "Not gonna lie, I almost cried when..." or "A funny thing happened on the way to..." Include fake lessons, forced vulnerability, unprompted gratitude, and at least one "thoughts?" or hashtag pile. Keep each 3-5 sentences.`, {
        schema: { properties: { posts: { type: "array", items: { type: "string" } } } }
      });
      const { posts } = JSON.parse(res);
      const ids = [];
      for (const post of posts) {
        const ok = await database.put({ type: "post", text: post, achievement: text, createdAt: Date.now() });
        ids.push(ok.id);
      }
      setLatestBatch(ids);
      setText("");
    } finally { setIsLoading(false); }
  }

  const spinner = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin inline" style={{verticalAlign:"middle"}}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42" strokeLinecap="round" />
    </svg>
  );

  return (
    <section id="achievement-form" className={classNames.feature}>
      <div className="flex items-center justify-between mb-2">
        <div className={classNames.featureLabel}>Step 01 — Input</div>
        <button onClick={suggest} disabled={isSuggesting} className={classNames.btnSuggest}>
          {isSuggesting ? spinner : "✦ Suggest"}
        </button>
      </div>
      <h2 className={classNames.featureTitle}>What'd You Accomplish?</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I got a small promotion at work"
        rows={3}
        className={classNames.input + " mb-3 resize-none"}
      />
      <button onClick={generate} disabled={isLoading || !text.trim()} className={classNames.btnPrimary}>
        {isLoading ? <>{spinner} Cooking...</> : "Generate 5 Cringe Posts"}
      </button>
    </section>
  );
}

function PostCard({ doc, database }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(doc.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className={classNames.postCard}>
      <p className={classNames.postText}>{doc.text}</p>
      <div className="flex gap-2">
        <button onClick={copy} className={classNames.btnGhost}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
        <button onClick={() => database.del(doc._id)} className={classNames.btnGhost}>Delete</button>
      </div>
    </div>
  );
}

function GeneratedPosts({ docs, latestBatch, database }) {
  const fresh = docs.filter(d => latestBatch.includes(d._id));
  if (fresh.length === 0) return null;
  return (
    <section id="generated-posts" className={classNames.feature}>
      <div className="flex items-center justify-between mb-2">
        <div className={classNames.featureLabel}>Step 02 — Output</div>
        <span className={classNames.badge}>New</span>
      </div>
      <h2 className={classNames.featureTitle}>Fresh Cringe</h2>
      {fresh.map(d => <PostCard key={d._id} doc={d} database={database} />)}
    </section>
  );
}

function PostArchive({ docs, latestBatch, database }) {
  const older = docs.filter(d => !latestBatch.includes(d._id));
  return (
    <section id="post-archive" className={classNames.feature}>
      <div className={classNames.featureLabel}>Archive — {older.length} posts</div>
      <h2 className={classNames.featureTitle}>The Vault</h2>
      {older.length === 0 ? (
        <p className={classNames.empty}>No saved humblebrags yet. Generate your first batch above.</p>
      ) : (
        older.map(d => <PostCard key={d._id} doc={d} database={database} />)
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("humble-flex-db");
  const [latestBatch, setLatestBatch] = useState([]);
  const { docs } = useLiveQuery("type", { key: "post", descending: true });

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className={classNames.logo}>
          <div className={classNames.logoSq} style={{background:"#d94a2e"}} />
          <div className={classNames.logoSq} style={{background:"#e8c547"}} />
          <div className={classNames.logoSq} style={{background:"#4a8f5c"}} />
        </div>

      <AchievementForm database={database} setLatestBatch={setLatestBatch} />
      <GeneratedPosts docs={docs} latestBatch={latestBatch} database={database} />
      <PostArchive docs={docs} latestBatch={latestBatch} database={database} />
    </main>
  );
}