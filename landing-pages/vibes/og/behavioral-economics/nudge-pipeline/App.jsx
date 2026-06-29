const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const c = {
  page: "min-h-screen bg-[#000000] text-[#f7f7f8] font-mono",
  header: "sticky top-0 z-10 bg-[#000000]/90 backdrop-blur border-b border-[#3a3f4d] px-4 py-3 flex items-center justify-between",
  title: "text-lg font-bold tracking-wider uppercase",
  tag: "text-xs text-[#7a8090] uppercase tracking-widest",
  badge: "text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase tracking-wider text-[#7a8090]",
  main: "max-w-6xl mx-auto p-4 space-y-6",
  section: "border border-[#3a3f4d] bg-[#0a0a0f]/80 rounded p-4",
  h2: "text-sm font-bold uppercase tracking-widest text-[#e63946] mb-3",
  btn: "min-h-[44px] px-4 py-3 bg-[#e63946] text-white rounded font-bold uppercase tracking-wider text-sm hover:bg-[#c52836] disabled:opacity-50",
  btnAlt: "min-h-[44px] px-3 py-2 border border-[#3a3f4d] rounded text-sm uppercase tracking-wider hover:bg-[#1a1f2e]",
  input: "w-full bg-[#0a0a0f] border border-[#3a3f4d] rounded px-3 py-2 text-sm text-[#f7f7f8] focus:border-[#e63946] outline-none",
  label: "text-xs uppercase tracking-widest text-[#7a8090] mb-1 block",
  card: "border border-[#3a3f4d] bg-[#0a0a0f] rounded p-3",
  dim: "text-[#7a8090]",
}

const STAGES = ["design", "internal review", "client review", "pilot launch", "evaluation", "scale decision"]
const MECHANISMS = ["default effects","loss aversion","present bias","hyperbolic discounting","framing effects","prospect theory","social preferences","reference-dependent preferences","nudge theory"]

function ArchiveBrowser({ briefs }) {
  const [filter, setFilter] = React.useState("all")
  const [q, setQ] = React.useState("")
  const filtered = briefs.filter(b =>
    (filter === "all" || b.mechanism === filter) &&
    (!q || (b.targetBehavior + " " + b.population + " " + b.nudgeContent).toLowerCase().includes(q.toLowerCase()))
  )
  return (
    _jsxDEV('div', { className: "space-y-3", children: [
      _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
        _jsxDEV('select', { className: "bg-[#0a0a0f] border border-[#3a3f4d] rounded px-2 py-2 text-xs text-[#f7f7f8]"       , value: filter, onChange: e => setFilter(e.target.value), children: [
          _jsxDEV('option', { value: "all", children: "all mechanisms" }, void 0, false, {fileName: _jsxFileName, lineNumber: 38}, this)
          , MECHANISMS.map(m => _jsxDEV('option', { children: m}, m, false, {fileName: _jsxFileName, lineNumber: 39}, this))
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 37}, this)
        , _jsxDEV('input', { className: "flex-1 min-w-[200px] bg-[#0a0a0f] border border-[#3a3f4d] rounded px-3 py-2 text-sm text-[#f7f7f8]"         , placeholder: "Search behavior, population, content..."   , value: q, onChange: e => setQ(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 36}, this)
      , _jsxDEV('div', { className: "space-y-2 max-h-96 overflow-y-auto"  , children: [
        filtered.length === 0 && _jsxDEV('div', { className: "text-[#7a8090] text-sm" , children: "No matching interventions."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
        , filtered.map(b => (
          _jsxDEV('div', { className: "border border-[#3a3f4d] bg-[#0a0a0f] rounded p-3 text-sm"     , children: [
            _jsxDEV('div', { className: "flex justify-between items-start gap-2 flex-wrap"    , children: [
              _jsxDEV('div', { className: "font-bold", children: b.targetBehavior}, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
              , _jsxDEV('span', { className: "text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase tracking-wider text-[#7a8090]"        , children: b.stage}, void 0, false, {fileName: _jsxFileName, lineNumber: 49}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 47}, this)
            , _jsxDEV('div', { className: "text-xs text-[#7a8090] mt-1"  , children: [b.mechanism, " · "  , b.predictedDirection, " · "  , b.population]}, void 0, true, {fileName: _jsxFileName, lineNumber: 51}, this)
            , _jsxDEV('div', { className: "text-xs mt-1" , children: b.nudgeContent}, void 0, false, {fileName: _jsxFileName, lineNumber: 52}, this)
            , b.effectSize && _jsxDEV('div', { className: "text-xs text-[#7ac57a] mt-1"  , children: ["Result: " , b.effectSize]}, void 0, true, {fileName: _jsxFileName, lineNumber: 53}, this)
          ]}, b._id, true, {fileName: _jsxFileName, lineNumber: 46}, this)
        ))
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 43}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 35}, this)
  )
}

function MechChart({ briefs }) {
  const ref = React.useRef()
  React.useEffect(() => {
    const counts = MECHANISMS.map(m => ({ m, n: briefs.filter(b => b.mechanism === m).length }))
    const w = 600, h = 220, margin = { top: 10, right: 10, bottom: 80, left: 30 }
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${w} ${h}`).style("width", "100%").style("height", "auto")
    const x = d3.scaleBand().domain(counts.map(d => d.m)).range([margin.left, w - margin.right]).padding(0.2)
    const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(counts, d => d.n))]).range([h - margin.bottom, margin.top])
    svg.selectAll("rect").data(counts).enter().append("rect")
      .attr("x", d => x(d.m)).attr("y", d => y(d.n))
      .attr("width", x.bandwidth()).attr("height", d => h - margin.bottom - y(d.n))
      .attr("fill", d => d.n > 3 ? "#e63946" : "#7a8090")
    svg.append("g").attr("transform", `translate(0,${h - margin.bottom})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-35)").style("text-anchor", "end").style("fill", "#7a8090").style("font-size", "9px")
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4)).selectAll("text").style("fill", "#7a8090")
  }, [briefs])
  return _jsxDEV('svg', { ref: ref,}, void 0, false, {fileName: _jsxFileName, lineNumber: 79}, this )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("behavioral-pipeline")
  const { doc, merge, submit } = useDocument({
    type: "brief",
    targetBehavior: "",
    population: "",
    mechanism: "default effects",
    predictedDirection: "increase",
    metric: "",
    nudgeContent: "",
    stage: "design",
    createdAt: Date.now(),
    authorSlug: _optionalChain([viewer, 'optionalAccess', _ => _.userSlug]),
    authorName: _nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _2 => _2.displayName]), () => ( _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]))),
  })
  const { docs: briefs } = useLiveQuery("type", { key: "brief", descending: true })
  const [suggesting, setSuggesting] = React.useState(false)
  const [auditingId, setAuditingId] = React.useState(null)

  async function suggestExample() {
    setSuggesting(true)
    try {
      const r = await callAI("Suggest a realistic workplace behavioral nudge intervention brief.", {
        schema: { properties: {
          targetBehavior: { type: "string" }, population: { type: "string" },
          mechanism: { type: "string" }, metric: { type: "string" }, nudgeContent: { type: "string" }
        }}
      })
      const s = JSON.parse(r)
      merge({ ...s, mechanism: MECHANISMS.includes(s.mechanism) ? s.mechanism : "default effects" })
    } finally { setSuggesting(false) }
  }

  async function runAudit(brief) {
    setAuditingId(brief._id)
    try {
      const r = await callAI(`Audit whether this nudge content is consistent with the claimed mechanism "${brief.mechanism}". Content: ${brief.nudgeContent}`, {
        schema: { properties: {
          consistent: { type: "boolean" },
          actualMechanism: { type: "string" },
          notes: { type: "string" },
          refinements: { type: "string" }
        }}
      })
      const audit = JSON.parse(r)
      await database.put({ ...brief, audit, auditedAt: Date.now(), auditedBy: _optionalChain([viewer, 'optionalAccess', _4 => _4.userSlug]) })
    } finally { setAuditingId(null) }
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { className: c.header, id: "app-header", children: [
        _jsxDEV('div', { children: [
          _jsxDEV('div', { className: c.title, children: "Recon Grid" }, void 0, false, {fileName: _jsxFileName, lineNumber: 136}, this)
          , _jsxDEV('div', { className: c.tag, children: "Behavioral Interventions Pipeline"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 137}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 135}, this)
        , _jsxDEV('div', { className: "flex items-center gap-2"  , children: [
          viewer && _jsxDEV('img', { src: viewer.avatarUrl, alt: viewer.userSlug, className: "w-8 h-8 rounded border border-[#3a3f4d]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this )
          , _jsxDEV('span', { className: c.badge, children: _nullishCoalesce(_nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _5 => _5.displayName]), () => ( _optionalChain([viewer, 'optionalAccess', _6 => _6.userSlug]))), () => ( "anon"))}, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 134}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "new-brief", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "New Intervention Brief"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 146}, this)
          , !can("write") ? (
            _jsxDEV('div', { className: "space-y-4", children: [
              _jsxDEV('p', { className: "text-[#7a8090] text-sm", children: "Design and track nudge experiments through every stage — from mechanism hypothesis to measured effect size." }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
              , _jsxDEV('div', { className: "border border-[#3a3f4d] rounded p-3 space-y-2", children: [
                _jsxDEV('div', { className: "text-xs uppercase tracking-widest text-[#e63946] mb-1", children: "Example Brief" }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
                , _jsxDEV('div', { className: "text-sm font-bold", children: "Increase library late-return rate" }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
                , _jsxDEV('div', { className: "text-xs text-[#7a8090]", children: "loss aversion · undergraduate students" }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
                , _jsxDEV('div', { className: "text-xs mt-1", children: "\"Books you hold past due are books others can't access\" SMS reminder at T-1 day" }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 148}, this)
              , _jsxDEV('a', { href: "https://vibes.diy/vibe/edu/nudge-pipeline", target: "_blank", rel: "noopener noreferrer", className: "inline-block min-h-[44px] px-6 py-3 rounded bg-[#e63946] text-white font-bold uppercase tracking-wider text-sm hover:bg-[#c52836] transition text-center", children: "Open Pipeline →"}, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 148}, this)
          ) : (
            _jsxDEV('form', { onSubmit: submit, className: "grid md:grid-cols-2 gap-3"  , children: [
              _jsxDEV('div', { className: "md:col-span-2", children: [
                _jsxDEV('label', { className: c.label, children: "Target behavior" }, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
                , _jsxDEV('input', { className: c.input, value: doc.targetBehavior, onChange: e => merge({ targetBehavior: e.target.value }), placeholder: "e.g. increase 401k contribution rate"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Population"}, void 0, false, {fileName: _jsxFileName, lineNumber: 156}, this)
                , _jsxDEV('input', { className: c.input, value: doc.population, onChange: e => merge({ population: e.target.value }), placeholder: "e.g. new hires under 35"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 155}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Behavioral mechanism" }, void 0, false, {fileName: _jsxFileName, lineNumber: 160}, this)
                , _jsxDEV('select', { className: c.input, value: doc.mechanism, onChange: e => merge({ mechanism: e.target.value }), children: 
                  MECHANISMS.map(m => _jsxDEV('option', { children: m}, m, false, {fileName: _jsxFileName, lineNumber: 162}, this))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Predicted direction" }, void 0, false, {fileName: _jsxFileName, lineNumber: 166}, this)
                , _jsxDEV('select', { className: c.input, value: doc.predictedDirection, onChange: e => merge({ predictedDirection: e.target.value }), children: [
                  _jsxDEV('option', { children: "increase"}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this), _jsxDEV('option', { children: "decrease"}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 165}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Success metric" }, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
                , _jsxDEV('input', { className: c.input, value: doc.metric, onChange: e => merge({ metric: e.target.value }), placeholder: "e.g. % enrolled within 30 days"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 173}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 171}, this)
              , _jsxDEV('div', { className: "md:col-span-2", children: [
                _jsxDEV('label', { className: c.label, children: "Nudge content / message variants"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 176}, this)
                , _jsxDEV('textarea', { className: c.input, rows: 3, value: doc.nudgeContent, onChange: e => merge({ nudgeContent: e.target.value }), placeholder: "Channel, decision moment, message text..."    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 177}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 175}, this)
              , _jsxDEV('div', { className: "md:col-span-2 flex gap-2 flex-wrap"   , children: [
                _jsxDEV('button', { type: "submit", className: c.btn, disabled: !doc.targetBehavior, children: "Create Brief" }, void 0, false, {fileName: _jsxFileName, lineNumber: 180}, this)
                , _jsxDEV('button', { type: "button", className: c.btnAlt, onClick: suggestExample, disabled: suggesting, children: 
                  suggesting ? _jsxDEV('svg', { className: "animate-spin w-4 h-4 inline"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this) : "Suggest Example"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 181}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 179}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 150}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 145}, this)
        , _jsxDEV('section', { id: "pipeline", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Pipeline"}, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this)
          , _jsxDEV('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"    , children: 
            STAGES.map(stage => {
              const items = briefs.filter(b => b.stage === stage)
              return (
                _jsxDEV('div', { className: "space-y-2", children: [
                  _jsxDEV('div', { className: "text-[10px] uppercase tracking-widest text-[#e63946] border-b border-[#3a3f4d] pb-1 flex justify-between"        , children: [
                    _jsxDEV('span', { children: stage}, void 0, false, {fileName: _jsxFileName, lineNumber: 196}, this), _jsxDEV('span', { className: c.dim, children: items.length}, void 0, false, {fileName: _jsxFileName, lineNumber: 196}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 195}, this)
                  , items.length === 0 && _jsxDEV('div', { className: c.dim + " text-xs", children: "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 198}, this)
                  , items.map(b => {
                    const idx = STAGES.indexOf(b.stage)
                    return (
                      _jsxDEV('div', { className: c.card, children: [
                        _jsxDEV('div', { className: "text-sm font-bold" , children: b.targetBehavior}, void 0, false, {fileName: _jsxFileName, lineNumber: 203}, this)
                        , _jsxDEV('div', { className: "text-xs text-[#7a8090] mt-1"  , children: [b.mechanism, " · "  , b.population]}, void 0, true, {fileName: _jsxFileName, lineNumber: 204}, this)
                        , b.audit && (
                          _jsxDEV('div', { className: "text-xs mt-2 p-2 rounded border " + (b.audit.consistent ? "border-[#3a8a4a] text-[#7ac57a]" : "border-[#e63946] text-[#ff8a90]"), children: [
                            _jsxDEV('div', { className: "font-bold uppercase tracking-wider text-[10px]"   , children: b.audit.consistent ? "Consistent" : "Mismatch: " + b.audit.actualMechanism}, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this)
                            , _jsxDEV('div', { className: "mt-1", children: b.audit.notes}, void 0, false, {fileName: _jsxFileName, lineNumber: 208}, this)
                            , b.audit.refinements && _jsxDEV('div', { className: "mt-1 italic" , children: b.audit.refinements}, void 0, false, {fileName: _jsxFileName, lineNumber: 209}, this)
                          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 206}, this)
                        )
                        , b.stage === "evaluation" && b.effectSize && (
                          _jsxDEV('div', { className: "text-xs mt-2 text-[#7ac57a]"  , children: ["Effect: " , b.effectSize]}, void 0, true, {fileName: _jsxFileName, lineNumber: 213}, this)
                        )
                        , can("write") && (
                          _jsxDEV('div', { className: "flex gap-1 mt-2 flex-wrap"   , children: [
                            idx < STAGES.length - 1 && (
                              _jsxDEV('button', { className: "text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase hover:bg-[#1a1f2e]"       , onClick: () => database.put({ ...b, stage: STAGES[idx+1] }), children: "Advance →" }, void 0, false, {fileName: _jsxFileName, lineNumber: 218}, this)
                            )
                            , b.stage === "internal review" && (
                              _jsxDEV('button', { className: "text-[10px] px-2 py-1 border border-[#e63946] text-[#e63946] rounded uppercase hover:bg-[#e63946] hover:text-white"         , disabled: auditingId === b._id, onClick: () => runAudit(b), children: 
                                auditingId === b._id ? "Auditing..." : "AI Audit"
                              }, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this)
                            )
                            , b.stage === "evaluation" && !b.effectSize && (
                              _jsxDEV('button', { className: "text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase hover:bg-[#1a1f2e]"       , onClick: () => {
                                const v = prompt("Measured effect size & notes:")
                                if (v) database.put({ ...b, effectSize: v, evaluatedAt: Date.now() })
                              }, children: "Log Result" }, void 0, false, {fileName: _jsxFileName, lineNumber: 226}, this)
                            )
                          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 216}, this)
                        )
                      ]}, b._id, true, {fileName: _jsxFileName, lineNumber: 202}, this)
                    )
                  })
                ]}, stage, true, {fileName: _jsxFileName, lineNumber: 194}, this)
              )
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 190}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 188}, this)
        , _jsxDEV('section', { id: "mechanism-chart", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Mechanism Frequency" }, void 0, false, {fileName: _jsxFileName, lineNumber: 242}, this)
          , _jsxDEV(MechChart, { briefs: briefs,}, void 0, false, {fileName: _jsxFileName, lineNumber: 243}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 241}, this)
        , _jsxDEV('section', { id: "archive", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Institutional Memory" }, void 0, false, {fileName: _jsxFileName, lineNumber: 246}, this)
          , _jsxDEV(ArchiveBrowser, { briefs: briefs,}, void 0, false, {fileName: _jsxFileName, lineNumber: 247}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 245}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 144}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 133}, this)
  )
}