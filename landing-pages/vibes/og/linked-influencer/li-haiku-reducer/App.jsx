import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6",
  header: "max-w-2xl mx-auto mb-8",
  title: "text-2xl font-semibold tracking-tight uppercase",
  feature: "max-w-2xl mx-auto mb-6 p-5 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded",
  featureTitle: "text-xs font-semibold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-3",
};

function Reducer({ source, setSource, onReduce, isLoading, trySample }) {
  return (
    <section id="reducer" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste Post</h2>
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Paste that 14-paragraph LinkedIn manifesto about synergy, grit, and Q3 learnings..."
        className="w-full h-48 p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded font-mono text-sm bg-[oklch(0.96_0.01_90)] focus:outline-none"
      />
      <button
        onClick={onReduce}
        disabled={isLoading || !source.trim()}
        className="mt-3 px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded text-xs uppercase tracking-[0.08em] font-bold shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeDasharray="45 60" /></svg>
            Distilling...
          </span>
        ) : "Reduce to Haiku"}
      </button>
      <button
        onClick={trySample}
        disabled={isLoading}
        className="mt-3 ml-2 px-3 py-2 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded text-xs uppercase tracking-[0.08em] font-bold shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
      >
        Try a sample
      </button>
    </section>
  );
}

function Haiku({ haiku }) {
  return (
    <section id="haiku" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Distilled</h2>
      {haiku ? (
        <div className="py-6 text-center">
          {haiku.split("\n").map((line, i) => (
            <p key={i} className="font-serif text-xl text-[oklch(0.15_0.02_280)] leading-relaxed italic">{line}</p>
          ))}
        </div>
      ) : (
        <p className="font-serif text-base text-[oklch(0.50_0.02_280)] italic py-6 text-center">Seventeen syllables await.</p>
      )}
    </section>
  );
}

function History({ entries }) {
  const [openId, setOpenId] = React.useState(null);
  return (
    <section id="history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Past Reductions</h2>
      {entries.length === 0 ? (
        <p className="font-serif italic text-sm text-[oklch(0.50_0.02_280)]">Nothing distilled yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((doc) => (
            <li key={doc._id} className="border-[3px] border-[oklch(0.15_0.02_280)] rounded bg-[oklch(0.96_0.01_90)]">
              <button
                onClick={() => setOpenId(openId === doc._id ? null : doc._id)}
                className="w-full text-left p-3 hover:bg-[oklch(0.85_0.18_85)] transition-colors"
              >
                {doc.haiku.split("\n").map((line, i) => (
                  <p key={i} className="font-serif italic text-[oklch(0.15_0.02_280)]">{line}</p>
                ))}
              </button>
              {openId === doc._id && (
                <div className="p-3 border-t-[3px] border-[oklch(0.15_0.02_280)] bg-white">
                  <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-2">Original</p>
                  <p className="font-mono text-xs text-[oklch(0.15_0.02_280)] whitespace-pre-wrap">{doc.source}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("linkedin-haiku-db");
  const [source, setSource] = React.useState("");
  const [haiku, setHaiku] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const { docs } = useLiveQuery("_id", { descending: true, limit: 50 });
  const entries = docs.filter((d) => d.type === "haiku");

  async function onReduce() {
    if (!source.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Compress this LinkedIn post into a sincere 3-line haiku (5-7-5 syllables). Strip buzzwords, flattery, filler. Capture what it's actually saying, honestly. Return line1, line2, line3 as plain text.\n\nPOST:\n${source}`,
        { schema: { properties: { line1: { type: "string" }, line2: { type: "string" }, line3: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      const text = `${parsed.line1}\n${parsed.line2}\n${parsed.line3}`;
      setHaiku(text);
      await database.put({ type: "haiku", source, haiku: text, createdAt: Date.now() });
    } finally {
      setIsLoading(false);
    }
  }

  async function trySample() {
    setIsLoading(true);
    try {
      const res = await callAI(
        "Generate a realistic, cringeworthy, long-winded LinkedIn post (200+ words) full of buzzwords, humble-bragging, and vague life lessons.",
        { schema: { properties: { post: { type: "string" } } } }
      );
      setSource(JSON.parse(res).post);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Noise → Haiku</h1>
        <p className="text-sm text-[oklch(0.50_0.02_280)] mt-2 font-serif italic">Distill corporate verbosity into seventeen honest syllables.</p>
      </header>
      <Reducer source={source} setSource={setSource} onReduce={onReduce} isLoading={isLoading} trySample={trySample} />
      <Haiku haiku={haiku} />
      <History entries={entries} />
    </main>
  );
}