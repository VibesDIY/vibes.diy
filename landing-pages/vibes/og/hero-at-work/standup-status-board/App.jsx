import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif] text-[#14131f]",
  shell: "max-w-6xl mx-auto",
  header: "mb-6 bg-white border-[3px] border-[#14131f] rounded p-5 shadow-[4px_4px_0px_#14131f]",
  title: "text-3xl font-bold uppercase tracking-tight",
  section: "mb-6 bg-white border-[3px] border-[#14131f] rounded p-5 shadow-[4px_4px_0px_#14131f]",
  sectionTitle: "text-sm font-bold uppercase tracking-[0.15em] mb-3",
};

function HeaderBar({ pct = 0, onClear, dateStr }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <header className={c.header}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={c.title}>Standup Board</h1>
          <div className="text-xs uppercase tracking-[0.15em] text-[#5a5870] mt-1">{dateStr}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={r} fill="none" stroke="#e8e4d4" strokeWidth="10"/>
              <circle cx="36" cy="36" r={r} fill="none" stroke="#4a8a5c" strokeWidth="10"
                strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 36 36)" strokeLinecap="butt"/>
              <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace">{pct}%</text>
            </svg>
            <div className="text-xs uppercase tracking-[0.15em] text-[#5a5870]">Team<br/>checked in</div>
          </div>
          <button onClick={onClear} className="px-4 py-2 bg-[#d84a3a] text-white border-[3px] border-[#14131f] rounded font-bold uppercase tracking-[0.08em] text-xs shadow-[4px_4px_0px_#14131f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#14131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
            Clear for Tomorrow
          </button>
        </div>
      </div>
    </header>
  );
}

const MOODS = ["🚀","🔥","😅","😬","🧠","🌧"];

function MyCard({ database, today, useLiveQuery }) {
  const [name, setName] = useState(() => localStorage.getItem("standup-name") || "");
  const [editingName, setEditingName] = useState(!name);
  const { docs: mine } = useLiveQuery("nameDay", { key: name ? `${name}::${today}` : "__none__" });
  const myDoc = mine[0];
  const [mood, setMood] = useState("🚀");
  const [yesterday, setYesterday] = useState("");
  const [todayText, setTodayText] = useState("");
  const [blockers, setBlockers] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (myDoc && !loaded) {
      setMood(myDoc.mood || "🚀");
      setYesterday(myDoc.yesterday || "");
      setTodayText(myDoc.today || "");
      setBlockers(myDoc.blockers || "");
      setLoaded(true);
    }
  }, [myDoc, loaded]);

  function saveName() {
    if (!name.trim()) return;
    localStorage.setItem("standup-name", name.trim());
    setEditingName(false);
  }

  async function save(patch) {
    if (!name) return;
    const base = myDoc || { type: "standup", name, day: today, nameDay: `${name}::${today}`, mood, yesterday, today: todayText, blockers };
    await database.put({ ...base, ...patch, updatedAt: Date.now(), nameDay: `${name}::${today}`, day: today, type: "standup", name });
  }

  async function aiSuggest() {
    const prompt = `Generate a playful example standup entry for a software engineer. Keep each field under 12 words.`;
    const res = await callAI(prompt, { schema: { properties: { yesterday:{type:"string"}, today:{type:"string"}, blockers:{type:"string"} } } });
    const p = JSON.parse(res);
    setYesterday(p.yesterday); setTodayText(p.today); setBlockers(p.blockers);
    save({ yesterday: p.yesterday, today: p.today, blockers: p.blockers, mood });
  }

  if (editingName) {
    return (
      <section className={c.section}>
        <h2 className={c.sectionTitle}>Who are you?</h2>
        <div className="flex gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="flex-1 px-3 py-2 border-[3px] border-[#14131f] rounded font-medium focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#14131f] transition-all"/>
          <button onClick={saveName} className="px-4 py-2 bg-[#e8c547] border-[3px] border-[#14131f] rounded font-bold uppercase text-xs tracking-[0.08em] shadow-[3px_3px_0px_#14131f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#14131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">Save</button>
        </div>
      </section>
    );
  }

  const blockerRed = blockers.trim() ? "border-[#d84a3a] shadow-[0_0_0_2px_#d84a3a33]" : "border-[#14131f]";

  return (
    <section className={c.section}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className={c.sectionTitle}>Your Check-in · {name}</h2>
        <div className="flex gap-2">
          <button onClick={()=>setEditingName(true)} className="text-xs uppercase tracking-[0.1em] underline">change name</button>
          <button onClick={aiSuggest} className="text-xs uppercase tracking-[0.1em] px-2 py-1 bg-[#3a6ea8] text-white border-[2px] border-[#14131f] rounded font-bold">AI ✨</button>
        </div>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {MOODS.map(m => (
          <button key={m} onClick={()=>{setMood(m); save({mood:m});}}
            className={`w-12 h-12 text-2xl border-[3px] border-[#14131f] rounded transition-all ${mood===m ? 'bg-[#e8c547] shadow-[3px_3px_0px_#14131f]' : 'bg-white hover:bg-[#f5f2e8]'}`}>{m}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] font-bold block mb-1">Yesterday</label>
          <textarea value={yesterday} onChange={e=>setYesterday(e.target.value)} onBlur={()=>save({yesterday})} rows="3" className="w-full px-3 py-2 border-[3px] border-[#14131f] rounded text-sm focus:outline-none"/>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] font-bold block mb-1">Today</label>
          <textarea value={todayText} onChange={e=>setTodayText(e.target.value)} onBlur={()=>save({today:todayText})} rows="3" className="w-full px-3 py-2 border-[3px] border-[#14131f] rounded text-sm focus:outline-none"/>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] font-bold block mb-1">Blockers</label>
          <textarea value={blockers} onChange={e=>setBlockers(e.target.value)} onBlur={()=>save({blockers})} rows="3" className={`w-full px-3 py-2 border-[3px] rounded text-sm focus:outline-none ${blockerRed}`}/>
        </div>
      </div>
    </section>
  );
}

function Board() {
  return (
    <section className={c.section}>
      <h2 className={c.sectionTitle}>Team Today</h2>
    </section>
  );
}

function History({ useLiveQuery }) {
  const { docs } = useLiveQuery("type", { key: "archive" });
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const sorted = [...docs].sort((a,b) => (b.archivedAt||0) - (a.archivedAt||0));
  return (
    <section className={c.section}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between">
        <h2 className={c.sectionTitle + " !mb-0"}>Past Standups · {sorted.length}</h2>
        <span className="text-lg font-bold">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          {sorted.length === 0 && <div className="text-sm text-[#5a5870]">No archived days yet.</div>}
          {sorted.map(a => (
            <div key={a._id} className="border-[3px] border-[#14131f] rounded">
              <button onClick={()=>setExpandedId(expandedId===a._id?null:a._id)} className="w-full flex justify-between items-center p-3 bg-[#f5f2e8] hover:bg-[#e8c547]">
                <span className="font-bold uppercase tracking-tight text-sm">{a.dateStr || a.day}</span>
                <span className="text-xs font-mono">{(a.standups||[]).length} posts</span>
              </button>
              {expandedId === a._id && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                  {(a.standups||[]).map((s,i) => (
                    <div key={i} className="border-[2px] border-[#14131f] rounded p-3">
                      <div className="flex justify-between mb-1"><span className="font-bold">{s.name}</span><span className="text-xl">{s.mood}</span></div>
                      <div className="text-xs space-y-1">
                        <div><b>Y:</b> {s.yesterday || '—'}</div>
                        <div><b>T:</b> {s.today || '—'}</div>
                        <div><b>B:</b> {s.blockers || 'none'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("standup-board");
  const today = todayKey();
  const { docs: todayDocs } = useLiveQuery("day", { key: today });
  const standups = todayDocs.filter(d => d.type === "standup");
  const teamSize = Math.max(standups.length, 3);
  const pct = Math.round((standups.length / teamSize) * 100);
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  async function clearBoard() {
    if (!standups.length) return;
    if (!confirm("Archive today's board?")) return;
    await database.put({ type: "archive", day: today, dateStr, standups: standups.map(s => ({...s})), archivedAt: Date.now() });
    for (const s of standups) await database.del(s._id);
  }

  return (
    <main className={c.page}>
      <div className={c.shell}>
        <HeaderBar pct={pct} onClear={clearBoard} dateStr={dateStr} />
        <MyCard database={database} today={today} useLiveQuery={useLiveQuery} />
        <Board standups={standups} useLiveQuery={useLiveQuery} />
        <History useLiveQuery={useLiveQuery} />
      </div>
    </main>
  );
}