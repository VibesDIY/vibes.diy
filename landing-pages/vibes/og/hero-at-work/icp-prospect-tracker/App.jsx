import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-4 font-['Space_Grotesk',sans-serif]",
  shell: "max-w-[920px] mx-auto",
  header: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_#1a1a2e] p-4 mb-6 flex items-center justify-between",
  title: "text-xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  card: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_#1a1a2e] p-5 mb-6",
  sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b7280] mb-3 font-semibold",
};

const STAGES = ["Lead", "Qualified", "Demo", "Closed-Won", "Closed-Lost"];

function QuickAdd({ database }) {
  const { useDocument } = useFireproof("pipeline-tracker");
  const today = new Date().toISOString().slice(0, 10);
  const { doc, merge, submit } = useDocument({
    type: "prospect",
    company: "",
    contact: "",
    stage: "Lead",
    fit: 3,
    value: "",
    lastTouch: today,
    createdAt: Date.now(),
  });

  const inputCls = "w-full border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 text-sm bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_#1a1a2e] transition-all";

  return (
    <section id="quick-add" className={classNames.card}>
      <div className={classNames.sectionLabel}>New Prospect</div>
      <form onSubmit={(e) => { e.preventDefault(); if (!doc.company.trim()) return; submit(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Company name" value={doc.company} onChange={(e) => merge({ company: e.target.value })} />
        <input className={inputCls} placeholder="Contact name" value={doc.contact} onChange={(e) => merge({ contact: e.target.value })} />
        <select className={inputCls} value={doc.stage} onChange={(e) => merge({ stage: e.target.value })}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1 border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 bg-white">
          <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#6b7280] mr-2">Fit</span>
          {[1,2,3,4,5].map(n => (
            <button type="button" key={n} onClick={() => merge({ fit: n })} className={`text-xl leading-none ${n <= doc.fit ? "text-[#f4c430]" : "text-[#d4d4d4]"}`}>★</button>
          ))}
        </div>
        <input type="number" className={inputCls} placeholder="Deal value ($)" value={doc.value} onChange={(e) => merge({ value: e.target.value })} />
        <input type="date" className={inputCls} value={doc.lastTouch} onChange={(e) => merge({ lastTouch: e.target.value })} />
        <button type="submit" className="sm:col-span-2 bg-[#e63946] text-white font-bold uppercase tracking-[0.08em] text-sm py-3 border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">Add Prospect</button>
      </form>
    </section>
  );
}

const STAGE_COLORS = {
  "Lead": "#3a82f6",
  "Qualified": "#f4c430",
  "Demo": "#8b5cf6",
  "Closed-Won": "#2a9d4a",
  "Closed-Lost": "#6b7280",
};

function Funnel({ prospects }) {
  const counts = STAGES.map(s => prospects.filter(p => p.stage === s).length);
  const max = Math.max(1, ...counts);
  return (
    <section id="funnel" className={classNames.card}>
      <div className={classNames.sectionLabel}>Pipeline Funnel</div>
      <div className="space-y-2">
        {STAGES.map((stage, i) => {
          const count = counts[i];
          const pct = (count / max) * 100;
          const nextCount = counts[i + 1];
          const conv = count > 0 && i < STAGES.length - 1 ? Math.round((nextCount / count) * 100) : null;
          const textColor = stage === "Qualified" ? "text-[#1a1a2e]" : "text-white";
          return (
            <div key={stage}>
              <div className="flex items-center gap-3">
                <div className="w-24 text-[0.7rem] uppercase tracking-[0.08em] font-semibold text-[#1a1a2e] shrink-0">{stage}</div>
                <div className="flex-1 h-8 bg-[#f5f2e8] border-[3px] border-[#1a1a2e] rounded-[4px] overflow-hidden">
                  <div className={`h-full flex items-center px-2 font-mono font-bold text-sm ${textColor}`} style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: STAGE_COLORS[stage] }}>{count}</div>
                </div>
              </div>
              {conv !== null && (
                <div className="ml-24 pl-3 text-[0.65rem] uppercase tracking-[0.15em] text-[#6b7280] font-mono">↓ {conv}%</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function nextStep(p) {
  const days = daysSince(p.lastTouch);
  if (p.stage === "Demo" && days > 5) return "Close it!";
  if (p.stage === "Qualified" && days > 7) return "Schedule demo";
  if (days > 14) return "Send a check-in";
  return null;
}

function Prospects({ prospects, database }) {
  const [activeStages, setActiveStages] = React.useState(new Set(STAGES));
  const [sortBy, setSortBy] = React.useState("staleness");

  const toggleStage = (s) => {
    const next = new Set(activeStages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setActiveStages(next);
  };

  const filtered = prospects.filter(p => activeStages.has(p.stage));
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "fit") return (b.fit || 0) - (a.fit || 0);
    if (sortBy === "staleness") return new Date(a.lastTouch) - new Date(b.lastTouch);
    if (sortBy === "value") return (Number(b.value) || 0) - (Number(a.value) || 0);
    if (sortBy === "company") return (a.company || "").localeCompare(b.company || "");
    return 0;
  });

  const touchToday = (p) => database.put({ ...p, lastTouch: new Date().toISOString().slice(0, 10) });

  return (
    <section id="prospects" className={classNames.card}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={classNames.sectionLabel + " !mb-0"}>Prospects ({sorted.length})</div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border-[3px] border-[#1a1a2e] rounded-[4px] px-2 py-1 text-xs uppercase tracking-[0.08em] font-semibold bg-white">
          <option value="staleness">Staleness</option>
          <option value="fit">Fit score</option>
          <option value="value">Deal value</option>
          <option value="company">Company A-Z</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {STAGES.map(s => {
          const on = activeStages.has(s);
          return (
            <button key={s} onClick={() => toggleStage(s)} className={`text-[0.65rem] uppercase tracking-[0.08em] font-bold px-2 py-1 border-[3px] border-[#1a1a2e] rounded-[4px] ${on ? "text-white shadow-[3px_3px_0_#1a1a2e]" : "bg-white text-[#6b7280] opacity-50"}`} style={on ? { backgroundColor: STAGE_COLORS[s] } : {}}>{s}</button>
          );
        })}
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-[#6b7280] text-sm">No prospects match your filters.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const days = daysSince(p.lastTouch);
            const stale = days > 14;
            const step = nextStep(p);
            return (
              <div key={p._id} className="border-[3px] border-[#1a1a2e] rounded-[4px] p-3 bg-white hover:bg-[#fef9e7] transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      {stale && <div className="w-2 h-2 rounded-full bg-[#e63946]" title="Stale"></div>}
                      <span className="font-bold text-[#1a1a2e]">{p.company}</span>
                      <span className="text-[#6b7280] text-sm">— {p.contact}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                      <span className="px-2 py-0.5 text-white font-semibold uppercase tracking-[0.08em] text-[0.6rem] rounded-[4px]" style={{ backgroundColor: STAGE_COLORS[p.stage], color: p.stage === "Qualified" ? "#1a1a2e" : "white" }}>{p.stage}</span>
                      <span className="text-[#f4c430]">{"★".repeat(p.fit)}<span className="text-[#d4d4d4]">{"★".repeat(5 - p.fit)}</span></span>
                      {p.value && <span className="font-mono font-bold text-[#2a9d4a]">${Number(p.value).toLocaleString()}</span>}
                      <span className="font-mono text-[#6b7280]">{days}d ago</span>
                    </div>
                    {step && <div className="mt-2 text-[0.7rem] uppercase tracking-[0.08em] font-bold text-[#3a82f6]">→ {step}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => touchToday(p)} className="text-[0.65rem] uppercase tracking-[0.08em] font-bold px-2 py-1 bg-[#f4c430] text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0_#1a1a2e] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all">Touched today</button>
                    <button onClick={() => database.del(p._id)} className="text-[0.65rem] uppercase tracking-[0.08em] font-bold px-2 py-1 bg-white text-[#e63946] border-[3px] border-[#1a1a2e] rounded-[4px] hover:shadow-[3px_3px_0_#1a1a2e] transition-all">×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Summary({ prospects }) {
  const open = prospects.filter(p => p.stage !== "Closed-Lost" && p.stage !== "Closed-Won");
  const totalValue = open.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  const now = new Date();
  const thisMonth = prospects.filter(p => {
    if (p.stage !== "Closed-Won") return false;
    const d = new Date(p.lastTouch);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const avgFit = prospects.length ? (prospects.reduce((s, p) => s + (p.fit || 0), 0) / prospects.length).toFixed(1) : "0.0";

  const tile = "border-[3px] border-[#1a1a2e] rounded-[4px] overflow-hidden shadow-[4px_4px_0_#1a1a2e]";
  const bar = "px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.15em] font-bold";
  const body = "p-4 bg-white font-mono font-bold text-2xl text-[#1a1a2e]";

  return (
    <section id="summary" className={classNames.card}>
      <div className={classNames.sectionLabel}>Summary</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={tile}>
          <div className={bar + " bg-[#e63946] text-white"}>Open pipeline</div>
          <div className={body}>${totalValue.toLocaleString()}</div>
        </div>
        <div className={tile}>
          <div className={bar + " bg-[#2a9d4a] text-white"}>Won this month</div>
          <div className={body}>{thisMonth}</div>
        </div>
        <div className={tile}>
          <div className={bar + " bg-[#f4c430] text-[#1a1a2e]"}>Avg fit score</div>
          <div className={body}>{avgFit} <span className="text-[#f4c430]">★</span></div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("pipeline-tracker");
  const { docs: prospects } = useLiveQuery("type", { key: "prospect" });
  return (
    <main id="app" className={classNames.page}>
      <div className={classNames.shell}>
        <header id="app-header" className={classNames.header}>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-[#e63946]"></div>
              <div className="w-3 h-3 bg-[#f4c430]"></div>
              <div className="w-3 h-3 bg-[#2a9d4a]"></div>
            </div>
            <h1 className={classNames.title}>Pipeline</h1>
          </div>
          <div className="text-[0.7rem] uppercase tracking-[0.08em] text-[#6b7280] font-semibold">B2B Tracker</div>
        </header>
        <QuickAdd database={database} />
        <Funnel prospects={prospects} />
        <Prospects prospects={prospects} database={database} />
        <Summary prospects={prospects} />
      </div>
    </main>
  );
}