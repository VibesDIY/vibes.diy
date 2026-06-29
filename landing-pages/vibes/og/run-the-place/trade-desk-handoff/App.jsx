import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-4 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-4",
  title: "text-2xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-4",
  featureTitle: "text-sm font-bold uppercase tracking-wider mb-3",
};

function NewEntry() {
  const { useDocument } = useFireproof("desk-handoff-log");
  const { doc, merge, submit } = useDocument(() => ({
    type: "handoff", trader: "", desk: "", positions: "", orders: "", clients: "", alerts: "",
    createdAt: Date.now(), ackAt: null, ackBy: null,
  }));
  const [loading, setLoading] = React.useState(false);

  const suggest = async () => {
    setLoading(true);
    try {
      const r = await callAI("Generate a realistic end-of-day trading desk handoff sample. Serious, concise, audit-log tone. Use tickers, sizes, levels.", {
        schema: { properties: {
          trader: { type: "string" }, desk: { type: "string" },
          positions: { type: "string" }, orders: { type: "string" },
          clients: { type: "string" }, alerts: { type: "string" },
        }}
      });
      merge(JSON.parse(r));
    } finally { setLoading(false); }
  };

  const inp = "w-full p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white font-['JetBrains_Mono',monospace] text-sm mb-2 focus:outline-none focus:shadow-[3px_3px_0_oklch(0.15_0.02_280)]";
  const lbl = "block text-[0.65rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)] mb-1 mt-2";

  return (
    <section id="new-entry" className={classNames.feature}>
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h2 className={classNames.featureTitle}>New Handoff Entry</h2>
        <button type="button" onClick={suggest} disabled={loading} className="px-2 py-1 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-[0.65rem] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] disabled:opacity-60 flex items-center gap-2">
          {loading && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/></svg>}
          {loading ? "Drafting…" : "AI Sample"}
        </button>
      </div>
      <form onSubmit={submit}>
        <label className={lbl}>Trader (Outgoing)</label>
        <input value={doc.trader} onChange={e => merge({ trader: e.target.value.toUpperCase() })} placeholder="e.g. J. MORGAN" className={inp} required />
        <label className={lbl}>Desk</label>
        <input value={doc.desk} onChange={e => merge({ desk: e.target.value.toUpperCase() })} placeholder="e.g. FX / RATES / EQUITIES" className={inp} required />
        <label className={lbl}>Open Positions Held Overnight</label>
        <textarea value={doc.positions} onChange={e => merge({ positions: e.target.value })} rows={3} placeholder="Ticker · Size · Avg · PnL" className={inp} />
        <label className={lbl}>Pending Orders</label>
        <textarea value={doc.orders} onChange={e => merge({ orders: e.target.value })} rows={2} placeholder="Working / GTC / Stop levels" className={inp} />
        <label className={lbl}>Key Client Conversations</label>
        <textarea value={doc.clients} onChange={e => merge({ clients: e.target.value })} rows={2} placeholder="Client · Topic · Follow-up" className={inp} />
        <label className={lbl}>Alerts for Next Shift</label>
        <textarea value={doc.alerts} onChange={e => merge({ alerts: e.target.value })} rows={2} placeholder="Must-know events, earnings, stops" className={inp} />
        <button type="submit" className="mt-3 px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white font-bold uppercase tracking-wider text-xs border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">Submit Handoff</button>
      </form>
    </section>
  );
}

function FilterBar({ dateFilter, traderFilter, setDateFilter, setTraderFilter }) {
  const inp = "p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white font-['JetBrains_Mono',monospace] text-sm";
  return (
    <section id="filter-bar" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Filter Audit Log</h2>
      <div className="flex flex-wrap gap-2">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={inp} />
        <input placeholder="TRADER" value={traderFilter} onChange={e => setTraderFilter(e.target.value.toUpperCase())} className={inp} />
        <button onClick={() => { setDateFilter(""); setTraderFilter(""); }} className="px-3 py-2 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-wider text-xs border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)]">Clear</button>
      </div>
    </section>
  );
}

function HandoffLog({ entries, onAck }) {
  const field = (label, val, mono) => val ? (
    <div className="mb-2">
      <div className="text-[0.6rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)]">{label}</div>
      <div className={`text-sm whitespace-pre-wrap ${mono ? "font-['JetBrains_Mono',monospace]" : ""}`}>{val}</div>
    </div>
  ) : null;
  return (
    <section id="handoff-log" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Handoff Log · {entries.length} Entries</h2>
      {entries.length === 0 && <div className="text-sm text-[oklch(0.50_0.02_280)] italic">No entries match filter.</div>}
      {entries.map(e => (
        <article key={e._id} className="mb-3 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white shadow-[3px_3px_0_oklch(0.15_0.02_280)]">
          <div className="bg-[oklch(0.52_0.18_255)] text-white px-3 py-2 border-b-[3px] border-[oklch(0.15_0.02_280)] flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider text-xs">{e.trader} · {e.desk}</span>
            <span className="font-['JetBrains_Mono',monospace] text-[0.7rem]">{new Date(e.createdAt).toISOString().replace("T"," ").slice(0,16)}Z</span>
          </div>
          <div className="p-3">
            {field("Open Positions", e.positions, true)}
            {field("Pending Orders", e.orders, true)}
            {field("Client Conversations", e.clients)}
            {field("Alerts", e.alerts)}
            <div className="mt-3 pt-3 border-t-[2px] border-[oklch(0.15_0.02_280)] flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!e.ackAt} onChange={() => onAck(e)} className="w-[22px] h-[22px] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] accent-[oklch(0.62_0.19_145)]" />
                <span className="text-[0.7rem] uppercase tracking-widest font-bold">Read & Acknowledged</span>
              </label>
              {e.ackAt && (
                <span className="text-[0.65rem] uppercase tracking-widest bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] px-2 py-1 border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-['JetBrains_Mono',monospace]">
                  ACK BY {e.ackBy || "—"} · {new Date(e.ackAt).toISOString().replace("T"," ").slice(0,16)}Z
                </span>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("desk-handoff-log");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const [dateFilter, setDateFilter] = React.useState("");
  const [traderFilter, setTraderFilter] = React.useState("");

  const entries = docs.filter(d => d.type === "handoff").filter(d => {
    if (traderFilter && !(d.trader || "").toUpperCase().includes(traderFilter)) return false;
    if (dateFilter) {
      const day = new Date(d.createdAt).toISOString().slice(0,10);
      if (day !== dateFilter) return false;
    }
    return true;
  });

  const handleAck = async (entry) => {
    if (entry.ackAt) {
      await database.put({ ...entry, ackAt: null, ackBy: null });
    } else {
      const who = prompt("Incoming trader initials for audit:");
      if (!who) return;
      await database.put({ ...entry, ackAt: Date.now(), ackBy: who.toUpperCase() });
    }
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Desk Handoff Log</h1>
        <p className="text-xs uppercase tracking-widest text-[oklch(0.50_0.02_280)] mt-1">End-of-Day Shift Transfer · Audit Record</p>
      </header>
      <NewEntry />
      <FilterBar dateFilter={dateFilter} traderFilter={traderFilter} setDateFilter={setDateFilter} setTraderFilter={setTraderFilter} />
      <HandoffLog entries={entries} onAck={handleAck} />
    </main>
  );
}