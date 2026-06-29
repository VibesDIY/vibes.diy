const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("bach-bash")
  const { doc, merge, submit } = useDocument({ name: "", desc: "", cost: "", type: "activity", createdAt: Date.now() })
  const { docs: activities } = useLiveQuery("type", { key: "activity", descending: true })
  const { docs: allVotes } = useLiveQuery("type", { key: "vote" })
  const [suggesting, setSuggesting] = React.useState(false)

  async function suggestActivity() {
    setSuggesting(true)
    try {
      const res = await callAI("Suggest one fun bachelorette party activity. Realistic per-person cost in USD.", {
        schema: { properties: {
          name: { type: "string" },
          desc: { type: "string", description: "One short friendly sentence" },
          cost: { type: "number", description: "Cost per person in dollars" },
        }}
      })
      const s = JSON.parse(res)
      merge({ name: s.name, desc: s.desc, cost: String(s.cost) })
    } finally { setSuggesting(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim()) return
    submit()
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] text-white font-[Nunito,sans-serif] pb-24",
    header: "sticky top-0 z-10 backdrop-blur bg-[oklch(0.18_0.10_300/0.7)] border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3",
    title: "font-[Fredoka,sans-serif] text-2xl font-semibold tracking-tight",
    chip: "px-3 py-1.5 rounded-full bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] font-semibold text-base shadow",
    main: "max-w-xl mx-auto px-4 py-5 space-y-5",
    section: "rounded-2xl bg-[oklch(0.38_0.17_295/0.4)] border border-white/10 p-5 shadow-lg",
    h2: "font-[Fredoka,sans-serif] text-xl font-bold mb-3",
    input: "w-full rounded-lg bg-[oklch(0.30_0.15_295)] border border-white/10 px-3 py-3 min-h-[44px] text-base text-white placeholder-white/50 focus:outline-none focus:border-[oklch(0.88_0.18_95)]",
    btn: "min-h-[44px] px-6 py-3 rounded-lg bg-[oklch(0.47_0.18_295)] hover:bg-[oklch(0.38_0.17_295)] text-white text-base font-semibold transition",
    btnGold: "min-h-[44px] px-6 py-3 rounded-lg bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] text-base font-semibold transition",
    card: "rounded-xl bg-[oklch(0.30_0.15_295/0.6)] border border-white/10 p-5 space-y-2",
    voteBtn: "min-h-[44px] flex-1 rounded-lg border border-white/10 px-4 py-3 text-base font-semibold transition",
    voteUp: "bg-[oklch(0.70_0.15_155/0.25)] hover:bg-[oklch(0.70_0.15_155/0.4)]",
    voteDown: "bg-[oklch(0.55_0.20_25/0.2)] hover:bg-[oklch(0.55_0.20_25/0.35)]",
    muted: "text-white/60 text-base",
    cost: "text-[oklch(0.88_0.18_95)] font-semibold",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('div', { id: "app-header", style: {
          background: "linear-gradient(rgba(30,0,60,0.5), rgba(30,0,60,0.75)), url('https://images.unsplash.com/photo-1762854382956-110a4021d92a?w=1920&q=80&fit=crop') center/cover no-repeat",
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
        }, children: [
        _jsxDEV('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '1rem' }, children:
          _jsxDEV('div', { className: c.chip, children: ["$", activities.filter(a => {
            const v = allVotes.filter(x => x.activityId === a._id)
            return v.filter(x=>x.vote==="up").length > v.filter(x=>x.vote==="down").length
          }).reduce((s,a)=>s+Number(a.cost||0),0), " approved" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 61}, this)
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 57}, this)
        , _jsxDEV('div', { className: c.title, style: { color: 'white', fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: '700', lineHeight: '1.1', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "You're planning the bach." }, void 0, false, {fileName: _jsxFileName, lineNumber: 58}, this)
        , _jsxDEV('div', { style: { color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', marginTop: '1rem', maxWidth: '500px', lineHeight: '1.5', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Activities, dates, headcount, budget — one place for everything they asked you to ‘just handle.’" }, void 0, false, {fileName: _jsxFileName, lineNumber: 59}, this)
              , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@vladdeep?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Vlad Deep" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
]}, void 0, true, {fileName: _jsxFileName, lineNumber: 56}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "add-activity", className: c.section, children: 
          can("write") ? (
            _jsxDEV(_Fragment, { children: [
              _jsxDEV('div', { className: "flex items-center justify-between mb-3"   , children: [
                _jsxDEV('h2', { className: c.h2, children: "Add an idea"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 72}, this)
                , _jsxDEV('button', { type: "button", onClick: suggestActivity, disabled: suggesting, className: c.btnGold + " disabled:opacity-60 flex items-center gap-2", children: [
                  suggesting ? (
                    _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
                  ) : "✨", " Suggest one"
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 73}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 71}, this)
              , _jsxDEV('form', { onSubmit: handleSubmit, className: "space-y-3", children: [
                _jsxDEV('input', { className: c.input, placeholder: "Activity name (e.g. Rooftop brunch)"    , value: doc.name, onChange: e => merge({ name: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this )
                , _jsxDEV('textarea', { className: c.input, rows: 2, placeholder: "What's the vibe? Short and fun."     , value: doc.desc, onChange: e => merge({ desc: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 81}, this )
                , _jsxDEV('input', { className: c.input, type: "number", placeholder: "Cost per person ($)"   , value: doc.cost, onChange: e => merge({ cost: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this )
                , _jsxDEV('button', { type: "submit", className: c.btn + " w-full", children: "Start planning" }, void 0, false, {fileName: _jsxFileName, lineNumber: 83}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 79}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 70}, this)
          ) : (
            _jsxDEV('p', { className: c.muted, children: "Read-only view — the planner controls what gets added."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 87}, this)
          )
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 68}, this)

        , _jsxDEV('section', { id: "activity-list", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The shortlist" }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
          , activities.length === 0 ? (
            _jsxDEV('p', { className: c.muted, children: "No ideas yet. Add the first one!"      }, void 0, false, {fileName: _jsxFileName, lineNumber: 94}, this)
          ) : (
            _jsxDEV('ul', { className: "space-y-3", children: 
              activities.map(a => {
                const votes = allVotes.filter(v => v.activityId === a._id)
                const ups = votes.filter(v => v.vote === "up").length
                const downs = votes.filter(v => v.vote === "down").length
                const me = _optionalChain([viewer, 'optionalAccess', _ => _.userSlug])
                const myVote = votes.find(v => v.voter === me)
                async function castVote(dir) {
                  if (!can("write") || !me) return
                  if (myVote) await database.put({ ...myVote, vote: dir })
                  else await database.put({ type: "vote", activityId: a._id, voter: me, vote: dir, createdAt: Date.now() })
                }
                return (
                  _jsxDEV('li', { className: c.card, children: [
                    _jsxDEV('div', { className: "flex justify-between items-start gap-2"   , children: [
                      _jsxDEV('h3', { className: "font-semibold text-lg" , children: a.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 111}, this)
                      , _jsxDEV('span', { className: c.cost, children: ["$", Number(a.cost||0), "/pp"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 112}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 110}, this)
                    , a.desc && _jsxDEV('p', { className: c.muted, children: a.desc}, void 0, false, {fileName: _jsxFileName, lineNumber: 114}, this)
                    , _jsxDEV('div', { className: "flex gap-2 pt-1 items-center"   , children: [
                      _jsxDEV('button', { onClick: () => castVote("up"), disabled: !can("write"), className: `${c.voteBtn} ${c.voteUp} ${_optionalChain([myVote, 'optionalAccess', _2 => _2.vote])==="up"?"ring-2 ring-[oklch(0.70_0.15_155)]":""}`, children: ["👍 " , ups]}, void 0, true, {fileName: _jsxFileName, lineNumber: 116}, this)
                      , _jsxDEV('button', { onClick: () => castVote("down"), disabled: !can("write"), className: `${c.voteBtn} ${c.voteDown} ${_optionalChain([myVote, 'optionalAccess', _3 => _3.vote])==="down"?"ring-2 ring-[oklch(0.55_0.20_25)]":""}`, children: ["👎 " , downs]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117}, this)
                      , can("write") && _jsxDEV('button', { onClick: () => database.del(a._id), className: "text-white/40 hover:text-[oklch(0.55_0.20_25)] px-2"  , title: "Remove", children: "✕"}, void 0, false, {fileName: _jsxFileName, lineNumber: 118}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
                  ]}, a._id, true, {fileName: _jsxFileName, lineNumber: 109}, this)
                )
              })
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 91}, this)

        , _jsxDEV('section', { id: "budget-tally", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Approved budget" }, void 0, false, {fileName: _jsxFileName, lineNumber: 128}, this)
          , (() => {
            const approved = activities.filter(a => {
              const votes = allVotes.filter(v => v.activityId === a._id)
              const ups = votes.filter(v => v.vote === "up").length
              const downs = votes.filter(v => v.vote === "down").length
              return ups > downs
            })
            const total = approved.reduce((s, a) => s + Number(a.cost||0), 0)
            return (
              _jsxDEV('div', { className: "space-y-2", children: [
                _jsxDEV('div', { className: "text-3xl font-[Fredoka,sans-serif] text-[oklch(0.88_0.18_95)]"  , children: ["$", total, "/pp"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
                , _jsxDEV('p', { className: c.muted, children: [approved.length, " activit" , approved.length===1?"y":"ies", " with more 👍 than 👎."     ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 140}, this)
                , approved.length > 0 && (
                  _jsxDEV('ul', { className: "text-base space-y-1 pt-2"  , children: 
                    approved.map(a => _jsxDEV('li', { className: "flex justify-between" , children: [_jsxDEV('span', { children: a.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this), _jsxDEV('span', { className: c.cost, children: ["$", Number(a.cost||0)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 143}, this)]}, a._id, true, {fileName: _jsxFileName, lineNumber: 143}, this))
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 142}, this)
                )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 138}, this)
            )
          })()
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 127}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 67}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 55}, this)
  )
}