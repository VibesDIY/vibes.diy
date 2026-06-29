import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AnalyticsRenderer({ cases, analyticsRef }) {
  React.useEffect(() => {
    if (!analyticsRef.current) return
    const el = analyticsRef.current
    el.innerHTML = ""
    if (cases.length === 0) {
      el.innerHTML = '<p style="font-size:11px;color:#9aa5c4;padding:1rem">No cases yet — analytics will populate as cases are opened.</p>'
      return
    }
    const counts = d3.rollup(cases, v => v.length, d => d.algorithmFamily)
    const data = Array.from(counts, ([family, n]) => ({ family, n })).sort((a,b) => b.n - a.n)
    const W = 320, H = 200, M = { t: 10, r: 10, b: 60, l: 30 }
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%")
    const x = d3.scaleBand().domain(data.map(d => d.family)).range([M.l, W - M.r]).padding(0.2)
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.n) || 1]).range([H - M.b, M.t])
    svg.append("g").selectAll("rect").data(data).enter().append("rect")
      .attr("x", d => x(d.family)).attr("y", d => y(d.n))
      .attr("width", x.bandwidth()).attr("height", d => H - M.b - y(d.n))
      .attr("fill", "#fafafa")
    svg.append("g").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-30)").attr("text-anchor", "end")
      .style("font-size", "8px").style("fill", "#9aa5c4")
    svg.append("g").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(4))
      .selectAll("text").style("font-size", "9px").style("fill", "#9aa5c4")
    svg.selectAll("path,line").style("stroke", "#3a4a6a")
  }, [cases, analyticsRef])
  return null
}

function FindingsBlock({ activeCase, database, useLiveQuery, can, c, aiLoading, setAiLoading }) {
  const { docs } = useLiveQuery("caseId", { key: activeCase._id })
  const rubric = docs.filter(d => d.type === "rubric")
  const flags = docs.filter(d => d.type === "flag")
  const findings = docs.filter(d => d.type === "findings").sort((a,b) => b.at - a.at)
  const latest = findings[0]

  async function generate() {
    setAiLoading(true)
    try {
      const prompt = `You are a federal ML model auditor. Generate a structured findings document for this case.
Case: ${activeCase.org} (${activeCase.industry})
Algorithm: ${activeCase.algorithmFamily}
Purpose: ${activeCase.purpose}
Training Data: ${activeCase.trainingData}
Rubric verdicts: ${rubric.map(r => `${r.dimension}: ${r.verdict}`).join("; ")}
Subgroup flags: ${flags.map(f => f.text).join("; ")}
Return cited deficiencies, per-dimension risk ratings, recommended enforcement actions, and a plain-language summary.`
      const r = await callAI(prompt, { schema: { properties: {
        summary: { type: "string", description: "Plain-language summary for enforcement workflow" },
        deficiencies: { type: "array", items: { type: "object", properties: {
          dimension: { type: "string" },
          description: { type: "string" },
          riskRating: { type: "string", description: "Low, Medium, High, Critical" },
        }}},
        recommendedActions: { type: "array", items: { type: "string" } },
      }}})
      const d = JSON.parse(r)
      await database.put({ type: "findings", caseId: activeCase._id, ...d, at: Date.now(), status: "draft" })
    } finally { setAiLoading(false) }
  }

  async function finalize() {
    if (!latest) return
    await database.put({ ...latest, status: "final" })
    const caseUpdated = (await database.get(activeCase._id))
    await database.put({ ...caseUpdated, status: "finalized" })
  }

  return (
    <>
      {can("write") && (
        <button type="button" onClick={generate} disabled={aiLoading} className={c.btn}>
          {aiLoading && <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>}
          {aiLoading ? "Drafting..." : "Generate Findings Draft"}
        </button>
      )}
      {!latest && <div className={c.row}><p className="text-xs text-[#9aa5c4]">No findings drafted yet.</p></div>}
      {latest && (
        <div className={c.row}>
          <div className="flex justify-between mb-2"><span className={c.badge}>{latest.status}</span><span className="text-[9px] text-[#9aa5c4]">{new Date(latest.at).toLocaleString()}</span></div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1">Summary</p>
          <p className="text-xs mb-3">{latest.summary}</p>
          <p className="text-xs font-bold uppercase tracking-widest mb-1">Deficiencies</p>
          {(latest.deficiencies || []).map((d, i) => (
            <div key={i} className="mb-2 pl-2 border-l border-[#3a4a6a]">
              <p className="text-xs"><strong>{d.dimension}</strong> <span className={c.badge}>{d.riskRating}</span></p>
              <p className="text-xs text-[#9aa5c4]">{d.description}</p>
            </div>
          ))}
          <p className="text-xs font-bold uppercase tracking-widest mb-1 mt-2">Recommended Actions</p>
          <ul className="text-xs list-disc list-inside">
            {(latest.recommendedActions || []).map((a,i) => <li key={i}>{a}</li>)}
          </ul>
          {can("write") && latest.status === "draft" && (
            <button type="button" onClick={finalize} className={`${c.btn} mt-3`}>Finalize Findings</button>
          )}
        </div>
      )}
    </>
  )
}

function DocLog({ caseId, database, useLiveQuery, can, c }) {
  const { docs } = useLiveQuery("caseId", { key: caseId })
  const exchanges = docs.filter(d => d.type === "exchange").sort((a,b) => a.at - b.at)
  const [text, setText] = React.useState("")
  const [kind, setKind] = React.useState("request")

  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    await database.put({ type: "exchange", caseId, kind, text: text.trim(), at: Date.now() })
    setText("")
  }

  return (
    <>
      {can("write") && (
        <form onSubmit={add} className="space-y-2">
          <textarea className={c.textarea} value={text} onChange={e => setText(e.target.value)} placeholder={kind === "request" ? "Request documentation..." : "Log submitter response..."} />
          <div className="flex gap-2">
            <button type="submit" onClick={() => setKind("request")} className={c.btn}>Send Request</button>
            <button type="submit" onClick={() => setKind("response")} className={c.btnGhost}>Log Response</button>
          </div>
        </form>
      )}
      <p className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">Exchange Log ({exchanges.length})</p>
      {exchanges.length === 0 && <p className="text-xs text-[#9aa5c4]">No exchanges logged.</p>}
      {exchanges.map(x => (
        <div key={x._id} className={c.row}>
          <span className={c.badge}>{x.kind}</span>
          <p className="text-xs mt-2">{x.text}</p>
          <p className="text-[9px] text-[#9aa5c4] mt-1">{new Date(x.at).toLocaleString()}</p>
        </div>
      ))}
    </>
  )
}

function RubricBlock({ caseId, database, useLiveQuery, can, c }) {
  const dims = [
    "Cross-validation protocol appropriate to data structure",
    "Model selection process documented & defensible",
    "Features engineered without outcome leakage",
    "Algorithm complexity proportionate to decision stakes",
    "Dimensionality reduction does not obscure protected attributes",
  ]
  const { docs: scores } = useLiveQuery("caseId", { key: caseId })
  const scoreMap = Object.fromEntries(scores.filter(s => s.type === "rubric").map(s => [s.dimension, s]))
  const flags = scores.filter(s => s.type === "flag")
  const [flagText, setFlagText] = React.useState("")

  async function setScore(dim, val) {
    const existing = scoreMap[dim]
    await database.put({ ...(existing || {}), _id: existing?._id, type: "rubric", caseId, dimension: dim, verdict: val, at: Date.now() })
  }
  async function addFlag(e) {
    e.preventDefault()
    if (!flagText.trim()) return
    await database.put({ type: "flag", caseId, text: flagText.trim(), at: Date.now() })
    setFlagText("")
  }

  return (
    <>
      {dims.map(dim => {
        const v = scoreMap[dim]?.verdict
        return (
          <div key={dim} className={c.row}>
            <p className="text-xs mb-2">{dim}</p>
            <div className="flex gap-2 flex-wrap">
              {["Pass","Concern","Fail"].map(opt => (
                <button key={opt} type="button" onClick={() => can("write") && setScore(dim, opt)}
                  className={`${c.btnGhost} ${v === opt ? "bg-[#fafafa] text-[#000000]" : ""}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {can("write") && (
        <form onSubmit={addFlag}>
          <label className={c.label}>Subgroup Disparity Flag</label>
          <textarea className={c.textarea} value={flagText} onChange={e => setFlagText(e.target.value)} placeholder="Describe disaggregated metrics needing explanation..." />
          <button type="submit" className={c.btn}>Log Flag</button>
        </form>
      )}
      {flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">Flags ({flags.length})</p>
          {flags.map(f => <div key={f._id} className={c.row}><p className="text-xs">{f.text}</p></div>)}
        </div>
      )}
    </>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("ml-audit-console")
  const [activeCaseId, setActiveCaseId] = React.useState(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const analyticsRef = React.useRef(null)

  const { doc: caseDoc, merge: mergeCase, submit: submitCase } = useDocument({
    type: "case",
    org: "",
    industry: "Lending",
    algorithmFamily: "Logistic Regression",
    purpose: "",
    trainingData: "",
    status: "open",
    createdAt: Date.now(),
  })

  const { docs: cases } = useLiveQuery("type", { key: "case", descending: true })
  const activeCase = cases.find(k => k._id === activeCaseId) || cases[0]

  async function aiSuggestIntake() {
    setSuggestLoading(true)
    try {
      const r = await callAI("Generate a realistic example ML model submission for federal regulatory review. Include a submitter org name, industry, algorithm family, model purpose statement, and training data description.", {
        schema: { properties: {
          org: { type: "string" },
          industry: { type: "string" },
          algorithmFamily: { type: "string" },
          purpose: { type: "string" },
          trainingData: { type: "string" },
        }}
      })
      const d = JSON.parse(r)
      mergeCase(d)
    } finally { setSuggestLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[#28282d] text-[#fafafa] font-mono",
    header: "sticky top-0 z-10 bg-[#000000] border-b border-[#3a4a6a] px-4 py-4 flex flex-col gap-1",
    title: "text-xl font-black tracking-wider uppercase",
    tagline: "text-xs text-[#9aa5c4] uppercase tracking-widest",
    main: "px-4 py-5 max-w-3xl mx-auto space-y-5 pb-24",
    section: "bg-[#000000] border border-[#3a4a6a] rounded-sm p-4 space-y-3",
    h2: "text-sm font-black uppercase tracking-widest text-[#fafafa] border-b border-[#3a4a6a] pb-2",
    label: "block text-[10px] uppercase tracking-widest text-[#9aa5c4] mb-1",
    input: "w-full bg-[#28282d] border border-[#3a4a6a] text-[#fafafa] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-[#fafafa] min-h-[44px]",
    select: "w-full bg-[#28282d] border border-[#3a4a6a] text-[#fafafa] px-3 py-3 text-sm rounded-sm min-h-[44px]",
    textarea: "w-full bg-[#28282d] border border-[#3a4a6a] text-[#fafafa] px-3 py-2 text-sm rounded-sm min-h-[80px]",
    btn: "px-4 py-3 bg-[#fafafa] text-[#000000] text-xs font-black uppercase tracking-widest rounded-sm min-h-[44px] disabled:opacity-50 inline-flex items-center gap-2",
    btnGhost: "px-3 py-2 bg-transparent border border-[#3a4a6a] text-[#fafafa] text-xs uppercase tracking-widest rounded-sm",
    row: "border border-[#3a4a6a] rounded-sm p-3 bg-[#28282d] text-sm",
    badge: "inline-block text-[9px] uppercase tracking-widest px-2 py-1 border border-[#3a4a6a]",
    suggest: "text-[10px] uppercase tracking-widest text-[#9aa5c4] underline",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={{ fontFamily: "Archivo Black, sans-serif" }}>ML Audit Console</h1>
        <p className={c.tagline}>Federal Model Review · Dossier System</p>
      </header>
      <main id="app" className={c.main}>
        <section id="case-intake" className={c.section}>
          <h2 className={c.h2}>Case Intake</h2>
          {can("write") ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">New Submission Dossier</span>
                <button type="button" onClick={aiSuggestIntake} disabled={suggestLoading} className={c.suggest}>
                  {suggestLoading ? "Loading..." : "AI suggest example"}
                </button>
              </div>
              <form onSubmit={submitCase} className="space-y-3">
                <div>
                  <label className={c.label}>Submitter Organization</label>
                  <input className={c.input} value={caseDoc.org} onChange={e => mergeCase({ org: e.target.value })} placeholder="e.g. Acme Lending Corp" />
                </div>
                <div>
                  <label className={c.label}>Industry</label>
                  <select className={c.select} value={caseDoc.industry} onChange={e => mergeCase({ industry: e.target.value })}>
                    <option>Lending</option><option>Hiring</option><option>Insurance Underwriting</option><option>Healthcare Risk</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Algorithm Family</label>
                  <select className={c.select} value={caseDoc.algorithmFamily} onChange={e => mergeCase({ algorithmFamily: e.target.value })}>
                    <option>Logistic Regression</option><option>Decision Trees / Random Forest</option><option>Support Vector Machine</option><option>Neural Network</option><option>Ensemble</option>
                  </select>
                </div>
                <div>
                  <label={c.label}>Stated Model Purpose</label>
                  <textarea className={c.textarea} value={caseDoc.purpose} onChange={e => mergeCase({ purpose: e.target.value })} placeholder="Decision context and stakes..." />
                </div>
                <div>
                  <label className={c.label}>Training Data Description</label>
                  <textarea className={c.textarea} value={caseDoc.trainingData} onChange={e => mergeCase({ trainingData: e.target.value })} placeholder="Sources, size, time window..." />
                </div>
                <button type="submit" className={c.btn}>Open Case</button>
              </form>
            </>
          ) : (
            <p className="text-xs text-[#9aa5c4]">Read-only view — contact the owner for write access.</p>
          )}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">Cases ({cases.length})</p>
            {cases.length === 0 && <p className="text-xs text-[#9aa5c4]">No cases yet.</p>}
            {cases.map(k => (
              <button key={k._id} onClick={() => setActiveCaseId(k._id)} className={`${c.row} w-full text-left ${activeCase?._id === k._id ? "border-[#fafafa]" : ""}`}>
                <div className="flex justify-between"><strong>{k.org || "Untitled"}</strong><span className={c.badge}>{k.status}</span></div>
                <p className="text-xs text-[#9aa5c4] mt-1">{k.industry} · {k.algorithmFamily}</p>
              </button>
            ))}
          </div>
        </section>
        <section id="rubric" className={c.section}>
          <h2 className={c.h2}>Rubric Evaluation</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">
            Active Case: {activeCase ? `${activeCase.org} · ${activeCase.algorithmFamily}` : "— select above —"}
          </p>
          {!activeCase ? <p className="text-xs text-[#9aa5c4]">Open or select a case to score rubric.</p> : (
            <RubricBlock caseId={activeCase._id} database={database} useLiveQuery={useLiveQuery} can={can} c={c} />
          )}
        </section>
        <section id="doc-requests" className={c.section}>
          <h2 className={c.h2}>Documentation Requests</h2>
          {activeCase ? (
            <DocLog caseId={activeCase._id} database={database} useLiveQuery={useLiveQuery} can={can} c={c} />
          ) : <p className="text-xs text-[#9aa5c4]">Select a case to log requests.</p>}
        </section>
        <section id="findings" className={c.section}>
          <h2 className={c.h2}>Structured Findings</h2>
          {activeCase ? (
            <FindingsBlock activeCase={activeCase} database={database} useLiveQuery={useLiveQuery} can={can} c={c} aiLoading={aiLoading} setAiLoading={setAiLoading} />
          ) : <p className="text-xs text-[#9aa5c4]">Select a case to generate findings.</p>}
        </section>
        <section id="analytics" className={c.section}>
          <h2 className={c.h2}>Cross-Submission Analytics</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#9aa5c4]">Algorithm family distribution across cases</p>
          <div ref={analyticsRef} className="w-full overflow-x-auto" />
          <AnalyticsRenderer cases={cases} analyticsRef={analyticsRef} />
        </section>
      </main>
    </div>
  )
}