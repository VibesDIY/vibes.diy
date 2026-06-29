import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#15120f] rounded p-4 shadow-[4px_4px_0px_#15120f]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#15120f]",
  feature: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#15120f] rounded p-5 shadow-[4px_4px_0px_#15120f]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[#15120f] mb-3",
};

function PromptBox({ prompt, setPrompt, onGenerate, isLoading, onSuggest }) {
  return (
    <section id="prompt-box" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Generate Post</h2>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="humblebrag about a 4am standup..."
        className="w-full border-[3px] border-[#15120f] rounded p-3 mb-3 text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#15120f] transition-all"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={isLoading || !prompt.trim()}
          className="px-4 py-2 bg-[#8b1e1e] text-white font-bold uppercase tracking-wider text-xs border-[3px] border-[#15120f] rounded shadow-[4px_4px_0px_#15120f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#15120f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 60"/></svg>
          ) : "Generate"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isLoading}
          className="px-4 py-2 bg-[#d9c26a] text-[#15120f] font-bold uppercase tracking-wider text-xs border-[3px] border-[#15120f] rounded shadow-[3px_3px_0px_#15120f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#15120f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          Suggest
        </button>
      </div>
    </section>
  );
}

function PostCard({ post }) {
  const [copied, setCopied] = React.useState(false);
  const cardRef = React.useRef(null);

  const copyImage = async () => {
    if (!window.html2canvas) {
      const s = document.createElement("script");
      s.src = "https://esm.sh/html2canvas@1.4.1";
      // fallback: use cdn
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(s);
      await new Promise((r) => { s.onload = r; });
    }
    const canvas = await window.html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "linkedin-post.png"; a.click();
      }
    });
  };

  if (!post) {
    return (
      <section id="post-card" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Preview</h2>
        <div className="text-sm text-[#666] italic py-8 text-center border-[2px] border-dashed border-[#15120f] rounded">
          Your generated post will appear here.
        </div>
      </section>
    );
  }

  const initials = (post.authorName || "??").split(" ").map(w => w[0]).slice(0,2).join("");
  const avatarBg = ["#8b1e1e","#1e5a8b","#2f7a3f","#d9c26a"][Math.abs((post.authorName||"").length) % 4];

  return (
    <section id="post-card" className={classNames.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.featureTitle}>Preview</h2>
        <button
          onClick={copyImage}
          className="px-3 py-1.5 bg-[#2f7a3f] text-white font-bold uppercase tracking-wider text-[10px] border-[3px] border-[#15120f] rounded shadow-[3px_3px_0px_#15120f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#15120f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          {copied ? "Copied!" : "Copy Image"}
        </button>
      </div>
      <div ref={cardRef} className="bg-white border border-[#e0e0e0] rounded-lg p-4 font-['Helvetica',sans-serif]" style={{fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"}}>
        <div className="flex items-start gap-2 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{background: avatarBg}}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] text-[#000000E6] leading-tight">{post.authorName}</div>
            <div className="text-[12px] text-[#00000099] leading-tight truncate">{post.authorTitle}</div>
            <div className="text-[12px] text-[#00000099] leading-tight flex items-center gap-1">
              <span>{post.timeAgo} •</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#00000099"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM2 8a6 6 0 0112 0A6 6 0 012 8zm5-3v3.25l2.5 1.5-.5.83L6 9V5h1z"/></svg>
            </div>
          </div>
          <div className="text-[#00000099] text-xl leading-none px-1">···</div>
        </div>
        <div className="text-[14px] text-[#000000E6] whitespace-pre-wrap leading-[1.4] mb-3">{post.content}</div>
        <div className="flex items-center gap-1 text-[12px] text-[#00000099] pb-2 border-b border-[#e0e0e0]">
          <span className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center text-white text-[8px] border border-white">👍</span>
            <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center text-white text-[8px] border border-white">❤</span>
            <span className="w-4 h-4 rounded-full bg-[#6dae4f] flex items-center justify-center text-white text-[8px] border border-white">💡</span>
          </span>
          <span className="ml-1">{post.likes?.toLocaleString()}</span>
          <span className="ml-auto">{post.comments} comments • {post.reposts} reposts</span>
        </div>
        <div className="flex justify-around pt-1 text-[#00000099] text-[14px] font-semibold">
          <div className="py-2 px-3">👍 Like</div>
          <div className="py-2 px-3">💬 Comment</div>
          <div className="py-2 px-3">🔄 Repost</div>
          <div className="py-2 px-3">➤ Send</div>
        </div>
      </div>
    </section>
  );
}

function PostHistory({ history, onSelect, database }) {
  if (!history || history.length === 0) {
    return (
      <section id="post-history" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>History</h2>
        <div className="text-sm text-[#666] italic">No posts yet.</div>
      </section>
    );
  }
  return (
    <section id="post-history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>History ({history.length})</h2>
      <ul className="space-y-2">
        {history.map((d) => (
          <li key={d._id} className="flex items-center gap-2 border-[2px] border-[#15120f] rounded p-2 hover:bg-[#d9c26a] transition-colors">
            <button onClick={() => onSelect(d)} className="flex-1 text-left text-xs">
              <div className="font-bold uppercase tracking-wider truncate">{d.authorName}</div>
              <div className="text-[#666] truncate">{d.prompt}</div>
            </button>
            <button
              onClick={() => database.del(d._id)}
              className="px-2 py-1 bg-[#8b1e1e] text-white text-[10px] font-bold uppercase border-[2px] border-[#15120f] rounded hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("post-forge-db");
  const [prompt, setPrompt] = React.useState("");
  const [current, setCurrent] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { docs: history } = useLiveQuery("_id", { descending: true, limit: 20 });

  const generate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(`Generate a parody LinkedIn post based on: "${prompt}". Make it cringe-corporate, humblebrag-heavy, or motivational-guru style. Include realistic reactions.`, {
        schema: {
          properties: {
            authorName: { type: "string" },
            authorTitle: { type: "string", description: "Job title | Company | tagline" },
            timeAgo: { type: "string", description: "e.g. 3h, 1d" },
            content: { type: "string", description: "The full post body, can include line breaks with \\n and emojis" },
            likes: { type: "number" },
            comments: { type: "number" },
            reposts: { type: "number" },
          }
        }
      });
      const data = JSON.parse(res);
      const saved = await database.put({ ...data, prompt, type: "post", createdAt: Date.now() });
      setCurrent({ ...data, _id: saved.id, prompt });
    } finally {
      setIsLoading(false);
    }
  };

  const suggest = async () => {
    setIsLoading(true);
    try {
      const res = await callAI("Give one short funny one-line prompt for a parody LinkedIn post. Just the prompt idea itself.", {
        schema: { properties: { idea: { type: "string" } } }
      });
      setPrompt(JSON.parse(res).idea);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Post Forge</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[#666] mt-1">Parody post generator</p>
      </header>
      <PromptBox prompt={prompt} setPrompt={setPrompt} onGenerate={generate} isLoading={isLoading} onSuggest={suggest} />
      <PostCard post={current} />
      <PostHistory history={history} onSelect={setCurrent} database={database} />
    </main>
  );
}