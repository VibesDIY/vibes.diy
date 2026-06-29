import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  header: "max-w-3xl mx-auto mb-6",
  title: "text-4xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-6 p-5 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] mb-3 text-[oklch(0.50_0.02_280)]",
};

function QuoteForm({ onAttribute, isLoading, onSuggest, text, setText }) {
  return (
    <section id="quote-form" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Submit A Sentence</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste any sentence here..."
        rows={3}
        className="w-full p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white focus:outline-none focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all text-sm"
      />
      <div className="flex gap-3 mt-3 flex-wrap">
        <button
          onClick={onAttribute}
          disabled={isLoading || !text.trim()}
          className="px-5 py-2 bg-[oklch(0.55_0.24_28)] text-white font-bold uppercase tracking-[0.08em] text-xs border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 20" /></svg>
              Attributing...
            </>
          ) : "Attribute"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isLoading}
          className="px-4 py-2 bg-[oklch(0.85_0.18_85)] font-bold uppercase tracking-[0.08em] text-xs border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          Suggest Sentence
        </button>
      </div>
    </section>
  );
}

function LatestAttribution({ doc }) {
  if (!doc) return (
    <section id="latest" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Latest Attribution</h2>
      <p className="text-sm text-[oklch(0.50_0.02_280)]">No attributions yet. Paste a sentence above to begin manufacturing wisdom.</p>
    </section>
  );
  return (
    <section id="latest" className="max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden">
      <div className="bg-[oklch(0.52_0.18_255)] text-white px-5 py-2 border-b-[3px] border-[oklch(0.15_0.02_280)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em]">Freshly Misattributed</h2>
      </div>
      <div className="p-6">
        <p className="text-xl font-semibold leading-snug mb-4">&ldquo;{doc.quote}&rdquo;</p>
        <div className="border-t-[2px] border-[oklch(0.15_0.02_280)] pt-3">
          <p className="font-bold uppercase tracking-tight">{doc.ceo}</p>
          <p className="text-xs uppercase tracking-[0.1em] text-[oklch(0.50_0.02_280)] font-mono">{doc.title} · {doc.company}</p>
        </div>
      </div>
    </section>
  );
}

function Archive({ docs, onDelete }) {
  return (
    <section id="archive" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Hall Of Fabricated Wisdom ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-[oklch(0.50_0.02_280)]">The archive awaits its first fraud.</p>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li key={d._id} className="p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] hover:bg-[oklch(0.85_0.18_85)] transition-colors">
              <p className="text-sm mb-2">&ldquo;{d.quote}&rdquo;</p>
              <div className="flex justify-between items-end gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase">{d.ceo}</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.1em] text-[oklch(0.50_0.02_280)] font-mono">{d.title} · {d.company}</p>
                </div>
                <button
                  onClick={() => onDelete(d._id)}
                  className="px-2 py-1 text-[0.65rem] uppercase tracking-[0.1em] font-bold bg-white border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:bg-[oklch(0.55_0.24_28)] hover:text-white transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("quote-misattributor-3000");
  const { docs } = useLiveQuery("_id", { descending: true, limit: 100 });
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const latest = docs[0];

  const attribute = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Invent a completely absurd, parody fortune-500 CEO to attribute this sentence to. Invent a ridiculous company name (not a real one), a pompous overly-specific title, and a plausible-sounding full CEO name. Quote: "${text}"`,
        { schema: { properties: { ceo: { type: "string" }, title: { type: "string" }, company: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      await database.put({ type: "attribution", quote: text.trim(), ...parsed, createdAt: Date.now() });
      setText("");
    } finally {
      setIsLoading(false);
    }
  };

  const suggest = async () => {
    setIsLoading(true);
    try {
      const res = await callAI("Write one short, vaguely profound-sounding sentence (10-20 words) that could pass as a business-guru quote. Just the sentence, nothing else.", { schema: { properties: { sentence: { type: "string" } } } });
      setText(JSON.parse(res).sentence);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Quote Misattributor 3000</h1>
        <p className="text-sm mt-2 text-[oklch(0.50_0.02_280)] uppercase tracking-[0.1em]">Paste wisdom. Receive an executive.</p>
      </header>
      <QuoteForm onAttribute={attribute} onSuggest={suggest} isLoading={isLoading} text={text} setText={setText} />
      <LatestAttribution doc={latest} />
      <Archive docs={docs} onDelete={(id) => database.del(id)} />
    </main>
  );
}