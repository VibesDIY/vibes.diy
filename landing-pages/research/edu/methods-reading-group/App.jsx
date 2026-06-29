import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Consensus({ paper, can, database, useDocument, c }) {
  const { doc, merge, submit } = useDocument({
    type: "consensus", paperId: paper?._id || "", finalMethod: "", contested: "", verdict: ""
  });

  function handleRecord(e) {
    e.preventDefault();
    if (!paper) return;
    merge({ paperId: paper._id });
    submit(e);
    database.put({ ...paper, archived: true, archivedAt: Date.now(), consensusMethod: doc.finalMethod });
  }

  if (!paper) return <p className={c.muted}>Post a paper to record consensus.</p>;
  if (!can("write")) return <p className={c.muted}>Read-only — only members can record consensus.</p>;

  return (
    <form onSubmit={handleRecord} className="space-y-2">
      <input className={c.input} placeholder="Final method classification" value={doc.finalMethod} onChange={e => merge({ finalMethod: e.target.value })} />
      <input className={c.input} placeholder="Most contested assumption" value={doc.contested} onChange={e => merge({ contested: e.target.value })} />
      <textarea className={c.input} rows="2" placeholder="Did the paper survive discussion?" value={doc.verdict} onChange={e => merge({ verdict: e.target.value })}></textarea>
      <button type="submit" className={c.btn}>Record consensus & archive</button>
    </form>
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
      .attr("x1", e => positions[e.from]?.x || 0).attr("y1", e => positions[e.from]?.y || 0)
      .attr("x2", e => positions[e.to]?.x || 0).attr("y2", e => positions[e.to]?.y || 0)
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
    const existing = votes.find(v => v.voter === (viewer?.userSlug || "anonymous"));
    if (existing) database.put({ ...existing, nodeId });
    else database.put({ type: "confounder-vote", paperId, nodeId, voter: viewer?.userSlug || "anonymous" });
  }

  const voteCounts = {};
  votes.forEach(v => { voteCounts[v.nodeId] = (voteCounts[v.nodeId] || 0) + 1; });

  return (
    <>
      <p className={c.muted + " mb-3"}>Tap a node, then tap another to draw an arrow. Vote on the key confounder below.</p>
      {can("write") && paperId && (
        <form onSubmit={addNode} className="flex gap-2 mb-3">
          <input className={c.input} placeholder="Variable name" value={nodeName} onChange={e => setNodeName(e.target.value)} />
          <button type="submit" className={c.btn}>Add</button>
        </form>
      )}
      <div className="bg-[#fafaf9] border border-[#e7e5e4] rounded-lg overflow-hidden">
        {nodes.length === 0 ? (
          <div className="h-64 flex items-center justify-center"><p className={c.muted}>{paperId ? "Add variables to start" : "Post a paper first"}</p></div>
        ) : <svg ref={svgRef} width="100%" height="256"></svg>}
      </div>
      {nodes.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium mb-2">Vote: which is the key confounder?</p>
          <div className="flex flex-wrap gap-2">
            {nodes.map(n => (
              <button key={n._id} onClick={() => vote(n._id)} disabled={!can("write")} className={c.btnGhost}>
                {n.label} <span className="ml-1 text-[#dc2626] font-semibold">{voteCounts[n._id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
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
    mergeNote({ paperId, author: viewer?.userSlug || "anonymous" });
    submitNote(e);
  }

  return (
    <>
      {can("write") && paperId && (
        <form onSubmit={handleAdd} className="space-y-2 mb-3">
          <select className={c.input} value={noteDraft.method} onChange={e => mergeNote({ method: e.target.value })}>
            <option value="">Pick method...</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <textarea className={c.input} rows="2" placeholder="Does the identifying assumption hold?" value={noteDraft.note} onChange={e => mergeNote({ note: e.target.value })}></textarea>
          <div className="flex gap-2">
            <button type="submit" className={c.btn}>Add note</button>
            <button type="button" onClick={aiTag} disabled={aiLoading} className={c.btnGhost}>
              {aiLoading ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : "AI tag & confounders"}
            </button>
          </div>
          {noteDraft.confounders?.length > 0 && (
            <div className="text-xs text-[#78716c]">Suggested confounders: {noteDraft.confounders.join(", ")}</div>
          )}
        </form>
      )}
      {notes.length === 0 ? <p className={c.muted}>No notes yet.</p> : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n._id} className={c.row}>
              <div className="flex justify-between items-start">
                <span className={c.pill}>{n.method || "untagged"}</span>
                <span className={c.muted}>{n.author}</span>
              </div>
              <p className="text-sm text-[#1c1917] mt-2">{n.note}</p>
              {n.confounders?.length > 0 && <p className="text-xs text-[#78716c] mt-1">confounders: {n.confounders.join(", ")}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
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
  const currentPaper = papers.find(p => p.posted && !p.archived) || papers.find(p => p.posted);
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
    mergePaper({ posted: true, postedAt: Date.now(), postedBy: viewer?.userSlug || "anonymous" });
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
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Causal Reading Group</h1>
        <p className={c.tagline}>monthly papers, shared reasoning</p>
      </header>
      <main id="app" className={c.main}>
        <section id="current-paper" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accentBar}></span>This Month's Paper</h2>
          {currentPaper ? (
            <div className={c.row}>
              <h3 className="font-semibold text-[#1c1917]">{currentPaper.title}</h3>
              <p className="text-sm text-[#44403c] mt-2">{currentPaper.abstract}</p>
              <div className="mt-3 text-sm space-y-1">
                <div><span className={c.pill}>treatment</span> <span className="ml-2">{currentPaper.treatment}</span></div>
                <div><span className={c.pill}>outcome</span> <span className="ml-2">{currentPaper.outcome}</span></div>
              </div>
              <p className={c.muted + " mt-3"}>posted by {currentPaper.postedBy}</p>
            </div>
          ) : !can("write") ? (
            <p className={c.muted}>No paper posted yet — read-only view.</p>
          ) : (
            <form onSubmit={handlePostPaper} className="space-y-2">
              <input className={c.input} placeholder="Paper title" value={paperDraft.title} onChange={e => mergePaper({ title: e.target.value })} />
              <textarea className={c.input} rows="3" placeholder="Abstract" value={paperDraft.abstract} onChange={e => mergePaper({ abstract: e.target.value })}></textarea>
              <div className="grid grid-cols-2 gap-2">
                <input className={c.input} placeholder="Treatment" value={paperDraft.treatment} onChange={e => mergePaper({ treatment: e.target.value })} />
                <input className={c.input} placeholder="Outcome" value={paperDraft.outcome} onChange={e => mergePaper({ outcome: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={c.btn}>Post paper</button>
                <button type="button" onClick={suggestPaper} disabled={suggestingPaper} className={c.btnGhost}>
                  {suggestingPaper ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : "Suggest example"}
                </button>
              </div>
            </form>
          )}
        </section>
        <section id="method-notes" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accentBar}></span>Method & Assumptions</h2>
          <MethodNotes paperId={currentPaper?._id} viewer={viewer} can={can} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} c={c} />
        </section>
        <section id="dag-sketch" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accentBar}></span>Causal DAG</h2>
          <DAGSketch paperId={currentPaper?._id} viewer={viewer} can={can} database={database} useLiveQuery={useLiveQuery} c={c} />
        </section>
        <section id="consensus" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accentBar}></span>Group Consensus</h2>
          <Consensus paper={currentPaper} can={can} database={database} useDocument={useDocument} c={c} />
        </section>
        <section id="archive" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accentBar}></span>Archive by Method</h2>
          {papers.filter(p => p.archived).length === 0 ? (
            <p className={c.muted}>No archived papers yet. Records appear here after a consensus is recorded.</p>
          ) : (
            <ul className="space-y-2">
              {papers.filter(p => p.archived).map(p => (
                <li key={p._id} className={c.row}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm text-[#1c1917]">{p.title}</span>
                    <span className={c.pill}>{p.consensusMethod || "untagged"}</span>
                  </div>
                  <p className={c.muted + " mt-1"}>{p.treatment} → {p.outcome}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}