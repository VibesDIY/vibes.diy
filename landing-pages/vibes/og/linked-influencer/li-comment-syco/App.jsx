import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6",
  header: "max-w-3xl mx-auto mb-6",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-6 p-5 bg-white border-[3px] border-[#1a1a2e] rounded-[4px]",
  featureTitle: "text-lg font-bold uppercase mb-3",
};

function PostInput({ onGenerate, isLoading, onSuggest, isSuggesting, text, setText }) {
  return (
    <section id="post-input" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste Your Post</h2>
      <label className={classNames.label}>Your visionary thought leadership</label>
      <textarea
        className={classNames.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="I just fired my assistant for not being humble enough. Here's what it taught me about grit..."
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button className={classNames.btnPrimary} onClick={onGenerate} disabled={isLoading || !text.trim()}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" strokeDasharray="42 20" />
              </svg>
              Hyping...
            </span>
          ) : "Generate Hype"}
        </button>
        <button className={classNames.btnGhost} onClick={onSuggest} disabled={isSuggesting}>
          {isSuggesting ? "..." : "Suggest a post"}
        </button>
      </div>
    </section>
  );
}

function CommentRow({ comment }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(comment).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className={classNames.commentCard}>
      <p className="text-sm font-medium flex-1">{comment}</p>
      <button className={classNames.btnGhost} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

function CommentHistory({ docs }) {
  if (!docs || docs.length === 0) {
    return (
      <section id="comment-history" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Generated Hype</h2>
        <p className="text-sm text-[#6b6b80]">No hype yet. Paste a post above and let the engagement begin.</p>
      </section>
    );
  }
  return (
    <section id="comment-history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Generated Hype</h2>
      {docs.filter(d => d.type === "hype").map((doc) => (
        <div key={doc._id} className={classNames.postCard}>
          <p className={classNames.originalPost}>"{doc.post}"</p>
          {(doc.comments || []).map((c, i) => (
            <CommentRow key={i} comment={c} />
          ))}
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("hype-machine");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { docs } = useLiveQuery("_id", { descending: true, limit: 50 });

  async function handleGenerate() {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const raw = await callAI(
        `Generate 5 absurdly sycophantic, over-the-top parody LinkedIn comments for this post. Think "THIS. So much THIS.", "Chills. Actual chills.", excessive emojis words (spelled out), unhinged praise, humblebrag replies. Keep each under 200 chars. Post: "${text}"`,
        { schema: { properties: { comments: { type: "array", items: { type: "string" } } } } }
      );
      const { comments } = JSON.parse(raw);
      await database.put({ type: "hype", post: text, comments, createdAt: Date.now() });
      setText("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSuggest() {
    setIsSuggesting(true);
    try {
      const raw = await callAI(
        "Generate one absurd parody LinkedIn 'thought leader' post. Humblebrag, fake vulnerability, business lesson from trivial event. 2-4 sentences.",
        { schema: { properties: { post: { type: "string" } } } }
      );
      setText(JSON.parse(raw).post);
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Hype Machine</h1>
        <p className={classNames.subtitle}>Synergy-grade validation, on demand</p>
      </header>
      <PostInput
        text={text} setText={setText}
        onGenerate={handleGenerate} isLoading={isLoading}
        onSuggest={handleSuggest} isSuggesting={isSuggesting}
      />
      <CommentHistory docs={docs} />
    </main>
  );
}