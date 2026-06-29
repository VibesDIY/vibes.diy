import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 p-4 bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  feature: "max-w-3xl mx-auto mb-4 p-5 bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-lg font-bold uppercase tracking-wide mb-3 text-[#1a1a2e]",
};

function Spinner() {
  return (
    <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function PostForm({ database }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);

  async function hashtagify() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const resp = await callAI(
        `Generate 32 cringe corporate LinkedIn hashtags for this post. Mix grindset, leadership, hustle, Monday energy, synergy, blessed, etc. No # symbol, just words. Post: "${text}"`,
        { schema: { properties: { hashtags: { type: "array", items: { type: "string" } } } } }
      );
      const { hashtags } = JSON.parse(resp);
      await database.put({ type: "post", text, hashtags, createdAt: Date.now() });
      setText("");
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const resp = await callAI(
        "Write one cringe humble-brag LinkedIn post (2-3 sentences). Return only the post text.",
        { schema: { properties: { post: { type: "string" } } } }
      );
      const { post } = JSON.parse(resp);
      setText(post);
    } catch (e) { console.error(e); }
    finally { setSuggesting(false); }
  }

  return (
    <section id="post-form" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste Your Post</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Just closed the biggest deal of my career..."
        className="w-full h-28 p-3 mb-3 border-[3px] border-[#1a1a2e] rounded-[4px] bg-[#fffef5] text-[#1a1a2e] focus:outline-none focus:shadow-[4px_4px_0px_#1a1a2e] transition-all"
      />
      <div className="flex gap-3 flex-wrap">
        <button onClick={hashtagify} disabled={busy || !text.trim()} className="px-4 py-2 bg-[#e63946] text-white font-bold uppercase tracking-wide border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] transition-all text-sm disabled:opacity-60">
          {busy ? <><Spinner /> Hashtagifying...</> : "Hashtagify"}
        </button>
        <button onClick={suggest} disabled={suggesting} className="px-4 py-2 bg-[#f4d35e] text-[#1a1a2e] font-bold uppercase tracking-wide border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1a2e] transition-all text-sm disabled:opacity-60">
          {suggesting ? <><Spinner /> ...</> : "Suggest Text"}
        </button>
      </div>
    </section>
  );
}

function PostList({ docs = [], onDelete }) {
  const c = {
    card: "p-4 mb-3 bg-[#fffef5] border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0px_#1a1a2e]",
    tag: "inline-block mr-1 mb-1 px-2 py-0.5 bg-[#4a90e2] text-white text-xs font-mono rounded-[4px] border-[2px] border-[#1a1a2e]",
    del: "text-xs font-bold uppercase px-2 py-1 bg-[#e63946] text-white border-[2px] border-[#1a1a2e] rounded-[4px] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all",
    empty: "text-sm text-[#6b6b80] italic",
  };
  return (
    <section id="post-list" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Your Cringe Feed</h2>
      {docs.length === 0 && <p className={c.empty}>No posts yet. Paste something and grind.</p>}
      {docs.map((d) => (
        <div key={d._id} className={c.card}>
          <p className="mb-2 text-[#1a1a2e] whitespace-pre-wrap">{d.text}</p>
          <div className="mb-2">
            {(d.hashtags || []).map((h, i) => (
              <span key={i} className={c.tag}>#{h}</span>
            ))}
          </div>
          <button onClick={() => onDelete(d._id)} className={c.del}>Delete</button>
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("hashtag-overload");
  const { docs } = useLiveQuery("type", { key: "post", descending: true });
  const onDelete = (id) => database.del(id);
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Hashtag Overload</h1>
        <p className="text-xs uppercase tracking-widest text-[#6b6b80] mt-1 font-mono">Maximum Engagement Mode</p>
      </header>
      <PostForm database={database} />
      <PostList docs={docs} onDelete={onDelete} />
    </main>
  );
}