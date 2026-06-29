import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AuditEntry({ c, canWrite, onSubmit }) {
  const [text, setText] = React.useState("")
  if (!canWrite) return <p className={c.readonly}>Read-only view — audit log is append-only and visible above.</p>
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onSubmit(text.trim())
        setText("")
      }}
    >
      <input className={c.input} placeholder="Log an analytic decision…" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className={c.btn}>Log</button>
    </form>
  )
}

function PackageCompare({ c, policies, packages, database, canWrite, viewer, onLog }) {
  const [name, setName] = React.useState("")
  const [picked, setPicked] = React.useState([])
  const [activePackageId, setActivePackageId] = React.useState(null)
  const svgRef = React.useRef(null)
  const activePackage = packages.find((p) => p._id === activePackageId) || packages[0] || null

  const packageMetrics = React.useMemo(() => {
    return packages.map((pkg) => {
      const pickedPolicies = policies.filter((p) => pkg.policyIds?.includes(p._id))
      const avg = (k) => pickedPolicies.length === 0 ? 0 : Math.round(pickedPolicies.reduce((s, p) => s + (p[k] ?? 0), 0) / pickedPolicies.length)
      return {
        id: pkg._id,
        name: pkg.name,
        emissions: avg("emissionsScore"),
        equity: avg("equityScore"),
        fiscal: avg("fiscalScore"),
        feasibility: avg("feasibilityScore"),
      }
    })
  }, [packages, policies])

  React.useEffect(() => {
    if (!svgRef.current || packageMetrics.length === 0) return
    const dims = ["emissions", "equity", "fiscal", "feasibility"]
    const width = 600, height = 240, margin = { top: 16, right: 16, bottom: 32, left: 36 }
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${width} ${height}`).style("max-width", "100%").style("height", "auto")
    const x0 = d3.scaleBand().domain(dims).range([margin.left, width - margin.right]).padding(0.2)
    const x1 = d3.scaleBand().domain(packageMetrics.map((p) => p.id)).range([0, x0.bandwidth()]).padding(0.1)
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top])
    const color = d3.scaleOrdinal().domain(packageMetrics.map((p) => p.id)).range(["#d93a1f", "#e89446", "#4a9eff", "#7a8194"])
    const g = svg.append("g")
    dims.forEach((dim) => {
      g.selectAll(`.bar-${dim}`).data(packageMetrics).enter().append("rect")
        .attr("x", (d) => x0(dim) + x1(d.id))
        .attr("y", (d) => y(d[dim]))
        .attr("width", x1.bandwidth())
        .attr("height", (d) => y(0) - y(d[dim]))
        .attr("fill", (d) => color(d.id))
    })
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x0)).selectAll("text").attr("fill", "#7a8194").style("font-size", "10px")
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5)).selectAll("text").attr("fill", "#7a8194").style("font-size", "10px")
    svg.selectAll(".domain, .tick line").attr("stroke", "#3a3f4d")
  }, [packageMetrics])

  return (
    <div className="space-y-3">
      {canWrite ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim() || picked.length === 0) return
            await database.put({
              type: "package",
              name: name.trim(),
              policyIds: picked,
              createdAt: Date.now(),
              createdBy: viewer?.userSlug || "anonymous",
            })
            onLog(`Created package: ${name.trim()} (${picked.length} policies)`)
            setName(""); setPicked([])
          }}
        >
          <div>
            <label className={c.label}>Package Name</label>
            <input className={c.input} placeholder="e.g. Aggressive Price + Weak Complements" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={c.label}>Include Policies</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border border-[#3a3f4d] rounded p-2">
              {policies.length === 0 && <p className="text-[10px] text-[#7a8194]">No policies in library yet.</p>}
              {policies.map((p) => (
                <label key={p._id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={picked.includes(p._id)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, p._id] : picked.filter((id) => id !== p._id))}
                  />
                  {p.name || "(unnamed)"}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className={c.btn}>Save Package</button>
        </form>
      ) : (
        <p className={c.readonly}>Read-only view — contact the owner for write access to compose packages.</p>
      )}
      {packages.length > 0 && (
        <>
          <div className="flex gap-2 flex-wrap pt-2">
            {packages.map((pkg) => (
              <button
                key={pkg._id}
                type="button"
                onClick={() => setActivePackageId(pkg._id)}
                className={`${c.btnSmall} ${activePackage?._id === pkg._id ? "border-[#d93a1f]" : ""}`}
              >
                {pkg.name}
              </button>
            ))}
          </div>
          <div className="bg-[#000000] border border-[#3a3f4d] rounded p-2 mt-2">
            <svg ref={svgRef} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {packageMetrics.map((m) => (
              <div key={m.id} className="border border-[#3a3f4d] rounded p-2">
                <div className="font-bold text-xs mb-1">{m.name}</div>
                <div className="text-[#7a8194]">Emissions: {m.emissions} · Equity: {m.equity}</div>
                <div className="text-[#7a8194]">Fiscal: {m.fiscal} · Feasibility: {m.feasibility}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("recon-grid-policy")
  const { docs: policies } = useLiveQuery("type", { key: "policy", descending: true })
  const { docs: critiques } = useLiveQuery("type", { key: "critique", descending: true })
  const { docs: audits } = useLiveQuery("type", { key: "audit", descending: true })
  const { docs: packages } = useLiveQuery("type", { key: "package", descending: true })
  const [selectedPolicyId, setSelectedPolicyId] = React.useState(null)
  const [critiqueLoading, setCritiqueLoading] = React.useState(false)
  const selectedPolicy = policies.find((p) => p._id === selectedPolicyId) || policies[0] || null

  const { doc: newPolicy, merge: mergeNewPolicy, submit: submitNewPolicy } = useDocument({
    type: "policy",
    name: "",
    instrument: "",
    sector: "",
    designParams: "",
    emissionsPathway: "",
    timeline: "",
    costAssumptions: "",
    lifeCycleNotes: "",
    equityNarrative: "",
    frontlineImpact: "",
    vulnerabilityOverlay: "",
    emissionsScore: 50,
    equityScore: 50,
    fiscalScore: 50,
    feasibilityScore: 50,
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })

  async function logDecision(text, policyId) {
    if (!can("write")) return
    await database.put({
      type: "audit",
      text,
      policyId: policyId || null,
      createdAt: Date.now(),
      createdBy: viewer?.userSlug || "anonymous",
      authorName: viewer?.displayName ?? viewer?.userSlug ?? "analyst",
    })
  }

  async function suggestPolicy() {
    if (!can("write")) return
    try {
      const r = await callAI("Suggest one realistic candidate state-level climate mitigation policy with a name, instrument type (Price/Standard/Incentive/Mandate), and lead sector.", {
        schema: { properties: { name: { type: "string" }, instrument: { type: "string" }, sector: { type: "string" } } }
      })
      const s = JSON.parse(r)
      mergeNewPolicy({ name: s.name, instrument: s.instrument, sector: s.sector })
    } catch (e) { console.error(e) }
  }

  const c = {
    page: "min-h-screen bg-[#000000] text-[#f5f6f8] font-mono",
    header: "sticky top-0 z-10 bg-[#000000]/95 border-b border-[#3a3f4d] backdrop-blur px-4 py-3",
    title: "text-lg font-bold tracking-tight text-[#f5f6f8]",
    tagline: "text-xs text-[#7a8194] mt-0.5",
    viewerChip: "flex items-center gap-2 text-xs text-[#7a8194]",
    avatar: "w-6 h-6 rounded-full border border-[#3a3f4d]",
    main: "max-w-5xl mx-auto px-3 py-4 space-y-4 pb-24",
    section: "bg-[#0a0a12]/80 border border-[#3a3f4d] rounded-md p-4",
    sectionHead: "flex items-center justify-between mb-3 pb-2 border-b border-[#3a3f4d]",
    sectionTitle: "text-sm font-bold uppercase tracking-widest text-[#f5f6f8]",
    sectionMeta: "text-[10px] uppercase tracking-wider text-[#7a8194]",
    btn: "min-h-[44px] px-4 py-2 bg-[#d93a1f] hover:bg-[#b8311a] text-white text-sm font-semibold rounded uppercase tracking-wider disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a3f4d] hover:border-[#d93a1f] text-[#f5f6f8] text-xs rounded uppercase tracking-wider",
    btnSmall: "px-2 py-1 text-[10px] uppercase tracking-wider border border-[#3a3f4d] hover:border-[#d93a1f] rounded text-[#f5f6f8]",
    input: "w-full bg-[#000000] border border-[#3a3f4d] focus:border-[#d93a1f] rounded px-3 py-2 text-sm text-[#f5f6f8] placeholder:text-[#5a6070]",
    textarea: "w-full bg-[#000000] border border-[#3a3f4d] focus:border-[#d93a1f] rounded px-3 py-2 text-sm text-[#f5f6f8] placeholder:text-[#5a6070] min-h-[80px]",
    label: "block text-[10px] uppercase tracking-wider text-[#7a8194] mb-1",
    row: "border border-[#3a3f4d] rounded p-3 bg-[#000000]/60",
    readonly: "text-xs text-[#7a8194] italic border border-dashed border-[#3a3f4d] rounded p-3",
    bottomBar: "fixed bottom-0 left-0 right-0 bg-[#000000]/95 border-t border-[#3a3f4d] backdrop-blur px-4 py-2 flex gap-2 overflow-x-auto",
    tab: "min-h-[40px] px-3 py-1 text-[10px] uppercase tracking-wider rounded whitespace-nowrap border border-[#3a3f4d]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={c.title}>RECON GRID // POLICY ASSESSMENT</h1>
            <p className={c.tagline}>State energy transition portfolio — analytic workbench</p>
          </div>
          {viewer && (
            <div className={c.viewerChip}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="policy-library" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>01 · Policy Library</h2>
            <span className={c.sectionMeta}>{policies.length} Candidate{policies.length === 1 ? "" : "s"}</span>
          </div>
          {can("write") ? (
            <form
              className="space-y-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newPolicy.name.trim()) return
                submitNewPolicy()
                logDecision(`Added policy: ${newPolicy.name}`)
              }}
            >
              <div>
                <label className={c.label}>Policy Name</label>
                <input
                  className={c.input}
                  placeholder="e.g. Carbon Pricing Mechanism"
                  value={newPolicy.name}
                  onChange={(e) => mergeNewPolicy({ name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={c.label}>Instrument Type</label>
                  <input
                    className={c.input}
                    placeholder="Price / Standard / Incentive"
                    value={newPolicy.instrument}
                    onChange={(e) => mergeNewPolicy({ instrument: e.target.value })}
                  />
                </div>
                <div>
                  <label className={c.label}>Lead Sector</label>
                  <input
                    className={c.input}
                    placeholder="Power / Buildings / Transport"
                    value={newPolicy.sector}
                    onChange={(e) => mergeNewPolicy({ sector: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={c.btn}>Add Policy</button>
                <button type="button" onClick={suggestPolicy} className={c.btnGhost}>AI Suggest</button>
              </div>
            </form>
          ) : (
            <p className={c.readonly}>Read-only view — contact the owner for write access to add policies.</p>
          )}
          <ul className="space-y-2">
            {policies.length === 0 && (
              <li className="text-xs text-[#7a8194] italic">No policies yet. Add a candidate mitigation above.</li>
            )}
            {policies.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => setSelectedPolicyId(p._id)}
                  className={`${c.row} w-full text-left ${selectedPolicy?._id === p._id ? "border-[#d93a1f]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{p.name || "(unnamed)"}</span>
                    <span className="text-[10px] text-[#7a8194]">{p.instrument || "—"} · {p.sector || "—"}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section id="policy-detail" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>02 · Policy Detail</h2>
            <span className={c.sectionMeta}>Assumptions & Pathways</span>
          </div>
          {!selectedPolicy ? (
            <p className="text-xs text-[#7a8194] italic">Select a policy from the library to edit its assumptions.</p>
          ) : !can("write") ? (
            <div className="space-y-3 text-xs">
              <div><span className={c.label}>Policy</span><p>{selectedPolicy.name}</p></div>
              <div><span className={c.label}>Emissions Pathway</span><p>{selectedPolicy.emissionsPathway || "—"}</p></div>
              <div><span className={c.label}>Equity Narrative</span><p>{selectedPolicy.equityNarrative || "—"}</p></div>
              <p className={c.readonly}>Read-only view — contact the owner for write access.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-bold">{selectedPolicy.name}</div>
              <div>
                <label className={c.label}>Design Parameters</label>
                <textarea
                  className={c.textarea}
                  placeholder="Coverage, stringency, exemptions, implementation year…"
                  value={selectedPolicy.designParams || ""}
                  onChange={(e) => database.put({ ...selectedPolicy, designParams: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Emissions Reduction Pathway</label>
                <textarea
                  className={c.textarea}
                  placeholder="MtCO2e/yr trajectory, sectoral attribution, baseline year…"
                  value={selectedPolicy.emissionsPathway || ""}
                  onChange={(e) => database.put({ ...selectedPolicy, emissionsPathway: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={c.label}>Timeline</label>
                  <input
                    className={c.input}
                    placeholder="2025–2040"
                    value={selectedPolicy.timeline || ""}
                    onChange={(e) => database.put({ ...selectedPolicy, timeline: e.target.value })}
                  />
                </div>
                <div>
                  <label className={c.label}>Cost Assumptions</label>
                  <input
                    className={c.input}
                    placeholder="$/tCO2e, fiscal impact…"
                    value={selectedPolicy.costAssumptions || ""}
                    onChange={(e) => database.put({ ...selectedPolicy, costAssumptions: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={c.label}>Life-Cycle / Supply-Chain Notes</label>
                <textarea
                  className={c.textarea}
                  placeholder="Embodied emissions, grid mix assumptions, upstream impacts…"
                  value={selectedPolicy.lifeCycleNotes || ""}
                  onChange={(e) => database.put({ ...selectedPolicy, lifeCycleNotes: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Equity Narrative — Frontline & Disinvested Communities</label>
                <textarea
                  className={c.textarea}
                  placeholder="Distributional impact, cumulative burden, just-transition provisions…"
                  value={selectedPolicy.equityNarrative || ""}
                  onChange={(e) => database.put({ ...selectedPolicy, equityNarrative: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Climate Vulnerability Overlay</label>
                <textarea
                  className={c.textarea}
                  placeholder="Adaptation funding vs. measured vulnerability index, geographic targeting…"
                  value={selectedPolicy.vulnerabilityOverlay || ""}
                  onChange={(e) => database.put({ ...selectedPolicy, vulnerabilityOverlay: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {["emissionsScore", "equityScore", "fiscalScore", "feasibilityScore"].map((k) => (
                  <div key={k}>
                    <label className={c.label}>{k.replace("Score", "")} (0–100)</label>
                    <input
                      type="range" min="0" max="100"
                      value={selectedPolicy[k] ?? 50}
                      onChange={(e) => database.put({ ...selectedPolicy, [k]: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-[10px] text-[#7a8194]">{selectedPolicy[k] ?? 50}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={c.btnGhost}
                onClick={() => logDecision(`Updated detail for ${selectedPolicy.name}`, selectedPolicy._id)}
              >
                Log Decision
              </button>
            </div>
          )}
        </section>

        <section id="ai-critique" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>03 · AI Critique & Uncertainty</h2>
            <span className={c.sectionMeta}>Assumption Audit</span>
          </div>
          {!selectedPolicy ? (
            <p className="text-xs text-[#7a8194] italic">Select a policy to request a structured critique.</p>
          ) : (
            <>
              {can("write") && (
                <button
                  type="button"
                  disabled={critiqueLoading}
                  className={`${c.btn} mb-3 inline-flex items-center gap-2`}
                  onClick={async () => {
                    setCritiqueLoading(true)
                    try {
                      const prompt = `Review this state-level climate policy assessment for assumption gaps, missing equity considerations, and uncertainty bounds. Policy: ${selectedPolicy.name}. Instrument: ${selectedPolicy.instrument}. Sector: ${selectedPolicy.sector}. Design: ${selectedPolicy.designParams}. Emissions pathway: ${selectedPolicy.emissionsPathway}. Cost: ${selectedPolicy.costAssumptions}. Life-cycle: ${selectedPolicy.lifeCycleNotes}. Equity: ${selectedPolicy.equityNarrative}. Vulnerability: ${selectedPolicy.vulnerabilityOverlay}.`
                      const r = await callAI(prompt, {
                        schema: {
                          properties: {
                            assumptionGaps: { type: "array", items: { type: "string" } },
                            missingEquity: { type: "array", items: { type: "string" } },
                            uncertaintyBounds: { type: "string" },
                            uncertaintyParagraph: { type: "string" },
                          },
                        },
                      })
                      const parsed = JSON.parse(r)
                      await database.put({
                        type: "critique",
                        policyId: selectedPolicy._id,
                        policyName: selectedPolicy.name,
                        ...parsed,
                        createdAt: Date.now(),
                        createdBy: viewer?.userSlug || "anonymous",
                      })
                      await logDecision(`AI critique generated for ${selectedPolicy.name}`, selectedPolicy._id)
                    } catch (e) { console.error(e) } finally { setCritiqueLoading(false) }
                  }}
                >
                  {critiqueLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" strokeDasharray="40 20" strokeLinecap="round" />
                      </svg>
                      Reviewing…
                    </>
                  ) : "Request AI Critique"}
                </button>
              )}
              <ul className="space-y-3">
                {critiques.filter((cr) => cr.policyId === selectedPolicy._id).length === 0 && (
                  <li className="text-xs text-[#7a8194] italic">No critiques yet for this policy.</li>
                )}
                {critiques.filter((cr) => cr.policyId === selectedPolicy._id).map((cr) => (
                  <li key={cr._id} className={c.row}>
                    <div className="text-[10px] text-[#7a8194] mb-2">{new Date(cr.createdAt).toLocaleString()}</div>
                    {cr.assumptionGaps?.length > 0 && (
                      <div className="mb-2">
                        <div className={c.label}>Assumption Gaps</div>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {cr.assumptionGaps.map((g, i) => <li key={i}>{g}</li>)}
                        </ul>
                      </div>
                    )}
                    {cr.missingEquity?.length > 0 && (
                      <div className="mb-2">
                        <div className={c.label}>Missing Equity Considerations</div>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {cr.missingEquity.map((g, i) => <li key={i}>{g}</li>)}
                        </ul>
                      </div>
                    )}
                    {cr.uncertaintyBounds && (
                      <div className="mb-2">
                        <div className={c.label}>Uncertainty Bounds</div>
                        <p className="text-xs">{cr.uncertaintyBounds}</p>
                      </div>
                    )}
                    {cr.uncertaintyParagraph && (
                      <div>
                        <div className={c.label}>Draft Uncertainty Discussion</div>
                        <p className="text-xs">{cr.uncertaintyParagraph}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section id="package-compare" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>04 · Package Comparison</h2>
            <span className={c.sectionMeta}>Tradeoff Analysis</span>
          </div>
          <PackageCompare
            c={c}
            policies={policies}
            packages={packages}
            database={database}
            canWrite={can("write")}
            viewer={viewer}
            onLog={logDecision}
          />
        </section>

        <section id="audit-log" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>05 · Audit Log</h2>
            <span className={c.sectionMeta}>{audits.length} Entries · Append-only</span>
          </div>
          <AuditEntry c={c} canWrite={can("write")} onSubmit={(text) => logDecision(text, selectedPolicy?._id)} />
          <ul className="space-y-2 mt-3 max-h-64 overflow-y-auto">
            {audits.length === 0 && <li className="text-xs text-[#7a8194] italic">No decisions logged yet.</li>}
            {audits.map((a) => (
              <li key={a._id} className={c.row}>
                <div className="text-[10px] text-[#7a8194]">{new Date(a.createdAt).toLocaleString()} · {a.authorName}</div>
                <div className="text-xs mt-1">{a.text}</div>
              </li>
            ))}
          </ul>
        </section>

        <section id="briefing-report" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>06 · Legislative Briefing</h2>
            <span className={c.sectionMeta}>Compiled Report</span>
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <div className={c.label}>Chapter 1 — Portfolio Overview</div>
              <p>{policies.length} candidate policies under assessment across {new Set(policies.map((p) => p.sector).filter(Boolean)).size || 0} sectors.</p>
            </div>
            <div>
              <div className={c.label}>Chapter 2 — Policy Records</div>
              {policies.length === 0 ? (
                <p className="text-[#7a8194] italic">No policies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {policies.map((p) => (
                    <li key={p._id} className={c.row}>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[10px] text-[#7a8194] mb-1">{p.instrument} · {p.sector} · {p.timeline || "—"}</div>
                      {p.emissionsPathway && <p className="mt-1"><span className="text-[#7a8194]">Emissions: </span>{p.emissionsPathway}</p>}
                      {p.costAssumptions && <p><span className="text-[#7a8194]">Cost: </span>{p.costAssumptions}</p>}
                      {p.equityNarrative && <p><span className="text-[#7a8194]">Equity: </span>{p.equityNarrative}</p>}
                      {p.vulnerabilityOverlay && <p><span className="text-[#7a8194]">Vulnerability: </span>{p.vulnerabilityOverlay}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className={c.label}>Chapter 3 — Uncertainty Discussion</div>
              {critiques.length === 0 ? (
                <p className="text-[#7a8194] italic">No AI critiques compiled.</p>
              ) : (
                <ul className="space-y-2">
                  {critiques.map((cr) => (
                    <li key={cr._id} className={c.row}>
                      <div className="font-bold">{cr.policyName}</div>
                      {cr.uncertaintyParagraph && <p className="mt-1">{cr.uncertaintyParagraph}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className={c.label}>Chapter 4 — Analytic Decision Trail</div>
              <p className="text-[#7a8194]">{audits.length} logged decisions available in §05.</p>
            </div>
            {can("write") && (
              <button
                type="button"
                className={c.btnGhost}
                onClick={() => window.print()}
              >
                Print Briefing
              </button>
            )}
          </div>
        </section>
      </main>

      <nav className={c.bottomBar} aria-label="Section jump">
        <a href="#policy-library" className={c.tab}>Library</a>
        <a href="#policy-detail" className={c.tab}>Detail</a>
        <a href="#ai-critique" className={c.tab}>Critique</a>
        <a href="#package-compare" className={c.tab}>Compare</a>
        <a href="#audit-log" className={c.tab}>Audit</a>
        <a href="#briefing-report" className={c.tab}>Brief</a>
      </nav>
    </div>
  )
}