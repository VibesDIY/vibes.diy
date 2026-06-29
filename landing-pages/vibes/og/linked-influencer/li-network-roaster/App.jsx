import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded p-5 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-5 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded p-5 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-3",
};

function InputRoast({ onRoast, isLoading }) {
  const [text, setText] = React.useState("");
  return (
    <section id="input-roast" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste Your Orbit (5 Connections)</h2>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={"Sarah Chen — VP Marketing at Initech\nDoug Ramsey — Synergy Evangelist at CloudMoose\n..."}
        rows={6}
        className="w-full p-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded text-sm font-mono focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all duration-150"
      />
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => onRoast(text)}
          disabled={isLoading || !text.trim()}
          className="px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded font-bold uppercase text-sm tracking-[0.08em] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 transition-all duration-150 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" strokeDasharray="42 60" strokeLinecap="round" />
              </svg>
              Grading...
            </>
          ) : "Roast Me"}
        </button>
        <button
          onClick={async () => {
            const r = await callAI("Generate 5 fake LinkedIn connections as lines like 'Name — Title at Company'. Mix of corporate buzzwords.", { schema: { properties: { lines: { type: "array", items: { type: "string" } } } } });
            setText(JSON.parse(r).lines.join("\n"));
          }}
          disabled={isLoading}
          className="px-3 py-2 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded font-bold uppercase text-xs tracking-[0.08em] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
        >
          Suggest
        </button>
      </div>
    </section>
  );
}

function GradeBadge({ grade }) {
  const color = grade?.startsWith("A") ? "oklch(0.62_0.19_145)" : grade?.startsWith("B") ? "oklch(0.52_0.18_255)" : grade?.startsWith("C") ? "oklch(0.85_0.18_85)" : "oklch(0.55_0.24_28)";
  const ink = grade?.startsWith("C") ? "oklch(0.15_0.02_280)" : "white";
  return (
    <div className="inline-flex items-center justify-center w-20 h-20 border-[3px] border-[oklch(0.15_0.02_280)] rounded shadow-[4px_4px_0px_oklch(0.15_0.02_280)] font-mono font-bold text-4xl" style={{ background: color, color: ink }}>
      {grade || "?"}
    </div>
  );
}

function LatestRoast({ roast }) {
  if (!roast) {
    return (
      <section id="latest-roast" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Latest Report Card</h2>
        <p className="text-sm text-[oklch(0.50_0.02_280)]">Paste 5 connections above to receive your grade.</p>
      </section>
    );
  }
  return (
    <section id="latest-roast" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Latest Report Card</h2>
      <div className="flex gap-4 items-start mb-4">
        <GradeBadge grade={roast.grade} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-1">Breakdown</div>
          <ul className="space-y-1">
            {(roast.stats || []).map((s, i) => (
              <li key={i} className="font-mono text-sm border-b border-[oklch(0.15_0.02_280)]/20 py-1">{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed">
        {(roast.paragraphs || []).map((p, i) => (
          <p key={i} className="border-l-[3px] border-[oklch(0.55_0.24_28)] pl-3">{p}</p>
        ))}
      </div>
    </section>
  );
}

function Transcript({ docs, onSelect, selectedId }) {
  return (
    <section id="transcript" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Transcript ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-[oklch(0.50_0.02_280)]">No grades on file.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-[2px] border-[oklch(0.15_0.02_280)]">
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] py-2">Date</th>
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] py-2">Preview</th>
              <th className="text-right text-[0.6rem] uppercase tracking-[0.15em] py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => {
              const g = d.grade || "?";
              const bg = g.startsWith("A") ? "oklch(0.62_0.19_145)" : g.startsWith("B") ? "oklch(0.52_0.18_255)" : g.startsWith("C") ? "oklch(0.85_0.18_85)" : "oklch(0.55_0.24_28)";
              const ink = g.startsWith("C") ? "oklch(0.15_0.02_280)" : "white";
              return (
                <tr key={d._id} onClick={() => onSelect(d)} className={`cursor-pointer hover:bg-[oklch(0.85_0.18_85)] ${selectedId === d._id ? "bg-[oklch(0.85_0.18_85)]" : ""}`}>
                  <td className="font-mono text-xs py-2 border-b border-[oklch(0.15_0.02_280)]/20">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="text-sm py-2 border-b border-[oklch(0.15_0.02_280)]/20 truncate max-w-[200px]">{(d.input || "").split("\n")[0]}</td>
                  <td className="text-right py-2 border-b border-[oklch(0.15_0.02_280)]/20">
                    <span className="inline-block px-2 py-1 font-mono font-bold text-sm border-[2px] border-[oklch(0.15_0.02_280)] rounded" style={{ background: bg, color: ink }}>{g}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("network-roaster");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const [selected, setSelected] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRoast = async (text) => {
    setIsLoading(true);
    try {
      const prompt = `You are a savage comedic network analyst. Given these LinkedIn connections, produce: (1) a letter grade A+ to F for the user's professional orbit, (2) 3-5 punchy percentage-based stat lines like "73% middle managers clinging to title inflation", (3) exactly 3 roast paragraphs (2-3 sentences each) mocking the user's network quality. Be witty, specific, brutal-but-funny. Connections:\n\n${text}`;
      const r = await callAI(prompt, {
        schema: {
          properties: {
            grade: { type: "string", description: "Letter grade A+ through F" },
            stats: { type: "array", items: { type: "string" } },
            paragraphs: { type: "array", items: { type: "string" } }
          }
        }
      });
      const parsed = JSON.parse(r);
      const ok = await database.put({ ...parsed, input: text, createdAt: Date.now() });
      const saved = await database.get(ok.id);
      setSelected(saved);
    } finally {
      setIsLoading(false);
    }
  };

  const latest = selected || docs[0];

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Network Transcript</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-2">Orbit Analysis &amp; Grading Bureau</p>
      </header>
      <InputRoast onRoast={handleRoast} isLoading={isLoading} />
      <LatestRoast roast={latest} />
      <Transcript docs={docs} onSelect={setSelected} selectedId={selected?._id} />
    </main>
  );
}