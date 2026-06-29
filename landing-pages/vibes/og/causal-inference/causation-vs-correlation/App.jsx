const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("causal-compass")
  const { docs: claims } = useLiveQuery("createdAt", { descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = claims.find((d) => d._id === selectedId) || null

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#0c0a09]",
    header: "sticky top-0 z-10 bg-[#e63946] text-white px-4 py-3 shadow-md",
    title: "text-xl font-bold tracking-tight",
    subtitle: "text-xs opacity-90 mt-0.5",
    main: "max-w-3xl mx-auto px-4 py-4 space-y-4 pb-24",
    section: "bg-white rounded-lg border border-[#e7e5e4] p-4 shadow-sm",
    h2: "text-lg font-semibold text-[#0c0a09] mb-3",
    btn: "min-h-[44px] px-4 py-3 bg-[#e63946] text-white rounded-md font-medium active:bg-[#c92a37] disabled:opacity-50 inline-flex items-center justify-center gap-2",
    btnGhost: "min-h-[44px] px-3 py-2 bg-[#f5f5f4] text-[#0c0a09] rounded-md text-sm active:bg-[#e7e5e4]",
    input: "w-full px-3 py-3 bg-white border border-[#d6d3d1] rounded-md text-base focus:outline-none focus:border-[#e63946]",
    chip: "inline-block px-2 py-1 bg-[#fef3c7] text-[#78350f] rounded text-xs font-medium",
    muted: "text-sm text-[#78716c]",
    readonly: "text-sm italic text-[#78716c] bg-[#f5f5f4] p-3 rounded-md",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Causal Compass" }, void 0, false, {fileName: _jsxFileName, lineNumber: 33}, this)
        , _jsxDEV('p', { className: c.subtitle, children: "Tell correlation from causation, one headline at a time"        }, void 0, false, {fileName: _jsxFileName, lineNumber: 34}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 32}, this)
      , _jsxDEV('main', { className: c.main, children: [
        _jsxDEV(ClaimInput, { database: database, can: can, c: c, setSelectedId: setSelectedId,}, void 0, false, {fileName: _jsxFileName, lineNumber: 37}, this )

        , _jsxDEV('section', { className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Claim Library" }, void 0, false, {fileName: _jsxFileName, lineNumber: 40}, this)
          , claims.length === 0 ? (
            _jsxDEV('p', { className: c.muted, children: "No claims yet. Paste one above to begin."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 42}, this)
          ) : (
            _jsxDEV('ul', { className: "space-y-2", children: 
              claims.map((d) => (
                _jsxDEV('li', {

                  onClick: () => setSelectedId(d._id),
                  className: `p-3 rounded-md border cursor-pointer active:bg-[#f5f5f4] ${
                    selectedId === d._id ? "border-[#e63946] bg-[#fef2f2]" : "border-[#e7e5e4]"
                  }`,
 children: [
                  _jsxDEV('p', { className: "font-medium text-sm" , children: d.claim}, void 0, false, {fileName: _jsxFileName, lineNumber: 53}, this)
                  , d.treatment && d.outcome && (
                    _jsxDEV('p', { className: c.muted, children: [
                      _jsxDEV('span', { className: c.chip, children: d.treatment}, void 0, false, {fileName: _jsxFileName, lineNumber: 56}, this), " → "  , _jsxDEV('span', { className: c.chip, children: d.outcome}, void 0, false, {fileName: _jsxFileName, lineNumber: 56}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 55}, this)
                  )
                ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 46}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 39}, this)

        , _jsxDEV('section', { className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Causal DAG" }, void 0, false, {fileName: _jsxFileName, lineNumber: 66}, this)
          , !selected ? (
            _jsxDEV('p', { className: c.muted, children: "Select a claim above to see its DAG."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 68}, this)
          ) : (
            _jsxDEV(DagView, { claim: selected, database: database, can: can, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 70}, this )
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 65}, this)

        , _jsxDEV('section', { className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Causal Checklist" }, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
          , !selected ? (
            _jsxDEV('p', { className: c.muted, children: "Select a claim to work through the checklist."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 77}, this)
          ) : (
            _jsxDEV(Checklist, { claim: selected, database: database, can: can, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 79}, this )
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 36}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 31}, this)
  )
}

function ClaimInput({ database, can, c, setSelectedId }) {
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const examples = [
    "Ice cream sales cause drownings",
    "Coffee drinkers live longer than non-drinkers",
    "A job training program reduced unemployment by 12%",
    "Countries with more chocolate win more Nobel Prizes",
    "Children who eat breakfast get better grades",
    "People who own dogs have lower blood pressure",
    "Students who attend private schools earn more later in life",
    "Cities with more police have more crime",
    "Patients treated at top hospitals have higher mortality",
    "Wine drinkers have fewer heart attacks",
    "Tall parents tend to have tall children",
    "Countries with more storks have higher birth rates",
  ]

  async function analyze() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await callAI(
        `Analyze this claim as a causal-inference tutor: "${text}". Identify treatment, outcome, likely confounders, whether the language is causal or associational, and the likely study type.`,
        {
          schema: {
            properties: {
              treatment: { type: "string" },
              outcome: { type: "string" },
              confounders: { type: "array", items: { type: "string" } },
              languageFlag: { type: "string", description: "causal, associational, or ambiguous" },
              studyType: { type: "string" },
              potentialOutcomesQuestion: { type: "string" },
            },
          },
        }
      )
      const parsed = JSON.parse(res)
      const nodes = [
        { id: "T", label: parsed.treatment, kind: "treatment" },
        { id: "Y", label: parsed.outcome, kind: "outcome" },
        ...(parsed.confounders || []).map((cf, i) => ({ id: `C${i}`, label: cf, kind: "confounder" })),
      ]
      const edges = [
        { source: "T", target: "Y" },
        ...(parsed.confounders || []).flatMap((_, i) => [
          { source: `C${i}`, target: "T" },
          { source: `C${i}`, target: "Y" },
        ]),
      ]
      const result = await database.put({
        claim: text.trim(),
        treatment: parsed.treatment,
        outcome: parsed.outcome,
        confounders: parsed.confounders || [],
        languageFlag: parsed.languageFlag,
        studyType: parsed.studyType,
        potentialOutcomesQuestion: parsed.potentialOutcomesQuestion,
        nodes,
        edges,
        checklist: {},
        notes: "",
        createdAt: Date.now(),
      })
      setSelectedId(result.id)
      setText("")
    } finally {
      setLoading(false)
    }
  }

  function suggest() {
    setText(examples[Math.floor(Math.random() * examples.length)])
  }

  if (!can("write")) {
    return (
      _jsxDEV('section', { className: c.section, children: [
        _jsxDEV('h2', { className: c.h2, children: "Try an example claim"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 166}, this)
        , _jsxDEV('p', { className: "text-sm text-[#44403c] mb-3", children: "Click any example below to analyze it — see the Causal DAG and checklist update live."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this)
        , _jsxDEV('div', { className: "flex flex-wrap gap-2", children:
          examples.slice(0, 6).map((ex, i) =>
            _jsxDEV('button', {
              key: i,
              onClick: async () => {
                setText(ex)
                setLoading(true)
                try {
                  const res = await (async () => {
                    const callAIModule = await import("call-ai")
                    return callAIModule.callAI(
                      `Analyze this claim as a causal-inference tutor: "${ex}". Identify treatment, outcome, likely confounders, whether the language is causal or associational, and the likely study type.`,
                      { schema: { properties: { treatment: { type: "string" }, outcome: { type: "string" }, confounders: { type: "array", items: { type: "string" } }, languageFlag: { type: "string", description: "causal, associational, or ambiguous" }, studyType: { type: "string" }, potentialOutcomesQuestion: { type: "string" } } } }
                    )
                  })()
                  const parsed = JSON.parse(res)
                  const nodes = [
                    { id: "T", label: parsed.treatment, kind: "treatment" },
                    { id: "Y", label: parsed.outcome, kind: "outcome" },
                    ...(parsed.confounders || []).map((cf, j) => ({ id: `C${j}`, label: cf, kind: "confounder" })),
                  ]
                  const edges = [
                    { source: "T", target: "Y" },
                    ...(parsed.confounders || []).flatMap((_, j) => [{ source: `C${j}`, target: "T" }, { source: `C${j}`, target: "Y" }]),
                  ]
                  const result = await database.put({ claim: ex, treatment: parsed.treatment, outcome: parsed.outcome, confounders: parsed.confounders || [], languageFlag: parsed.languageFlag, studyType: parsed.studyType, potentialOutcomesQuestion: parsed.potentialOutcomesQuestion, nodes, edges, checklist: {}, notes: "", createdAt: Date.now() })
                  setSelectedId(result.id)
                  setText("")
                } finally { setLoading(false) }
              },
              className: "text-left px-3 py-2 bg-[#fef3c7] text-[#78350f] border border-[#fcd34d] rounded-md text-sm hover:bg-[#fde68a] active:bg-[#fcd34d]",
              children: ex
            }, i, false, {fileName: _jsxFileName, lineNumber: 170}, this)
          )
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)
        , loading && _jsxDEV('p', { className: "text-sm text-[#78716c] mt-2 italic", children: "Analyzing…" }, void 0, false, {fileName: _jsxFileName, lineNumber: 180}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 165}, this)
    )
  }

  const Spinner = () => (
    _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: 
      _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "50 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this )
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 173}, this)
  )

  return (
    _jsxDEV('section', { className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: "Paste a Claim"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 180}, this)
      , _jsxDEV('textarea', {
        className: c.input,
        rows: 3,
        value: text,
        onChange: (e) => setText(e.target.value),
        placeholder: "e.g. Countries with more chocolate consumption win more Nobel Prizes"         ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 181}, this
      )
      , _jsxDEV('div', { className: "flex gap-2 mt-3 flex-wrap"   , children: [
        _jsxDEV('button', { onClick: analyze, disabled: loading || !text.trim(), className: c.btn, children: 
          loading ? _jsxDEV(_Fragment, { children: [_jsxDEV(Spinner, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 190}, this ), " Analyzing…" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 190}, this) : "Analyze"
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this)
        , _jsxDEV('button', { onClick: suggest, className: c.btnGhost, children: "Suggest example" }, void 0, false, {fileName: _jsxFileName, lineNumber: 192}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 188}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 179}, this)
  )
}

function DagView({ claim, database, can, c }) {
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!ref.current || !claim.nodes) return
    const width = ref.current.clientWidth || 320
    const height = 280
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${width} ${height}`)

    const nodes = claim.nodes.map((n) => ({ ...n }))
    const links = (claim.edges || []).map((e) => ({ ...e }))

    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#78716c")

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40))

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("stroke", "#78716c").attr("stroke-width", 2).attr("marker-end", "url(#arrow)")

    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y })
        .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    node.append("circle").attr("r", 22)
      .attr("fill", (d) => d.kind === "treatment" ? "#e63946" : d.kind === "outcome" ? "#0c0a09" : "#fbbf24")
      .attr("stroke", "white").attr("stroke-width", 2)

    node.append("text").text((d) => (d.label || "").slice(0, 14))
      .attr("text-anchor", "middle").attr("dy", 36)
      .attr("font-size", 11).attr("fill", "#0c0a09")

    sim.on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y)
      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })
  }, [claim._id, claim.nodes])

  async function addConfounder() {
    const label = prompt("Confounder name?")
    if (!label) return
    const id = `C${Date.now()}`
    const newNodes = [...(claim.nodes || []), { id, label, kind: "confounder" }]
    const newEdges = [...(claim.edges || []), { source: id, target: "T" }, { source: id, target: "Y" }]
    await database.put({ ...claim, nodes: newNodes, edges: newEdges })
  }

  return (
    _jsxDEV('div', { children: [
      _jsxDEV('svg', { ref: ref, className: "w-full bg-[#fafaf9] rounded-md border border-[#e7e5e4]"    , style: { height: 280 },}, void 0, false, {fileName: _jsxFileName, lineNumber: 261}, this )
      , _jsxDEV('div', { className: "flex gap-2 mt-3 text-xs flex-wrap"    , children: [
        _jsxDEV('span', { className: "flex items-center gap-1"  , children: [_jsxDEV('span', { className: "w-3 h-3 rounded-full bg-[#e63946]"   ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 263}, this ), " treatment" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 263}, this)
        , _jsxDEV('span', { className: "flex items-center gap-1"  , children: [_jsxDEV('span', { className: "w-3 h-3 rounded-full bg-[#0c0a09]"   ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 264}, this ), " outcome" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 264}, this)
        , _jsxDEV('span', { className: "flex items-center gap-1"  , children: [_jsxDEV('span', { className: "w-3 h-3 rounded-full bg-[#fbbf24]"   ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 265}, this ), " confounder" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 265}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 262}, this)
      , can("write") && (
        _jsxDEV('button', { onClick: addConfounder, className: `${c.btnGhost} mt-3`, children: "+ Add confounder"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 268}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 260}, this)
  )
}

function Checklist({ claim, database, can, c }) {
  const prompts = [
    { key: "confounders", q: "What variables might cause BOTH the treatment and the outcome?" },
    { key: "selection", q: "How were units selected into the sample? Could that bias the comparison?" },
    { key: "reverse", q: "Could the outcome actually be causing the treatment?" },
    { key: "design", q: "Is this an RCT, natural experiment, or observational study?" },
    { key: "potential", q: claim.potentialOutcomesQuestion || "What would have happened to the same units without treatment?" },
    { key: "evidence", q: "What new evidence would shift your belief?" },
  ]
  const checklist = claim.checklist || {}

  async function update(key, value) {
    await database.put({ ...claim, checklist: { ...checklist, [key]: value } })
  }

  async function saveNotes(value) {
    await database.put({ ...claim, notes: value })
  }

  return (
    _jsxDEV('div', { className: "space-y-3", children: [
      claim.languageFlag && (
        _jsxDEV('p', { className: c.muted, children: ["Language: "
           , _jsxDEV('span', { className: c.chip, children: claim.languageFlag}, void 0, false, {fileName: _jsxFileName, lineNumber: 297}, this)
          , claim.studyType && _jsxDEV(_Fragment, { children: [" · Study type: "    , _jsxDEV('span', { className: c.chip, children: claim.studyType}, void 0, false, {fileName: _jsxFileName, lineNumber: 298}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 298}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 296}, this)
      )
      , prompts.map((p) => (
        _jsxDEV('div', { children: [
          _jsxDEV('label', { className: "block text-sm font-medium mb-1"   , children: p.q}, void 0, false, {fileName: _jsxFileName, lineNumber: 303}, this)
          , can("write") ? (
            _jsxDEV('textarea', {
              className: c.input,
              rows: 2,
              value: checklist[p.key] || "",
              onChange: (e) => update(p.key, e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 305}, this
            )
          ) : (
            _jsxDEV('p', { className: c.readonly, children: checklist[p.key] || "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 312}, this)
          )
        ]}, p.key, true, {fileName: _jsxFileName, lineNumber: 302}, this)
      ))
      , _jsxDEV('div', { children: [
        _jsxDEV('label', { className: "block text-sm font-medium mb-1"   , children: "Personal notes" }, void 0, false, {fileName: _jsxFileName, lineNumber: 317}, this)
        , can("write") ? (
          _jsxDEV('textarea', {
            className: c.input,
            rows: 3,
            value: claim.notes || "",
            onChange: (e) => saveNotes(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 319}, this
          )
        ) : (
          _jsxDEV('p', { className: c.readonly, children: claim.notes || "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 326}, this)
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 316}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 294}, this)
  )
}