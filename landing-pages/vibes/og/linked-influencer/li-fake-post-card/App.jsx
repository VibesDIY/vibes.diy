import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-2xl mx-auto mb-8 p-5 bg-white border-[3px] border-[#0f172a] rounded shadow-[4px_4px_0px_#0f172a]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#0f172a]",
  subtitle: "text-xs uppercase tracking-[0.15em] text-[#64748b] mt-1",
  feature: "max-w-2xl mx-auto mb-5 p-5 bg-white border-[3px] border-[#0f172a] rounded shadow-[4px_4px_0px_#0f172a]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] mb-3 text-[#0f172a]",
  label: "block text-xs uppercase tracking-[0.1em] font-bold mb-2 text-[#0f172a]",
  input: "w-full p-3 border-[3px] border-[#0f172a] rounded bg-white text-sm focus:outline-none focus:shadow-[3px_3px_0px_#0f172a]",
  btnPrimary: "px-5 py-2.5 bg-[#d94f2a] text-white border-[3px] border-[#0f172a] rounded font-bold text-xs uppercase tracking-wider shadow-[4px_4px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0f172a] transition disabled:opacity-60",
  btnGhost: "px-3 py-1.5 bg-white text-[#0f172a] border-[3px] border-[#0f172a] rounded font-bold text-xs uppercase tracking-wider hover:shadow-[3px_3px_0px_#0f172a] transition",
  linkedinCard: "bg-white border border-[#e0e0e0] rounded-lg shadow-sm p-4 font-['Inter',system-ui,sans-serif]",


function Avatar({ name }) {
  const initials = (name || "??").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  const colors = ["#d94f2a", "#e8c547", "#3f8f5e", "#2d6cdf"];
  const bg = colors[(initials.charCodeAt(0) || 0) % 4];
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0" style={{background: bg}}>
      {initials}
    </div>
  );
}

function LinkedInCard({ post }) {
  if (!post) return null;
  return (
    <div className={classNames.linkedinCard}>
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={post.name} />
        <div className="min-w-0">
          <div className="font-semibold text-[15px] text-[#000] leading-tight">{post.name}</div>
          <div className="text-[12px] text-[#666] leading-snug">{post.title}</div>
          <div className="text-[11px] text-[#666] mt-0.5">1h · <span className="text-[#666]">🌐</span></div>
        </div>
      </div>
      <div className="text-[14px] text-[#000] whitespace-pre-wrap leading-relaxed mb-3">{post.body}</div>
      <div className="flex items-center justify-between pt-2 border-t border-[#e0e0e0] text-[12px] text-[#666]">
        <div className="flex items-center gap-1">
          <span className="inline-flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center text-white ring-2 ring-white">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.76-7.62A1 1 0 0 1 13.5 3a2.38 2.38 0 0 1 2.38 2.38c0 .18 0 .35-.05.52z"/></svg>
            </span>
            <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center text-white ring-2 ring-white">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/></svg>
            </span>
            <span className="w-4 h-4 rounded-full bg-[#6dae4f] flex items-center justify-center text-white ring-2 ring-white">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>
            </span>
          </span>
          <span className="ml-1">{post.reactions}</span>
        </div>
        <div>{post.comments} comments</div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "humble brag about waking up at 4am to meditate",
  "getting laid off but grateful for the journey",
  "my toddler taught me about Q4 strategy",
  "rejected by a candidate and crying in my Tesla",
];

function Generator({ prompt, setPrompt, onGenerate, isLoading }) {
  return (
    <section id="generator" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Vibe Prompt</h2>
      <label className={classNames.label}>Describe the cringe</label>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={3}
        placeholder="e.g. humble brag about waking up at 4am"
        className={classNames.input}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => setPrompt(s)} className={classNames.btnGhost}>{s.slice(0,24)}…</button>
        ))}
      </div>
      <div className="mt-4">
        <button onClick={onGenerate} disabled={isLoading || !prompt.trim()} className={classNames.btnPrimary}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Cooking...
            </span>
          ) : "Generate Post"}
        </button>
      </div>
    </section>
  );
}

function Preview({ post, onSave, saved }) {
  return (
    <section id="preview" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Preview</h2>
      {post ? (
        <>
          <LinkedInCard post={post} />
          <div className="mt-4">
            <button onClick={onSave} disabled={saved} className={classNames.btnPrimary}>
              {saved ? "Saved ✓" : "Save to Feed"}
            </button>
          </div>
        </>
      ) : (
        <p className={classNames.muted}>No post yet. Generate one above.</p>
      )}
    </section>
  );
}

function Feed({ docs }) {
  return (
    <section id="feed" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Saved Feed ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className={classNames.muted}>Saved parody posts will appear here.</p>
      ) : (
        <div className="space-y-3">
          {docs.map(d => <LinkedInCard key={d._id} post={d} />)}
        </div>
      )}
    </section>
  );
}

const FONT_LINK_ID = "cringe-fonts";
if (typeof document !== "undefined" && !document.getElementById(FONT_LINK_ID)) {
  const l = document.createElement("link");
  l.id = FONT_LINK_ID;
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=optional";
  document.head.appendChild(l);
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringe-feed");
  const { docs } = useLiveQuery("type", { key: "post", descending: true });
  const [prompt, setPrompt] = useState("");
  const [post, setPost] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const onGenerate = async () => {
    setIsLoading(true);
    setSavedId(null);
    try {
      const res = await callAI(
        `Write a parody LinkedIn post based on this vibe: "${prompt}". Make it cringey, self-important, overly emotional, with short one-line paragraphs and random hashtags at the end. Invent a fake name and pompous job title.`,
        { schema: { properties: {
          name: { type: "string" },
          title: { type: "string", description: "pompous job title" },
          body: { type: "string", description: "post body, 60-120 words, line breaks between paragraphs" },
          reactions: { type: "number" },
          comments: { type: "number" },
        }}}
      );
      const parsed = JSON.parse(res);
      setPost(parsed);
    } finally {
      setIsLoading(false);
    }
  };

  const onSave = async () => {
    if (!post) return;
    const ok = await database.put({ ...post, type: "post", createdAt: Date.now() });
    setSavedId(ok.id);
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Cringe Feed</h1>
        <p className={classNames.subtitle}>Parody Post Generator // Not Real</p>
      </header>
      <Generator prompt={prompt} setPrompt={setPrompt} onGenerate={onGenerate} isLoading={isLoading} />
      <Preview post={post} onSave={onSave} saved={!!savedId} />
      <Feed docs={docs} />
    </main>
  );
}