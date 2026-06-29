import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f2e8] p-4 font-['Space_Grotesk',sans-serif] text-[#0f172a]",
  shell: "max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4",
  header: "col-span-full bg-white border-[3px] border-[#0f172a] rounded p-4 shadow-[4px_4px_0px_#0f172a]",
  title: "text-2xl md:text-3xl font-bold uppercase tracking-tight",
  sidebar: "bg-white border-[3px] border-[#0f172a] rounded p-3 shadow-[4px_4px_0px_#0f172a]",
  feature: "bg-white border-[3px] border-[#0f172a] rounded p-4 shadow-[4px_4px_0px_#0f172a]",
  featureTitle: "text-lg font-bold uppercase mb-3 tracking-tight",
};

function Generator({ topic, setTopic, onGenerate, isLoading, onSuggest }) {
  return (
    <section id="generator" className={c.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={c.featureTitle}>New Topic</h2>
        <button onClick={onSuggest} disabled={isLoading} className="text-[0.65rem] uppercase tracking-widest px-2 py-1 border-[2px] border-[#0f172a] bg-[#eab308] rounded hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0px_#0f172a] transition-all">✨ Idea</button>
      </div>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. waking up at 5am, drinking water, quitting my job to sell candles..."
        rows={3}
        className="w-full p-3 border-[3px] border-[#0f172a] rounded font-mono text-sm mb-3 focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#0f172a] transition-all"
      />
      <button
        onClick={onGenerate}
        disabled={isLoading || !topic.trim()}
        className="px-5 py-2 bg-[#dc2626] text-white border-[3px] border-[#0f172a] rounded uppercase tracking-wider font-bold text-sm shadow-[4px_4px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" strokeWidth="3" strokeDasharray="40 20"/></svg>
            Cooking...
          </span>
        ) : "Generate 10"}
      </button>
    </section>
  );
}

function Leaderboard({ topic, headlines }) {
  if (!headlines || headlines.length === 0) {
    return (
      <section id="leaderboard" className={c.feature + " mt-4"}>
        <h2 className={c.featureTitle}>Leaderboard</h2>
        <p className="text-sm text-[#64748b] uppercase tracking-wider">No headlines yet. Feed the machine a topic.</p>
      </section>
    );
  }
  const colors = ["#dc2626", "#eab308", "#2563eb", "#16a34a"];
  return (
    <section id="leaderboard" className={c.feature + " mt-4"}>
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <h2 className={c.featureTitle}>Leaderboard</h2>
        <span className="text-xs uppercase tracking-widest text-[#64748b] font-mono truncate">RE: {topic}</span>
      </div>
      <ol className="space-y-2">
        {headlines.map((h, i) => {
          const bg = colors[i % colors.length];
          const textLight = bg === "#eab308" ? "text-[#0f172a]" : "text-white";
          return (
            <li key={i} className="border-[3px] border-[#0f172a] rounded overflow-hidden shadow-[3px_3px_0px_#0f172a]">
              <div className="flex items-stretch">
                <div className={`flex items-center justify-center w-12 font-mono font-bold text-lg border-r-[3px] border-[#0f172a] ${textLight}`} style={{ background: bg }}>
                  #{i + 1}
                </div>
                <div className="flex-1 p-2 bg-white relative">
                  <div className="absolute inset-0 opacity-20" style={{ background: bg, width: `${h.score}%` }} />
                  <div className="relative flex items-center justify-between gap-2">
                    <p className="text-sm font-medium flex-1">
                      {i === 0 && <span className="mr-1">🎉✨🎊</span>}
                      {h.text}
                    </p>
                    <span className="font-mono font-bold text-lg tabular-nums">{h.score}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function History({ docs, onView, viewId, onDelete }) {
  return (
    <aside id="history" className={c.sidebar}>
      <h2 className={c.featureTitle}>Past Runs</h2>
      {(!docs || docs.length === 0) ? (
        <p className="text-xs uppercase tracking-widest text-[#64748b]">Empty. Go generate.</p>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {docs.map((d) => {
            const active = d._id === viewId;
            return (
              <li key={d._id} className={`border-[2px] border-[#0f172a] rounded p-2 cursor-pointer transition-all ${active ? "bg-[#eab308]" : "bg-white hover:bg-[#fef3c7]"}`} onClick={() => onView(d)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.topic}</p>
                    <p className="text-[0.6rem] uppercase tracking-widest text-[#64748b] font-mono mt-1">
                      {new Date(d.createdAt).toLocaleDateString()} · top {d.headlines?.[0]?.score ?? "?"}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(d._id); }} className="text-[0.6rem] uppercase px-1.5 py-0.5 border-[2px] border-[#0f172a] bg-[#dc2626] text-white rounded hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">×</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("headline-lab");
  const [topic, setTopic] = React.useState("");
  const [headlines, setHeadlines] = React.useState([]);
  const [currentTopic, setCurrentTopic] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [viewId, setViewId] = React.useState(null);
  const { docs } = useLiveQuery("type", { key: "run", descending: true });

  const generate = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Generate exactly 10 cringe-corporate parody LinkedIn headlines about: "${topic}". Each should be over-the-top LinkedIn influencer voice (humblebrag, fake epiphany, "I'll never forget what my Uber driver said", etc). Include a simulated engagement score 0-99 for each. Return sorted by score descending.`,
        { schema: { properties: { headlines: { type: "array", items: { type: "object", properties: { text: { type: "string" }, score: { type: "number" } } } } } } }
      );
      const data = JSON.parse(res);
      const sorted = (data.headlines || []).slice(0, 10).sort((a, b) => b.score - a.score);
      setHeadlines(sorted);
      setCurrentTopic(topic);
      const ok = await database.put({ type: "run", topic, headlines: sorted, createdAt: Date.now() });
      setViewId(ok.id);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const suggest = async () => {
    setIsLoading(true);
    try {
      const res = await callAI("Suggest one absurd, specific topic for parody LinkedIn headlines. One short phrase only.", { schema: { properties: { topic: { type: "string" } } } });
      setTopic(JSON.parse(res).topic || "");
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const viewRun = (d) => { setHeadlines(d.headlines); setCurrentTopic(d.topic); setViewId(d._id); };

  return (
    <main id="app" className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>HeadlineLab</h1>
          <p className="text-xs uppercase tracking-widest text-[#64748b] mt-1">Parody Engagement Simulator</p>
        </header>
        <History docs={docs} onView={viewRun} viewId={viewId} onDelete={(id) => database.del(id)} />
        <div>
          <Generator topic={topic} setTopic={setTopic} onGenerate={generate} isLoading={isLoading} onSuggest={suggest} />
          <Leaderboard topic={currentTopic} headlines={headlines} />
        </div>
      </div>
    </main>
  );
}