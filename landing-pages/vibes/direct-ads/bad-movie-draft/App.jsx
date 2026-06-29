const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
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
    tagline: "text-[#00f0ff] text-base font-['Share_Tech_Mono',monospace] mt-1",
    section: "bg-[#4d1558] border-2 border-[#f93c94] rounded-lg p-4 mb-4 shadow-[0_0_10px_#f93c94]",
    h2: "text-[#fcee0a] text-2xl font-['Orbitron',sans-serif] font-bold mb-3 uppercase tracking-wide",
    input: "w-full bg-[#2a0a2e] text-[#fcee0a] border-2 border-[#00f0ff] rounded px-3 py-3 min-h-[44px] placeholder-[#00f0ff]/50 focus:outline-none focus:border-[#fcee0a]",
    btn: "bg-[#f93c94] text-[#2a0a2e] font-bold py-3 px-4 rounded border-2 border-[#fcee0a] min-h-[44px] hover:bg-[#fcee0a] hover:text-[#2a0a2e] transition uppercase font-['Orbitron',sans-serif] tracking-wide disabled:opacity-50",
    btnAlt: "bg-[#00f0ff] text-[#2a0a2e] font-bold py-3 px-4 rounded border-2 border-[#2a0a2e] hover:bg-[#fcee0a] transition text-base min-h-[44px]",
    row: "bg-[#2a0a2e] border-2 border-[#00f0ff] rounded p-3 mb-2 text-[#fcee0a]",
    label: "text-[#00f0ff] text-base font-['Share_Tech_Mono',monospace] uppercase",
    crown: "text-[#fcee0a]",
    readonly: "text-[#00f0ff] italic text-base",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, style: {
        background: "linear-gradient(rgba(42,10,46,0.55), rgba(42,10,46,0.80)), url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920&q=80&fit=crop') center/cover",
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        borderRadius: '12px',
        position: 'relative',
      }, children: [
        _jsxDEV('h1', { className: c.title, style: { fontSize: 'clamp(2.5rem, 8vw, 5rem)', lineHeight: 1, marginBottom: '0.5rem', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "It's draft night."    }, void 0, false, {fileName: _jsxFileName, lineNumber: 70}, this)
        , _jsxDEV('p', { className: c.tagline, style: { fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', maxWidth: '32ch' }, children: "Pick your bad movies. Build your lineup. See who wins the worst."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 71}, this)
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@felixmooneeram?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Felix Mooneeram" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 69}, this)
      , _jsxDEV('main', { id: "app", children: [
        _jsxDEV('section', { id: "draft-board", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Draft Board" }, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
          , can("write") && viewer ? (
            _jsxDEV('div', { className: "space-y-2 mb-3" , children: [
              _jsxDEV('input', { className: c.input, value: title, onChange: e => setTitle(e.target.value), placeholder: "Movie title (e.g. The Room)"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this )
              , _jsxDEV('input', { className: c.input, value: tagline, onChange: e => setTagline(e.target.value), placeholder: "Tagline",}, void 0, false, {fileName: _jsxFileName, lineNumber: 79}, this )
              , _jsxDEV('input', { className: c.input, value: year, onChange: e => setYear(e.target.value), placeholder: "Year",}, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this )
              , _jsxDEV('div', { className: "flex gap-2" , children: [
                _jsxDEV('button', { className: c.btnAlt, onClick: handleAiFill, disabled: aiLoading || !title.trim(), children: 
                  aiLoading ? (
                    _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 84}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 84}, this)
                  ) : "✨ AI Fill"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this)
                , _jsxDEV('button', { className: c.btn, onClick: handleClaim, disabled: !title.trim(), children: "Start drafting" }, void 0, false, {fileName: _jsxFileName, lineNumber: 87}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 81}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 77}, this)
          ) : (
            _jsxDEV('p', { className: c.readonly, children: "Read-only view — sign in for write access to claim picks."          }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
          )
          , picks.length === 0 ? (
            _jsxDEV('p', { className: c.readonly, children: "No picks yet. Be the first to claim a bad movie."          }, void 0, false, {fileName: _jsxFileName, lineNumber: 94}, this)
          ) : picks.map(p => (
            _jsxDEV('div', { className: c.row, children: [
              _jsxDEV('div', { className: "flex items-center gap-2"  , children: [
                p.drafterAvatar && _jsxDEV('img', { src: p.drafterAvatar, alt: "", className: "w-6 h-6 rounded-full"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this )
                , _jsxDEV('div', { className: c.label, children: p.drafterName}, void 0, false, {fileName: _jsxFileName, lineNumber: 99}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 97}, this)
              , _jsxDEV('div', { className: "font-bold text-xl" , children: [p.title, " " , p.year && `(${p.year})`]}, void 0, true, {fileName: _jsxFileName, lineNumber: 101}, this)
              , p.tagline && _jsxDEV('div', { className: "text-base italic" , children: p.tagline}, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)
            ]}, p._id, true, {fileName: _jsxFileName, lineNumber: 96}, this)
          ))
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
        , _jsxDEV('section', { id: "rate-watch", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Rate the Watch"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
          , picks.length === 0 ? (
            _jsxDEV('p', { className: c.readonly, children: "No picks to rate yet."    }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
          ) : picks.map(p => {
            const myRating = viewer && ratings.find(r => r.pickId === p._id && r.raterSlug === viewer.userSlug);
            const pickRatings = ratings.filter(r => r.pickId === p._id);
            const avg = pickRatings.length ? (pickRatings.reduce((s,r) => s + r.score, 0) / pickRatings.length).toFixed(1) : "—";
            return (
              _jsxDEV('div', { className: c.row, children: [
                _jsxDEV('div', { className: "font-bold", children: p.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 116}, this)
                , _jsxDEV('div', { className: c.label, children: ["Avg: " , avg, " (" , pickRatings.length, " votes)" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117}, this)
                , can("write") && viewer ? (
                  _jsxDEV('div', { className: "flex gap-1 mt-2"  , children: 
                    [1,2,3,4,5].map(n => (
                      _jsxDEV('button', { onClick: () => handleRate(p._id, n),
                        className: `w-10 h-10 rounded border-2 font-bold ${_optionalChain([myRating, 'optionalAccess', _ => _.score]) === n ? "bg-[#fcee0a] text-[#2a0a2e] border-[#f93c94]" : "bg-[#4d1558] text-[#fcee0a] border-[#00f0ff]"}`, children: 
                        n
                      }, n, false, {fileName: _jsxFileName, lineNumber: 121}, this)
                    ))
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this)
                ) : (
                  _jsxDEV('p', { className: c.readonly, children: "Sign in to rate."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 128}, this)
                )
              ]}, p._id, true, {fileName: _jsxFileName, lineNumber: 115}, this)
            );
          })
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
        , _jsxDEV('section', { id: "standings", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Season Standings" }, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this)
          , (() => {
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
            if (!standings.length) return _jsxDEV('p', { className: c.readonly, children: "No rated picks yet — standings will appear once ratings come in."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this);
            return standings.map((s, i) => (
              _jsxDEV('div', { className: c.row, children: 
                _jsxDEV('div', { className: "flex items-center gap-2"  , children: [
                  i === 0 && _jsxDEV('span', { className: c.crown, children: "👑"}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
                  , s.avatar && _jsxDEV('img', { src: s.avatar, alt: "", className: "w-8 h-8 rounded-full"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this )
                  , _jsxDEV('div', { className: "flex-1", children: [
                    _jsxDEV('div', { className: "font-bold", children: s.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
                    , _jsxDEV('div', { className: c.label, children: [s.scores.length, " pick(s) • Avg "    , s.avg.toFixed(2)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 156}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 154}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
              }, s.slug, false, {fileName: _jsxFileName, lineNumber: 150}, this)
            ));
          })()
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 134}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 73}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 68}, this)
  )
}