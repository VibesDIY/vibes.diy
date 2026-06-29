import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("chore-slab");
  const { doc: newMember, merge: mergeMember, submit: submitMember } = useDocument({ type: "member", name: "", createdAt: Date.now() });
  const { doc: newChore, merge: mergeChore, submit: submitChore } = useDocument({ type: "chore", name: "", assignee: "", createdAt: Date.now() });
  const { docs: members } = useLiveQuery("type", { key: "member" });
  const { docs: chores } = useLiveQuery("type", { key: "chore" });
  const { docs: completions } = useLiveQuery("type", { key: "completion" });
  const { docs: swaps } = useLiveQuery("type", { key: "swap" });
  const [isLoading, setIsLoading] = React.useState(false);

  const weekKey = (() => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  })();

  async function suggestRotation() {
    if (members.length === 0 || chores.length === 0) return;
    setIsLoading(true);
    try {
      const prompt = `Assign chores fairly. Members: ${members.map(m => m.name).join(", ")}. Chores: ${chores.map(c => c.name).join(", ")}. Return assignments.`;
      const res = await callAI(prompt, { schema: { properties: { assignments: { type: "array", items: { type: "object", properties: { chore: { type: "string" }, member: { type: "string" } } } } } } });
      const { assignments } = JSON.parse(res);
      for (const a of assignments) {
        const chore = chores.find(c => c.name === a.chore);
        if (chore) await database.put({ ...chore, assignee: a.member });
      }
    } finally { setIsLoading(false); }
  }

  const c = {
    page: "min-h-screen bg-[#e0dfdb] text-[#000000] font-[Inter,sans-serif]",
    header: "bg-[#0a0a0a] text-[#e0dfdb] px-5 py-6 border-b-4 border-[#e8f547]",
    title: "text-3xl font-bold tracking-tight",
    tagline: "text-sm text-[#e0dfdb]/70 mt-1 font-mono",
    main: "max-w-2xl mx-auto p-4 space-y-4",
    section: "bg-white border-2 border-[#0a0a0a] rounded-lg p-4 shadow-[4px_4px_0_#0a0a0a]",
    h2: "text-xl font-bold mb-3 uppercase tracking-wide",
    btn: "bg-[#e8f547] text-[#0a0a0a] border-2 border-[#0a0a0a] px-4 py-3 rounded font-bold min-h-[44px] active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_#0a0a0a]",
    btnGhost: "bg-white text-[#0a0a0a] border-2 border-[#0a0a0a] px-4 py-3 rounded font-bold min-h-[44px]",
    input: "w-full border-2 border-[#0a0a0a] rounded px-3 py-3 bg-white text-[#0a0a0a] min-h-[44px]",
    row: "flex items-center justify-between gap-3 py-3 border-b border-[#0a0a0a]/20 last:border-0",
    pill: "inline-block bg-[#e8f547] border-2 border-[#0a0a0a] text-[#0a0a0a] text-xs px-2 py-0.5 rounded font-mono font-bold",
    readonly: "text-sm italic text-[#0a0a0a]/60 font-mono",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Chore Slab</h1>
        <p className={c.tagline}>// weekly rotation. no excuses.</p>
      </header>
      <main id="app" className={c.main}>
        <section id="household" className={c.section}>
          <h2 className={c.h2}>Household</h2>
          <ul className="mb-3">
            {members.length === 0 && <li className={c.readonly}>No members yet.</li>}
            {members.map(m => (
              <li key={m._id} className={c.row}>
                <span className="font-medium">{m.name}</span>
                {can("write") && <button className={c.btnGhost} onClick={() => database.del(m._id)}>Remove</button>}
              </li>
            ))}
          </ul>
          {can("write") ? (
            <form onSubmit={(e) => { e.preventDefault(); if (newMember.name.trim()) submitMember(); }} className="flex gap-2">
              <input className={c.input} placeholder="Add a name" value={newMember.name} onChange={(e) => mergeMember({ name: e.target.value })} />
              <button type="submit" className={c.btn}>Add</button>
            </form>
          ) : <p className={c.readonly}>Read-only view.</p>}
        </section>
        <section id="chores" className={c.section}>
          <h2 className={c.h2}>Chores</h2>
          <ul className="mb-3">
            {chores.length === 0 && <li className={c.readonly}>No chores yet.</li>}
            {chores.map(ch => (
              <li key={ch._id} className={c.row}>
                <div>
                  <div className="font-medium">{ch.name}</div>
                  <div className="text-xs font-mono text-[#0a0a0a]/60">→ {ch.assignee || "unassigned"}</div>
                </div>
                {can("write") && <button className={c.btnGhost} onClick={() => database.del(ch._id)}>Remove</button>}
              </li>
            ))}
          </ul>
          {can("write") && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); if (newChore.name.trim()) submitChore(); }} className="flex flex-col gap-2 mb-2">
                <input className={c.input} placeholder="Chore name (e.g. Take out trash)" value={newChore.name} onChange={(e) => mergeChore({ name: e.target.value })} />
                <select className={c.input} value={newChore.assignee} onChange={(e) => mergeChore({ assignee: e.target.value })}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
                </select>
                <button type="submit" className={c.btn}>Add Chore</button>
              </form>
              <button onClick={suggestRotation} disabled={isLoading || members.length === 0 || chores.length === 0} className={c.btnGhost + " w-full flex items-center justify-center gap-2"}>
                {isLoading ? (<><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg> Thinking...</>) : "✨ AI: Suggest Fair Rotation"}
              </button>
            </>
          )}
        </section>
        <section id="board" className={c.section}>
          <h2 className={c.h2}>This Week <span className={c.pill}>{weekKey}</span></h2>
          <ul>
            {chores.filter(ch => ch.assignee).length === 0 && <li className={c.readonly}>No assignments yet. Add chores and assign them above.</li>}
            {chores.filter(ch => ch.assignee).map(ch => {
              const done = completions.find(co => co.choreId === ch._id && co.week === weekKey);
              const streak = completions.filter(co => co.choreId === ch._id).length;
              return (
                <li key={ch._id} className={c.row}>
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#e8f547]"
                      checked={!!done}
                      disabled={!can("write")}
                      onChange={() => {
                        if (done) database.del(done._id);
                        else database.put({ type: "completion", choreId: ch._id, week: weekKey, by: ch.assignee, at: Date.now() });
                      }}
                    />
                    <div>
                      <div className={done ? "line-through text-[#0a0a0a]/50" : "font-medium"}>{ch.name}</div>
                      <div className="text-xs font-mono text-[#0a0a0a]/60">{ch.assignee} · streak: {streak}</div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
        <section id="swaps" className={c.section}>
          <h2 className={c.h2}>Swap Requests</h2>
          <ul className="mb-3">
            {swaps.filter(s => s.status === "pending").length === 0 && <li className={c.readonly}>No pending swaps.</li>}
            {swaps.filter(s => s.status === "pending").map(s => {
              const ch = chores.find(c => c._id === s.choreId);
              if (!ch) return null;
              return (
                <li key={s._id} className={c.row}>
                  <div className="flex-1">
                    <div className="font-medium">{ch.name}</div>
                    <div className="text-xs font-mono">{s.from} → {s.to}</div>
                  </div>
                  {can("write") && (
                    <div className="flex gap-2">
                      <button className={c.btn} onClick={async () => {
                        await database.put({ ...ch, assignee: s.to });
                        await database.put({ ...s, status: "accepted" });
                      }}>Accept</button>
                      <button className={c.btnGhost} onClick={() => database.del(s._id)}>X</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {can("write") && chores.filter(ch => ch.assignee).length > 0 && members.length > 1 && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              const f = e.target;
              if (!f.choreId.value || !f.to.value) return;
              const ch = chores.find(c => c._id === f.choreId.value);
              await database.put({ type: "swap", choreId: f.choreId.value, from: ch.assignee, to: f.to.value, status: "pending", at: Date.now() });
              f.reset();
            }} className="flex flex-col gap-2">
              <select name="choreId" className={c.input} defaultValue="">
                <option value="">Pick a chore to swap...</option>
                {chores.filter(ch => ch.assignee).map(ch => <option key={ch._id} value={ch._id}>{ch.name} ({ch.assignee})</option>)}
              </select>
              <select name="to" className={c.input} defaultValue="">
                <option value="">Swap with...</option>
                {members.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
              </select>
              <button type="submit" className={c.btn}>Propose Swap</button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}