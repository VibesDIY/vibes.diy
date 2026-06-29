import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-sans",
  shell: "max-w-2xl mx-auto",
  header: "mb-4",
  title: "text-2xl font-bold uppercase tracking-tight text-[#0f172a] font-mono",
  feature: "bg-white border-[3px] border-[#0f172a] rounded-[4px] p-4 mb-4 shadow-[4px_4px_0px_#0f172a]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[#64748b] mb-3 font-mono",
};

function LockStatus({ allSigned, latestTs, total, signed }) {
  const bg = allSigned ? "bg-[#16a34a]" : "bg-[#dc2626]";
  const label = allSigned ? "LOCKED UP" : "NOT SECURED";
  const ts = latestTs ? new Date(latestTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <section id="lock-status" className={`${classNames.feature} ${bg} border-[3px] border-[#0f172a]`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-white/80 font-mono">Lock Up Status</div>
          <div className="text-2xl font-bold uppercase tracking-tight text-white font-mono">{label}</div>
          {ts && <div className="text-xs text-white/90 font-mono mt-1">Secured at {ts}</div>}
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-white font-mono">{signed}/{total}</div>
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-white/80 font-mono">stations</div>
        </div>
      </div>
    </section>
  );
}

function StationRow({ station, signoff, database, today }) {
  const [initials, setInitials] = useState(signoff?.initials || "");
  const [by, setBy] = useState(signoff?.by || station.assignee || "");
  const done = signoff && signoff.checkedAt && signoff.initials;

  async function handleCheck() {
    if (!initials.trim()) return;
    const doc = signoff || { type: "signoff", date: today, station: station.name };
    await database.put({ ...doc, by: by || "—", initials: initials.toUpperCase().trim(), checkedAt: Date.now() });
  }

  async function handleUndo() {
    if (signoff) await database.del(signoff._id);
    setInitials("");
  }

  return (
    <div className={`border-[3px] border-[#0f172a] rounded-[4px] p-3 mb-2 ${done ? "bg-[#dcfce7]" : "bg-[#f5f1e8]"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono font-bold uppercase text-sm tracking-tight text-[#0f172a]">{station.name}</div>
        {done && <div className="text-[0.6rem] uppercase tracking-[0.15em] font-mono text-[#16a34a] font-bold">✓ Signed</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="text"
          placeholder="Responsible"
          value={by}
          onChange={e => setBy(e.target.value)}
          disabled={done}
          className="border-[2px] border-[#0f172a] rounded-[4px] px-2 py-1 text-sm font-mono bg-white disabled:opacity-70"
        />
        <input
          type="text"
          placeholder="Initials"
          value={initials}
          onChange={e => setInitials(e.target.value.toUpperCase().slice(0,4))}
          disabled={done}
          maxLength={4}
          className="border-[2px] border-[#0f172a] rounded-[4px] px-2 py-1 text-sm font-mono uppercase bg-white disabled:opacity-70"
        />
      </div>
      {done ? (
        <button onClick={handleUndo} className="w-full text-xs uppercase tracking-[0.1em] font-mono font-bold border-[2px] border-[#0f172a] rounded-[4px] py-2 bg-white hover:bg-[#fef3c7]">
          Undo — signed by {signoff.by} · {signoff.initials}
        </button>
      ) : (
        <button onClick={handleCheck} disabled={!initials.trim()} className="w-full text-xs uppercase tracking-[0.1em] font-mono font-bold border-[2px] border-[#0f172a] rounded-[4px] py-2 bg-[#1e3a8a] text-white disabled:opacity-40 disabled:bg-[#64748b]">
          Confirm Sign-Off
        </button>
      )}
    </div>
  );
}

function Checklist({ stations, signoffByStation, database, today }) {
  return (
    <section id="checklist" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Tonight's Stations</h2>
      {stations.length === 0 ? (
        <div className="text-sm text-[#64748b] font-mono italic">No stations configured. Add them below in Settings.</div>
      ) : (
        stations.map(st => (
          <StationRow key={st._id} station={st} signoff={signoffByStation[st.name]} database={database} today={today} />
        ))
      )}
    </section>
  );
}

function Settings({ stations, database }) {
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [open, setOpen] = useState(false);

  async function addStation() {
    if (!name.trim()) return;
    await database.put({ type: "station", name: name.trim(), assignee: assignee.trim(), createdAt: Date.now() });
    setName(""); setAssignee("");
  }

  async function seedDefaults() {
    const defaults = ["Lights", "Safe", "Alarm", "Inventory", "Trash", "Back Door", "Restrooms"];
    for (const n of defaults) {
      if (!stations.find(s => s.name === n)) {
        await database.put({ type: "station", name: n, assignee: "", createdAt: Date.now() });
      }
    }
  }

  return (
    <section id="settings" className={classNames.feature}>
      <div className="flex items-center justify-between">
        <h2 className={classNames.featureTitle} style={{marginBottom:0}}>Settings — Stations</h2>
        <button onClick={() => setOpen(!open)} className="text-[0.6rem] uppercase tracking-[0.15em] font-mono font-bold border-[2px] border-[#0f172a] rounded-[4px] px-2 py-1 bg-white">
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          {stations.length === 0 && (
            <button onClick={seedDefaults} className="w-full mb-3 text-xs uppercase tracking-[0.1em] font-mono font-bold border-[2px] border-[#0f172a] rounded-[4px] py-2 bg-[#fde047]">
              Load Default Stations
            </button>
          )}
          <ul className="mb-3">
            {stations.map(st => (
              <li key={st._id} className="flex items-center justify-between border-b-[1px] border-[#0f172a]/30 py-2 text-sm font-mono">
                <span><span className="font-bold">{st.name}</span>{st.assignee && <span className="text-[#64748b]"> · {st.assignee}</span>}</span>
                <button onClick={() => database.del(st._id)} className="text-[0.6rem] uppercase tracking-[0.15em] font-bold text-[#dc2626] border-[2px] border-[#dc2626] rounded-[4px] px-2 py-1">Remove</button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Station name" className="border-[2px] border-[#0f172a] rounded-[4px] px-2 py-1 text-sm font-mono bg-white" />
            <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Default assignee (opt)" className="border-[2px] border-[#0f172a] rounded-[4px] px-2 py-1 text-sm font-mono bg-white" />
          </div>
          <button onClick={addStation} disabled={!name.trim()} className="w-full text-xs uppercase tracking-[0.1em] font-mono font-bold border-[2px] border-[#0f172a] rounded-[4px] py-2 bg-[#1e3a8a] text-white disabled:opacity-40">
            Add Station
          </button>
        </div>
      )}
    </section>
  );
}

function History({ allSignoffs, stations, today }) {
  const byDate = {};
  allSignoffs.forEach(s => {
    if (s.date === today) return;
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  const dates = Object.keys(byDate).sort().reverse().slice(0, 14);
  const stationCount = stations.length;

  return (
    <section id="history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Last 14 Nights</h2>
      {dates.length === 0 ? (
        <div className="text-sm text-[#64748b] font-mono italic">No prior close-outs on record.</div>
      ) : (
        <ul>
          {dates.map(d => {
            const entries = byDate[d];
            const complete = stationCount > 0 && entries.length >= stationCount;
            const latest = Math.max(...entries.map(e => e.checkedAt || 0));
            return (
              <li key={d} className="border-b-[1px] border-[#0f172a]/20 py-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-sm text-[#0f172a]">{d}</div>
                  <div className={`text-[0.6rem] uppercase tracking-[0.15em] font-mono font-bold ${complete ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                    {complete ? `✓ Locked ${new Date(latest).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : `Incomplete (${entries.length}/${stationCount})`}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#64748b] mt-1">
                  {entries.map(e => `${e.station}·${e.initials}`).join(" / ")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function App() {
  const fp = useFireproof("closing-signoff-db");
  const { useLiveQuery, database } = fp;
  const today = todayKey();

  const { docs: stations } = useLiveQuery("type", { key: "station" });
  const { docs: signoffs } = useLiveQuery("date", { key: today });
  const { docs: allSignoffs } = useLiveQuery("type", { key: "signoff", descending: true });

  const signoffByStation = {};
  signoffs.forEach(s => { signoffByStation[s.station] = s; });

  const allSigned = stations.length > 0 && stations.every(st => {
    const s = signoffByStation[st.name];
    return s && s.checkedAt && s.initials;
  });
  const latestTs = allSigned ? Math.max(...stations.map(st => signoffByStation[st.name].checkedAt)) : null;

  return (
    <main id="app" className={classNames.page}>
      <div className={classNames.shell}>
        <header id="app-header" className={classNames.header}>
          <h1 className={classNames.title}>Closing Sign-Off</h1>
          <p className="text-xs uppercase tracking-[0.15em] text-[#64748b] font-mono mt-1">End-of-Day Checklist — {today}</p>
        </header>
        <LockStatus allSigned={allSigned} latestTs={latestTs} total={stations.length} signed={stations.filter(st => { const s = signoffByStation[st.name]; return s && s.checkedAt && s.initials; }).length} />
        <Checklist stations={stations} signoffByStation={signoffByStation} database={database} today={today} />
        <Settings stations={stations} database={database} />
        <History allSignoffs={allSignoffs} stations={stations} today={today} />
      </div>
    </main>
  );
}