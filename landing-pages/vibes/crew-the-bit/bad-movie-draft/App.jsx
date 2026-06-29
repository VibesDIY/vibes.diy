import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery } = useFireproof("bad-movie-night");
  const { docs: picks } = useLiveQuery("type", { key: "pick", descending: true });
  const { docs: ratings } = useLiveQuery("type", { key: "rating" });
  const [title, setTitle] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [year, setYear] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);

  const handleAiFill = async () => {
    if (!title.trim()) return;
    setAiLoading(true);
    try {
      const res = await callAI(`Give a short campy tagline and release year for the movie "${title}".`, {
        schema: { properties: { tagline: { type: "string" }, year: { type: "string" } } }
      });
      const data = JSON.parse(res);
      setTagline(data.tagline || "");
      setYear(data.year || "");
    } finally { setAiLoading(false); }
  };

  const handleClaim = async () => {
    if (!title.trim() || !viewer) return;
    await database.put({
      type: "pick", title, tagline, year,
      drafterSlug: viewer.userSlug,
      drafterName: viewer.displayName || viewer.userSlug,
      drafterAvatar: viewer.avatarUrl,
      createdAt: Date.now(), watched: false,
    });
    setTitle(""); setTagline(""); setYear("");
  };

  const handleRate = async (pickId, score) => {
    if (!viewer) return;
    const existing = ratings.find(r => r.pickId === pickId && r.raterSlug === viewer.userSlug);
    if (existing) {
      await database.put({ ...existing, score });
    } else {
      await database.put({ type: "rating", pickId, score, raterSlug: viewer.userSlug, createdAt: Date.now() });
    }
  };

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] p-4 font-['Rajdhani',sans-serif]",
    header: "bg-[#2a0a2e] border-4 border-[#fcee0a] rounded-lg p-4 mb-4 shadow-[0_0_20px_#f93c94]",
    title: "text-[#fcee0a] text-3xl font-['Orbitron',sans-serif] font-bold tracking-wider",
    tagline: "text-[#00f0ff] text-sm font-['Share_Tech_Mono',monospace] mt-1",
    section: "bg-[#4d1558] border-2 border-[#f93c94] rounded-lg p-4 mb-4 shadow-[0_0_10px_#f93c94]",
    h2: "text-[#fcee0a] text-xl font-['Orbitron',sans-serif] font-bold mb-3 uppercase tracking-wide",
    input: "w-full bg-[#2a0a2e] text-[#fcee0a] border-2 border-[#00f0ff] rounded px-3 py-3 min-h-[44px] placeholder-[#00f0ff]/50 focus:outline-none focus:border-[#fcee0a]",
    btn: "bg-[#f93c94] text-[#2a0a2e] font-bold py-3 px-4 rounded border-2 border-[#fcee0a] min-h-[44px] hover:bg-[#fcee0a] hover:text-[#2a0a2e] transition uppercase font-['Orbitron',sans-serif] tracking-wide disabled:opacity-50",
    btnAlt: "bg-[#00f0ff] text-[#2a0a2e] font-bold py-2 px-3 rounded border-2 border-[#2a0a2e] hover:bg-[#fcee0a] transition text-sm",
    row: "bg-[#2a0a2e] border-2 border-[#00f0ff] rounded p-3 mb-2 text-[#fcee0a]",
    label: "text-[#00f0ff] text-sm font-['Share_Tech_Mono',monospace] uppercase",
    crown: "text-[#fcee0a]",
    readonly: "text-[#00f0ff] italic text-sm",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>★ BAD MOVIE NIGHT ★</h1>
        <p className={c.tagline}>Draft. Watch. Rate. Crown the worst.</p>
      </header>
      <main id="app">
        <section id="draft-board" className={c.section}>
          <h2 className={c.h2}>Draft Board</h2>
          {can("write") && viewer ? (
            <div className="space-y-2 mb-3">
              <input className={c.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie title (e.g. The Room)" />
              <input className={c.input} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Tagline" />
              <input className={c.input} value={year} onChange={e => setYear(e.target.value)} placeholder="Year" />
              <div className="flex gap-2">
                <button className={c.btnAlt} onClick={handleAiFill} disabled={aiLoading || !title.trim()}>
                  {aiLoading ? (
                    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg>
                  ) : "✨ AI Fill"}
                </button>
                <button className={c.btn} onClick={handleClaim} disabled={!title.trim()}>Claim Pick</button>
              </div>
            </div>
          ) : (
            <p className={c.readonly}>Read-only view — sign in for write access to claim picks.</p>
          )}
          {picks.length === 0 ? (
            <p className={c.readonly}>No picks yet. Be the first to claim a bad movie.</p>
          ) : picks.map(p => (
            <div key={p._id} className={c.row}>
              <div className="flex items-center gap-2">
                {p.drafterAvatar && <img src={p.drafterAvatar} alt="" className="w-6 h-6 rounded-full" />}
                <div className={c.label}>{p.drafterName}</div>
              </div>
              <div className="font-bold text-lg">{p.title} {p.year && `(${p.year})`}</div>
              {p.tagline && <div className="text-sm italic">{p.tagline}</div>}
            </div>
          ))}
        </section>
        <section id="rate-watch" className={c.section}>
          <h2 className={c.h2}>Rate the Watch</h2>
          {picks.length === 0 ? (
            <p className={c.readonly}>No picks to rate yet.</p>
          ) : picks.map(p => {
            const myRating = viewer && ratings.find(r => r.pickId === p._id && r.raterSlug === viewer.userSlug);
            const pickRatings = ratings.filter(r => r.pickId === p._id);
            const avg = pickRatings.length ? (pickRatings.reduce((s,r) => s + r.score, 0) / pickRatings.length).toFixed(1) : "—";
            return (
              <div key={p._id} className={c.row}>
                <div className="font-bold">{p.title}</div>
                <div className={c.label}>Avg: {avg} ({pickRatings.length} votes)</div>
                {can("write") && viewer ? (
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => handleRate(p._id, n)}
                        className={`w-10 h-10 rounded border-2 font-bold ${myRating?.score === n ? "bg-[#fcee0a] text-[#2a0a2e] border-[#f93c94]" : "bg-[#4d1558] text-[#fcee0a] border-[#00f0ff]"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={c.readonly}>Sign in to rate.</p>
                )}
              </div>
            );
          })}
        </section>
        <section id="standings" className={c.section}>
          <h2 className={c.h2}>Season Standings</h2>
          {(() => {
            const byDrafter = {};
            picks.forEach(p => {
              const pickRatings = ratings.filter(r => r.pickId === p._id);
              if (!pickRatings.length) return;
              const avg = pickRatings.reduce((s,r) => s + r.score, 0) / pickRatings.length;
              if (!byDrafter[p.drafterSlug]) byDrafter[p.drafterSlug] = { name: p.drafterName, avatar: p.drafterAvatar, scores: [] };
              byDrafter[p.drafterSlug].scores.push(avg);
            });
            const standings = Object.entries(byDrafter).map(([slug, d]) => ({
              slug, ...d, avg: d.scores.reduce((s,x) => s+x, 0) / d.scores.length
            })).sort((a,b) => b.avg - a.avg);
            if (!standings.length) return <p className={c.readonly}>No rated picks yet — standings will appear once ratings come in.</p>;
            return standings.map((s, i) => (
              <div key={s.slug} className={c.row}>
                <div className="flex items-center gap-2">
                  {i === 0 && <span className={c.crown}>👑</span>}
                  {s.avatar && <img src={s.avatar} alt="" className="w-8 h-8 rounded-full" />}
                  <div className="flex-1">
                    <div className="font-bold">{s.name}</div>
                    <div className={c.label}>{s.scores.length} pick(s) • Avg {s.avg.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ));
          })()}
        </section>
      </main>
    </div>
  )
}