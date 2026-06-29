import React from "react"
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
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select className="bg-[#0a0a0f] border border-[#3a3f4d] rounded px-2 py-2 text-xs text-[#f7f7f8]" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">all mechanisms</option>
          {MECHANISMS.map(m => <option key={m}>{m}</option>)}
        </select>
        <input className="flex-1 min-w-[200px] bg-[#0a0a0f] border border-[#3a3f4d] rounded px-3 py-2 text-sm text-[#f7f7f8]" placeholder="Search behavior, population, content..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filtered.length === 0 && <div className="text-[#7a8090] text-sm">No matching interventions.</div>}
        {filtered.map(b => (
          <div key={b._id} className="border border-[#3a3f4d] bg-[#0a0a0f] rounded p-3 text-sm">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div className="font-bold">{b.targetBehavior}</div>
              <span className="text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase tracking-wider text-[#7a8090]">{b.stage}</span>
            </div>
            <div className="text-xs text-[#7a8090] mt-1">{b.mechanism} · {b.predictedDirection} · {b.population}</div>
            <div className="text-xs mt-1">{b.nudgeContent}</div>
            {b.effectSize && <div className="text-xs text-[#7ac57a] mt-1">Result: {b.effectSize}</div>}
          </div>
        ))}
      </div>
    </div>
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
  return <svg ref={ref} />
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
    authorSlug: viewer?.userSlug,
    authorName: viewer?.displayName ?? viewer?.userSlug,
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
      await database.put({ ...brief, audit, auditedAt: Date.now(), auditedBy: viewer?.userSlug })
    } finally { setAuditingId(null) }
  }

  return (
    <div className={c.page}>
      <header className={c.header} id="app-header">
        <div>
          <div className={c.title}>Recon Grid</div>
          <div className={c.tag}>Behavioral Interventions Pipeline</div>
        </div>
        <div className="flex items-center gap-2">
          {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-8 h-8 rounded border border-[#3a3f4d]" />}
          <span className={c.badge}>{viewer?.displayName ?? viewer?.userSlug ?? "anon"}</span>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="new-brief" className={c.section}>
          <h2 className={c.h2}>New Intervention Brief</h2>
          {!can("write") ? (
            <p className={c.dim}>Read-only view — contact the owner for write access.</p>
          ) : (
            <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={c.label}>Target behavior</label>
                <input className={c.input} value={doc.targetBehavior} onChange={e => merge({ targetBehavior: e.target.value })} placeholder="e.g. increase 401k contribution rate" />
              </div>
              <div>
                <label className={c.label}>Population</label>
                <input className={c.input} value={doc.population} onChange={e => merge({ population: e.target.value })} placeholder="e.g. new hires under 35" />
              </div>
              <div>
                <label className={c.label}>Behavioral mechanism</label>
                <select className={c.input} value={doc.mechanism} onChange={e => merge({ mechanism: e.target.value })}>
                  {MECHANISMS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={c.label}>Predicted direction</label>
                <select className={c.input} value={doc.predictedDirection} onChange={e => merge({ predictedDirection: e.target.value })}>
                  <option>increase</option><option>decrease</option>
                </select>
              </div>
              <div>
                <label className={c.label}>Success metric</label>
                <input className={c.input} value={doc.metric} onChange={e => merge({ metric: e.target.value })} placeholder="e.g. % enrolled within 30 days" />
              </div>
              <div className="md:col-span-2">
                <label className={c.label}>Nudge content / message variants</label>
                <textarea className={c.input} rows={3} value={doc.nudgeContent} onChange={e => merge({ nudgeContent: e.target.value })} placeholder="Channel, decision moment, message text..." />
              </div>
              <div className="md:col-span-2 flex gap-2 flex-wrap">
                <button type="submit" className={c.btn} disabled={!doc.targetBehavior}>Create Brief</button>
                <button type="button" className={c.btnAlt} onClick={suggestExample} disabled={suggesting}>
                  {suggesting ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : "Suggest Example"}
                </button>
              </div>
            </form>
          )}
        </section>
        <section id="pipeline" className={c.section}>
          <h2 className={c.h2}>Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STAGES.map(stage => {
              const items = briefs.filter(b => b.stage === stage)
              return (
                <div key={stage} className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-[#e63946] border-b border-[#3a3f4d] pb-1 flex justify-between">
                    <span>{stage}</span><span className={c.dim}>{items.length}</span>
                  </div>
                  {items.length === 0 && <div className={c.dim + " text-xs"}>—</div>}
                  {items.map(b => {
                    const idx = STAGES.indexOf(b.stage)
                    return (
                      <div key={b._id} className={c.card}>
                        <div className="text-sm font-bold">{b.targetBehavior}</div>
                        <div className="text-xs text-[#7a8090] mt-1">{b.mechanism} · {b.population}</div>
                        {b.audit && (
                          <div className={"text-xs mt-2 p-2 rounded border " + (b.audit.consistent ? "border-[#3a8a4a] text-[#7ac57a]" : "border-[#e63946] text-[#ff8a90]")}>
                            <div className="font-bold uppercase tracking-wider text-[10px]">{b.audit.consistent ? "Consistent" : "Mismatch: " + b.audit.actualMechanism}</div>
                            <div className="mt-1">{b.audit.notes}</div>
                            {b.audit.refinements && <div className="mt-1 italic">{b.audit.refinements}</div>}
                          </div>
                        )}
                        {b.stage === "evaluation" && b.effectSize && (
                          <div className="text-xs mt-2 text-[#7ac57a]">Effect: {b.effectSize}</div>
                        )}
                        {can("write") && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {idx < STAGES.length - 1 && (
                              <button className="text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase hover:bg-[#1a1f2e]" onClick={() => database.put({ ...b, stage: STAGES[idx+1] })}>Advance →</button>
                            )}
                            {b.stage === "internal review" && (
                              <button className="text-[10px] px-2 py-1 border border-[#e63946] text-[#e63946] rounded uppercase hover:bg-[#e63946] hover:text-white" disabled={auditingId === b._id} onClick={() => runAudit(b)}>
                                {auditingId === b._id ? "Auditing..." : "AI Audit"}
                              </button>
                            )}
                            {b.stage === "evaluation" && !b.effectSize && (
                              <button className="text-[10px] px-2 py-1 border border-[#3a3f4d] rounded uppercase hover:bg-[#1a1f2e]" onClick={() => {
                                const v = prompt("Measured effect size & notes:")
                                if (v) database.put({ ...b, effectSize: v, evaluatedAt: Date.now() })
                              }}>Log Result</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </section>
        <section id="mechanism-chart" className={c.section}>
          <h2 className={c.h2}>Mechanism Frequency</h2>
          <MechChart briefs={briefs} />
        </section>
        <section id="archive" className={c.section}>
          <h2 className={c.h2}>Institutional Memory</h2>
          <ArchiveBrowser briefs={briefs} />
        </section>
      </main>
    </div>
  )
}