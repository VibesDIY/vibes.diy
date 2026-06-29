import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ExemplaryList({ c }) {
  const { useLiveQuery } = useFireproof("causal-workshop")
  const { docs } = useLiveQuery("exemplary", { key: true })
  if (docs.length === 0) return <p className={c.muted}>No exemplary answers yet — instructors can mark them in the dashboard above.</p>
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d._id} className="border border-[#fbbf24] bg-[#fffbeb] rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">★ {d.authorName}</span>
            <span className={c.pill}>{d.design}</span>
          </div>
          <p className="text-xs text-[#44403c] mt-2"><strong>Assumption:</strong> {d.assumption}</p>
          <p className="text-xs text-[#44403c] mt-1"><strong>Defense:</strong> {d.defense}</p>
        </li>
      ))}
    </ul>
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
  return <svg ref={ref}></svg>
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("causal-workshop")
  const { doc: newScenario, merge: mergeScenario, submit: submitScenario } = useDocument({
    type: "scenario", title: "", body: "", createdAt: Date.now()
  })
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario", descending: true })
  const [activeScenarioId, setActiveScenarioId] = React.useState(null)
  const { doc: scaffold, merge: mergeScaffold, submit: submitScaffold } = useDocument(() => ({
    type: "submission", scenarioId: activeScenarioId, treatment: "", outcome: "",
    population: "", dag: "", design: "", assumption: "", defense: "",
    authorSlug: viewer?.userSlug || "anonymous",
    authorName: viewer?.displayName || viewer?.userSlug || "anonymous",
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
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={c.title}>Causal Inference Workshop</h1>
            <p className={c.subtitle}>Weekly problem sets · scaffolded reasoning</p>
          </div>
          {viewer && (
            <div className="flex items-center gap-2">
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-8 h-8 rounded-full border border-[#404040]" />
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        {can("write") && (
          <section id="scenario-post" className={c.section}>
            <h2 className={c.h2}><span className={c.badge}>Instructor</span> Post a scenario</h2>
            <form className="space-y-3" onSubmit={submitScenario}>
              <input className={c.input} placeholder="Week title (e.g., Week 4 — Tutoring rollout)"
                value={newScenario.title} onChange={(e) => mergeScenario({ title: e.target.value })} />
              <textarea className={c.textarea} rows={5} placeholder="Describe the real-world scenario: what happened, when, to whom, and what data is available..."
                value={newScenario.body} onChange={(e) => mergeScenario({ body: e.target.value })} />
              <button type="submit" className={c.btn} disabled={!newScenario.title.trim() || !newScenario.body.trim()}>Post scenario</button>
            </form>
          </section>
        )}

        <section id="scenario-list" className={c.section}>
          <h2 className={c.h2}>This quarter's scenarios</h2>
          {scenarios.length === 0 && <p className={c.muted}>No scenarios posted yet.</p>}
          <ul className="space-y-2">
            {scenarios.map((s) => (
              <li key={s._id}>
                <button
                  onClick={() => setActiveScenarioId(s._id)}
                  className={`w-full text-left p-3 rounded border transition ${activeScenarioId === s._id ? "border-[#dc2626] bg-[#fef2f2]" : "border-[#e7e5e4] hover:bg-[#fafaf9]"}`}
                >
                  <div className="font-semibold text-sm">{s.title}</div>
                  <div className={`${c.muted} mt-1 line-clamp-2`}>{s.body}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section id="student-scaffold" className={c.section}>
          <h2 className={c.h2}><span className={c.badge}>Student</span> Work through the scaffold</h2>
          {!activeScenarioId ? (
            <p className={c.muted}>Pick a scenario above to begin.</p>
          ) : !can("write") ? (
            <p className={c.muted}>Read-only view — sign in with write access to submit.</p>
          ) : (
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault()
              if (!scaffold.design) return
              setCritiqueLoading(true)
              try {
                const prompt = `Evaluate this causal inference student response. Scenario: ${scenarios.find(s => s._id === activeScenarioId)?.body || ""}. Design chosen: ${scaffold.design}. Identifying assumption: ${scaffold.assumption}. Defense: ${scaffold.defense}. Rate the plausibility of their defense and list weaknesses.`
                const raw = await callAI(prompt, { schema: { properties: {
                  plausibility: { type: "string", description: "weak, moderate, or strong" },
                  weaknesses: { type: "array", items: { type: "string" } },
                  suggestion: { type: "string" }
                }}})
                mergeScaffold({ critique: JSON.parse(raw) })
                await submitScaffold()
              } finally { setCritiqueLoading(false) }
            }}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">1. Treatment</label>
                <input className={c.input} placeholder="What is the intervention?"
                  value={scaffold.treatment} onChange={(e) => mergeScaffold({ treatment: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">2. Outcome</label>
                <input className={c.input} placeholder="What are we measuring?"
                  value={scaffold.outcome} onChange={(e) => mergeScaffold({ outcome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">3. Population</label>
                <input className={c.input} placeholder="Who is the population of interest?"
                  value={scaffold.population} onChange={(e) => mergeScaffold({ population: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">4. DAG sketch (text description)</label>
                <textarea className={c.textarea} rows={3} placeholder="Describe the edges, e.g., Z → D → Y, U → D, U → Y..."
                  value={scaffold.dag} onChange={(e) => mergeScaffold({ dag: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">5. Design</label>
                <select className={c.input} value={scaffold.design} onChange={(e) => mergeScaffold({ design: e.target.value })}>
                  <option value="">— pick one —</option>
                  <option>Regression discontinuity</option>
                  <option>Difference-in-differences</option>
                  <option>Instrumental variables</option>
                  <option>Panel data methods</option>
                  <option>Two-stage least squares</option>
                  <option>Propensity score methods</option>
                  <option>Matching estimators</option>
                  <option>Synthetic controls</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">6. Identifying assumption</label>
                <textarea className={c.textarea} rows={2} placeholder="State the key assumption your design requires..."
                  value={scaffold.assumption} onChange={(e) => mergeScaffold({ assumption: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#525252]">7. Defense</label>
                <textarea className={c.textarea} rows={4} placeholder="Why is the assumption plausible here? What would break it?"
                  value={scaffold.defense} onChange={(e) => mergeScaffold({ defense: e.target.value })} />
              </div>
              <button type="submit" className={c.btn} disabled={critiqueLoading || !scaffold.design}>
                {critiqueLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50 20" /></svg>
                    Critiquing...
                  </span>
                ) : "Submit for AI critique"}
              </button>
            </form>
          )}
        </section>

        <section id="aggregate-dashboard" className={c.section}>
          <h2 className={c.h2}><span className={c.badge}>Instructor</span> Class aggregate</h2>
          {!activeScenarioId ? (
            <p className={c.muted}>Pick a scenario to see the class breakdown.</p>
          ) : (
            <DesignChart submissions={submissions} />
          )}
          {activeScenarioId && submissions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {submissions.map((s) => (
                <li key={s._id} className="border border-[#e7e5e4] rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{s.authorName}</div>
                    <span className={c.pill}>{s.design || "no design"}</span>
                  </div>
                  {s.critique && (
                    <div className="mt-2 text-xs">
                      <span className={c.pill}>Plausibility: {s.critique.plausibility}</span>
                      {s.critique.weaknesses?.length > 0 && (
                        <ul className="mt-1 list-disc list-inside text-[#737373]">
                          {s.critique.weaknesses.slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  {can("write") && (
                    <button
                      onClick={() => database.put({ ...s, exemplary: !s.exemplary })}
                      className={`${c.btnGhost} mt-2 ${s.exemplary ? "bg-[#fef2f2] border-[#dc2626]" : ""}`}
                    >
                      {s.exemplary ? "★ Exemplary" : "Mark exemplary"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="exemplary-library" className={c.section}>
          <h2 className={c.h2}>Exemplary answer library</h2>
          <ExemplaryList c={c} />
        </section>
      </main>
    </div>
  )
}