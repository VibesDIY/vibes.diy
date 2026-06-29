import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f3ec] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0_#1a1a2e] overflow-hidden",
  bar: "flex h-[6px] border-b-[3px] border-[#1a1a2e]",
  title: "text-2xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  sub: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b80] font-mono mt-1",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0_#1a1a2e]",
  featureTitle: "text-[0.7rem] font-bold uppercase tracking-[0.15em] mb-3 text-[#1a1a2e]",
  red: "bg-[#e63946]", yellow: "bg-[#f4c430]", green: "bg-[#2a9d5f]", blue: "bg-[#2563c9]",
  muted: "text-[#6b6b80]",
  btn: "px-3 py-2 text-xs font-bold uppercase tracking-wider border-[3px] border-[#1a1a2e] rounded shadow-[3px_3px_0_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  btnRed: "bg-[#e63946] text-white",
  btnYellow: "bg-[#f4c430] text-[#1a1a2e]",
  btnGhost: "bg-white text-[#1a1a2e]",
  input: "w-full px-3 py-2 text-sm border-[3px] border-[#1a1a2e] rounded bg-white focus:outline-none",
};

const DB = "sunday-school-roster";

function sundayKey(d) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function Classes({ selectedId, setSelectedId }) {
  const { useLiveQuery, useDocument, database } = useFireproof(DB);
  const { docs: classes } = useLiveQuery("type", { key: "class" });
  const { doc, merge, submit } = useDocument({ type: "class", name: "", grade: "", teacher: "", room: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = (e) => { e.preventDefault(); if (doc.name.trim()) submit(); };

  const suggest = async () => {
    setLoading(true);
    try {
      const r = await callAI("Suggest one Sunday school class with fields: name, grade (like '1st' or 'K'), teacher (first+last name), room (like 'A2').", {
        schema: { properties: { name:{type:"string"}, grade:{type:"string"}, teacher:{type:"string"}, room:{type:"string"} } }
      });
      const j = JSON.parse(r);
      merge(j);
    } finally { setLoading(false); }
  };

  const accents = [c.red, c.yellow, c.green, c.blue];

  return (
    <section id="classes" className={c.feature}>
      <h2 className={c.featureTitle}>Classes</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {classes.map((k, i) => {
          const active = selectedId === k._id;
          const onDark = i%4===0 || i%4===3;
          return (
            <button key={k._id} onClick={() => setSelectedId(k._id)}
              className={`text-left border-[3px] border-[#1a1a2e] rounded bg-white transition-all ${active ? "shadow-[6px_6px_0_#1a1a2e] -translate-x-[2px] -translate-y-[2px]" : "shadow-[3px_3px_0_#1a1a2e]"}`}>
              <div className={`${accents[i%4]} ${onDark ? "text-white" : "text-[#1a1a2e]"} px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[#1a1a2e] flex justify-between`}>
                <span>Grade {k.grade || "—"}</span>
                <span className="font-mono">Rm {k.room || "—"}</span>
              </div>
              <div className="p-3">
                <div className="font-bold uppercase tracking-tight text-[#1a1a2e]">{k.name}</div>
                <div className={`text-xs font-mono mt-1 ${c.muted}`}>{k.teacher || "No teacher"}</div>
              </div>
            </button>
          );
        })}
        {classes.length === 0 && <div className={`text-xs ${c.muted} col-span-full`}>No classes yet. Add one below.</div>}
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2">
        <input className={c.input} placeholder="Class name" value={doc.name} onChange={e=>merge({name:e.target.value})}/>
        <input className={c.input} placeholder="Grade" value={doc.grade} onChange={e=>merge({grade:e.target.value})}/>
        <input className={c.input} placeholder="Teacher" value={doc.teacher} onChange={e=>merge({teacher:e.target.value})}/>
        <input className={c.input} placeholder="Room" value={doc.room} onChange={e=>merge({room:e.target.value})}/>
        <button type="submit" className={`${c.btn} ${c.btnRed}`}>Add Class</button>
        <button type="button" onClick={suggest} disabled={loading} className={`${c.btn} ${c.btnYellow} flex items-center justify-center gap-2`}>
          {loading ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 20"/></svg>Thinking</> : "Suggest"}
        </button>
      </form>
    </section>
  );
}

function Lesson({ selectedId, weekKey, setWeekKey }) {
  const { useLiveQuery, database } = useFireproof(DB);
  const { docs } = useLiveQuery("type", { key: "lesson" });
  const existing = docs.find(d => d.classId === selectedId && d.week === weekKey);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { setTitle(existing?.title || ""); }, [existing?._id, selectedId, weekKey]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await database.put({ ...(existing||{}), type:"lesson", classId:selectedId, week:weekKey, title });
    } finally { setSaving(false); }
  };

  const shiftWeek = (delta) => {
    const d = new Date(weekKey);
    d.setDate(d.getDate() + delta*7);
    setWeekKey(sundayKey(d));
  };

  const suggest = async () => {
    setSaving(true);
    try {
      const r = await callAI("Suggest one age-appropriate Sunday school lesson title (3-8 words).", {
        schema: { properties: { title: { type: "string" } } }
      });
      setTitle(JSON.parse(r).title);
    } finally { setSaving(false); }
  };

  return (
    <section id="lesson" className={c.feature}>
      <h2 className={c.featureTitle}>This Week's Lesson</h2>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={()=>shiftWeek(-1)} className={`${c.btn} ${c.btnGhost}`}>◀</button>
        <div className={`flex-1 text-center font-mono text-sm border-[3px] border-[#1a1a2e] rounded py-2 ${c.blue} text-white font-bold`}>{weekKey}</div>
        <button onClick={()=>shiftWeek(1)} className={`${c.btn} ${c.btnGhost}`}>▶</button>
      </div>
      {selectedId ? (
        <div className="flex flex-col gap-2">
          <input className={c.input} placeholder="Lesson title" value={title} onChange={e=>setTitle(e.target.value)}/>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className={`${c.btn} ${c.btnRed} flex-1 flex items-center justify-center gap-2`}>
              {saving ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 20"/></svg>Saving</> : "Save Lesson"}
            </button>
            <button onClick={suggest} disabled={saving} className={`${c.btn} ${c.btnYellow}`}>Suggest</button>
          </div>
        </div>
      ) : <div className={`text-xs ${c.muted}`}>Select a class above.</div>}
    </section>
  );
}

function Attendance({ selectedId, weekKey }) {
  const { useLiveQuery, useDocument, database } = useFireproof(DB);
  const { docs: students } = useLiveQuery("type", { key: "student" });
  const { docs: attendance } = useLiveQuery("type", { key: "attendance" });
  const { doc, merge, submit } = useDocument({ type:"student", name:"", classId: selectedId || "" });
  const [loading, setLoading] = useState(false);

  React.useEffect(()=>{ merge({ classId: selectedId || "" }); }, [selectedId]);

  const roster = students.filter(s => s.classId === selectedId);
  const markMap = {};
  attendance.forEach(a => { if (a.classId===selectedId && a.week===weekKey) markMap[a.studentId] = a; });

  const toggle = async (s) => {
    const existing = markMap[s._id];
    if (existing) await database.put({ ...existing, present: !existing.present });
    else await database.put({ type:"attendance", classId:selectedId, week:weekKey, studentId:s._id, present:true });
  };

  const onSubmit = (e) => { e.preventDefault(); if (doc.name.trim() && selectedId) submit(); };

  const suggest = async () => {
    setLoading(true);
    try {
      const r = await callAI("Suggest one kid first+last name for a class roster.", { schema:{ properties:{ name:{type:"string"} } } });
      merge({ name: JSON.parse(r).name });
    } finally { setLoading(false); }
  };

  const presentCount = roster.filter(s => markMap[s._id]?.present).length;

  if (!selectedId) return <section id="attendance" className={c.feature}><h2 className={c.featureTitle}>Attendance</h2><div className={`text-xs ${c.muted}`}>Select a class to see its roster.</div></section>;

  return (
    <section id="attendance" className={c.feature}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={c.featureTitle}>Attendance</h2>
        <div className="font-mono text-xs text-[#1a1a2e]"><span className="font-bold text-lg">{presentCount}</span>/{roster.length} here</div>
      </div>
      <div className="grid grid-cols-1 gap-2 mb-3">
        {roster.map(s => {
          const present = markMap[s._id]?.present;
          return (
            <button key={s._id} onClick={()=>toggle(s)}
              className={`flex items-center justify-between px-3 py-2 border-[3px] border-[#1a1a2e] rounded transition-all ${present ? `${c.green} text-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e]` : "bg-white text-[#1a1a2e] shadow-[3px_3px_0_#1a1a2e]"}`}>
              <span className="font-bold uppercase tracking-tight">{s.name}</span>
              <span className={`text-[0.65rem] uppercase tracking-[0.15em] font-bold px-2 py-1 border-[3px] border-[#1a1a2e] rounded ${present ? "bg-white" : "bg-[#eeeeee]"}`}>{present ? "Here" : "Tap"}</span>
            </button>
          );
        })}
        {roster.length === 0 && <div className={`text-xs ${c.muted}`}>No students yet. Add one below.</div>}
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-[1fr_auto_auto] gap-2">
        <input className={c.input} placeholder="Student name" value={doc.name} onChange={e=>merge({name:e.target.value})}/>
        <button type="submit" className={`${c.btn} ${c.btnRed}`}>Add</button>
        <button type="button" onClick={suggest} disabled={loading} className={`${c.btn} ${c.btnYellow}`}>
          {loading ? "..." : "Idea"}
        </button>
      </form>
    </section>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [weekKey, setWeekKey] = useState(sundayKey(new Date()));

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.bar}>
          <div className={`flex-1 ${c.red}`}/>
          <div className={`flex-1 ${c.yellow}`}/>
          <div className={`flex-1 ${c.green}`}/>
          <div className={`flex-1 ${c.blue}`}/>
        </div>
        <div className="p-4">
          <h1 className={c.title}>Sunday School Roster</h1>
          <p className={c.sub}>Level · Lord's Day Dashboard</p>
        </div>
      </header>
      <Classes selectedId={selectedId} setSelectedId={setSelectedId} />
      <Lesson selectedId={selectedId} weekKey={weekKey} setWeekKey={setWeekKey} />
      <Attendance selectedId={selectedId} weekKey={weekKey} />
    </main>
  );
}