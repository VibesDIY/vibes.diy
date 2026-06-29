import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"



function InputFeature({ value, onChange, onAnalyze, onSuggest, isLoading, isSuggesting }) {
  return (
    <section id="input-feature" className={c.feature}>
      <h2 className={c.featureTitle}>1. Paste Connections</h2>
      <p className="text-xs text-[#6b6b7b] mb-3">5–10 connections, one per line — Name, Title</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Chad Synergy, Chief Vibes Officer\nSamantha Rivera, Product Manager\n..."}
        rows={7}
        className={c.textarea}
      />
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <button onClick={onAnalyze} disabled={isLoading} className={c.btnPrimary}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M12 2 A10 10 0 0 1 22 12" />
              </svg>
              Auditing...
            </span>
          ) : "Run Audit"}
        </button>
        <button onClick={onSuggest} disabled={isSuggesting} className={c.btnSecondary}>
          {isSuggesting ? "..." : "✨ Fill Example"}
        </button>
      </div>
    </section>
  );
}

function Gauge({ score }) {
  const s = Math.max(0, Math.min(100, score || 0));
  const angle = (s / 100) * 180 - 90;
  const color = s < 33 ? "#d93f2b" : s < 66 ? "#f2cd3c" : "#4aa862";
  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#17171f" strokeWidth="20" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${(s / 100) * 251} 251`} />
        <line x1="100" y1="100" x2={100 + 70 * Math.cos((angle * Math.PI) / 180)} y2={100 + 70 * Math.sin((angle * Math.PI) / 180)}
          stroke="#17171f" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="8" fill="#17171f" />
      </svg>
      <div className="font-mono text-4xl font-bold text-[#17171f] mt-1">{s}</div>
      <div className="text-[0.6rem] uppercase tracking-widest text-[#6b6b7b]">Vibe Score / 100</div>
    </div>
  );
}

function Pie({ result }) {
  const slices = [
    { label: "Buzzword Bros", value: result.buzzwordBros || 0, color: "#d93f2b" },
    { label: "Actual Humans", value: result.actualHumans || 0, color: "#4aa862" },
    { label: "MLM Recruiters", value: result.mlmRecruiters || 0, color: "#f2cd3c" },
    { label: "Ghost Profiles", value: result.ghostProfiles || 0, color: "#3a6ed4" },
  ];
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const cx = 70, cy = 70, r = 60;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width="150" height="150" viewBox="0 0 140 140">
        {slices.map((s, i) => {
          if (!s.value) return null;
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += s.value;
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
          const d = s.value === total
            ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return <path key={i} d={d} fill={s.color} stroke="#17171f" strokeWidth="3" />;
        })}
      </svg>
      <ul className="flex-1 min-w-[150px] space-y-1.5">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm border-[2px] border-[#17171f] rounded px-2 py-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-[2px] border-[#17171f]" style={{ background: s.color }}></span>
              <span className="font-bold uppercase text-[0.7rem] tracking-wide">{s.label}</span>
            </span>
            <span className="font-mono font-bold">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsFeature({ result }) {
  return (
    <section id="results-feature" className={c.feature}>
      <h2 className={c.featureTitle}>2. Audit Results</h2>
      {!result ? (
        <p className="text-xs text-[#6b6b7b]">Run an audit to see the damage.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-5 items-center md:items-start">
            <Gauge score={result.vibeScore} />
            <div className="flex-1 w-full">
              <div className={c.label}>Category Breakdown</div>
              <Pie result={result} />
            </div>
          </div>
          <div className="border-[3px] border-[#17171f] rounded p-4 bg-[#f2cd3c] shadow-[3px_3px_0px_#17171f]">
            <div className="text-[0.65rem] uppercase tracking-widest font-bold mb-2">🔥 The Roast</div>
            <p className="text-sm leading-relaxed text-[#17171f]">{result.roast}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryFeature({ audits, onSelect }) {
  return (
    <section id="history-feature" className={c.feature}>
      <h2 className={c.featureTitle}>3. Past Audits</h2>
      {!audits || audits.length === 0 ? (
        <p className="text-xs text-[#6b6b7b]">No audits yet. Run one above.</p>
      ) : (
        <ul className="space-y-2">
          {audits.map((a) => (
            <li key={a._id}>
              <button
                onClick={() => onSelect(a)}
                className="w-full text-left border-[3px] border-[#17171f] rounded p-3 bg-white hover:bg-[#f2cd3c] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#17171f] transition-all flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono font-bold text-2xl text-[#d93f2b]">{a.vibeScore}</span>
                  <span className="text-xs text-[#17171f] line-clamp-1">{(a.roast || "").slice(0, 70)}...</span>
                </span>
                <span className="text-[0.6rem] uppercase tracking-widest text-[#6b6b7b] font-mono whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("network-auditor-3000");
  const [input, setInput] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const { docs: audits } = useLiveQuery("type", { key: "audit", descending: true });

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await callAI("Generate 7 fake LinkedIn connections in the format 'Name, Title'. Mix buzzword bros, normal humans, MLM recruiters, and suspicious profiles. Be satirical but realistic.", {
        schema: { properties: { lines: { type: "array", items: { type: "string" } } } }
      });
      const data = JSON.parse(res);
      setInput(data.lines.join("\n"));
    } finally { setIsSuggesting(false); }
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(`You are a snarky LinkedIn network analyst. Given these connections, produce a parody audit. Connections:\n\n${input}\n\nReturn: vibeScore (0-100), category counts (must sum to total connections) for buzzwordBros, actualHumans, mlmRecruiters, ghostProfiles, and a single savage roast paragraph (2-3 sentences).`, {
        schema: {
          properties: {
            vibeScore: { type: "number" },
            buzzwordBros: { type: "number" },
            actualHumans: { type: "number" },
            mlmRecruiters: { type: "number" },
            ghostProfiles: { type: "number" },
            roast: { type: "string" }
          }
        }
      });
      const data = JSON.parse(res);
      const doc = { type: "audit", createdAt: Date.now(), input, ...data };
      const saved = await database.put(doc);
      setResult({ ...doc, _id: saved.id });
    } finally { setIsLoading(false); }
  };

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Network Auditor 3000</h1>
        <p className={c.subtitle}>Forensic Analysis Of Your Professional Illusion</p>
      </header>
      <InputFeature
        value={input}
        onChange={setInput}
        onAnalyze={handleAnalyze}
        onSuggest={handleSuggest}
        isLoading={isLoading}
        isSuggesting={isSuggesting}
      />
      <ResultsFeature result={result} />
      <HistoryFeature audits={audits} onSelect={setResult} />
    </main>
  );
}