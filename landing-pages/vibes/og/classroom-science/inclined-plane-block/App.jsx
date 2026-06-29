import React from "react"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  header: "max-w-5xl mx-auto mb-6 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-5xl mx-auto mb-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]",
  featureTitle: "text-lg font-bold uppercase tracking-tight mb-3",
};

function SessionBar({ session, database, trialCount }) {
  const [name, setName] = React.useState("");
  const active = session?.active;
  return (
    <section id="session-bar" className={c.feature}>
      <h2 className={c.featureTitle}>Session</h2>
      {active ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)]">Current session</div>
            <div className="font-mono font-bold text-lg">{session.name}</div>
            <div className="text-xs text-[oklch(0.50_0.02_280)]">{trialCount} trial{trialCount===1?"":"s"} logged</div>
          </div>
          <button
            onClick={async () => { await database.put({ ...session, active: false, endedAt: Date.now() }); }}
            className="px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded shadow-[3px_3px_0_oklch(0.15_0.02_280)] text-xs uppercase tracking-[0.08em] font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] transition-all"
          >Reset / New Session</button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lab session name…"
            className="flex-1 min-w-[200px] px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded font-mono text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[3px_3px_0_oklch(0.15_0.02_280)] transition-all"
          />
          <button
            onClick={async () => {
              const n = name.trim(); if (!n) return;
              await database.put({ type: "session", name: n, active: true, startedAt: Date.now() });
              setName("");
            }}
            className="px-4 py-2 bg-[oklch(0.62_0.19_145)] border-[3px] border-[oklch(0.15_0.02_280)] rounded shadow-[3px_3px_0_oklch(0.15_0.02_280)] text-xs uppercase tracking-[0.08em] font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] transition-all"
          >Start Session</button>
        </div>
      )}
    </section>
  );
}

function Simulator() {
  return (
    <section id="simulator" className={c.feature}>
      <h2 className={c.featureTitle}>Simulator</h2>
    </section>
  );
}

function ResultsTable() {
  return (
    <section id="results-table" className={c.feature}>
      <h2 className={c.featureTitle}>Trial Log</h2>
    </section>
  );
}

function ScatterPlot() {
  return (
    <section id="scatter-plot" className={c.feature}>
      <h2 className={c.featureTitle}>Scatter Plot</h2>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("inclined-plane-lab");
  const { docs: sessions } = useLiveQuery("type", { key: "session" });
  const session = sessions.find((s) => s.active);
  const { docs: trials } = useLiveQuery("sessionId", { key: session?._id || "__none__" });
  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Inclined Plane Lab</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-1">Data collection notebook</p>
      </header>
      <SessionBar session={session} database={database} trialCount={trials.length} />
      <Simulator session={session} database={database} />
      <ResultsTable trials={trials} />
      <ScatterPlot trials={trials} />
    </main>
  );
}