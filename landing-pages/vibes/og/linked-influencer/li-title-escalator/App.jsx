import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#1a1a2e] rounded",
  featureTitle: "text-lg font-bold uppercase mb-2",
};

function Escalator({ value, onChange, onSubmit, onSuggest, isLoading, isSuggesting }) {
  return (
    <section id="escalator" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Your Current Title</h2>
      <input
        className={classNames.input + " mb-3"}
        placeholder="e.g. Junior Accountant"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        <button className={classNames.btnPrimary} onClick={onSubmit} disabled={isLoading || !value.trim()}>
          {isLoading ? (
            <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : "Escalate →"}
        </button>
        <button className={classNames.btnYellow} onClick={onSuggest} disabled={isSuggesting}>
          {isSuggesting ? "..." : "Surprise Me"}
        </button>
      </div>
    </section>
  );
}

function Results({ titles, onSave, sourceTitle }) {
  if (!titles || titles.length === 0) return null;
  return (
    <section id="results" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Your Rebrands</h2>
      <p className="text-sm mb-3 italic">From: <strong>{sourceTitle}</strong></p>
      <div className="space-y-2">
        {titles.map((t, i) => (
          <div key={i} className={classNames.chip}>
            <span className="font-bold">{t}</span>
            <button className={classNames.btnGhost} onClick={() => onSave(t)}>Save</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function History({ docs, onDelete }) {
  return (
    <section id="history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Saved Titles ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-[#6b6b80]">No rebrands saved yet. Escalate something.</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <li key={d._id} className={classNames.historyItem}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{d.title}</div>
                  <div className="text-xs text-[#6b6b80] uppercase tracking-wider">from: {d.source}</div>
                </div>
                <button className={classNames.btnGhost} onClick={() => onDelete(d._id)}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("title-escalator");
  const { docs } = useLiveQuery("_id", { descending: true });
  const [input, setInput] = useState("");
  const [titles, setTitles] = useState([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const escalate = async () => {
    const src = input.trim();
    if (!src) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Take this job title: "${src}". Generate 5 absurd, over-the-top LinkedIn-influencer parody rebrands of it. Think "Chief Vibe Architect", "Director of Forward Synergy", "VP of Thought Leadership". Be creative, pompous, slightly ridiculous.`,
        { schema: { properties: { titles: { type: "array", items: { type: "string" } } } } }
      );
      const data = JSON.parse(res);
      setTitles(data.titles || []);
      setSourceTitle(src);
    } finally {
      setIsLoading(false);
    }
  };

  const suggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await callAI(
        `Give one single mundane real-world job title (like "Barista" or "Assistant Manager"). Just the title, nothing fancy.`,
        { schema: { properties: { title: { type: "string" } } } }
      );
      const data = JSON.parse(res);
      if (data.title) setInput(data.title);
    } finally {
      setIsSuggesting(false);
    }
  };

  const save = (title) => {
    database.put({ title, source: sourceTitle, createdAt: Date.now() });
  };

  const del = (id) => database.del(id);

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Title Escalator</h1>
        <p className={classNames.subtitle}>Promote Yourself In One Click</p>
      </header>
      <Escalator
        value={input}
        onChange={setInput}
        onSubmit={escalate}
        onSuggest={suggest}
        isLoading={isLoading}
        isSuggesting={isSuggesting}
      />
      <Results titles={titles} onSave={save} sourceTitle={sourceTitle} />
      <History docs={docs} onDelete={del} />
    </main>
  );
}