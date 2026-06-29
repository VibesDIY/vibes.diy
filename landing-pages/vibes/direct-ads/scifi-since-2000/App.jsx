const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const TIERS = ["S", "A", "B", "C", "D", "F"]
const TIER_RANK = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 }
const TIER_COLOR = {
  S: "bg-[#39ff14] text-[#05060f]",
  A: "bg-[#13e0d8] text-[#05060f]",
  B: "bg-[#3aa0ff] text-[#05060f]",
  C: "bg-[#b46bff] text-[#05060f]",
  D: "bg-[#ff5fd2] text-[#05060f]",
  F: "bg-[#ff3b5c] text-[#05060f]",
}

// real movie posters via OMDb; graceful null on miss/CORS
async function fetchPoster(title, year) {
  try {
    const u = `https://www.omdbapi.com/?apikey=4f5681f1&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}`
    const r = await fetch(u)
    const j = await r.json()
    return (j && j.Poster && j.Poster !== "N/A") ? j.Poster : null
  } catch (e) { return null }
}

function Poster({ url, label, w }) {
  const width = w || 96
  const height = Math.round(width * 1.5)
  if (url) return _jsxDEV('img', { src: url, alt: label, className: "object-cover border border-[#39ff14]/40 shrink-0 shadow-[0_0_14px_rgba(57,255,20,0.18)]"    , style: { width, height },}, void 0, false, {fileName: _jsxFileName, lineNumber: 30}, this )
  return (
    _jsxDEV('div', { className: "border border-[#39ff14]/40 shrink-0 flex items-center justify-center bg-[#0b0e1f] relative overflow-hidden"        , style: { width, height }, children: [
      _jsxDEV('div', { className: "absolute inset-0 opacity-30"  , style: { background: "radial-gradient(circle at 50% 30%, rgba(57,255,20,0.25), transparent 70%)" },}, void 0, false, {fileName: _jsxFileName, lineNumber: 33}, this )
      , _jsxDEV('span', { className: "display text-[#39ff14] text-center px-1 leading-tight relative z-10"      , style: { fontSize: Math.max(8, width * 0.1) }, children: label}, void 0, false, {fileName: _jsxFileName, lineNumber: 34}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 32}, this)
  )
}

// poster + caption (title, optional year) below — for unranked pool + in-tier chips
function PosterCard({ url, name, year, w }) {
  return (
    _jsxDEV('div', { className: "flex flex-col items-center"  , style: { width: w }, children: [
      _jsxDEV(Poster, { url: url, label: name, w: w,}, void 0, false, {fileName: _jsxFileName, lineNumber: 43}, this )
      , _jsxDEV('div', { className: "mono text-[#9fb0e0] text-center leading-tight mt-1 w-full truncate px-0.5"       , style: { fontSize: 13 }, title: name, children: name}, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
      , year ? _jsxDEV('div', { className: "mono text-[#5a6699] text-center leading-tight"   , style: { fontSize: 12 }, children: year}, void 0, false, {fileName: _jsxFileName, lineNumber: 45}, this) : null
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 42}, this)
  )
}

function Spinner() {
  return _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeOpacity: ".25",}, void 0, false, {fileName: _jsxFileName, lineNumber: 51}, this ), _jsxDEV('path', { d: "M12 2a10 10 0 0 1 10 10"       ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 51}, this )]}, void 0, true, {fileName: _jsxFileName, lineNumber: 51}, this)
}

function AddMovieForm({ database, can }) {
  const [name, setName] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [last, setLast] = React.useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      const res = await callAI(
        `You are a sci-fi film archivist. For this movie (released in the year 2000 or later), return its release year and a one-line note (max 12 words). Movie: "${name}".`,
        { schema: { properties: { year: { type: "string" }, description: { type: "string" } } } }
      )
      const { year, description } = JSON.parse(res)
      const posterUrl = await fetchPoster(name.trim(), year)
      await database.put({ type: "movie", name: name.trim(), year, description, posterUrl, createdAt: Date.now() })
      setLast({ name: name.trim(), year, description, posterUrl })
      setName("")
    } finally { setAdding(false) }
  }

  if (!can("write")) return null

  return (
    _jsxDEV('details', { className: "bg-[#080b1a] border border-[#13e0d8]/30 shadow-[0_0_24px_rgba(19,224,216,0.08)]"   , children: [
      _jsxDEV(‘summary’, { className: "px-5 py-3 mono text-sm font-bold uppercase tracking-[0.15em] text-[#13e0d8] cursor-pointer select-none bg-[#0b0e1f] border-b border-[#13e0d8]/30"            , children: "+ Add a film that’s missing"     }, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this)
      , _jsxDEV('form', { onSubmit: handleAdd, className: "px-5 py-4 space-y-3"  , children: [
        _jsxDEV('input', { className: "w-full bg-[#0b0e1f] border border-[#39ff14]/40 px-3 py-3 text-base text-[#d7e0ff] placeholder-[#5a6699] focus:outline-none focus:border-[#39ff14] focus:shadow-[0_0_12px_rgba(57,255,20,0.35)] transition-all min-h-[44px]"            , placeholder: "Add a film — e.g. Tenet"     , value: name, onChange: e => setName(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this )
        , _jsxDEV('button', { className: "w-full bg-transparent text-[#39ff14] mono uppercase tracking-[0.15em] text-sm px-4 py-3 border border-[#39ff14] hover:bg-[#39ff14] hover:text-[#05060f] hover:shadow-[0_0_16px_rgba(57,255,20,0.5)] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2 min-h-[44px]"                    , disabled: adding || !name.trim(), children: [
          adding ? _jsxDEV(Spinner, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 84}, this ) : null
          , adding ? "Scanning archive…" : "Add film (AI tags it, poster auto-fetched)"
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 83}, this)
        , last && (
          _jsxDEV('div', { className: "bg-[#0b0e1f] border border-[#13e0d8]/50 p-4 text-base shadow-[0_0_14px_rgba(19,224,216,0.18)] flex gap-3 items-center"        , children: [
            _jsxDEV(Poster, { url: last.posterUrl, label: last.name, w: 40,}, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this )
            , _jsxDEV('div', { children: [
              _jsxDEV('span', { className: "display text-[#d7e0ff]" , children: last.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
              , _jsxDEV('span', { className: "ml-2 mono text-sm bg-[#13e0d8] text-[#05060f] px-2 py-0.5 font-bold"       , children: last.year}, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
              , _jsxDEV('p', { className: "text-[#7a8bbf] mt-0.5" , children: last.description}, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 81}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 79}, this)
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("scifi-since-2000-v2")

  const { docs: movies } = useLiveQuery("type", { key: "movie" })
  const { docs: ballots } = useLiveQuery("type", { key: "ballot" })

  React.useEffect(() => {
    if (movies.length === 0) {
      const seeds = [
        { name: "Children of Men", year: "2006", description: "A dying world, one fragile pregnancy, the most harrowing long takes ever filmed." },
        { name: "Arrival", year: "2016", description: "First contact rewires how you read time itself." },
        { name: "Ex Machina", year: "2014", description: "A Turing test that becomes a seduction becomes a trap." },
        { name: "Interstellar", year: "2014", description: "Love, relativity, and a bookshelf at the edge of a black hole." },
        { name: "Dune", year: "2021", description: "Desert prophecy rendered at staggering scale." },
        { name: "Annihilation", year: "2018", description: "A shimmer where biology mutates and the self dissolves." },
        { name: "Edge of Tomorrow", year: "2014", description: "Live. Die. Repeat. The best time-loop war movie." },
        { name: "Her", year: "2013", description: "A man falls for his operating system — and it's tender, not creepy." },
        { name: "District 9", year: "2009", description: "Apartheid allegory with aliens and a body horror twist." },
        { name: "Blade Runner 2049", year: "2017", description: "A worthy sequel: rain, neon, and questions of the soul." },
      ]
      seeds.forEach(async s => {
        const posterUrl = await fetchPoster(s.name, s.year)
        database.put({ _id: `movie:${s.name}`, type: "movie", createdAt: Date.now(), posterUrl, ...s })
      })
    }
  }, [movies.length])

  const { doc: nameDoc, merge: mergeName } = useDocument({ _id: "my-name", name: "" })
  const [tiers, setTiers] = React.useState({})
  const [activeId, setActiveId] = React.useState(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const resultsRef = React.useRef(null)

  const avgFor = (id) => {
    const vs = ballots.filter(b => b.tiers && b.tiers[id])
    return vs.length ? vs.reduce((s, b) => s + TIER_RANK[b.tiers[id]], 0) / vs.length : null
  }
  const ranked = [...movies].sort((a, b) => (_nullishCoalesce(avgFor(a._id), () => ( 99))) - (_nullishCoalesce(avgFor(b._id), () => ( 99))))
  const totalBallots = ballots.length
  const placedCount = Object.keys(tiers).length

  const setTier = (id, t) => { setTiers(prev => ({ ...prev, [id]: t })); setActiveId(null) }
  const benchIt = (id) => setTiers(prev => { const n = { ...prev }; delete n[id]; return n })
  const onDragStart = (e, id) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move" }
  const onDropTier = (e, t) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setTier(id, t) }
  const onDropBench = (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) benchIt(id) }

  const submit = async () => {
    setSubmitting(true)
    try {
      const voter = nameDoc.name.trim() || (viewer && (viewer.displayName || viewer.userSlug)) || "Anonymous"
      await database.put({ type: "ballot", voter, tiers, createdAt: Date.now() })
      setSubmitted(true)
      setTimeout(() => { if (resultsRef.current) resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }) }, 120)
    } finally { setSubmitting(false) }
  }

  return (
    _jsxDEV('div', { className: "min-h-screen bg-[#05060f] text-[#d7e0ff] font-['Chakra_Petch',sans-serif] relative overflow-hidden"     , children: [
      _jsxDEV('style', { children: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Chakra+Petch:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
        .display { font-family: 'Orbitron', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .starfield::before, .starfield::after {
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
          background-image:
            radial-gradient(1px 1px at 20px 30px, rgba(215,224,255,0.9), transparent),
            radial-gradient(1px 1px at 70px 120px, rgba(57,255,20,0.6), transparent),
            radial-gradient(1.5px 1.5px at 160px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 230px 200px, rgba(19,224,216,0.7), transparent),
            radial-gradient(1px 1px at 300px 40px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.5px 1.5px at 120px 260px, rgba(180,107,255,0.6), transparent);
          background-size: 350px 350px; opacity:0.55;
        }
        .starfield::after { background-size: 500px 500px; opacity:0.3; animation: drift 90s linear infinite; }
        @keyframes drift { from { transform: translateY(0); } to { transform: translateY(-500px); } }
        .scanlines::before {
          content:""; position:fixed; inset:0; pointer-events:none; z-index:1; opacity:0.5;
          background: repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0) 4px);
        }
        .glow-text { text-shadow: 0 0 12px rgba(57,255,20,0.6), 0 0 28px rgba(57,255,20,0.3); }
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this)
      , _jsxDEV('link', { rel: "preconnect", href: "https://fonts.googleapis.com",}, void 0, false, {fileName: _jsxFileName, lineNumber: 186}, this )
      , _jsxDEV('link', { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous",}, void 0, false, {fileName: _jsxFileName, lineNumber: 187}, this )
      , _jsxDEV('div', { className: "starfield",}, void 0, false, {fileName: _jsxFileName, lineNumber: 188}, this )
      , _jsxDEV('div', { className: "scanlines",}, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this )

      , _jsxDEV(‘header’, { className: "relative z-10 border-b border-[#39ff14]/30"      , style: {
        background: "linear-gradient(rgba(5,6,15,0.40), rgba(5,6,15,0.80)), url(‘https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80&fit=crop’) center/cover",
        minHeight: ‘60vh’,
        display: ‘flex’,
        alignItems: ‘center’,
        justifyContent: ‘center’,
        textAlign: ‘center’,
      }, children:
        _jsxDEV(‘div’, { className: "max-w-2xl mx-auto px-5 py-12 w-full"    , children: [
          _jsxDEV(‘div’, { className: "mono text-sm font-bold uppercase tracking-[0.4em] text-[#13e0d8] mb-3"      , children: "// GROUP CONSENSUS PROTOCOL · ARCHIVE 2000+"      }, void 0, false, {fileName: _jsxFileName, lineNumber: 193}, this)
          , _jsxDEV(‘h1’, { className: "display font-black uppercase leading-[0.95] text-[#39ff14] glow-text"      , style: { fontSize: ‘clamp(2.5rem, 8vw, 5rem)’, textShadow: ‘0 2px 20px rgba(0,0,0,0.5), 0 0 12px rgba(57,255,20,0.6), 0 0 28px rgba(57,255,20,0.3)’ }, children: ["The best sci-fi since 2000." , _jsxDEV(‘br’, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 194}, this ), "Fight about it."  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 194}, this)
          , _jsxDEV(‘p’, { className: "mt-4 text-[#9fb0e0]"   , style: { fontSize: ‘clamp(1rem, 2.5vw, 1.3rem)’, maxWidth: ‘36ch’, margin: ‘1rem auto 0’ }, children: "Rank, debate, and settle it once and for all."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 195}, this)
          , _jsxDEV(‘div’, { className: "mt-5 flex flex-wrap gap-2 justify-center"    , children: [
            _jsxDEV(‘span’, { className: "mono text-sm font-bold uppercase bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/40 px-3 py-1.5"         , children: [totalBallots, " " , totalBallots === 1 ? "ballot" : "ballots"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 197}, this)
            , _jsxDEV(‘span’, { className: "mono text-sm font-bold uppercase bg-[#13e0d8]/10 text-[#13e0d8] border border-[#13e0d8]/40 px-3 py-1.5"         , children: [movies.length, " films" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 198}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 196}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 192}, this)
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this)

      /* single-column flow: rank → lock in → results reveal right below */
      , _jsxDEV('main', { className: "relative z-10 max-w-2xl mx-auto px-5 py-8 space-y-6"      , children: [

        !can("write") ? (
          _jsxDEV(‘div’, { className: "bg-[#080b1a] border border-[#39ff14]/30 shadow-[0_0_30px_rgba(57,255,20,0.08)] p-5 text-base text-[#7a8bbf]"      , children: "Read-only transmission — request write access to cast a ballot. The crew’s verdict is below."              }, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this)
        ) : (
          _jsxDEV('section', { className: "bg-[#080b1a] border border-[#39ff14]/30 shadow-[0_0_30px_rgba(57,255,20,0.08)]"   , children: [
            _jsxDEV('h2', { className: "px-5 py-3 border-b border-[#39ff14]/30 bg-[#0b0e1f] text-[#39ff14] display uppercase text-lg tracking-[0.15em]"         , children: submitted ? "Your Ballot — edit anytime" : "Rank the films"}, void 0, false, {fileName: _jsxFileName, lineNumber: 210}, this)
            , _jsxDEV('div', { className: "p-5 space-y-4" , children: [
              submitted && (
                _jsxDEV('div', { className: "flex items-center gap-2 bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/50 px-3 py-2 text-base font-bold shadow-[0_0_14px_rgba(57,255,20,0.2)]"           , children: [
                  _jsxDEV('svg', { viewBox: "0 0 24 24"   , className: "w-5 h-5" , fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: _jsxDEV('polyline', { points: "20 6 9 17 4 12"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 214}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 214}, this), "Ballot counted — change a pick and lock in again anytime."

                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 213}, this)
              )

              , activeId && (
                _jsxDEV('div', { className: "bg-[#0b0e1f] border border-[#13e0d8]/50 p-3 shadow-[0_0_14px_rgba(19,224,216,0.18)]"    , children: [
                  _jsxDEV('p', { className: "text-sm font-bold mb-2 flex items-center gap-2 text-[#d7e0ff]"      , children: [_jsxDEV(Poster, { url: _optionalChain([movies, 'access', _ => _.find, 'call', _2 => _2(a => a._id === activeId), 'optionalAccess', _3 => _3.posterUrl]), label: "", w: 28,}, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this ), " Slot "  , _jsxDEV('span', { className: "text-[#39ff14]", children: _optionalChain([movies, 'access', _4 => _4.find, 'call', _5 => _5(a => a._id === activeId), 'optionalAccess', _6 => _6.name])}, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this), " in:" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 221}, this)
                  , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
                    TIERS.map(t => (
                      _jsxDEV('button', { className: `${TIER_COLOR[t]} display w-11 h-11 text-xl font-bold border border-[#05060f] hover:-translate-y-[2px] hover:shadow-[0_0_12px_currentColor] transition-all`, onClick: () => setTier(activeId, t), children: t}, t, false, {fileName: _jsxFileName, lineNumber: 224}, this)
                    ))
                    , _jsxDEV('button', { className: "text-sm underline text-[#7a8bbf] self-center ml-1"    , onClick: () => setActiveId(null), children: "cancel"}, void 0, false, {fileName: _jsxFileName, lineNumber: 226}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 222}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 220}, this)
              )

              , _jsxDEV('div', { children: [
                _jsxDEV('div', { className: "mono text-sm font-bold mb-2 uppercase tracking-wide text-[#7a8bbf]"      , children: "Unranked — tap or drag a poster to place"        }, void 0, false, {fileName: _jsxFileName, lineNumber: 232}, this)
                , _jsxDEV('div', { className: "flex flex-wrap gap-4 min-h-[210px] p-3 bg-[#0b0e1f] border border-dashed border-[#39ff14]/40"        , onDragOver: e => e.preventDefault(), onDrop: onDropBench, children: [
                  movies.filter(a => !tiers[a._id]).map(a => (
                    _jsxDEV('button', { draggable: true, onDragStart: e => onDragStart(e, a._id), onClick: () => setActiveId(a._id), title: a.name, className: `relative cursor-grab active:cursor-grabbing transition-transform hover:-translate-y-1 ${activeId === a._id ? "ring-2 ring-[#39ff14]" : ""}`, children: 
                      _jsxDEV(PosterCard, { url: a.posterUrl, name: a.name, year: a.year, w: 120,}, void 0, false, {fileName: _jsxFileName, lineNumber: 236}, this )
                    }, a._id, false, {fileName: _jsxFileName, lineNumber: 235}, this)
                  ))
                  , movies.filter(a => !tiers[a._id]).length === 0 && _jsxDEV('span', { className: "text-[#7a8bbf] text-sm self-center italic px-1"    , children: "All slotted — lock it in."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 239}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 233}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 231}, this)

              , _jsxDEV('div', { className: "space-y-2", children: 
                TIERS.map(tier => (
                  _jsxDEV('div', { className: "flex items-stretch gap-3"  , children: [
                    _jsxDEV('div', { className: `w-14 shrink-0 ${TIER_COLOR[tier]} display text-xl font-bold border border-[#05060f] flex items-center justify-center`, children: tier}, void 0, false, {fileName: _jsxFileName, lineNumber: 246}, this)
                    , _jsxDEV('div', { className: "flex-1 min-h-[175px] flex flex-wrap gap-3 p-2 bg-[#0b0e1f] border border-[#39ff14]/25"        , onDragOver: e => e.preventDefault(), onDrop: e => onDropTier(e, tier), children: 
                      movies.filter(a => tiers[a._id] === tier).map(a => (
                        _jsxDEV('button', { draggable: true, onDragStart: e => onDragStart(e, a._id), onClick: () => benchIt(a._id), title: "tap to remove, or drag"    , className: "cursor-grab active:cursor-grabbing transition-transform hover:-translate-y-1"   , children: _jsxDEV(PosterCard, { url: a.posterUrl, name: a.name, year: a.year, w: 90,}, void 0, false, {fileName: _jsxFileName, lineNumber: 249}, this )}, a._id, false, {fileName: _jsxFileName, lineNumber: 249}, this)
                      ))
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 247}, this)
                  ]}, tier, true, {fileName: _jsxFileName, lineNumber: 245}, this)
                ))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 243}, this)

              , _jsxDEV('div', { className: "pt-1 space-y-2" , children: [
                _jsxDEV('input', { className: "w-full bg-[#0b0e1f] border border-[#39ff14]/40 px-3 py-3 text-base text-[#d7e0ff] placeholder-[#5a6699] focus:outline-none focus:border-[#39ff14] focus:shadow-[0_0_12px_rgba(57,255,20,0.35)] transition-all min-h-[44px]"            , placeholder: viewer ? `${viewer.displayName || viewer.userSlug} — or type a name` : "operator name (optional)", value: nameDoc.name, onChange: e => mergeName({ name: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 257}, this )
                , _jsxDEV('button', { className: "w-full bg-[#39ff14] text-[#05060f] display uppercase tracking-[0.1em] font-bold px-6 py-3 border border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_32px_rgba(57,255,20,0.7)] active:scale-[0.99] transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"                    , disabled: submitting || placedCount === 0, onClick: submit, children: [
                  submitting ? _jsxDEV(Spinner, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 259}, this ) : null
                  , submitting ? "Transmitting…" : placedCount === 0 ? "Rank at least one to vote" : submitted ? `Update my ballot (${placedCount})` : `Cast your vote`
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 258}, this)
                , _jsxDEV('p', { className: "mono text-sm text-[#7a8bbf] text-center"   , children: "Rank as many or as few as you want — partial ballots count."            }, void 0, false, {fileName: _jsxFileName, lineNumber: 262}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 256}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 211}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 209}, this)
        )

        , _jsxDEV(AddMovieForm, { database: database, can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 268}, this )

        /* results — same column, right below; auto-scrolled into view on submit */
        , _jsxDEV('section', { ref: resultsRef, className: "bg-[#080b1a] border border-[#13e0d8]/30 shadow-[0_0_30px_rgba(19,224,216,0.08)]"   , children: [
          _jsxDEV(‘h2’, { className: "px-5 py-3 border-b border-[#13e0d8]/30 bg-[#0b0e1f] text-[#13e0d8] display uppercase text-lg tracking-[0.15em]"         , children: ["The Crew’s Verdict "   , totalBallots > 0 && _jsxDEV(‘span’, { className: "text-[#13e0d8]/60", children: ["· " , totalBallots, " " , totalBallots === 1 ? "ballot" : "ballots"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 272}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 272}, this)
          , _jsxDEV('ul', { children: [
            ranked.map((al, i) => {
              const votes = ballots.filter(b => b.tiers && b.tiers[al._id])
              const avg = avgFor(al._id)
              const avgTier = avg !== null ? TIERS[Math.round(avg)] : "—"
              const mine = tiers[al._id]
              return (
                _jsxDEV('li', { className: "flex items-center gap-4 px-5 py-5 border-b border-[#39ff14]/10 last:border-b-0"       , children: [
                  _jsxDEV('span', { className: "mono text-sm font-bold text-[#5a6699] w-6 text-right"     , children: i + 1}, void 0, false, {fileName: _jsxFileName, lineNumber: 281}, this)
                  , _jsxDEV(Poster, { url: al.posterUrl, label: al.name, w: 160,}, void 0, false, {fileName: _jsxFileName, lineNumber: 282}, this )
                  , _jsxDEV('div', { className: `w-12 h-12 shrink-0 display text-xl font-bold flex items-center justify-center border border-[#05060f] ${avgTier !== "—" ? TIER_COLOR[avgTier] : "bg-[#0b0e1f] text-[#5a6699] border-[#39ff14]/25"}`, children: avgTier}, void 0, false, {fileName: _jsxFileName, lineNumber: 283}, this)
                  , _jsxDEV('div', { className: "flex-1 min-w-0" , children: [
                    _jsxDEV('div', { className: "display text-base text-[#d7e0ff] truncate"   , children: al.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 285}, this)
                    , _jsxDEV('div', { className: "text-sm text-[#7a8bbf] truncate"  , children: [al.year ? `${al.year} · ` : "", al.description]}, void 0, true, {fileName: _jsxFileName, lineNumber: 286}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 284}, this)
                  , mine && _jsxDEV('span', { className: "mono text-sm font-bold bg-[#39ff14] text-[#05060f] px-1.5 py-0.5 border border-[#05060f] shrink-0"         , children: ["you: " , mine]}, void 0, true, {fileName: _jsxFileName, lineNumber: 288}, this)
                  , _jsxDEV('div', { className: "mono text-sm font-bold shrink-0 text-right text-[#13e0d8]"     , children: [votes.length, _jsxDEV('span', { className: "text-[#5a6699]", children: [" " , votes.length === 1 ? "vote" : "votes"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 289}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 289}, this)
                ]}, al._id, true, {fileName: _jsxFileName, lineNumber: 280}, this)
              )
            })
            , movies.length === 0 && _jsxDEV('li', { className: "px-5 py-8 text-center text-[#7a8bbf] text-base italic"     , children: "No films yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 293}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 273}, this)
          , totalBallots === 0 && movies.length > 0 && (
            _jsxDEV('div', { className: "px-5 py-4 bg-[#13e0d8]/10 border-t border-[#13e0d8]/30 text-base font-bold text-[#13e0d8]"       , children: "No ballots yet. Rank a few above, lock in, then pass the signal — the board updates as the crew votes."                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 296}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 271}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 204}, this)

      , _jsxDEV('footer', { className: "relative z-10 max-w-2xl mx-auto px-5 py-8 mono text-xs uppercase tracking-[0.2em] text-[#5a6699] text-center"           , children: ["Created by "
          , _jsxDEV('a', { href: "https://kmikeym.com", target: "_blank", rel: "noreferrer", className: "underline", children: "KmikeyM"}, void 0, false, {fileName: _jsxFileName, lineNumber: 302}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 301}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 162}, this)
  )
}
