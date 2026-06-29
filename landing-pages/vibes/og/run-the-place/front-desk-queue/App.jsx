import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-2xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] rounded p-4 shadow-[4px_4px_0px_#1a1a2e]",
  title: "text-2xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  feature: "max-w-2xl mx-auto mb-4 bg-white border-[3px] border-[#1a1a2e] rounded p-4 shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[#6b6b7a] mb-3",
};

function Timeline() {
  return (
    <section id="timeline" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Today's Slots</h2>
      {/* timeline lands here */}
    </section>
  );
}

function AddGuest({ database }) {
  const { useDocument } = useFireproof("queue-board-db");
  const [suggesting, setSuggesting] = React.useState(false);
  const defaultTime = () => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d.toTimeString().slice(0, 5);
  };
  const { doc, merge, submit } = useDocument(() => ({
    type: "guest", name: "", phone: "", service: "", startsAt: defaultTime(),
    duration: 30, status: "waiting", createdAt: Date.now()
  }));
  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await callAI("Suggest a plausible walk-in guest for a salon/studio/clinic.", {
        schema: { properties: { name: { type: "string" }, phone: { type: "string" }, service: { type: "string" }, duration: { type: "number" } } }
      });
      const s = JSON.parse(res);
      merge({ name: s.name, phone: s.phone, service: s.service, duration: s.duration });
    } finally { setSuggesting(false); }
  };
  const input = "w-full border-[3px] border-[#1a1a2e] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1a2e] transition-all";
  const label = "block text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b7a] mb-1 font-semibold";
  return (
    <section id="add-guest" className={classNames.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.featureTitle + " mb-0"}>New Walk-in</h2>
        <button onClick={suggest} disabled={suggesting} className="text-[0.6rem] uppercase tracking-[0.1em] font-bold bg-[#4270c9] text-white border-[2px] border-[#1a1a2e] rounded px-2 py-1 shadow-[2px_2px_0px_#1a1a2e] disabled:opacity-50">
          {suggesting ? "..." : "✨ Suggest"}
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div><label className={label}>Name</label><input className={input} value={doc.name} onChange={e => merge({ name: e.target.value })} required /></div>
        <div><label className={label}>Phone</label><input className={input} value={doc.phone} onChange={e => merge({ phone: e.target.value })} /></div>
        <div><label className={label}>Service</label><input className={input} value={doc.service} onChange={e => merge({ service: e.target.value })} placeholder="Cut & color, Reformer, Cleaning..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Start</label><input type="time" className={input} value={doc.startsAt} onChange={e => merge({ startsAt: e.target.value })} /></div>
          <div><label className={label}>Duration (min)</label><input type="number" min="5" step="5" className={input} value={doc.duration} onChange={e => merge({ duration: Number(e.target.value) })} /></div>
        </div>
        <button type="submit" className="w-full bg-[#d64545] text-white font-bold uppercase tracking-[0.08em] text-sm border-[3px] border-[#1a1a2e] rounded py-3 shadow-[4px_4px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          Add to Queue
        </button>
      </form>
    </section>
  );
}

function Status({ guests = [] }) {
  const now = Date.now();
  const waiting = guests.filter(g => g.status === "waiting").length;
  const checked = guests.filter(g => g.status === "checked-in").length;
  const late = guests.filter(g => g.status === "waiting" && new Date(g.startsAt).getTime() < now).length;
  const chip = "flex-1 border-[3px] border-[#1a1a2e] rounded p-3 text-center";
  return (
    <section id="status" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Queue Status</h2>
      <div className="flex gap-3">
        <div className={`${chip} bg-[#e8c547]`}>
          <div className="font-mono font-bold text-2xl text-[#1a1a2e]">{waiting}</div>
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#1a1a2e]">Waiting</div>
        </div>
        <div className={`${chip} bg-[#5a9e5a] text-white`}>
          <div className="font-mono font-bold text-2xl">{checked}</div>
          <div className="text-[0.6rem] uppercase tracking-[0.15em]">Checked In</div>
        </div>
        <div className={`${chip} bg-[#d64545] text-white`}>
          <div className="font-mono font-bold text-2xl">{late}</div>
          <div className="text-[0.6rem] uppercase tracking-[0.15em]">Late</div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("queue-board-db");
  const { docs: guests } = useLiveQuery("type", { key: "guest" });
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className="flex h-[6px] -mx-4 -mt-4 mb-3">
          <div className="flex-1 bg-[#d64545]" />
          <div className="flex-1 bg-[#e8c547]" />
          <div className="flex-1 bg-[#5a9e5a]" />
          <div className="flex-1 bg-[#4270c9]" />
        </div>
        <h1 className={classNames.title}>Queue Board</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[#6b6b7a] mt-1">Live Front-Desk Timeline</p>
      </header>
      <Status guests={guests} />
      <Timeline guests={guests} database={database} />
      <AddGuest database={database} />
    </main>
  );
}