import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function VersionList({ planId }) {
  const { useLiveQuery } = useFireproof("causal-dossier")
  const { docs: allVersions } = useLiveQuery("type", { key: "version", descending: true })
  const versions = allVersions.filter((v) => v.planId === planId)
  if (!planId) return <p className="text-[10px] uppercase tracking-widest text-[#8a95a8]">No plan selected.</p>
  if (versions.length === 0) return <p className="text-[10px] uppercase tracking-widest text-[#8a95a8]">No locked versions yet. Lock a draft to snapshot it.</p>
  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li key={v._id} className="border border-[#2a3548] bg-[#0a0a0a] rounded-sm p-3 text-sm">
          <div className="flex justify-between items-baseline">
            <div className="text-xs uppercase tracking-widest text-[#fafafa] font-black">
              {new Date(v.lockedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[#8a95a8]">{v.lockedBy}</div>
          </div>
          {v.snapshot?.title && <div className="mt-1 text-xs">{v.snapshot.title}</div>}
          {v.snapshot?.exposure && (
            <div className="text-[10px] opacity-70 mt-1">
              {v.snapshot.exposure} vs {v.snapshot.comparator} → {v.snapshot.outcome}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("causal-dossier")
  const [activePlanId, setActivePlanId] = React.useState(null)
  const { doc: plan, merge: mergePlan, save: savePlan } = useDocument(
    activePlanId ? { _id: activePlanId } : { type: "plan", title: "", cohort: "", registryId: "", locked: false, createdAt: Date.now() }
  )
  const { docs: allPlans } = useLiveQuery("type", { key: "plan", descending: true })
  const [suggestingQ, setSuggestingQ] = React.useState(false)
  const [newNodeLabel, setNewNodeLabel] = React.useState("")
  const [newNodeRole, setNewNodeRole] = React.useState("confounder")
  const [auditing, setAuditing] = React.useState(false)
  const dagSvgRef = React.useRef(null)

  const dagNodes = plan.dagNodes || []
  const dagEdges = plan.dagEdges || []

  function addNode() {
    if (!newNodeLabel.trim()) return
    const id = `n${Date.now()}`
    const next = [...dagNodes, { id, label: newNodeLabel.trim(), role: newNodeRole }]
    let edges = dagEdges
    const exposure = next.find((n) => n.role === "exposure")
    const outcome = next.find((n) => n.role === "outcome")
    if (newNodeRole === "confounder" && exposure && outcome) {
      edges = [...edges, { source: id, target: exposure.id }, { source: id, target: outcome.id }]
    } else if (newNodeRole === "exposure" && outcome) {
      edges = [...edges, { source: id, target: outcome.id }]
    } else if (newNodeRole === "outcome" && exposure) {
      edges = [...edges, { source: exposure.id, target: id }]
    } else if (newNodeRole === "mediator" && exposure && outcome) {
      edges = [...edges, { source: exposure.id, target: id }, { source: id, target: outcome.id }]
    }
    mergePlan({ dagNodes: next, dagEdges: edges })
    setNewNodeLabel("")
  }

  function removeNode(id) {
    mergePlan({
      dagNodes: dagNodes.filter((n) => n.id !== id),
      dagEdges: dagEdges.filter((e) => {
        const s = typeof e.source === "object" ? e.source.id : e.source
        const t = typeof e.target === "object" ? e.target.id : e.target
        return s !== id && t !== id
      }),
    })
  }

  async function auditDAG() {
    setAuditing(true)
    try {
      const desc = dagNodes.map((n) => `${n.label} [${n.role}]`).join(", ")
      const edges = dagEdges.map((e) => {
        const s = typeof e.source === "object" ? e.source.id : e.source
        const t = typeof e.target === "object" ? e.target.id : e.target
        const sn = dagNodes.find((n) => n.id === s)?.label
        const tn = dagNodes.find((n) => n.id === t)?.label
        return `${sn} → ${tn}`
      }).join("; ")
      const r = await callAI(
        `You are a senior epidemiologist auditing a causal DAG. Exposure-outcome question: ${plan.exposure || "?"} vs ${plan.comparator || "?"} → ${plan.outcome || "?"} in ${plan.population || "?"}. Current DAG nodes: ${desc}. Edges: ${edges}. Identify likely missing confounders, implausible arrows, and unstated assumptions. Propose the minimal sufficient adjustment set as a list of node labels.`,
        { schema: { properties: { missingConfounders: { type: "array", items: { type: "string" } }, implausibleArrows: { type: "array", items: { type: "string" } }, unstatedAssumptions: { type: "array", items: { type: "string" } }, adjustmentSet: { type: "array", items: { type: "string" } }, commentary: { type: "string" } } } }
      )
      const audit = JSON.parse(r)
      mergePlan({ dagAudit: audit, dagAuditAt: Date.now() })
    } finally { setAuditing(false) }
  }

  React.useEffect(() => {
    const svg = d3.select(dagSvgRef.current)
    if (!svg.node()) return
    svg.selectAll("*").remove()
    const width = svg.node().clientWidth || 400
    const height = 280
    if (dagNodes.length === 0) return
    const roleColor = { exposure: "#fafafa", outcome: "#fafafa", confounder: "#8a95a8", mediator: "#5a6478" }
    const nodes = dagNodes.map((n) => ({ ...n }))
    const links = dagEdges.map((e) => ({
      source: typeof e.source === "object" ? e.source.id : e.source,
      target: typeof e.target === "object" ? e.target.id : e.target,
    }))
    const defs = svg.append("defs")
    defs.append("marker").attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 22).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#8a95a8")
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(34))
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#2a3548").attr("stroke-width", 1.5).attr("marker-end", "url(#arrow)")
    const g = svg.append("g").selectAll("g").data(nodes).enter().append("g").style("cursor", "pointer").on("click", (_, d) => can("write") && !plan.locked && removeNode(d.id))
    g.append("circle").attr("r", 18).attr("fill", "#000").attr("stroke", (d) => roleColor[d.role] || "#8a95a8").attr("stroke-width", (d) => (d.role === "exposure" || d.role === "outcome" ? 2.5 : 1.5))
    g.append("text").text((d) => d.label).attr("y", 32).attr("text-anchor", "middle").attr("fill", "#fafafa").attr("font-size", "10px").attr("font-family", "Roboto Mono")
    g.append("text").text((d) => d.role[0].toUpperCase()).attr("text-anchor", "middle").attr("dy", 4).attr("fill", (d) => roleColor[d.role]).attr("font-size", "11px").attr("font-weight", "bold")
    sim.on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y)
      g.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })
    return () => sim.stop()
  }, [dagNodes, dagEdges, can, plan.locked])
  React.useEffect(() => {
    if (!activePlanId && allPlans.length > 0) setActivePlanId(allPlans[0]._id)
  }, [allPlans, activePlanId])
  const { docs: allThreats } = useLiveQuery("type", { key: "threat" })
  const threats = allThreats.filter((t) => t.planId === activePlanId)
  const [threatLabel, setThreatLabel] = React.useState("")
  const [threatCategory, setThreatCategory] = React.useState("selection")
  const [threatMitigation, setThreatMitigation] = React.useState("")
  const [suggestingThreats, setSuggestingThreats] = React.useState(false)

  async function addThreat() {
    if (!threatLabel.trim() || !activePlanId) return
    await database.put({
      type: "threat", planId: activePlanId, label: threatLabel.trim(),
      category: threatCategory, mitigation: threatMitigation.trim(), createdAt: Date.now(),
      createdBy: viewer?.userSlug ?? "anonymous",
    })
    setThreatLabel(""); setThreatMitigation("")
  }

  async function suggestThreats() {
    setSuggestingThreats(true)
    try {
      const r = await callAI(
        `For an observational cohort study of ${plan.exposure || "an exposure"} vs ${plan.comparator || "a comparator"} on ${plan.outcome || "an outcome"} in ${plan.population || "the cohort"}, list the top 3 threats to validity (selection, confounding, information) and a concrete planned mitigation or sensitivity analysis for each.`,
        { schema: { properties: { threats: { type: "array", items: { type: "object", properties: { label: { type: "string" }, category: { type: "string" }, mitigation: { type: "string" } } } } } } }
      )
      const out = JSON.parse(r)
      for (const t of out.threats || []) {
        await database.put({ type: "threat", planId: activePlanId, label: t.label, category: t.category, mitigation: t.mitigation, createdAt: Date.now(), createdBy: viewer?.userSlug ?? "anonymous", aiGenerated: true })
      }
    } finally { setSuggestingThreats(false) }
  }

  async function handleSavePlan() {
    const r = await savePlan()
    if (!activePlanId && r?.id) setActivePlanId(r.id)
  }
  async function handleLockVersion() {
    if (!plan._id) return
    await database.put({
      type: "version",
      planId: plan._id,
      snapshot: plan,
      lockedAt: Date.now(),
      lockedBy: viewer?.userSlug ?? "anonymous",
    })
    await database.put({ ...plan, locked: true })
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-[#fafafa] font-mono",
    header: "sticky top-0 z-10 bg-[#000000] border-b border-[#2a3548] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-black tracking-wider uppercase",
    tag: "text-[10px] text-[#8a95a8] uppercase tracking-widest",
    avatar: "w-8 h-8 rounded-full border border-[#2a3548]",
    main: "max-w-3xl mx-auto px-4 py-4 pb-32 space-y-4",
    section: "bg-[#000000] border border-[#2a3548] rounded-sm p-4",
    h2: "text-xs uppercase tracking-widest text-[#8a95a8] mb-3 font-black",
    input: "w-full bg-[#1a1a1a] border border-[#2a3548] text-[#fafafa] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-[#fafafa] min-h-[44px]",
    textarea: "w-full bg-[#1a1a1a] border border-[#2a3548] text-[#fafafa] px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-[#fafafa] min-h-[88px]",
    btn: "min-h-[44px] px-4 py-2 bg-[#fafafa] text-[#000000] text-xs uppercase tracking-widest font-black rounded-sm hover:bg-[#d4d4d4] disabled:opacity-40",
    btnGhost: "min-h-[44px] px-3 py-2 bg-transparent border border-[#2a3548] text-[#fafafa] text-xs uppercase tracking-widest rounded-sm hover:border-[#fafafa]",
    row: "border border-[#2a3548] bg-[#0a0a0a] rounded-sm p-3 text-sm",
    label: "block text-[10px] uppercase tracking-widest text-[#8a95a8] mb-1",
    suggest: "text-[10px] uppercase tracking-widest text-[#8a95a8] underline hover:text-[#fafafa]",
    bar: "fixed bottom-0 left-0 right-0 bg-[#000000] border-t border-[#2a3548] px-4 py-3 flex gap-2 justify-between items-center",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>Causal Dossier</div>
          <div className={c.tag}>Pre-Analysis Plan Workbench</div>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <span className={c.tag}>{viewer.displayName ?? viewer.userSlug}</span>
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="plan-meta" className={c.section}>
          <h2 className={c.h2}>Dossier {plan.locked && <span className="text-[#fafafa]">[LOCKED]</span>}</h2>
          <div className="space-y-3">
            {allPlans.length > 1 && (
              <select
                className={c.input}
                value={activePlanId ?? ""}
                onChange={(e) => setActivePlanId(e.target.value)}
              >
                {allPlans.map((p) => (
                  <option key={p._id} value={p._id}>{p.title || "Untitled plan"}</option>
                ))}
              </select>
            )}
            <div>
              <label className={c.label}>Plan title</label>
              <input
                className={c.input}
                placeholder="e.g. Mediterranean diet pattern and incident colorectal cancer"
                value={plan.title || ""}
                onChange={(e) => mergePlan({ title: e.target.value })}
                disabled={!can("write") || plan.locked}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={c.label}>Cohort</label>
                <input
                  className={c.input}
                  placeholder="Cohort identifier"
                  value={plan.cohort || ""}
                  onChange={(e) => mergePlan({ cohort: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
              <div>
                <label className={c.label}>Registry ID</label>
                <input
                  className={c.input}
                  placeholder="OSF / PROSPERO"
                  value={plan.registryId || ""}
                  onChange={(e) => mergePlan({ registryId: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
            </div>
            {can("write") ? (
              <div className="flex gap-2 flex-wrap">
                <button className={c.btn} onClick={handleSavePlan} disabled={plan.locked}>Save Draft</button>
                <button className={c.btnGhost} onClick={handleLockVersion} disabled={!plan._id || plan.locked}>Lock Version</button>
                <button className={c.btnGhost} onClick={() => setActivePlanId(null)}>+ New Plan</button>
              </div>
            ) : (
              <p className={c.tag}>Read-only view — contact the owner for write access.</p>
            )}
          </div>
        </section>
        <section id="research-question" className={c.section}>
          <h2 className={c.h2}>Research Question</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={c.label}>Exposure (index)</label>
                <input
                  className={c.input}
                  placeholder="High adherence to Mediterranean diet"
                  value={plan.exposure || ""}
                  onChange={(e) => mergePlan({ exposure: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
              <div>
                <label className={c.label}>Comparator</label>
                <input
                  className={c.input}
                  placeholder="Low adherence"
                  value={plan.comparator || ""}
                  onChange={(e) => mergePlan({ comparator: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={c.label}>Outcome</label>
                <input
                  className={c.input}
                  placeholder="Incident colorectal cancer"
                  value={plan.outcome || ""}
                  onChange={(e) => mergePlan({ outcome: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
              <div>
                <label className={c.label}>Population</label>
                <input
                  className={c.input}
                  placeholder="Adults 45–75 at baseline"
                  value={plan.population || ""}
                  onChange={(e) => mergePlan({ population: e.target.value })}
                  disabled={!can("write") || plan.locked}
                />
              </div>
            </div>
            <div>
              <label className={c.label}>Time horizon</label>
              <input
                className={c.input}
                placeholder="20-year follow-up"
                value={plan.horizon || ""}
                onChange={(e) => mergePlan({ horizon: e.target.value })}
                disabled={!can("write") || plan.locked}
              />
            </div>
            {can("write") && !plan.locked && (
              <button
                className={c.suggest}
                disabled={suggestingQ}
                onClick={async () => {
                  setSuggestingQ(true)
                  try {
                    const r = await callAI("Suggest a concrete observational cohort research question (exposure, comparator, outcome, population, time horizon) in nutritional epidemiology of cancer. Be specific.", {
                      schema: { properties: { exposure: { type: "string" }, comparator: { type: "string" }, outcome: { type: "string" }, population: { type: "string" }, horizon: { type: "string" } } },
                    })
                    mergePlan(JSON.parse(r))
                  } finally { setSuggestingQ(false) }
                }}
              >
                {suggestingQ ? "Generating…" : "Suggest framing →"}
              </button>
            )}
          </div>
        </section>
        <section id="dag-canvas" className={c.section}>
          <h2 className={c.h2}>Causal DAG</h2>
          <div className="space-y-3">
            <div className="bg-[#0a0a0a] border border-[#2a3548] rounded-sm" style={{ height: 280 }}>
              <svg ref={dagSvgRef} width="100%" height="280" />
            </div>
            <p className={c.tag}>Tap a node to remove. {dagNodes.length === 0 && "Start with exposure + outcome."}</p>
            {can("write") && !plan.locked && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={c.input}
                    placeholder="Node label (e.g. Age)"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                  />
                  <select className={c.input} value={newNodeRole} onChange={(e) => setNewNodeRole(e.target.value)}>
                    <option value="confounder">Confounder</option>
                    <option value="exposure">Exposure</option>
                    <option value="outcome">Outcome</option>
                    <option value="mediator">Mediator</option>
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className={c.btn} onClick={addNode}>Add Node</button>
                  <button className={c.btnGhost} onClick={auditDAG} disabled={auditing || dagNodes.length < 2}>
                    {auditing ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                        Auditing…
                      </span>
                    ) : "Audit DAG"}
                  </button>
                </div>
              </>
            )}
            <div className={c.row}>
              <div className={c.label}>Adjustment set</div>
              <div className="text-sm">
                {plan.dagAudit?.adjustmentSet?.length ? plan.dagAudit.adjustmentSet.join(", ") : "— run Audit DAG to derive"}
              </div>
            </div>
            {plan.dagAudit && (
              <div className={c.row}>
                <div className={c.label}>AI Audit ({plan.dagAuditAt ? new Date(plan.dagAuditAt).toISOString().slice(0,16).replace("T"," ") : ""})</div>
                {plan.dagAudit.missingConfounders?.length > 0 && (
                  <div className="mt-2"><span className={c.tag}>Missing:</span> {plan.dagAudit.missingConfounders.join(", ")}</div>
                )}
                {plan.dagAudit.implausibleArrows?.length > 0 && (
                  <div className="mt-1"><span className={c.tag}>Implausible:</span> {plan.dagAudit.implausibleArrows.join("; ")}</div>
                )}
                {plan.dagAudit.unstatedAssumptions?.length > 0 && (
                  <div className="mt-1"><span className={c.tag}>Assumptions:</span> {plan.dagAudit.unstatedAssumptions.join("; ")}</div>
                )}
                {plan.dagAudit.commentary && <div className="mt-2 text-xs opacity-80">{plan.dagAudit.commentary}</div>}
              </div>
            )}
          </div>
        </section>
        <section id="analysis-spec" className={c.section}>
          <h2 className={c.h2}>Analysis Specification</h2>
          <div className="space-y-3">
            <div>
              <label className={c.label}>Measure of association</label>
              <select
                className={c.input}
                value={plan.measure || ""}
                onChange={(e) => mergePlan({ measure: e.target.value })}
                disabled={!can("write") || plan.locked}
              >
                <option value="">Select…</option>
                <option value="hr">Hazard ratio (Cox PH)</option>
                <option value="rr">Risk ratio</option>
                <option value="rd">Risk difference</option>
                <option value="or">Odds ratio</option>
              </select>
            </div>
            <div>
              <label className={c.label}>Model specification</label>
              <textarea
                className={c.textarea}
                placeholder="e.g. Cox PH stratified by enrollment year, with adjustment set from DAG..."
                value={plan.modelSpec || ""}
                onChange={(e) => mergePlan({ modelSpec: e.target.value })}
                disabled={!can("write") || plan.locked}
              />
            </div>
            <div>
              <label className={c.label}>Pre-specified subgroups (effect modification)</label>
              <div className="space-y-2 text-xs">
                {["sex", "raceEthnicity", "ageBaseline", "familyHistory"].map((key) => {
                  const labels = { sex: "Sex", raceEthnicity: "Race / ethnicity", ageBaseline: "Age at baseline (tertiles)", familyHistory: "Family history" }
                  const subgroups = plan.subgroups || {}
                  return (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!subgroups[key]}
                        onChange={(e) => mergePlan({ subgroups: { ...subgroups, [key]: e.target.checked } })}
                        disabled={!can("write") || plan.locked}
                      />
                      {labels[key]}
                    </label>
                  )
                })}
              </div>
              <input
                className={`${c.input} mt-2`}
                placeholder="Other subgroup (free text, comma-separated)"
                value={plan.subgroupsOther || ""}
                onChange={(e) => mergePlan({ subgroupsOther: e.target.value })}
                disabled={!can("write") || plan.locked}
              />
            </div>
          </div>
        </section>
        <section id="validity-threats" className={c.section}>
          <h2 className={c.h2}>Threats to Validity & Sensitivity Analyses</h2>
          <div className="space-y-3">
            {can("write") && !plan.locked && activePlanId && (
              <div className="grid grid-cols-1 gap-2">
                <input
                  className={c.input}
                  placeholder="Threat (e.g. Differential loss to follow-up)"
                  value={threatLabel}
                  onChange={(e) => setThreatLabel(e.target.value)}
                />
                <select className={c.input} value={threatCategory} onChange={(e) => setThreatCategory(e.target.value)}>
                  <option value="selection">Selection bias</option>
                  <option value="confounding">Residual confounding</option>
                  <option value="information">Information / misclassification</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  className={c.textarea}
                  placeholder="Planned mitigation or sensitivity analysis..."
                  value={threatMitigation}
                  onChange={(e) => setThreatMitigation(e.target.value)}
                />
                <div className="flex gap-2 flex-wrap">
                  <button className={c.btn} onClick={addThreat}>Add Threat</button>
                  <button className={c.suggest} onClick={suggestThreats} disabled={suggestingThreats}>
                    {suggestingThreats ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                        Drafting…
                      </span>
                    ) : "Suggest 3 threats →"}
                  </button>
                </div>
              </div>
            )}
            {threats.length === 0 ? (
              <p className={c.tag}>No threats listed yet.</p>
            ) : (
              <ul className="space-y-2">
                {threats.map((t) => (
                  <li key={t._id} className={c.row}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-xs uppercase tracking-widest text-[#8a95a8]">{t.category}{t.aiGenerated && " · AI"}</div>
                        <div className="font-bold text-sm mt-1">{t.label}</div>
                        {t.mitigation && <div className="text-xs mt-1 opacity-80">{t.mitigation}</div>}
                      </div>
                      {can("write") && !plan.locked && (
                        <button
                          className="text-xs text-[#8a95a8] hover:text-[#fafafa]"
                          onClick={() => database.del(t._id)}
                          aria-label="Delete threat"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section id="version-history" className={c.section}>
          <h2 className={c.h2}>Version History</h2>
          <VersionList planId={activePlanId} />
        </section>
      </main>
    </div>
  )
}