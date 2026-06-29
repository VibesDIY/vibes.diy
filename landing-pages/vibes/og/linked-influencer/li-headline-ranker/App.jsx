import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] p-4 shadow-[4px_4px_0px_#1a1a2e]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  feature: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] p-4 shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-lg font-bold uppercase tracking-wide mb-3 text-[#1a1a2e]",
};

function TopicInput({ topic, setTopic, onGenerate, isLoading }) {
  const [suggesting, setSuggesting] = React.useState(false);
  async function suggest() {
    setSuggesting(true);
    try {
      const raw = await callAI("Suggest one short, mundane everyday topic (3-6 words) that would be absurd to make a LinkedIn post about. Just the topic itself.", { schema: { properties: { topic: { type: "string" } } } });
      setTopic(JSON.parse(raw).topic || "");
    } finally { setSuggesting(false); }
  }
  return (
    <section id="topic-input" className={classNames.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.featureTitle + " mb-0"}>New Batch</h2>
        <button onClick={suggest} disabled={suggesting} className="text-[0.65rem] uppercase tracking-widest bg-[#4361ee] text-white border-2 border-[#1a1a2e] px-2 py-1 shadow-[2px_2px_0px_#1a1a2e] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#1a1a2e] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all">
          {suggesting ? "..." : "Idea?"}
        </button>
      </div>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. drinking water at work"
        className="w-full p-3 border-[3px] border-[#1a1a2e] rounded-[4px] mb-3 font-mono text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1a2e] transition-all"
      />
      <button
        onClick={onGenerate}
        disabled={isLoading || !topic.trim()}
        className="px-4 py-2 bg-[#e63946] text-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] uppercase tracking-wide text-sm font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-all inline-flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42" strokeDashoffset="10" /></svg>
            Cooking...
          </>
        ) : "Generate"}
      </button>
    </section>
  );
}

function rankLabel(score) {
  if (score >= 70) return { text: "FIRE", bg: "bg-[#e63946]", fg: "text-white" };
  if (score >= 40) return { text: "MID", bg: "bg-[#f4c430]", fg: "text-[#1a1a2e]" };
  return { text: "FLOPS", bg: "bg-[#6b6b80]", fg: "text-white" };
}

function Podium({ items }) {
  const order = [1, 0, 2]; // 2nd, 1st, 3rd visually
  const heights = { 0: "h-32", 1: "h-24", 2: "h-20" };
  const colors = { 0: "bg-[#f4c430]", 1: "bg-[#cfcfe0]", 2: "bg-[#c98a5b]" };
  return (
    <div className="grid grid-cols-3 gap-2 mb-6 items-end">
      {order.map((i) => items[i] && (
        <div key={i} className="flex flex-col items-center">
          <div className="bg-white border-[3px] border-[#1a1a2e] p-2 mb-2 w-full shadow-[3px_3px_0px_#1a1a2e] min-h-[80px] flex flex-col justify-between">
            <p className="text-xs font-medium leading-tight">"{items[i].text}"</p>
            <div className="flex items-center justify-between mt-2">
              <span className="font-mono text-sm font-bold">{Math.round(items[i].viralScore)}</span>
              <span className={`${rankLabel(items[i].viralScore).bg} ${rankLabel(items[i].viralScore).fg} text-[0.6rem] uppercase tracking-widest px-1.5 py-0.5 border-2 border-[#1a1a2e]`}>{rankLabel(items[i].viralScore).text}</span>
            </div>
          </div>
          <div className={`${colors[i]} ${heights[i]} w-full border-[3px] border-[#1a1a2e] flex items-center justify-center font-mono font-bold text-2xl`}>#{i+1}</div>
        </div>
      ))}
    </div>
  );
}

function BarChart({ items, startRank }) {
  const max = Math.max(...items.map(i => i.viralScore), 1);
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => {
        const label = rankLabel(item.viralScore);
        const pct = Math.max(6, (item.viralScore / max) * 100);
        return (
          <li key={idx} className="border-[3px] border-[#1a1a2e] bg-white p-2 shadow-[3px_3px_0px_#1a1a2e]">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="font-mono text-xs font-bold text-[#6b6b80]">#{startRank + idx}</span>
              <span className="text-xs flex-1">"{item.text}"</span>
              <span className={`${label.bg} ${label.fg} text-[0.6rem] uppercase tracking-widest px-1.5 py-0.5 border-2 border-[#1a1a2e] shrink-0`}>{label.text}</span>
            </div>
            <div className="h-5 border-2 border-[#1a1a2e] bg-[#f5f2e8] relative">
              <div className={`${label.bg} h-full border-r-2 border-[#1a1a2e]`} style={{ width: `${pct}%` }} />
              <span className="absolute right-1 top-0 text-xs font-mono font-bold leading-5">{Math.round(item.viralScore)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Results({ current }) {
  return (
    <section id="results" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>The Rankings</h2>
      {!current ? (
        <p className="text-sm text-[#6b6b80] font-mono">Enter a topic above to cook a fresh batch.</p>
      ) : (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-[#6b6b80] mb-3">Topic: <span className="text-[#1a1a2e] font-bold">{current.topic}</span></p>
          <Podium items={current.headlines.slice(0,3)} />
          <BarChart items={current.headlines.slice(3)} startRank={4} />
        </>
      )}
    </section>
  );
}

function History({ sessions, onLoad }) {
  return (
    <section id="history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Past Sessions</h2>
      {(!sessions || sessions.length === 0) ? (
        <p className="text-sm text-[#6b6b80] font-mono">No batches yet.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const top = s.headlines?.[0]?.viralScore ?? 0;
            return (
              <li key={s._id}>
                <button onClick={() => onLoad(s._id)} className="w-full text-left border-[3px] border-[#1a1a2e] bg-white p-2 shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1a2e] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate">{s.topic}</span>
                  <span className="font-mono text-xs bg-[#f4c430] border-2 border-[#1a1a2e] px-1.5 py-0.5 shrink-0">TOP {Math.round(top)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringe-lab-db");
  const [topic, setTopic] = React.useState("");
  const [current, setCurrent] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true });

  async function onGenerate() {
    setIsLoading(true);
    try {
      const raw = await callAI(
        `Generate 10 absurd, cringe LinkedIn-influencer-style headlines about "${topic}". Each headline should be the kind of humblebrag thought-leader post that makes people cringe. Rank them with a viralScore 0-100 (higher = more viral). Make scores vary widely.`,
        { schema: { properties: { headlines: { type: "array", items: { type: "object", properties: { text: { type: "string" }, viralScore: { type: "number" } } } } } } }
      );
      const parsed = JSON.parse(raw);
      const sorted = (parsed.headlines || []).sort((a,b) => b.viralScore - a.viralScore).slice(0,10);
      const doc = { type: "session", topic, headlines: sorted, createdAt: Date.now() };
      const { id } = await database.put(doc);
      setCurrent({ ...doc, _id: id });
      setTopic("");
    } finally { setIsLoading(false); }
  }

  async function loadSession(id) {
    const doc = await database.get(id);
    setCurrent(doc);
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Cringe Lab</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[#6b6b80] mt-1">Headline Virality Simulator</p>
      </header>
      <TopicInput topic={topic} setTopic={setTopic} onGenerate={onGenerate} isLoading={isLoading} />
      <Results current={current} />
      <History sessions={sessions} onLoad={loadSession} />
    </main>
  );
}