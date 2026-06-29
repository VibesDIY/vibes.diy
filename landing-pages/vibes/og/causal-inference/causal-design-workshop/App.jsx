const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ExemplaryList({ c }) {
  const { useLiveQuery } = useFireproof("causal-workshop")
  const { docs } = useLiveQuery("exemplary", { key: true })
  if (docs.length === 0) return _jsxDEV('p', { className: c.muted, children: "No exemplary answers yet — instructors can mark them in the dashboard above."            }, void 0, false, {fileName: _jsxFileName, lineNumber: 10}, this)
  return (
    _jsxDEV('ul', { className: "space-y-2", children: 
      docs.map((d) => (
        _jsxDEV('li', { className: "border border-[#fbbf24] bg-[#fffbeb] rounded p-3"    , children: [
          _jsxDEV('div', { className: "flex items-center justify-between"  , children: [
            _jsxDEV('span', { className: "text-sm font-semibold" , children: ["★ " , d.authorName]}, void 0, true, {fileName: _jsxFileName, lineNumber: 16}, this)
            , _jsxDEV('span', { className: c.pill, children: d.design}, void 0, false, {fileName: _jsxFileName, lineNumber: 17}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 15}, this)
          , _jsxDEV('p', { className: "text-xs text-[#44403c] mt-2"  , children: [_jsxDEV('strong', { children: "Assumption:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 19}, this), " " , d.assumption]}, void 0, true, {fileName: _jsxFileName, lineNumber: 19}, this)
          , _jsxDEV('p', { className: "text-xs text-[#44403c] mt-1"  , children: [_jsxDEV('strong', { children: "Defense:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 20}, this), " " , d.defense]}, void 0, true, {fileName: _jsxFileName, lineNumber: 20}, this)
        ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 14}, this)
      ))
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 12}, this)
  )
}

function DesignChart({ submissions }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (!ref.current) return
    const counts = d3.rollup(submissions.filter(s => s.design), v => v.length, d => d.design)
    const data = Array.from(counts, ([design, count]) => ({ design, count }))
    const w = 320, h = 200, m = { top: 10, right: 10, bottom: 60, left: 30 }
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${w} ${h}`).style("width", "100%").style("height", "auto")
    if (data.length === 0) { svg.append("text").attr("x", w/2).attr("y", h/2).attr("text-anchor","middle").attr("fill","#737373").style("font-size","12px").text("No submissions yet"); return }
    const x = d3.scaleBand().domain(data.map(d => d.design)).range([m.left, w - m.right]).padding(0.2)
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).range([h - m.bottom, m.top])
    svg.append("g").selectAll("rect").data(data).enter().append("rect")
      .attr("x", d => x(d.design)).attr("y", d => y(d.count))
      .attr("width", x.bandwidth()).attr("height", d => h - m.bottom - y(d.count))
      .attr("fill", "#dc2626")
    svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-30)").style("text-anchor", "end").style("font-size", "9px")
    svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4))
  }, [submissions])
  return _jsxDEV('svg', { ref: ref,}, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("causal-workshop")
  const { doc: newScenario, merge: mergeScenario, submit: submitScenario } = useDocument({
    type: "scenario", title: "", body: "", createdAt: Date.now()
  })
  const { docs: scenarioDocs } = useLiveQuery("type", { key: "scenario", descending: true })
  const demoScenario = {
    _id: "demo-week4",
    type: "scenario",
    title: "Week 4 — UT Austin Tutoring Rollout",
    body: "In Fall 2023, UT Austin offered free peer tutoring to students in ECO 304K who scored below 70 on the first midterm. Students just above the cutoff were not offered tutoring. Final exam scores are available for all students. Design a study to estimate the causal effect of tutoring on final exam performance.",
  }
  const scenarios = scenarioDocs.length > 0 ? scenarioDocs : [demoScenario]
  const [activeScenarioId, setActiveScenarioId] = React.useState("demo-week4")
  const { doc: scaffold, merge: mergeScaffold, submit: submitScaffold } = useDocument(() => ({
    type: "submission", scenarioId: activeScenarioId, treatment: "", outcome: "",
    population: "", dag: "", design: "", assumption: "", defense: "",
    authorSlug: _optionalChain([viewer, 'optionalAccess', _ => _.userSlug]) || "anonymous",
    authorName: _optionalChain([viewer, 'optionalAccess', _2 => _2.displayName]) || _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]) || "anonymous",
    createdAt: Date.now(), critique: null, exemplary: false,
  }))
  const { docs: submissions } = useLiveQuery("scenarioId", { key: activeScenarioId })
  const [critiqueLoading, setCritiqueLoading] = React.useState(false)

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#1a1a1a] font-sans",
    header: "sticky top-0 z-10 bg-[#1a1a1a] text-[#fafaf9] px-4 py-4 border-b-4 border-[#dc2626] shadow-sm",
    title: "text-xl font-bold tracking-tight",
    subtitle: "text-xs text-[#a3a3a3] mt-0.5",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-white border border-[#e7e5e4] rounded-lg p-5 shadow-sm",
    h2: "text-lg font-bold text-[#1a1a1a] mb-3 flex items-center gap-2",
    badge: "inline-block bg-[#dc2626] text-white text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide",
    input: "w-full border border-[#d6d3d1] rounded px-3 py-3 text-sm focus:outline-none focus:border-[#dc2626] min-h-[44px]",
    textarea: "w-full border border-[#d6d3d1] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] resize-y",
    btn: "bg-[#dc2626] text-white font-semibold px-4 py-3 rounded hover:bg-[#b91c1c] disabled:opacity-50 min-h-[44px] text-sm",
    btnGhost: "border border-[#d6d3d1] text-[#1a1a1a] font-medium px-3 py-2 rounded hover:bg-[#f5f5f4] text-sm",
    muted: "text-xs text-[#737373]",
    pill: "inline-block bg-[#f5f5f4] text-[#44403c] text-xs px-2 py-1 rounded border border-[#e7e5e4]",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: 
        _jsxDEV('div', { className: "max-w-3xl mx-auto flex items-center justify-between"    , children: [
          _jsxDEV('div', { children: [
            _jsxDEV('h1', { className: c.title, children: "Causal Inference Workshop"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
            , _jsxDEV('p', { className: c.subtitle, children: "Weekly problem sets · scaffolded reasoning"     }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)
          , viewer && (
            _jsxDEV('div', { className: "flex items-center gap-2"  , children: 
              _jsxDEV('img', { src: viewer.avatarUrl, alt: viewer.userSlug, className: "w-8 h-8 rounded-full border border-[#404040]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this )
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 95}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 89}, this)
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        can("write") && (
          _jsxDEV('section', { id: "scenario-post", className: c.section, children: [
            _jsxDEV('h2', { className: c.h2, children: [_jsxDEV('span', { className: c.badge, children: "Instructor"}, void 0, false, {fileName: _jsxFileName, lineNumber: 105}, this), " Post a scenario"   ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 105}, this)
            , _jsxDEV('form', { className: "space-y-3", onSubmit: submitScenario, children: [
              _jsxDEV('input', { className: c.input, placeholder: "Week title (e.g., Week 4 — Tutoring rollout)"       ,
                value: newScenario.title, onChange: (e) => mergeScenario({ title: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this )
              , _jsxDEV('textarea', { className: c.textarea, rows: 5, placeholder: "Describe the real-world scenario: what happened, when, to whom, and what data is available..."             ,
                value: newScenario.body, onChange: (e) => mergeScenario({ body: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this )
              , _jsxDEV('button', { type: "submit", className: c.btn, disabled: !newScenario.title.trim() || !newScenario.body.trim(), children: "Post scenario" }, void 0, false, {fileName: _jsxFileName, lineNumber: 111}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 104}, this)
        )

        , _jsxDEV('section', { id: "scenario-list", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "This quarter's scenarios"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)
          , scenarios.length === 0 && _jsxDEV('p', { className: c.muted, children: "No scenarios posted yet."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 118}, this)
          , _jsxDEV('ul', { className: "space-y-2", children: 
            scenarios.map((s) => (
              _jsxDEV('li', { children: 
                _jsxDEV('button', {
                  onClick: () => setActiveScenarioId(s._id),
                  className: `w-full text-left p-3 rounded border transition ${activeScenarioId === s._id ? "border-[#dc2626] bg-[#fef2f2]" : "border-[#e7e5e4] hover:bg-[#fafaf9]"}`,
 children: [
                  _jsxDEV('div', { className: "font-semibold text-sm" , children: s.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
                  , _jsxDEV('div', { className: `${c.muted} mt-1 line-clamp-2`, children: s.body}, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 122}, this)
              }, s._id, false, {fileName: _jsxFileName, lineNumber: 121}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 116}, this)

        , _jsxDEV('section', { id: "student-scaffold", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: [_jsxDEV('span', { className: c.badge, children: "Student"}, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this), " Work through the scaffold"    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 135}, this)
          , !activeScenarioId ? (
            _jsxDEV('p', { className: c.muted, children: "Pick a scenario above to begin."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 137}, this)
          ) : !can("write") ? (
            _jsxDEV('p', { className: c.muted, children: "Read-only view — sign in with write access to submit."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this)
          ) : (
            _jsxDEV('form', { className: "space-y-3", onSubmit: async (e) => {
              e.preventDefault()
              if (!scaffold.design) return
              setCritiqueLoading(true)
              try {
                const prompt = `Evaluate this causal inference student response. Scenario: ${_optionalChain([scenarios, 'access', _4 => _4.find, 'call', _5 => _5(s => s._id === activeScenarioId), 'optionalAccess', _6 => _6.body]) || ""}. Design chosen: ${scaffold.design}. Identifying assumption: ${scaffold.assumption}. Defense: ${scaffold.defense}. Rate the plausibility of their defense and list weaknesses.`
                const raw = await callAI(prompt, { schema: { properties: {
                  plausibility: { type: "string", description: "weak, moderate, or strong" },
                  weaknesses: { type: "array", items: { type: "string" } },
                  suggestion: { type: "string" }
                }}})
                mergeScaffold({ critique: JSON.parse(raw) })
                await submitScaffold()
              } finally { setCritiqueLoading(false) }
            }, children: [
              _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "1. Treatment" }, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this)
                , _jsxDEV('input', { className: c.input, placeholder: "What is the intervention?"   ,
                  value: scaffold.treatment, onChange: (e) => mergeScaffold({ treatment: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 158}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 156}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "2. Outcome" }, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this)
                , _jsxDEV('input', { className: c.input, placeholder: "What are we measuring?"   ,
                  value: scaffold.outcome, onChange: (e) => mergeScaffold({ outcome: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 161}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "3. Population" }, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this)
                , _jsxDEV('input', { className: c.input, placeholder: "Who is the population of interest?"     ,
                  value: scaffold.population, onChange: (e) => mergeScaffold({ population: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "4. DAG sketch (text description)"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
                , _jsxDEV('textarea', { className: c.textarea, rows: 3, placeholder: "Describe the edges, e.g., Z → D → Y, U → D, U → Y..."              ,
                  value: scaffold.dag, onChange: (e) => mergeScaffold({ dag: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 173}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 171}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "5. Design" }, void 0, false, {fileName: _jsxFileName, lineNumber: 177}, this)
                , _jsxDEV('select', { className: c.input, value: scaffold.design, onChange: (e) => mergeScaffold({ design: e.target.value }), children: [
                  _jsxDEV('option', { value: "", children: "— pick one —"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 179}, this)
                  , _jsxDEV('option', { children: "Regression discontinuity" }, void 0, false, {fileName: _jsxFileName, lineNumber: 180}, this)
                  , _jsxDEV('option', { children: "Difference-in-differences"}, void 0, false, {fileName: _jsxFileName, lineNumber: 181}, this)
                  , _jsxDEV('option', { children: "Instrumental variables" }, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this)
                  , _jsxDEV('option', { children: "Panel data methods"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this)
                  , _jsxDEV('option', { children: "Two-stage least squares"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 184}, this)
                  , _jsxDEV('option', { children: "Propensity score methods"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 185}, this)
                  , _jsxDEV('option', { children: "Matching estimators" }, void 0, false, {fileName: _jsxFileName, lineNumber: 186}, this)
                  , _jsxDEV('option', { children: "Synthetic controls" }, void 0, false, {fileName: _jsxFileName, lineNumber: 187}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 178}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 176}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "6. Identifying assumption"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this)
                , _jsxDEV('textarea', { className: c.textarea, rows: 2, placeholder: "State the key assumption your design requires..."      ,
                  value: scaffold.assumption, onChange: (e) => mergeScaffold({ assumption: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 192}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 190}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: "text-xs font-semibold uppercase tracking-wide text-[#525252]"    , children: "7. Defense" }, void 0, false, {fileName: _jsxFileName, lineNumber: 196}, this)
                , _jsxDEV('textarea', { className: c.textarea, rows: 4, placeholder: "Why is the assumption plausible here? What would break it?"         ,
                  value: scaffold.defense, onChange: (e) => mergeScaffold({ defense: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 197}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 195}, this)
              , _jsxDEV('button', { type: "submit", className: c.btn, disabled: critiqueLoading || !scaffold.design, children: 
                critiqueLoading ? (
                  _jsxDEV('span', { className: "inline-flex items-center gap-2"  , children: [
                    _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "50 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 203}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 203}, this), "Critiquing..."

                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 202}, this)
                ) : "Submit for AI critique"
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 200}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 141}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 134}, this)

        , _jsxDEV('section', { id: "aggregate-dashboard", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: [_jsxDEV('span', { className: c.badge, children: "Instructor"}, void 0, false, {fileName: _jsxFileName, lineNumber: 213}, this), " Class aggregate"  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 213}, this)
          , !activeScenarioId ? (
            _jsxDEV('p', { className: c.muted, children: "Pick a scenario to see the class breakdown."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this)
          ) : (
            _jsxDEV(DesignChart, { submissions: submissions,}, void 0, false, {fileName: _jsxFileName, lineNumber: 217}, this )
          )
          , activeScenarioId && submissions.length > 0 && (
            _jsxDEV('ul', { className: "mt-4 space-y-2" , children: 
              submissions.map((s) => (
                _jsxDEV('li', { className: "border border-[#e7e5e4] rounded p-3"   , children: [
                  _jsxDEV('div', { className: "flex items-center justify-between"  , children: [
                    _jsxDEV('div', { className: "text-sm font-semibold" , children: s.authorName}, void 0, false, {fileName: _jsxFileName, lineNumber: 224}, this)
                    , _jsxDEV('span', { className: c.pill, children: s.design || "no design"}, void 0, false, {fileName: _jsxFileName, lineNumber: 225}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 223}, this)
                  , s.critique && (
                    _jsxDEV('div', { className: "mt-2 text-xs" , children: [
                      _jsxDEV('span', { className: c.pill, children: ["Plausibility: " , s.critique.plausibility]}, void 0, true, {fileName: _jsxFileName, lineNumber: 229}, this)
                      , _optionalChain([s, 'access', _7 => _7.critique, 'access', _8 => _8.weaknesses, 'optionalAccess', _9 => _9.length]) > 0 && (
                        _jsxDEV('ul', { className: "mt-1 list-disc list-inside text-[#737373]"   , children: 
                          s.critique.weaknesses.slice(0, 2).map((w, i) => _jsxDEV('li', { children: w}, i, false, {fileName: _jsxFileName, lineNumber: 232}, this))
                        }, void 0, false, {fileName: _jsxFileName, lineNumber: 231}, this)
                      )
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 228}, this)
                  )
                  , can("write") && (
                    _jsxDEV('button', {
                      onClick: () => database.put({ ...s, exemplary: !s.exemplary }),
                      className: `${c.btnGhost} mt-2 ${s.exemplary ? "bg-[#fef2f2] border-[#dc2626]" : ""}`,
 children: 
                      s.exemplary ? "★ Exemplary" : "Mark exemplary"
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 238}, this)
                  )
                ]}, s._id, true, {fileName: _jsxFileName, lineNumber: 222}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 220}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 212}, this)

        , _jsxDEV('section', { id: "exemplary-library", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Exemplary answer library"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 252}, this)
          , _jsxDEV(ExemplaryList, { c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 253}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 251}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
  )
}