const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Consensus({ paper, can, database, useDocument, c }) {
  const { doc, merge, submit } = useDocument({
    type: "consensus", paperId: _optionalChain([paper, 'optionalAccess', _2 => _2._id]) || "", finalMethod: "", contested: "", verdict: ""
  });

  function handleRecord(e) {
    e.preventDefault();
    if (!paper) return;
    merge({ paperId: paper._id });
    submit(e);
    database.put({ ...paper, archived: true, archivedAt: Date.now(), consensusMethod: doc.finalMethod });
  }

  if (!paper) return _jsxDEV('p', { className: c.muted, children: "Post a paper to record consensus."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 20}, this);
  if (!can("write")) return _jsxDEV('p', { className: c.muted, children: "Read-only — only members can record consensus."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 21}, this);

  return (
    _jsxDEV('form', { onSubmit: handleRecord, className: "space-y-2", children: [
      _jsxDEV('input', { className: c.input, placeholder: "Final method classification"  , value: doc.finalMethod, onChange: e => merge({ finalMethod: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 25}, this )
      , _jsxDEV('input', { className: c.input, placeholder: "Most contested assumption"  , value: doc.contested, onChange: e => merge({ contested: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 26}, this )
      , _jsxDEV('textarea', { className: c.input, rows: "2", placeholder: "Did the paper survive discussion?"    , value: doc.verdict, onChange: e => merge({ verdict: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 27}, this)
      , _jsxDEV('button', { type: "submit", className: c.btn, children: "Record consensus & archive"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 28}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 24}, this)
  );
}

function DAGSketch({ paperId, viewer, can, database, useLiveQuery, c }) {
  const svgRef = React.useRef(null);
  const [nodeName, setNodeName] = React.useState("");
  const [selectedFrom, setSelectedFrom] = React.useState(null);
  const { docs: allNodes } = useLiveQuery("type", { key: "dag-node" });
  const { docs: allEdges } = useLiveQuery("type", { key: "dag-edge" });
  const { docs: allVotes } = useLiveQuery("type", { key: "confounder-vote" });
  const nodes = allNodes.filter(n => n.paperId === paperId);
  const edges = allEdges.filter(e => e.paperId === paperId);
  const votes = allVotes.filter(v => v.paperId === paperId);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const w = svgRef.current.clientWidth, h = 256;
    svg.append("defs").append("marker").attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 22).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#78716c");
    const positions = {};
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI;
      positions[n._id] = { x: w/2 + Math.cos(angle) * 80, y: h/2 + Math.sin(angle) * 70 };
    });
    svg.selectAll("line").data(edges).enter().append("line")
      .attr("x1", e => _optionalChain([positions, 'access', _3 => _3[e.from], 'optionalAccess', _4 => _4.x]) || 0).attr("y1", e => _optionalChain([positions, 'access', _5 => _5[e.from], 'optionalAccess', _6 => _6.y]) || 0)
      .attr("x2", e => _optionalChain([positions, 'access', _7 => _7[e.to], 'optionalAccess', _8 => _8.x]) || 0).attr("y2", e => _optionalChain([positions, 'access', _9 => _9[e.to], 'optionalAccess', _10 => _10.y]) || 0)
      .attr("stroke", "#78716c").attr("stroke-width", 2).attr("marker-end", "url(#arrow)");
    const g = svg.selectAll("g.node").data(nodes).enter().append("g").attr("class", "node")
      .attr("transform", n => `translate(${positions[n._id].x},${positions[n._id].y})`)
      .style("cursor", "pointer")
      .on("click", (_, n) => {
        if (!can("write")) return;
        if (selectedFrom === null) setSelectedFrom(n._id);
        else if (selectedFrom === n._id) setSelectedFrom(null);
        else {
          database.put({ type: "dag-edge", paperId, from: selectedFrom, to: n._id });
          setSelectedFrom(null);
        }
      });
    g.append("circle").attr("r", 20).attr("fill", n => n._id === selectedFrom ? "#dc2626" : "#fef2f2").attr("stroke", "#dc2626").attr("stroke-width", 2);
    g.append("text").text(n => n.label).attr("text-anchor", "middle").attr("dy", 4).attr("font-size", 10).attr("fill", n => n._id === selectedFrom ? "#fff" : "#1c1917");
  }, [nodes, edges, selectedFrom, can, database, paperId]);

  function addNode(e) {
    e.preventDefault();
    if (!nodeName.trim() || !paperId) return;
    database.put({ type: "dag-node", paperId, label: nodeName.trim() });
    setNodeName("");
  }

  function vote(nodeId) {
    const existing = votes.find(v => v.voter === (_optionalChain([viewer, 'optionalAccess', _11 => _11.userSlug]) || "anonymous"));
    if (existing) database.put({ ...existing, nodeId });
    else database.put({ type: "confounder-vote", paperId, nodeId, voter: _optionalChain([viewer, 'optionalAccess', _12 => _12.userSlug]) || "anonymous" });
  }

  const voteCounts = {};
  votes.forEach(v => { voteCounts[v.nodeId] = (voteCounts[v.nodeId] || 0) + 1; });

  return (
    _jsxDEV(_Fragment, { children: [
      _jsxDEV('p', { className: c.muted + " mb-3", children: "Tap a node, then tap another to draw an arrow. Vote on the key confounder below."               }, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)
      , can("write") && paperId && (
        _jsxDEV('form', { onSubmit: addNode, className: "flex gap-2 mb-3"  , children: [
          _jsxDEV('input', { className: c.input, placeholder: "Variable name" , value: nodeName, onChange: e => setNodeName(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this )
          , _jsxDEV('button', { type: "submit", className: c.btn, children: "Add"}, void 0, false, {fileName: _jsxFileName, lineNumber: 97}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 95}, this)
      )
      , _jsxDEV('div', { className: "bg-[#fafaf9] border border-[#e7e5e4] rounded-lg overflow-hidden"    , children: 
        nodes.length === 0 ? (
          _jsxDEV('div', { className: "h-64 flex items-center justify-center"   , children: _jsxDEV('p', { className: c.muted, children: paperId ? "Add variables to start" : "Post a paper first"}, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)
        ) : _jsxDEV('svg', { ref: svgRef, width: "100%", height: "256",}, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this)
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this)
      , nodes.length > 0 && (
        _jsxDEV('div', { className: "mt-3", children: [
          _jsxDEV('p', { className: "text-sm font-medium mb-2"  , children: "Vote: which is the key confounder?"     }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
          , _jsxDEV('div', { className: "flex flex-wrap gap-2"  , children: 
            nodes.map(n => (
              _jsxDEV('button', { onClick: () => vote(n._id), disabled: !can("write"), className: c.btnGhost, children: [
                n.label, " " , _jsxDEV('span', { className: "ml-1 text-[#dc2626] font-semibold"  , children: voteCounts[n._id] || 0}, void 0, false, {fileName: _jsxFileName, lineNumber: 111}, this)
              ]}, n._id, true, {fileName: _jsxFileName, lineNumber: 110}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 92}, this)
  );
}

function MethodNotes({ paperId, viewer, can, database, useLiveQuery, useDocument, c }) {
  const { doc: noteDraft, merge: mergeNote, submit: submitNote } = useDocument({
    type: "method-note", paperId: paperId || "", method: "", note: "", confounders: [], author: ""
  });
  const { docs: allNotes } = useLiveQuery("type", { key: "method-note" });
  const notes = allNotes.filter(n => n.paperId === paperId);
  const [aiLoading, setAiLoading] = React.useState(false);
  const methods = ["RCT", "Difference-in-differences", "Regression discontinuity", "Instrumental variables", "Propensity score", "Matching", "Synthetic control"];

  async function aiTag() {
    if (!noteDraft.note.trim()) return;
    setAiLoading(true);
    try {
      const r = await callAI(`Given this assumption note about a causal inference paper, suggest the best-fit method category and list 2-3 potential confounders. Note: "${noteDraft.note}"`, {
        schema: { properties: { method: { type: "string" }, confounders: { type: "array", items: { type: "string" } } } }
      });
      const s = JSON.parse(r);
      const matched = methods.find(m => s.method.toLowerCase().includes(m.toLowerCase().split(" ")[0])) || s.method;
      mergeNote({ method: matched, confounders: s.confounders });
    } finally { setAiLoading(false); }
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!noteDraft.note.trim() || !paperId) return;
    mergeNote({ paperId, author: _optionalChain([viewer, 'optionalAccess', _13 => _13.userSlug]) || "anonymous" });
    submitNote(e);
  }

  return (
    _jsxDEV(_Fragment, { children: [
      can("write") && paperId && (
        _jsxDEV('form', { onSubmit: handleAdd, className: "space-y-2 mb-3" , children: [
          _jsxDEV('select', { className: c.input, value: noteDraft.method, onChange: e => mergeNote({ method: e.target.value }), children: [
            _jsxDEV('option', { value: "", children: "Pick method..." }, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
            , methods.map(m => _jsxDEV('option', { value: m, children: m}, m, false, {fileName: _jsxFileName, lineNumber: 156}, this))
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 154}, this)
          , _jsxDEV('textarea', { className: c.input, rows: "2", placeholder: "Does the identifying assumption hold?"    , value: noteDraft.note, onChange: e => mergeNote({ note: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 158}, this)
          , _jsxDEV('div', { className: "flex gap-2" , children: [
            _jsxDEV('button', { type: "submit", className: c.btn, children: "Add note" }, void 0, false, {fileName: _jsxFileName, lineNumber: 160}, this)
            , _jsxDEV('button', { type: "button", onClick: aiTag, disabled: aiLoading, className: c.btnGhost, children: 
              aiLoading ? _jsxDEV('svg', { className: "animate-spin w-4 h-4 inline"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this) : "AI tag & confounders"
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)
          , _optionalChain([noteDraft, 'access', _14 => _14.confounders, 'optionalAccess', _15 => _15.length]) > 0 && (
            _jsxDEV('div', { className: "text-xs text-[#78716c]" , children: ["Suggested confounders: "  , noteDraft.confounders.join(", ")]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 153}, this)
      )
      , notes.length === 0 ? _jsxDEV('p', { className: c.muted, children: "No notes yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 170}, this) : (
        _jsxDEV('ul', { className: "space-y-2", children: 
          notes.map(n => (
            _jsxDEV('li', { className: c.row, children: [
              _jsxDEV('div', { className: "flex justify-between items-start"  , children: [
                _jsxDEV('span', { className: c.pill, children: n.method || "untagged"}, void 0, false, {fileName: _jsxFileName, lineNumber: 175}, this)
                , _jsxDEV('span', { className: c.muted, children: n.author}, void 0, false, {fileName: _jsxFileName, lineNumber: 176}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 174}, this)
              , _jsxDEV('p', { className: "text-sm text-[#1c1917] mt-2"  , children: n.note}, void 0, false, {fileName: _jsxFileName, lineNumber: 178}, this)
              , _optionalChain([n, 'access', _16 => _16.confounders, 'optionalAccess', _17 => _17.length]) > 0 && _jsxDEV('p', { className: "text-xs text-[#78716c] mt-1"  , children: ["confounders: " , n.confounders.join(", ")]}, void 0, true, {fileName: _jsxFileName, lineNumber: 179}, this)
            ]}, n._id, true, {fileName: _jsxFileName, lineNumber: 173}, this)
          ))
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 171}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("causal-reading-group");
  const { doc: paperDraft, merge: mergePaper, submit: submitPaper } = useDocument({
    type: "paper", title: "", abstract: "", treatment: "", outcome: "",
    posted: false, postedAt: 0, postedBy: ""
  });
  const { docs: papers } = useLiveQuery("type", { key: "paper", descending: true });
  const livePaper = papers.find(p => p.posted && !p.archived) || papers.find(p => p.posted)
  const demoPaper = livePaper ? null : {
    _id: "demo",
    title: "Does Job Training Reduce Unemployment? Evidence from the JTPA Study",
    abstract: "Uses a randomized experiment to estimate the effect of job training on earnings and employment. Demonstrates how RCTs can isolate causal effects even when selection bias would otherwise confound estimates.",
    treatment: "Job training program participation",
    outcome: "Quarterly earnings 18 months post-enrollment",
    postedBy: "instructor",
    posted: true,
  }
  const currentPaper = livePaper || demoPaper;
  const [suggestingPaper, setSuggestingPaper] = React.useState(false);

  async function suggestPaper() {
    setSuggestingPaper(true);
    try {
      const r = await callAI("Suggest one well-known causal inference paper for a reading group. Return title, one-sentence abstract, treatment variable, outcome variable.", {
        schema: { properties: { title: { type: "string" }, abstract: { type: "string" }, treatment: { type: "string" }, outcome: { type: "string" } } }
      });
      const s = JSON.parse(r);
      mergePaper({ title: s.title, abstract: s.abstract, treatment: s.treatment, outcome: s.outcome });
    } finally { setSuggestingPaper(false); }
  }

  function handlePostPaper(e) {
    e.preventDefault();
    if (!paperDraft.title.trim()) return;
    mergePaper({ posted: true, postedAt: Date.now(), postedBy: _optionalChain([viewer, 'optionalAccess', _18 => _18.userSlug]) || "anonymous" });
    submitPaper(e);
  }

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#1c1917]",
    header: "sticky top-0 z-10 bg-[#1c1917] text-[#fafaf9] px-4 py-4 shadow-md",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-[#a8a29e] mt-0.5",
    main: "px-4 py-5 space-y-5 max-w-2xl mx-auto pb-24",
    section: "bg-white rounded-xl border border-[#e7e5e4] p-4 shadow-sm",
    sectionTitle: "text-base font-semibold text-[#1c1917] mb-3 flex items-center gap-2",
    accentBar: "inline-block w-1 h-5 bg-[#dc2626] rounded-full",
    btn: "min-h-[44px] px-4 py-2 bg-[#dc2626] text-white rounded-lg font-medium active:bg-[#b91c1c] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#e7e5e4] text-[#1c1917] rounded-lg text-sm active:bg-[#f5f5f4]",
    input: "w-full px-3 py-3 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:border-[#dc2626]",
    row: "p-3 border border-[#e7e5e4] rounded-lg bg-[#fafaf9]",
    muted: "text-xs text-[#78716c]",
    pill: "inline-block px-2 py-0.5 text-xs rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Causal Reading Group"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 237}, this)
        , _jsxDEV('p', { className: c.tagline, children: "monthly papers, shared reasoning"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 238}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 236}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "current-paper", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.accentBar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 242}, this), "This Month's Paper"  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 242}, this)
          , currentPaper ? (
            _jsxDEV('div', { className: c.row, children: [
              _jsxDEV('h3', { className: "font-semibold text-[#1c1917]" , children: currentPaper.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 245}, this)
              , _jsxDEV('p', { className: "text-sm text-[#44403c] mt-2"  , children: currentPaper.abstract}, void 0, false, {fileName: _jsxFileName, lineNumber: 246}, this)
              , _jsxDEV('div', { className: "mt-3 text-sm space-y-1"  , children: [
                _jsxDEV('div', { children: [_jsxDEV('span', { className: c.pill, children: "treatment"}, void 0, false, {fileName: _jsxFileName, lineNumber: 248}, this), " " , _jsxDEV('span', { className: "ml-2", children: currentPaper.treatment}, void 0, false, {fileName: _jsxFileName, lineNumber: 248}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 248}, this)
                , _jsxDEV('div', { children: [_jsxDEV('span', { className: c.pill, children: "outcome"}, void 0, false, {fileName: _jsxFileName, lineNumber: 249}, this), " " , _jsxDEV('span', { className: "ml-2", children: currentPaper.outcome}, void 0, false, {fileName: _jsxFileName, lineNumber: 249}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 249}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 247}, this)
              , _jsxDEV('p', { className: c.muted + " mt-3", children: ["posted by "  , currentPaper.postedBy]}, void 0, true, {fileName: _jsxFileName, lineNumber: 251}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 244}, this)
          ) : !can("write") ? (
            _jsxDEV('p', { className: c.muted, children: "No paper posted yet — read-only view."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 254}, this)
          ) : (
            _jsxDEV('form', { onSubmit: handlePostPaper, className: "space-y-2", children: [
              _jsxDEV('input', { className: c.input, placeholder: "Paper title" , value: paperDraft.title, onChange: e => mergePaper({ title: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 257}, this )
              , _jsxDEV('textarea', { className: c.input, rows: "3", placeholder: "Abstract", value: paperDraft.abstract, onChange: e => mergePaper({ abstract: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 258}, this)
              , _jsxDEV('div', { className: "grid grid-cols-2 gap-2"  , children: [
                _jsxDEV('input', { className: c.input, placeholder: "Treatment", value: paperDraft.treatment, onChange: e => mergePaper({ treatment: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 260}, this )
                , _jsxDEV('input', { className: c.input, placeholder: "Outcome", value: paperDraft.outcome, onChange: e => mergePaper({ outcome: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 261}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 259}, this)
              , _jsxDEV('div', { className: "flex gap-2" , children: [
                _jsxDEV('button', { type: "submit", className: c.btn, children: "Post paper" }, void 0, false, {fileName: _jsxFileName, lineNumber: 264}, this)
                , _jsxDEV('button', { type: "button", onClick: suggestPaper, disabled: suggestingPaper, className: c.btnGhost, children: 
                  suggestingPaper ? _jsxDEV('svg', { className: "animate-spin w-4 h-4 inline"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 266}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 266}, this) : "Suggest example"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 265}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 263}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 256}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 241}, this)
        , _jsxDEV('section', { id: "method-notes", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.accentBar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 273}, this), "Method & Assumptions"  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 273}, this)
          , _jsxDEV(MethodNotes, { paperId: _optionalChain([currentPaper, 'optionalAccess', _19 => _19._id]), viewer: viewer, can: can, database: database, useLiveQuery: useLiveQuery, useDocument: useDocument, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 274}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 272}, this)
        , _jsxDEV('section', { id: "dag-sketch", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.accentBar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 277}, this), "Causal DAG" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 277}, this)
          , _jsxDEV(DAGSketch, { paperId: _optionalChain([currentPaper, 'optionalAccess', _20 => _20._id]), viewer: viewer, can: can, database: database, useLiveQuery: useLiveQuery, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 278}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 276}, this)
        , _jsxDEV('section', { id: "consensus", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.accentBar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 281}, this), "Group Consensus" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 281}, this)
          , _jsxDEV(Consensus, { paper: currentPaper, can: can, database: database, useDocument: useDocument, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 282}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 280}, this)
        , _jsxDEV('section', { id: "archive", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.accentBar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 285}, this), "Archive by Method"  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 285}, this)
          , papers.filter(p => p.archived).length === 0 ? (
            _jsxDEV('p', { className: c.muted, children: "No archived papers yet. Records appear here after a consensus is recorded."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 287}, this)
          ) : (
            _jsxDEV('ul', { className: "space-y-2", children: 
              papers.filter(p => p.archived).map(p => (
                _jsxDEV('li', { className: c.row, children: [
                  _jsxDEV('div', { className: "flex justify-between items-start gap-2"   , children: [
                    _jsxDEV('span', { className: "font-medium text-sm text-[#1c1917]"  , children: p.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 293}, this)
                    , _jsxDEV('span', { className: c.pill, children: p.consensusMethod || "untagged"}, void 0, false, {fileName: _jsxFileName, lineNumber: 294}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 292}, this)
                  , _jsxDEV('p', { className: c.muted + " mt-1", children: [p.treatment, " → "  , p.outcome]}, void 0, true, {fileName: _jsxFileName, lineNumber: 296}, this)
                ]}, p._id, true, {fileName: _jsxFileName, lineNumber: 291}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 289}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 284}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 240}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 235}, this)
  );
}