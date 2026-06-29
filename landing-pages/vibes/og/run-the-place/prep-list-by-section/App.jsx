import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const STATIONS = ["Sauté", "Grill", "Garde Manger", "Pastry", "Pantry"];
const COOKS = ["Maria", "Jon", "Priya", "Diego", "Sam", "Alex", "Kenji"];

const c = {
  page: "min-h-screen bg-[#1a2420] p-3 font-['Space_Grotesk',sans-serif] text-[#f1ede4]",
  header: "max-w-[1400px] mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap",
  title: "text-3xl font-bold uppercase tracking-tight",
  toggle: "px-4 py-2 bg-[#e8d77a] text-[#15131f] border-[3px] border-[#0a0810] rounded text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_#0a0810] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0810] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",
  columns: "max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3",
  col: "bg-[#f1ede4] text-[#15131f] border-[3px] border-[#0a0810] rounded p-3 shadow-[4px_4px_0px_#0a0810]",
  colHead: "text-lg font-bold uppercase tracking-tight mb-2 pb-2 border-b-[2px] border-[#15131f]",
  card: "bg-white border-[3px] border-[#0a0810] rounded p-2 mb-2 shadow-[3px_3px_0px_#0a0810]",
  cardDone: "bg-[#8bc47a] border-[3px] border-[#0a0810] rounded p-2 mb-2 shadow-[3px_3px_0px_#0a0810] opacity-80",
  cardLate: "bg-[#d9483d] text-white border-[3px] border-[#0a0810] rounded p-2 mb-2 shadow-[3px_3px_0px_#0a0810]",
  input: "w-full px-2 py-1 bg-white border-[2px] border-[#0a0810] rounded text-sm mb-1 focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[2px_2px_0px_#0a0810]",
  addBtn: "w-full px-2 py-1 bg-[#d9483d] text-white border-[2px] border-[#0a0810] rounded text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#0a0810] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#0a0810] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all",
  delBtn: "text-xs underline opacity-70 hover:opacity-100",
  footer: "max-w-[1400px] mx-auto mt-4 bg-[#f1ede4] text-[#15131f] border-[3px] border-[#0a0810] rounded p-3 shadow-[4px_4px_0px_#0a0810] flex flex-wrap gap-3 text-sm font-bold uppercase tracking-wider",
  chefList: "max-w-[900px] mx-auto bg-[#f1ede4] text-[#15131f] border-[3px] border-[#0a0810] rounded p-3 shadow-[4px_4px_0px_#0a0810]",
  chefRow: "flex items-center gap-3 py-2 border-b-[1px] border-[#15131f22]",
  stationTag: "text-[0.65rem] uppercase tracking-widest px-2 py-0.5 bg-[#15131f] text-[#f1ede4] rounded font-bold",
};

function AddForm({ station, onAdd }) {
  const [item, setItem] = useState("");
  const [owner, setOwner] = useState(COOKS[0]);
  const [dueAt, setDueAt] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!item.trim()) return;
    onAdd({ item: item.trim(), owner, dueAt });
    setItem("");
    setDueAt("");
  };

  return (
    <form onSubmit={submit} className="mt-2 pt-2 border-t-[2px] border-dashed border-[#15131f66]">
      <input className={c.input} placeholder="item, qty (e.g. demi-glace, 2 qt)" value={item} onChange={e => setItem(e.target.value)} />
      <div className="flex gap-1 mb-1">
        <select className={c.input + " mb-0"} value={owner} onChange={e => setOwner(e.target.value)}>
          {COOKS.map(k => <option key={k}>{k}</option>)}
        </select>
        <input className={c.input + " mb-0"} type="time" value={dueAt} onChange={e => setDueAt(e.target.value)} />
      </div>
      <button type="submit" className={c.addBtn}>+ Add Prep</button>
    </form>
  );
}

function isLate(doc, now) {
  if (doc.doneAt || !doc.dueAt) return false;
  const [h, m] = doc.dueAt.split(":").map(Number);
  const due = new Date(); due.setHours(h, m, 0, 0);
  return now > due.getTime();
}

function fmtDue(t) { return t ? t : "—"; }

export default function App() {
  const { database, useLiveQuery } = useFireproof("prep-list-kitchen");
  const { docs } = useLiveQuery("type", { key: "prep" });
  const [chefView, setChefView] = useState(false);
  const now = Date.now();

  const add = (station) => ({ item, owner, dueAt }) => {
    database.put({ type: "prep", station, item, owner, dueAt, started: null, doneAt: null, note: "", createdAt: Date.now() });
  };
  const toggleDone = (d) => database.put({ ...d, doneAt: d.doneAt ? null : Date.now() });
  const del = (d) => database.del(d._id);

  const sortByDue = (a, b) => (a.dueAt || "99:99").localeCompare(b.dueAt || "99:99");

  return (
    <main className={c.page} style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 39px, #ffffff08 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, #ffffff08 39px 40px)" }}>
      <header className={c.header}>
        <h1 className={c.title}>Prep List / Service Board</h1>
        <button className={c.toggle} onClick={() => setChefView(v => !v)}>
          {chefView ? "◀ Station View" : "Chef View ▶"}
        </button>
      </header>

      {chefView ? (
        <div className={c.chefList}>
          <div className="text-xs uppercase tracking-widest opacity-60 mb-2">All prep · sorted by due time</div>
          {docs.length === 0 && <div className="py-4 opacity-60">No prep on the board.</div>}
          {[...docs].sort(sortByDue).map(d => {
            const late = isLate(d, now);
            return (
              <div key={d._id} className={c.chefRow}>
                <input type="checkbox" checked={!!d.doneAt} onChange={() => toggleDone(d)} className="w-5 h-5 accent-[#8bc47a]" />
                <span className={c.stationTag}>{d.station}</span>
                <span className={"flex-1 font-semibold " + (d.doneAt ? "line-through opacity-50" : late ? "text-[#d9483d]" : "")}>{d.item}</span>
                <span className="text-sm opacity-70">{d.owner}</span>
                <span className={"font-mono text-sm " + (late ? "text-[#d9483d] font-bold" : "")}>{fmtDue(d.dueAt)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={c.columns}>
          {STATIONS.map(station => {
            const items = docs.filter(d => d.station === station).sort(sortByDue);
            return (
              <div key={station} className={c.col}>
                <div className={c.colHead}>{station}</div>
                {items.length === 0 && <div className="text-xs opacity-50 italic py-2">no prep yet</div>}
                {items.map(d => {
                  const late = isLate(d, now);
                  const cardClass = d.doneAt ? c.cardDone : late ? c.cardLate : c.card;
                  return (
                    <div key={d._id} className={cardClass}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={!!d.doneAt} onChange={() => toggleDone(d)} className="w-5 h-5 mt-0.5 accent-[#8bc47a]" />
                        <div className="flex-1 min-w-0">
                          <div className={"font-bold text-base leading-tight " + (d.doneAt ? "line-through" : "")}>{d.item}</div>
                          <div className="flex items-center justify-between mt-1 text-xs uppercase tracking-wider">
                            <span className="font-semibold">{d.owner}</span>
                            <span className="font-mono font-bold">{fmtDue(d.dueAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-1">
                        <button onClick={() => del(d)} className={c.delBtn}>remove</button>
                      </div>
                    </div>
                  );
                })}
                <AddForm station={station} onAdd={add(station)} />
              </div>
            );
          })}
        </div>
      )}

      <div className={c.footer}>
        {STATIONS.map(s => {
          const items = docs.filter(d => d.station === s);
          const done = items.filter(d => d.doneAt).length;
          const late = items.filter(d => isLate(d, now)).length;
          return (
            <div key={s} className="flex items-center gap-2">
              <span>{s}:</span>
              <span className="font-mono">{done}/{items.length}</span>
              {late > 0 && <span className="px-2 py-0.5 bg-[#d9483d] text-white rounded text-xs">{late} LATE</span>}
            </div>
          );
        })}
      </div>
    </main>
  );
}