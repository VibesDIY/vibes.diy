import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("surveillance-ops")
  const { docs: allCases } = useLiveQuery("type", { key: "case", descending: true, limit: 500 })
  const { docs: investigations } = useLiveQuery("type", { key: "investigation", descending: true })

  const c = {
    page: "min-h-screen bg-[#1a1a1f] text-[#ecece8] font-mono",
    header: "sticky top-0 z-10 bg-[#28282e] border-b border-[#3a3a42] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-bold tracking-wider text-[#ecece8] uppercase",
    tag: "text-xs text-[#9a9a9a] uppercase tracking-widest",
    main: "px-4 py-4 space-y-4 max-w-3xl mx-auto pb-24",
    section: "bg-[#28282e] border border-[#3a3a42] rounded p-4",
    h2: "text-xs uppercase tracking-widest text-[#d64545] mb-3 font-bold",
    btn: "min-h-[44px] px-4 py-2 bg-[#d64545] hover:bg-[#b83838] text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a3a42] text-[#ecece8] rounded text-sm hover:bg-[#33333a]",
    input: "w-full bg-[#1a1a1f] border border-[#3a3a42] rounded px-3 py-2 text-sm text-[#ecece8] focus:border-[#d64545] focus:outline-none",
    label: "block text-xs uppercase tracking-wider text-[#9a9a9a] mb-1",
    row: "flex items-center justify-between py-2 border-b border-[#3a3a42] last:border-b-0",
    chip: "inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded bg-[#3a3a42] text-[#ecece8]",
    chipAlert: "inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded bg-[#d64545] text-white",
    muted: "text-xs text-[#9a9a9a]",
    suggest: "text-[10px] uppercase tracking-wider text-[#d64545] hover:text-[#ff6b6b] underline"
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>SurveillanceOps</h1>
          <p className={c.tag}>State Epi // Reportable Conditions</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-8 h-8 rounded-full border border-[#3a3a42]" />}
      </header>

      <main id="app" className={c.main}>
        <section id="case-intake" className={c.section}>
          <h2 className={c.h2}>Case Report Intake</h2>
          {(() => {
            const today = new Date().toISOString().slice(0, 10)
            const { doc, merge, submit } = useDocument({
              type: "case",
              condition: "",
              onsetDate: today,
              county: "",
              age: "",
              sex: "F",
              labStatus: "Suspect",
              exposure: "",
              createdAt: Date.now()
            })
            const cases = allCases.filter(d => d.type === "case")
            if (!can("write")) {
              return <p className={c.muted}>Read-only view — contact the owner for write access.</p>
            }
            return (
              <>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={c.label}>Condition</label>
                      <input className={c.input} value={doc.condition} onChange={e => merge({ condition: e.target.value })} placeholder="e.g. Salmonellosis" required />
                    </div>
                    <div>
                      <label className={c.label}>Onset Date</label>
                      <input type="date" className={c.input} value={doc.onsetDate} onChange={e => merge({ onsetDate: e.target.value })} />
                    </div>
                    <div>
                      <label className={c.label}>County</label>
                      <input className={c.input} value={doc.county} onChange={e => merge({ county: e.target.value })} placeholder="County" />
                    </div>
                    <div>
                      <label className={c.label}>Age</label>
                      <input type="number" className={c.input} value={doc.age} onChange={e => merge({ age: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <label className={c.label}>Sex</label>
                      <select className={c.input} value={doc.sex} onChange={e => merge({ sex: e.target.value })}>
                        <option>F</option><option>M</option><option>X</option>
                      </select>
                    </div>
                    <div>
                      <label className={c.label}>Lab Status</label>
                      <select className={c.input} value={doc.labStatus} onChange={e => merge({ labStatus: e.target.value })}>
                        <option>Suspect</option><option>Probable</option><option>Confirmed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={c.label}>Exposure History</label>
                    <textarea className={c.input} rows="2" value={doc.exposure} onChange={e => merge({ exposure: e.target.value })} placeholder="Restaurant, travel, contacts..." />
                  </div>
                  <button type="submit" className={c.btn}>Log Report</button>
                </form>
                <div className="mt-4">
                  <h3 className={c.muted + " mb-2 uppercase tracking-wider"}>Recent Reports ({cases.length})</h3>
                  {cases.slice(0, 8).map(d => (
                    <div key={d._id} className={c.row}>
                      <span className="text-sm">{d.condition || "—"} · {d.county || "—"} · {d.sex}{d.age}</span>
                      <span className={d.labStatus === "Confirmed" ? c.chipAlert : c.chip}>{d.labStatus}</span>
                    </div>
                  ))}
                  {cases.length === 0 && <p className={c.muted}>No reports yet.</p>}
                </div>
              </>
            )
          })()}
        </section>

        <section id="epi-curve" className={c.section}>
          <h2 className={c.h2}>Epi Curve // Weekly Counts</h2>
          {(() => {
            const svgRef = React.useRef(null)
            const cases = allCases.filter(d => d.type === "case" && d.onsetDate)
            const threshold = 5
            React.useEffect(() => {
              if (!svgRef.current) return
              const buckets = d3.rollup(
                cases,
                v => v.length,
                d => {
                  const dt = new Date(d.onsetDate)
                  const onejan = new Date(dt.getFullYear(), 0, 1)
                  const week = Math.ceil(((dt - onejan) / 86400000 + onejan.getDay() + 1) / 7)
                  return `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`
                }
              )
              const data = Array.from(buckets, ([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week))
              const w = 600, h = 200, m = { t: 10, r: 10, b: 30, l: 30 }
              const svg = d3.select(svgRef.current)
              svg.selectAll("*").remove()
              if (data.length === 0) {
                svg.append("text").attr("x", w/2).attr("y", h/2).attr("fill", "#9a9a9a").attr("text-anchor", "middle").attr("font-size", "12").text("No data yet")
                return
              }
              const x = d3.scaleBand().domain(data.map(d => d.week)).range([m.l, w - m.r]).padding(0.15)
              const y = d3.scaleLinear().domain([0, Math.max(threshold + 1, d3.max(data, d => d.count))]).range([h - m.b, m.t])
              svg.selectAll("rect").data(data).enter().append("rect")
                .attr("x", d => x(d.week)).attr("y", d => y(d.count))
                .attr("width", x.bandwidth()).attr("height", d => h - m.b - y(d.count))
                .attr("fill", d => d.count >= threshold ? "#d64545" : "#5a8fa8")
              svg.append("line").attr("x1", m.l).attr("x2", w - m.r)
                .attr("y1", y(threshold)).attr("y2", y(threshold))
                .attr("stroke", "#d64545").attr("stroke-dasharray", "3,3").attr("opacity", 0.5)
              svg.append("g").attr("transform", `translate(0,${h - m.b})`)
                .call(d3.axisBottom(x).tickSize(0))
                .selectAll("text").attr("fill", "#9a9a9a").attr("font-size", "9")
              svg.append("g").attr("transform", `translate(${m.l},0)`)
                .call(d3.axisLeft(y).ticks(4))
                .selectAll("text").attr("fill", "#9a9a9a").attr("font-size", "9")
              svg.selectAll("path,line.domain").attr("stroke", "#3a3a42")
            }, [cases.length])
            const thisWeekCount = (() => {
              const now = new Date()
              const onejan = new Date(now.getFullYear(), 0, 1)
              const thisWeek = Math.ceil(((now - onejan) / 86400000 + onejan.getDay() + 1) / 7)
              const key = `${now.getFullYear()}-W${String(thisWeek).padStart(2, "0")}`
              return cases.filter(d => {
                const dt = new Date(d.onsetDate)
                const oj = new Date(dt.getFullYear(), 0, 1)
                const w = Math.ceil(((dt - oj) / 86400000 + oj.getDay() + 1) / 7)
                return `${dt.getFullYear()}-W${String(w).padStart(2, "0")}` === key
              }).length
            })()
            return (
              <>
                <div className="flex gap-2 mb-3 flex-wrap items-center">
                  <span className={c.chip}>This Wk: {thisWeekCount}</span>
                  <span className={thisWeekCount >= threshold ? c.chipAlert : c.chip}>Threshold: {threshold}</span>
                  {thisWeekCount >= threshold && <span className={c.chipAlert}>⚑ EXCEEDED</span>}
                </div>
                <svg ref={svgRef} viewBox="0 0 600 200" className="w-full h-40 bg-[#1a1a1f] border border-[#3a3a42] rounded"></svg>
                <p className={c.muted + " mt-2"}>Bars show new cases per ISO week. Red bars exceed threshold.</p>
              </>
            )
          })()}
        </section>

        <section id="investigations" className={c.section}>
          <h2 className={c.h2}>Outbreak Investigations</h2>
          {(() => {
            const { doc, merge, submit } = useDocument({
              type: "investigation",
              title: "",
              design: "Cohort",
              caseDefinition: "",
              analyticPlan: "",
              status: "open",
              createdAt: Date.now()
            })
            const [aiLoading, setAiLoading] = React.useState(false)
            const open = investigations.filter(i => i.status === "open")
            const archived = investigations.filter(i => i.status === "closed")

            async function suggest() {
              if (!doc.title) return
              setAiLoading(true)
              try {
                const res = await callAI(
                  `For a ${doc.design} study of "${doc.title}", suggest a concise case definition and a brief analytic plan (measures of association, confounders to address).`,
                  { schema: { properties: { caseDefinition: { type: "string" }, analyticPlan: { type: "string" } } } }
                )
                const parsed = JSON.parse(res)
                merge({ caseDefinition: parsed.caseDefinition, analyticPlan: parsed.analyticPlan })
              } finally {
                setAiLoading(false)
              }
            }

            if (!can("write")) {
              return (
                <div>
                  <h3 className={c.muted + " mb-2 uppercase tracking-wider"}>Active ({open.length})</h3>
                  {open.map(i => (
                    <div key={i._id} className={c.row}>
                      <span className="text-sm">{i.title}</span>
                      <span className={c.chip}>{i.design}</span>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <>
                <form onSubmit={submit} className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={c.input} value={doc.title} onChange={e => merge({ title: e.target.value })} placeholder="Investigation title" required />
                    <select className={c.input} value={doc.design} onChange={e => merge({ design: e.target.value })}>
                      <option>Cohort</option>
                      <option>Case-Control</option>
                      <option>Cross-Sectional</option>
                    </select>
                  </div>
                  <textarea className={c.input} rows="2" value={doc.caseDefinition} onChange={e => merge({ caseDefinition: e.target.value })} placeholder="Case definition" />
                  <textarea className={c.input} rows="2" value={doc.analyticPlan} onChange={e => merge({ analyticPlan: e.target.value })} placeholder="Analytic plan & measures of association" />
                  <div className="flex gap-2 items-center flex-wrap">
                    <button type="submit" className={c.btn}>Open Investigation</button>
                    <button type="button" onClick={suggest} disabled={aiLoading || !doc.title} className={c.suggest + " disabled:opacity-40"}>
                      {aiLoading ? (
                        <svg className="inline animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                      ) : "✦"} Suggest fields
                    </button>
                  </div>
                </form>
                <div>
                  <h3 className={c.muted + " mb-2 uppercase tracking-wider"}>Active ({open.length})</h3>
                  {open.map(i => (
                    <div key={i._id} className={c.row}>
                      <div className="flex-1">
                        <div className="text-sm">{i.title}</div>
                        <div className="text-[10px] text-[#9a9a9a]">{i.caseDefinition?.slice(0, 60)}...</div>
                      </div>
                      <div className="flex gap-1 items-center">
                        <span className={c.chip}>{i.design}</span>
                        <button onClick={() => database.put({ ...i, status: "closed", closedAt: Date.now() })} className="text-[10px] text-[#d64545] uppercase ml-2">Close</button>
                      </div>
                    </div>
                  ))}
                  {open.length === 0 && <p className={c.muted}>No open investigations.</p>}
                  {archived.length > 0 && (
                    <>
                      <h3 className={c.muted + " mt-4 mb-2 uppercase tracking-wider"}>Archived ({archived.length})</h3>
                      {archived.slice(0, 5).map(i => (
                        <div key={i._id} className={c.row}>
                          <span className="text-sm text-[#9a9a9a]">{i.title}</span>
                          <span className={c.chip}>{i.design}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )
          })()}
        </section>

        <section id="bulletin" className={c.section}>
          <h2 className={c.h2}>Weekly Surveillance Bulletin</h2>
          {(() => {
            const now = new Date()
            const onejan = new Date(now.getFullYear(), 0, 1)
            const wk = Math.ceil(((now - onejan) / 86400000 + onejan.getDay() + 1) / 7)
            const defaultWeek = `${now.getFullYear()}-W${String(wk).padStart(2, "0")}`
            const { doc, merge, submit } = useDocument({
              type: "bulletin",
              week: defaultWeek,
              narrative: "",
              publishedAt: Date.now()
            })
            const [aiLoading, setAiLoading] = React.useState(false)
            const { docs: bulletins } = useLiveQuery("type", { key: "bulletin", descending: true, limit: 5 })

            async function draft() {
              setAiLoading(true)
              try {
                const cases = allCases.filter(d => d.type === "case")
                const byCondition = d3.rollup(cases, v => v.length, d => d.condition || "Unknown")
                const conditionSummary = Array.from(byCondition).map(([k, v]) => `${k}: ${v}`).join(", ")
                const openInv = investigations.filter(i => i.status === "open").map(i => i.title).join(", ") || "none"
                const res = await callAI(
                  `Draft a concise weekly surveillance bulletin narrative for week ${doc.week}. Total cases logged: ${cases.length}. By condition: ${conditionSummary}. Open investigations: ${openInv}. Note any threshold concerns and recommended follow-up.`,
                  { schema: { properties: { narrative: { type: "string" } } } }
                )
                const parsed = JSON.parse(res)
                merge({ narrative: parsed.narrative })
              } finally {
                setAiLoading(false)
              }
            }

            if (!can("write")) {
              return (
                <div>
                  <h3 className={c.muted + " mb-2 uppercase tracking-wider"}>Published Bulletins</h3>
                  {bulletins.map(b => (
                    <div key={b._id} className="py-2 border-b border-[#3a3a42] last:border-b-0">
                      <div className="text-sm font-bold">{b.week}</div>
                      <div className="text-xs text-[#9a9a9a] mt-1">{b.narrative}</div>
                    </div>
                  ))}
                  {bulletins.length === 0 && <p className={c.muted}>No bulletins yet.</p>}
                </div>
              )
            }
            return (
              <>
                <form onSubmit={submit} className="space-y-2">
                  <input className={c.input} value={doc.week} onChange={e => merge({ week: e.target.value })} placeholder="Bulletin week" />
                  <textarea className={c.input} rows="6" value={doc.narrative} onChange={e => merge({ narrative: e.target.value })} placeholder="Narrative summary — case counts, threshold flags, investigation status..." />
                  <div className="flex gap-2 flex-wrap items-center">
                    <button type="submit" className={c.btn} disabled={!doc.narrative}>Publish</button>
                    <button type="button" onClick={draft} disabled={aiLoading} className={c.suggest + " disabled:opacity-40"}>
                      {aiLoading ? (
                        <svg className="inline animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                      ) : "✦"} Draft from live data
                    </button>
                  </div>
                </form>
                <div className="mt-4">
                  <h3 className={c.muted + " mb-2 uppercase tracking-wider"}>Published ({bulletins.length})</h3>
                  {bulletins.map(b => (
                    <div key={b._id} className="py-2 border-b border-[#3a3a42] last:border-b-0">
                      <div className="text-sm font-bold">{b.week}</div>
                      <div className="text-xs text-[#9a9a9a] mt-1">{b.narrative?.slice(0, 180)}{b.narrative?.length > 180 ? "..." : ""}</div>
                    </div>
                  ))}
                  {bulletins.length === 0 && <p className={c.muted}>No bulletins yet.</p>}
                </div>
              </>
            )
          })()}
        </section>
      </main>
    </div>
  )
}