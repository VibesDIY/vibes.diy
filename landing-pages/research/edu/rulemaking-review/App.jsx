import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("ria-review-dossier")

  const { doc: caseDoc, merge: mergeCase, submit: submitCase } = useDocument({
    type: "case",
    title: "",
    agency: "",
    docket: "",
    discountRate: "",
    netBenefit: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug ?? "anonymous",
  })

  const { docs: cases } = useLiveQuery("type", { key: "case", descending: true })
  const [selectedCaseId, setSelectedCaseId] = React.useState(null)
  const selectedCase = cases.find(c => c._id === selectedCaseId)

  const rubricDimensions = [
    "Alternatives Completeness", "Baseline Defensibility", "Causal Logic Documentation",
    "WTP Valuation Basis", "Discount Rate Consistency", "Distributional Analysis",
    "Optimization Transparency", "Stakeholder Completeness", "Tail Risk Surfacing", "Sensitivity Range Adequacy"
  ]

  const { doc: findingDoc, merge: mergeFinding, submit: submitFinding } = useDocument({
    type: "finding",
    caseId: "",
    dimension: rubricDimensions[0],
    finding: "",
    citation: "",
    rigor: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug ?? "anonymous",
  })

  const { docs: allFindings } = useLiveQuery("type", { key: "finding" })
  const findings = allFindings.filter(f => f.caseId === selectedCaseId)
  const [critiqueLoadingId, setCritiqueLoadingId] = React.useState(null)

  const handleFindingSubmit = (e) => {
    e.preventDefault()
    if (!selectedCaseId) return
    mergeFinding({ caseId: selectedCaseId })
    submitFinding()
  }

  const chartRef = React.useRef(null)

  const agencyRigor = React.useMemo(() => {
    const byAgency = new Map()
    for (const f of allFindings) {
      if (!f.rigor) continue
      const caseRec = cases.find(c => c._id === f.caseId)
      const agency = caseRec?.agency || "Unknown"
      if (!byAgency.has(agency)) byAgency.set(agency, [])
      byAgency.get(agency).push(Number(f.rigor))
    }
    return Array.from(byAgency.entries()).map(([agency, scores]) => ({
      agency, avg: d3.mean(scores), n: scores.length
    })).sort((a, b) => b.avg - a.avg)
  }, [allFindings, cases])

  const dimensionCounts = React.useMemo(() => {
    const counts = d3.rollup(allFindings, v => v.length, f => f.dimension)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [allFindings])

  React.useEffect(() => {
    if (!chartRef.current) return
    const el = chartRef.current
    el.innerHTML = ""
    if (agencyRigor.length === 0) {
      el.innerHTML = '<div class="text-gray-500 text-sm italic text-center py-8">No rigor scores logged yet.</div>'
      return
    }
    const width = Math.max(el.clientWidth, 320)
    const height = Math.max(agencyRigor.length * 36 + 40, 120)
    const margin = { top: 10, right: 50, bottom: 30, left: 120 }
    const svg = d3.select(el).append("svg").attr("width", width).attr("height", height).style("background", "#0a0a0a")
    const x = d3.scaleLinear().domain([0, 5]).range([margin.left, width - margin.right])
    const y = d3.scaleBand().domain(agencyRigor.map(d => d.agency)).range([margin.top, height - margin.bottom]).padding(0.2)
    svg.selectAll("rect").data(agencyRigor).enter().append("rect")
      .attr("x", x(0)).attr("y", d => y(d.agency)).attr("height", y.bandwidth())
      .attr("width", d => x(d.avg) - x(0))
      .attr("fill", d => d.avg >= 4 ? "#4ade80" : d.avg >= 2.5 ? "#fbbf24" : "#f87171")
    svg.selectAll("text.val").data(agencyRigor).enter().append("text").attr("class", "val")
      .attr("x", d => x(d.avg) + 6).attr("y", d => y(d.agency) + y.bandwidth() / 2 + 4)
      .attr("fill", "white").style("font-size", "11px").style("font-family", "monospace")
      .text(d => `${d.avg.toFixed(1)} (n=${d.n})`)
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5)).attr("color", "#9ca3af")
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)).attr("color", "#9ca3af")
  }, [agencyRigor])

  const runCritique = async (f) => {
    setCritiqueLoadingId(f._id)
    try {
      const resp = await callAI(
        `You are a senior regulatory analyst reviewing this finding from a Regulatory Impact Analysis review.\nDimension: ${f.dimension}\nFinding: ${f.finding}\nCitation: ${f.citation}\nEvaluate against best-practice regulatory analysis standards. Return a rigor score 1-5, 2-3 follow-up questions to send to the submitting agency, and any flagged inconsistencies with guidance.`,
        { schema: { properties: {
          rigorScore: { type: "number" },
          followUps: { type: "array", items: { type: "string" } },
          flags: { type: "array", items: { type: "string" } },
        }}}
      )
      const critique = JSON.parse(resp)
      await database.put({ ...f, critique })
    } catch (err) {
      console.error(err)
    } finally {
      setCritiqueLoadingId(null)
    }
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4660] bg-black px-4 py-5 sticky top-0 z-10",
    brand: "text-2xl font-black tracking-tight uppercase",
    brandFont: "font-['Archivo_Black',sans-serif]",
    tagline: "text-xs text-gray-400 mt-1 tracking-widest uppercase",
    main: "max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4660] bg-black p-5 rounded",
    sectionTitle: "text-lg font-black uppercase tracking-wide mb-4 font-['Archivo_Black',sans-serif]",
    label: "block text-xs uppercase tracking-widest text-gray-400 mb-1",
    input: "w-full bg-[#1a1a1a] border border-[#3a4660] px-3 py-3 min-h-[44px] text-white focus:outline-none focus:border-white text-sm",
    textarea: "w-full bg-[#1a1a1a] border border-[#3a4660] px-3 py-2 text-white focus:outline-none focus:border-white text-sm",
    btn: "bg-white text-black px-4 py-3 min-h-[44px] font-black uppercase tracking-wider text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "border border-[#3a4660] text-white px-4 py-3 min-h-[44px] uppercase tracking-wider text-xs hover:border-white",
    row: "border border-[#3a4660] bg-[#0a0a0a] p-3 rounded text-sm",
    rowTitle: "font-black uppercase tracking-wide text-sm",
    rowMeta: "text-xs text-gray-400 mt-1",
    pill: "inline-block border border-[#3a4660] px-2 py-1 text-[10px] uppercase tracking-widest text-gray-300",
    empty: "text-gray-500 text-sm italic text-center py-8",
    readonly: "text-xs text-gray-500 italic border border-dashed border-[#3a4660] p-3 rounded",
    viewerBadge: "flex items-center gap-2 text-xs",
    avatar: "w-8 h-8 rounded-full border border-[#3a4660]",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>

      <header id="app-header" className={c.header}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={`${c.brand} ${c.brandFont}`}>RIA Review Dossier</h1>
            <p className={c.tagline}>Regulatory Impact Analysis · Structured Review</p>
          </div>
          {viewer && (
            <div className={c.viewerBadge}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="case-intake" className={c.section}>
          <h2 className={c.sectionTitle}>01 · Open Review Case</h2>
          {can("write") ? (
            <form className="space-y-3" onSubmit={submitCase}>
              <div>
                <label className={c.label}>Rulemaking Title</label>
                <input className={c.input} value={caseDoc.title} onChange={e => mergeCase({ title: e.target.value })} placeholder="e.g. Heavy-Duty Vehicle Emissions Standards" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Submitting Agency</label>
                  <input className={c.input} value={caseDoc.agency} onChange={e => mergeCase({ agency: e.target.value })} placeholder="EPA / DOT / HHS …" />
                </div>
                <div>
                  <label className={c.label}>RIN / Docket</label>
                  <input className={c.input} value={caseDoc.docket} onChange={e => mergeCase({ docket: e.target.value })} placeholder="RIN 2060-AV50" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Social Discount Rate</label>
                  <input className={c.input} value={caseDoc.discountRate} onChange={e => mergeCase({ discountRate: e.target.value })} placeholder="3% / 7% / other" />
                </div>
                <div>
                  <label className={c.label}>Net Benefit Estimate ($B)</label>
                  <input className={c.input} value={caseDoc.netBenefit} onChange={e => mergeCase({ netBenefit: e.target.value })} placeholder="e.g. 12.4" />
                </div>
              </div>
              <button type="submit" className={c.btn} disabled={!caseDoc.title || !caseDoc.agency}>Open Case</button>
            </form>
          ) : (
            <p className={c.readonly}>Read-only view — contact the office for write access to open cases.</p>
          )}
          <div className="mt-5 space-y-2">
            <p className={c.label}>Open Cases ({cases.length})</p>
            {cases.length === 0 ? (
              <div className={c.empty}>No cases opened yet.</div>
            ) : (
              <ul className="space-y-2">
                {cases.map(d => (
                  <li key={d._id}>
                    <button onClick={() => setSelectedCaseId(d._id === selectedCaseId ? null : d._id)} className={`${c.row} w-full text-left ${d._id === selectedCaseId ? "border-white" : ""}`}>
                      <div className={c.rowTitle}>{d.title}</div>
                      <div className={c.rowMeta}>
                        <span className={c.pill}>{d.agency}</span> <span className={c.pill}>{d.docket}</span> <span className={c.pill}>DR {d.discountRate}</span> <span className={c.pill}>${d.netBenefit}B</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section id="rubric-findings" className={c.section}>
          <h2 className={c.sectionTitle}>02 · Rubric Findings</h2>
          <p className="text-xs text-gray-400 mb-3">{selectedCase ? `Case: ${selectedCase.title}` : "Select a case above, then log findings."}</p>
          {can("write") ? (
            <form className="space-y-3" onSubmit={handleFindingSubmit}>
              <div>
                <label className={c.label}>Rubric Dimension</label>
                <select className={c.input} value={findingDoc.dimension} onChange={e => mergeFinding({ dimension: e.target.value })}>
                  {rubricDimensions.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={c.label}>Finding</label>
                <textarea className={c.textarea} rows="3" value={findingDoc.finding} onChange={e => mergeFinding({ finding: e.target.value })} placeholder="Document the specific gap or strength observed…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Citation (¶ / Table)</label>
                  <input className={c.input} value={findingDoc.citation} onChange={e => mergeFinding({ citation: e.target.value })} placeholder="¶ 4.2.1 / Table 5-3" />
                </div>
                <div>
                  <label className={c.label}>Rigor (1–5)</label>
                  <input className={c.input} type="number" min="1" max="5" value={findingDoc.rigor} onChange={e => mergeFinding({ rigor: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className={c.btn} disabled={!selectedCaseId || !findingDoc.finding}>Log Finding</button>
              </div>
            </form>
          ) : (
            <p className={c.readonly}>Read-only view — findings are visible below but cannot be added.</p>
          )}
          <div className="mt-5 space-y-2">
            <p className={c.label}>Findings on Selected Case ({findings.length})</p>
            {!selectedCaseId ? (
              <div className={c.empty}>Select a case to view its findings.</div>
            ) : findings.length === 0 ? (
              <div className={c.empty}>No findings logged on this case yet.</div>
            ) : (
              <ul className="space-y-2">
                {findings.map(f => (
                  <li key={f._id} className={c.row}>
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <span className={c.pill}>{f.dimension}</span>
                      <span className={c.pill}>Rigor {f.rigor || "—"}/5</span>
                    </div>
                    <p className="mt-2 text-sm">{f.finding}</p>
                    <p className={c.rowMeta}>Cite: {f.citation || "—"}</p>
                    {can("write") && (
                      <button onClick={() => runCritique(f)} disabled={critiqueLoadingId === f._id} className={`${c.btnGhost} mt-2 inline-flex items-center gap-2`}>
                        {critiqueLoadingId === f._id ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                            Critiquing…
                          </>
                        ) : "AI Critique"}
                      </button>
                    )}
                    {f.critique && (
                      <div className="mt-3 border-t border-[#3a4660] pt-3 text-xs space-y-2">
                        <div><span className={c.pill}>AI Rigor Score {f.critique.rigorScore}/5</span></div>
                        {f.critique.followUps?.length > 0 && (
                          <div>
                            <p className="text-gray-400 uppercase tracking-widest mb-1">Follow-ups for agency</p>
                            <ul className="list-disc list-inside space-y-1">{f.critique.followUps.map((q, i) => <li key={i}>{q}</li>)}</ul>
                          </div>
                        )}
                        {f.critique.flags?.length > 0 && (
                          <div>
                            <p className="text-gray-400 uppercase tracking-widest mb-1">Flagged inconsistencies</p>
                            <ul className="list-disc list-inside space-y-1">{f.critique.flags.map((q, i) => <li key={i}>{q}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section id="portfolio-patterns" className={c.section}>
          <h2 className={c.sectionTitle}>03 · Portfolio Patterns</h2>
          <p className="text-xs text-gray-400 mb-3">Avg reviewer rigor score by agency across all logged findings.</p>
          <div ref={chartRef} className="w-full overflow-x-auto" />
          <div className="mt-4">
            <p className={c.label}>Recurring Dimensions Flagged</p>
            {dimensionCounts.length === 0 ? (
              <div className={c.empty}>No findings logged across portfolio yet.</div>
            ) : (
              <ul className="space-y-1 mt-2">
                {dimensionCounts.map(([dim, n]) => (
                  <li key={dim} className="flex justify-between text-sm border-b border-[#3a4660] py-1">
                    <span>{dim}</span><span className="text-gray-400">{n} finding{n === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}