import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Dashboard({ reviews }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (!ref.current) return
    const counts = d3.rollup(reviews.filter(r => r.design), v => v.length, d => d.design)
    const data = Array.from(counts, ([design, count]) => ({ design, count }))
    const width = 360, height = Math.max(120, data.length * 28 + 20), margin = { left: 110, right: 30, top: 10, bottom: 10 }
    d3.select(ref.current).selectAll("*").remove()
    if (data.length === 0) {
      d3.select(ref.current).append("div").attr("class","text-xs text-[#9ca3af] italic py-4 text-center").text("No data yet — file a dossier.")
      return
    }
    const svg = d3.select(ref.current).append("svg").attr("viewBox", `0 0 ${width} ${height}`).style("max-width","100%")
    const y = d3.scaleBand().domain(data.map(d => d.design)).range([margin.top, height - margin.bottom]).padding(0.2)
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).range([margin.left, width - margin.right])
    svg.selectAll("rect").data(data).enter().append("rect")
      .attr("x", margin.left).attr("y", d => y(d.design))
      .attr("width", d => x(d.count) - margin.left).attr("height", y.bandwidth())
      .attr("fill", "#fafafa")
    svg.selectAll("text.label").data(data).enter().append("text").attr("class","label")
      .attr("x", margin.left - 6).attr("y", d => y(d.design) + y.bandwidth() / 2 + 3)
      .attr("text-anchor","end").attr("fill","#9ca3af")
      .style("font-size","8px").style("font-family","monospace").style("text-transform","uppercase")
      .text(d => d.design.length > 18 ? d.design.slice(0,16) + "…" : d.design)
    svg.selectAll("text.count").data(data).enter().append("text").attr("class","count")
      .attr("x", d => x(d.count) + 4).attr("y", d => y(d.design) + y.bandwidth() / 2 + 3)
      .attr("fill","#fafafa").style("font-size","10px").style("font-family","monospace")
      .text(d => d.count)
  }, [reviews])
  return <div ref={ref} />
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("grant-review-hub")
  const designOptions = [
    "Randomized Controlled Trial","Regression Discontinuity","Difference-in-Differences",
    "Instrumental Variables","Propensity Score Methods","Matching Estimators",
    "Synthetic Controls","Panel Data Methods","Two-Stage Least Squares",
  ]
  const { doc, merge, submit } = useDocument({
    type: "review",
    title: "", treatment: "", outcome: "", population: "",
    design: "", assumption: "", credibility: "",
    aiCritique: null, createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
    createdByName: viewer?.displayName || viewer?.userSlug || "anonymous",
  })
  const { docs: reviews } = useLiveQuery("type", { key: "review", descending: true })
  const [critiqueLoading, setCritiqueLoading] = React.useState(false)
  const [sampleLoading, setSampleLoading] = React.useState(false)

  async function runCritique() {
    if (!doc.design || !doc.assumption) return
    setCritiqueLoading(true)
    try {
      const res = await callAI(
        `Design family: ${doc.design}. Identifying assumption: ${doc.assumption}. Treatment: ${doc.treatment}. Outcome: ${doc.outcome}. List threats to validity, suggested robustness checks, and likely unaddressed confounders.`,
        { schema: { properties: {
          threats: { type: "array", items: { type: "string" } },
          robustness: { type: "array", items: { type: "string" } },
          confounders: { type: "array", items: { type: "string" } },
        } } }
      )
      merge({ aiCritique: JSON.parse(res) })
    } finally { setCritiqueLoading(false) }
  }

  async function suggestSample() {
    setSampleLoading(true)
    try {
      const res = await callAI(
        "Generate one realistic federal program evaluation review entry.",
        { schema: { properties: {
          title: { type: "string" }, treatment: { type: "string" },
          outcome: { type: "string" }, population: { type: "string" },
          design: { type: "string", description: `one of: ${designOptions.join(", ")}` },
          assumption: { type: "string" },
        } } }
      )
      const ex = JSON.parse(res)
      merge(ex)
    } finally { setSampleLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[#282828] text-[#fafafa] font-mono",
    header: "sticky top-0 z-10 bg-[#000000] border-b border-[#3a4a6b] px-4 py-4 flex items-center justify-between",
    title: "text-lg font-black tracking-tight uppercase",
    titleAccent: "text-[#fafafa]",
    subtitle: "text-[10px] text-[#9ca3af] uppercase tracking-widest mt-0.5",
    avatar: "w-8 h-8 rounded-full border border-[#3a4a6b]",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24",
    section: "bg-[#000000] border border-[#3a4a6b] rounded-sm p-4",
    sectionTitle: "text-xs uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#3a4a6b]",
    label: "block text-[10px] uppercase tracking-widest text-[#9ca3af] mb-1",
    input: "w-full bg-[#282828] border border-[#3a4a6b] text-[#fafafa] px-3 py-3 min-h-[44px] rounded-sm text-sm focus:outline-none focus:border-[#fafafa]",
    select: "w-full bg-[#282828] border border-[#3a4a6b] text-[#fafafa] px-3 py-3 min-h-[44px] rounded-sm text-sm",
    btn: "w-full bg-[#fafafa] text-[#000000] py-3 px-4 min-h-[44px] rounded-sm text-xs uppercase tracking-widest font-bold hover:bg-[#9ca3af] disabled:opacity-50",
    btnGhost: "px-3 py-2 border border-[#3a4a6b] text-[#fafafa] text-[10px] uppercase tracking-widest rounded-sm hover:border-[#fafafa]",
    row: "border-b border-[#3a4a6b] py-3 last:border-0",
    badge: "inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest border border-[#3a4a6b] rounded-sm",
    empty: "text-xs text-[#9ca3af] italic py-4 text-center",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}><span className={c.titleAccent}>Grant Review</span> Hub</h1>
          <p className={c.subtitle}>Causal Claim Audit · Classified Methods</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>

      <main id="app" className={c.main}>
        <section id="intake" className={c.section}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#3a4a6b]">
            <h2 className="text-xs uppercase tracking-widest font-bold">▸ New Review Dossier</h2>
            {can("write") && (
              <button type="button" onClick={suggestSample} disabled={sampleLoading} className={c.btnGhost}>
                {sampleLoading ? "…" : "Suggest"}
              </button>
            )}
          </div>
          {!can("write") ? (
            <p className={c.empty}>Read-only archive — contact the head of methods for write access.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className={c.label}>Grantee / Report Title</label>
                <input className={c.input} value={doc.title} onChange={(e) => merge({ title: e.target.value })} placeholder="e.g. Acme Labs — Workforce Pilot 2023" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Claimed Treatment</label>
                  <input className={c.input} value={doc.treatment} onChange={(e) => merge({ treatment: e.target.value })} placeholder="Intervention" />
                </div>
                <div>
                  <label className={c.label}>Claimed Outcome</label>
                  <input className={c.input} value={doc.outcome} onChange={(e) => merge({ outcome: e.target.value })} placeholder="Measured effect" />
                </div>
              </div>
              <div>
                <label className={c.label}>Target Population</label>
                <input className={c.input} value={doc.population} onChange={(e) => merge({ population: e.target.value })} placeholder="Who the claim applies to" />
              </div>
              <div>
                <label className={c.label}>Design Family</label>
                <select className={c.select} value={doc.design} onChange={(e) => merge({ design: e.target.value })}>
                  <option value="">— select design —</option>
                  {designOptions.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={c.label}>Identifying Assumption</label>
                <textarea className={c.input} rows="3" value={doc.assumption} onChange={(e) => merge({ assumption: e.target.value })} placeholder="e.g. parallel trends, exclusion restriction…" />
              </div>
              <div>
                <label className={c.label}>Credibility Rubric (1–5)</label>
                <select className={c.select} value={doc.credibility} onChange={(e) => merge({ credibility: e.target.value })}>
                  <option value="">— rate —</option>
                  <option value="1">1 — Not credible</option>
                  <option value="2">2 — Weak</option>
                  <option value="3">3 — Moderate</option>
                  <option value="4">4 — Strong</option>
                  <option value="5">5 — Exemplary</option>
                </select>
              </div>
              <button type="submit" className={c.btn} disabled={!doc.title}>File Dossier</button>
            </form>
          )}
        </section>

        <section id="reports" className={c.section}>
          <h2 className={c.sectionTitle}>▸ Filed Dossiers</h2>
          {reviews.length === 0 ? (
            <p className={c.empty}>No dossiers on record.</p>
          ) : (
            <ul>
              {reviews.map((r) => (
                <li key={r._id} className={c.row}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{r.title || "Untitled"}</div>
                      <div className="text-[11px] text-[#9ca3af] mt-1 truncate">{r.treatment} → {r.outcome}</div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {r.design && <span className={c.badge}>{r.design}</span>}
                        {r.credibility && <span className={c.badge}>RUBRIC {r.credibility}/5</span>}
                      </div>
                    </div>
                    {can("write") && (
                      <button onClick={() => database.del(r._id)} className={c.btnGhost} aria-label="Remove">×</button>
                    )}
                  </div>
                  <div className="text-[10px] text-[#9ca3af] mt-2 uppercase tracking-widest">
                    Reviewer · {r.createdByName}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="critique" className={c.section}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#3a4a6b]">
            <h2 className="text-xs uppercase tracking-widest font-bold">▸ Methods Critique</h2>
            {can("write") && (
              <button type="button" onClick={runCritique} disabled={critiqueLoading || !doc.design || !doc.assumption} className={c.btnGhost}>
                {critiqueLoading ? (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                  </svg>
                ) : "Run"}
              </button>
            )}
          </div>
          {!doc.aiCritique ? (
            <p className={c.empty}>{doc.design && doc.assumption ? "Tap RUN to analyze design & assumption." : "Fill design + assumption first."}</p>
          ) : (
            <div className="space-y-3 text-xs">
              {["threats","robustness","confounders"].map((k) => (
                <div key={k}>
                  <div className={c.label}>{k === "threats" ? "Threats to validity" : k === "robustness" ? "Suggested robustness checks" : "Unaddressed confounders"}</div>
                  <ul className="space-y-1">
                    {(doc.aiCritique[k] || []).map((x, i) => (
                      <li key={i} className="border-l-2 border-[#3a4a6b] pl-2 text-[#fafafa]">{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="dashboard" className={c.section}>
          <h2 className={c.sectionTitle}>▸ Portfolio Telemetry</h2>
          <Dashboard reviews={reviews} />
        </section>
      </main>
    </div>
  )
}