import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function HallOfFame({ weeks, useLiveQuery, c }) {
  const { docs: allNoms } = useLiveQuery("type", { key: "nomination" });
  const tally = {};
  weeks.slice(1).forEach(w => {
    (w.categories || []).forEach(cat => {
      const winners = allNoms.filter(n => n.weekId === w._id && n.category === cat).sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
      if (winners[0] && (winners[0].votes?.length || 0) > 0) {
        tally[winners[0].name] = (tally[winners[0].name] || 0) + 1;
      }
    });
  });
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return <p className="text-sm opacity-70">No past winners yet. Finish a week to build the hall.</p>;
  return (
    <ul className="space-y-1">
      {ranked.map(([name, count], i) => (
        <li key={name} className={c.row}>
          <span>{i === 0 && "👑 "}{name}</span>
          <span className={c.pill}>{count} win{count !== 1 ? "s" : ""}</span>
        </li>
      ))}
    </ul>
  );
}

function NominateVote({ week, database, useLiveQuery, can, viewer, c }) {
  const [nomInputs, setNomInputs] = React.useState({});
  const { docs: noms } = useLiveQuery("weekId", { key: week?._id || "_none_" });
  if (!week) return <p className="text-sm opacity-70">Start a week above to begin nominating.</p>;
  if (!week.categories?.length) return <p className="text-sm opacity-70">Generate categories for this week first.</p>;

  async function addNom(cat) {
    const name = (nomInputs[cat] || "").trim();
    if (!name) return;
    await database.put({ type: "nomination", weekId: week._id, category: cat, name, votes: [], createdAt: Date.now() });
    setNomInputs({ ...nomInputs, [cat]: "" });
  }
  async function toggleVote(nom) {
    const slug = viewer?.userSlug || "anon";
    const votes = nom.votes?.includes(slug) ? nom.votes.filter(v => v !== slug) : [...(nom.votes || []), slug];
    await database.put({ ...nom, votes });
  }

  return (
    <div className="space-y-5">
      {week.categories.map((cat) => {
        const catNoms = noms.filter(n => n.category === cat).sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
        return (
          <div key={cat}>
            <h3 className="font-semibold mb-2">{cat}</h3>
            {can("write") && (
              <div className="flex gap-2 mb-2">
                <input className={c.input} placeholder="Nominate a friend..." value={nomInputs[cat] || ""} onChange={(e) => setNomInputs({ ...nomInputs, [cat]: e.target.value })} />
                <button className={c.btn} onClick={() => addNom(cat)}>Add</button>
              </div>
            )}
            <ul className="space-y-1">
              {catNoms.map(n => (
                <li key={n._id} className={c.row}>
                  <span>{n.name}</span>
                  {can("write") ? (
                    <button className={c.btnAccent} onClick={() => toggleVote(n)}>
                      {n.votes?.includes(viewer?.userSlug || "anon") ? "✓" : "Vote"} ({n.votes?.length || 0})
                    </button>
                  ) : <span className={c.pill}>{n.votes?.length || 0} votes</span>}
                </li>
              ))}
              {catNoms.length === 0 && <li className="text-sm opacity-60 py-1">No nominees yet.</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("superlatives");
  const { doc: weekDoc, merge: mergeWeek, submit: submitWeek } = useDocument({ type: "week", name: "", categories: [], createdAt: Date.now() });
  const { docs: weeks } = useLiveQuery("type", { key: "week", descending: true });
  const currentWeek = weeks[0];
  const [isGenerating, setIsGenerating] = React.useState(false);

  async function generateCategories() {
    setIsGenerating(true);
    try {
      const past = weeks.flatMap(w => w.categories || []).slice(0, 20).join(", ");
      const res = await callAI(`Generate 4 funny, creative weekly superlative categories for a friend group. Avoid: ${past}`, {
        schema: { properties: { categories: { type: "array", items: { type: "string" } } } }
      });
      const { categories } = JSON.parse(res);
      mergeWeek({ categories });
    } finally { setIsGenerating(false); }
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1530] font-sans pb-20",
    header: "bg-[#e63946] text-white px-4 py-5 border-b-4 border-[#1a1530] sticky top-0 z-10",
    title: "text-2xl font-bold tracking-tight",
    tagline: "text-sm opacity-90 mt-1",
    main: "px-4 py-5 space-y-5 max-w-2xl mx-auto",
    section: "bg-white border-2 border-[#1a1530] rounded p-4 shadow-[4px_4px_0_#1a1530]",
    sectionTitle: "text-lg font-bold mb-3 flex items-center gap-2",
    btn: "min-h-[44px] px-4 py-2 bg-[#1a1530] text-[#f5f1e8] rounded font-semibold hover:bg-[#e63946] disabled:opacity-50 transition-colors",
    btnAccent: "min-h-[44px] px-4 py-2 bg-[#fbbf24] text-[#1a1530] rounded font-bold border-2 border-[#1a1530] hover:bg-[#e63946] hover:text-white disabled:opacity-50",
    input: "w-full min-h-[44px] px-3 py-2 border-2 border-[#1a1530] rounded bg-[#f5f1e8] text-[#1a1530] focus:outline-none focus:ring-2 focus:ring-[#e63946]",
    row: "flex items-center justify-between gap-3 py-2 border-b border-[#1a1530]/20 last:border-0",
    pill: "inline-block px-2 py-1 text-xs font-bold bg-[#fbbf24] border border-[#1a1530] rounded",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Weekly Superlatives</h1>
        <p className={c.tagline}>Crown your friends, week by week</p>
      </header>
      <main id="app" className={c.main}>
        <section id="current-week" className={c.section}>
          <h2 className={c.sectionTitle}>This Week {currentWeek && <span className={c.pill}>{currentWeek.name}</span>}</h2>
          {can("write") ? (
            <div className="space-y-3">
              <input className={c.input} placeholder="Week name (e.g. Week of Nov 18)" value={weekDoc.name} onChange={(e) => mergeWeek({ name: e.target.value })} />
              <div className="flex gap-2 flex-wrap">
                <button className={c.btn} onClick={submitWeek} disabled={!weekDoc.name.trim()}>Start Week</button>
                <button className={c.btnAccent} onClick={generateCategories} disabled={isGenerating}>
                  {isGenerating ? <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : "✨ Generate Categories"}
                </button>
              </div>
              {weekDoc.categories?.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {weekDoc.categories.map((cat, i) => <li key={i} className={c.row}><span>{cat}</span><span className={c.pill}>draft</span></li>)}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm opacity-70">Read-only view. Contact the owner for write access.</p>
          )}
          {currentWeek?.categories?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {currentWeek.categories.map((cat, i) => <li key={i} className={c.row}><span>{cat}</span><span className={c.pill}>live</span></li>)}
            </ul>
          )}
        </section>
        <section id="nominate-vote" className={c.section}>
          <h2 className={c.sectionTitle}>Nominate & Vote</h2>
          <NominateVote week={currentWeek} database={database} useLiveQuery={useLiveQuery} can={can} viewer={viewer} c={c} />
        </section>
        <section id="hall-of-fame" className={c.section}>
          <h2 className={c.sectionTitle}>🏆 Hall of Fame</h2>
          <HallOfFame weeks={weeks} useLiveQuery={useLiveQuery} c={c} />
        </section>
      </main>
    </div>
  );
}