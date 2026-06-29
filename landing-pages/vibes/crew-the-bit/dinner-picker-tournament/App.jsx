import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can, ViewerTag } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("restaurant-showdown");
  const { docs: restaurants } = useLiveQuery("type", { key: "restaurant" });
  const { docs: brackets } = useLiveQuery("type", { key: "bracket", descending: true, limit: 1 });
  const { docs: matchupDocs } = useLiveQuery("type", { key: "matchup" });
  const { docs: votes } = useLiveQuery("type", { key: "vote" });
  const bracket = brackets[0];
  const { doc: newR, merge: mergeR, submit: submitR } = useDocument({ type: "restaurant", name: "", createdAt: Date.now() });
  const [suggesting, setSuggesting] = React.useState(false);
  const [launching, setLaunching] = React.useState(false);
  async function suggest() {
    setSuggesting(true);
    try {
      const r = await callAI("Suggest one fun local-style restaurant name (just the name, ~2-4 words).", { schema: { properties: { name: { type: "string" } } } });
      mergeR({ name: JSON.parse(r).name });
    } finally { setSuggesting(false); }
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1530] font-sans pb-20",
    header: "bg-[#1a1530] text-[#f5f1e8] px-4 py-5 border-b-4 border-[#e63946] sticky top-0 z-10",
    title: "text-2xl font-bold tracking-tight",
    tagline: "text-sm text-[#f5f1e8]/70 mt-1",
    main: "px-4 py-5 max-w-2xl mx-auto space-y-5",
    section: "bg-white border-2 border-[#1a1530] rounded p-4 shadow-[4px_4px_0_#1a1530]",
    h2: "text-lg font-bold mb-3 flex items-center gap-2",
    btn: "bg-[#e63946] text-white px-4 py-3 rounded font-bold min-h-[44px] border-2 border-[#1a1530] shadow-[2px_2px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnAlt: "bg-[#f4a261] text-[#1a1530] px-4 py-3 rounded font-bold min-h-[44px] border-2 border-[#1a1530] shadow-[2px_2px_0_#1a1530] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    input: "w-full px-3 py-3 border-2 border-[#1a1530] rounded bg-[#f5f1e8] text-[#1a1530] min-h-[44px] focus:outline-none focus:bg-white",
    row: "flex items-center justify-between gap-3 px-3 py-3 bg-[#f5f1e8] border-2 border-[#1a1530] rounded",
    matchup: "border-2 border-[#1a1530] rounded p-3 bg-[#f5f1e8] space-y-2",
    cuisineTag: "inline-block text-xs px-2 py-0.5 bg-[#264653] text-white rounded font-mono",
    muted: "text-sm text-[#1a1530]/60",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className={c.title}>Restaurant Showdown 🍽️</h1>
            <p className={c.tagline}>Bracket it out. Decide dinner.</p>
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="pool" className={c.section}>
          <h2 className={c.h2}>🍴 Contenders ({restaurants.length})</h2>
          {can("write") && !bracket && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); if (newR.name.trim()) submitR(); }} className="flex gap-2 mb-2">
                <input className={c.input} placeholder="Add a restaurant…" value={newR.name} onChange={(e) => mergeR({ name: e.target.value })} />
                <button type="submit" className={c.btn}>Add</button>
              </form>
              <button onClick={suggest} disabled={suggesting} className={c.btnAlt + " mb-3 text-sm"}>
                {suggesting ? (<svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>) : "✨ Suggest one"}
              </button>
            </>
          )}
          {!can("write") && <p className={c.muted + " mb-2"}>Spectator view — contact the owner for write access.</p>}
          <ul className="space-y-2">
            {restaurants.length === 0 && <li className={c.muted}>No contenders yet.</li>}
            {restaurants.map((r) => (
              <li key={r._id} className={c.row}>
                <span className="font-semibold">{r.name}</span>
                {can("write") && !bracket && <button onClick={() => database.del(r._id)} className="text-xs text-[#e63946] font-bold">remove</button>}
              </li>
            ))}
          </ul>
        </section>
        <section id="bracket-control" className={c.section}>
          <h2 className={c.h2}>🏆 Bracket {bracket && "— Live"}</h2>
          {bracket ? (
            <p className={c.muted}>Bracket launched! Round {Math.max(...matchupDocs.map(m=>m.round), 1)} in progress. Vote below.</p>
          ) : (
            <>
              <p className={c.muted + " mb-3"}>Need 2+ contenders. AI will tag each with a tagline + cuisine.</p>
              {can("write") && (
                <button
                  disabled={launching || restaurants.length < 2}
                  onClick={async () => {
                    setLaunching(true);
                    try {
                      const flavorRes = await callAI(`For each restaurant give a 4-8 word fun tagline and a 1-2 word cuisine tag. Restaurants: ${restaurants.map(r=>r.name).join(", ")}`, { schema: { properties: { items: { type: "array", items: { type: "object", properties: { name: {type:"string"}, tagline: {type:"string"}, cuisine: {type:"string"} } } } } } });
                      const flavor = JSON.parse(flavorRes).items;
                      const shuffled = [...restaurants].sort(() => Math.random() - 0.5);
                      await database.put({ type: "bracket", createdAt: Date.now(), totalRounds: Math.ceil(Math.log2(shuffled.length)) });
                      for (let i = 0; i < shuffled.length; i += 2) {
                        const a = shuffled[i]; const b = shuffled[i+1];
                        const fa = flavor.find(f => f.name === a.name) || {};
                        const fb = b ? flavor.find(f => f.name === b.name) || {} : null;
                        await database.put({ type: "matchup", round: 1, slot: i/2, aId: a._id, aName: a.name, aTagline: fa.tagline, aCuisine: fa.cuisine, bId: b?._id || null, bName: b?.name || null, bTagline: fb?.tagline, bCuisine: fb?.cuisine, winnerId: b ? null : a._id });
                      }
                    } finally { setLaunching(false); }
                  }}
                  className={c.btn}
                >
                  {launching ? (<><svg className="animate-spin inline w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>Seeding…</>) : "Launch Bracket"}
                </button>
              )}
            </>
          )}
        </section>
        <section id="matchups" className={c.section}>
          <h2 className={c.h2}>⚔️ Matchups</h2>
          {!bracket && <p className={c.muted}>Launch the bracket to start voting.</p>}
          {bracket && (() => {
            const currentRound = Math.min(...matchupDocs.filter(m => !m.winnerId).map(m => m.round).concat([bracket.totalRounds + 1]));
            const active = matchupDocs.filter(m => m.round === currentRound && !m.winnerId);
            const finalWinnerMatch = matchupDocs.find(m => m.round === bracket.totalRounds && m.winnerId);
            const voteFor = async (m, choiceId) => {
              const voterId = viewer?.userSlug || "anon-" + (localStorage.getItem("anonId") || (() => { const i = Math.random().toString(36).slice(2,8); localStorage.setItem("anonId", i); return i; })());
              const existing = votes.find(v => v.matchupId === m._id && v.voterId === voterId);
              if (existing) await database.put({ ...existing, choiceId });
              else await database.put({ type: "vote", matchupId: m._id, voterId, choiceId, createdAt: Date.now() });
              const all = votes.filter(v => v.matchupId === m._id && v._id !== existing?._id).concat([{ choiceId }]);
              const aVotes = all.filter(v => v.choiceId === m.aId).length;
              const bVotes = all.filter(v => v.choiceId === m.bId).length;
              if (aVotes + bVotes >= 2 && aVotes !== bVotes) {
                const winnerId = aVotes > bVotes ? m.aId : m.bId;
                const winnerName = aVotes > bVotes ? m.aName : m.bName;
                await database.put({ ...m, winnerId, winnerName });
                const sameRoundWinners = matchupDocs.filter(x => x.round === m.round && x.winnerId && x._id !== m._id).concat([{ ...m, winnerId, winnerName }]);
                if (sameRoundWinners.length === matchupDocs.filter(x => x.round === m.round).length && m.round < bracket.totalRounds) {
                  const sorted = sameRoundWinners.sort((a,b) => a.slot - b.slot);
                  for (let i = 0; i < sorted.length; i += 2) {
                    const w1 = sorted[i], w2 = sorted[i+1];
                    await database.put({ type: "matchup", round: m.round + 1, slot: i/2, aId: w1.winnerId, aName: w1.winnerName, bId: w2?.winnerId || null, bName: w2?.winnerName || null, winnerId: w2 ? null : w1.winnerId });
                  }
                }
              }
            };
            if (finalWinnerMatch) return <div className="text-center py-6"><p className="text-sm font-mono mb-2">🏆 TONIGHT WE EAT AT 🏆</p><p className="text-3xl font-bold text-[#e63946]">{finalWinnerMatch.winnerName}</p></div>;
            return (
              <div className="space-y-3">
                <p className={c.muted}>Round {currentRound} · {active.length} matchup{active.length!==1?"s":""}</p>
                {active.map(m => {
                  const mv = votes.filter(v => v.matchupId === m._id);
                  const aC = mv.filter(v => v.choiceId === m.aId).length;
                  const bC = mv.filter(v => v.choiceId === m.bId).length;
                  return (
                    <div key={m._id} className={c.matchup}>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{m.aName}</div>
                          {m.aCuisine && <span className={c.cuisineTag}>{m.aCuisine}</span>}
                          {m.aTagline && <p className="text-xs italic mt-1">{m.aTagline}</p>}
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg">{aC}</div>
                          {can("write") && <button onClick={() => voteFor(m, m.aId)} className={c.btnAlt + " text-xs py-2 px-3"}>Vote</button>}
                        </div>
                      </div>
                      <div className="text-center font-mono text-xs text-[#e63946]">— VS —</div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{m.bName}</div>
                          {m.bCuisine && <span className={c.cuisineTag}>{m.bCuisine}</span>}
                          {m.bTagline && <p className="text-xs italic mt-1">{m.bTagline}</p>}
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg">{bC}</div>
                          {can("write") && <button onClick={() => voteFor(m, m.bId)} className={c.btnAlt + " text-xs py-2 px-3"}>Vote</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      </main>
    </div>
  );
}