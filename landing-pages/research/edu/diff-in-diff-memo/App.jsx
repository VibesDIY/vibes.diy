import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("did-design-studio")
  const { docs: critiques } = useLiveQuery("section", { descending: true })
  const critiqueFor = (s) => critiques.find((d) => d.section === s)
  const [loading, setLoading] = React.useState({})

  async function critique(section, content) {
    setLoading((l) => ({ ...l, [section]: true }))
    try {
      const res = await callAI(
        `You are a senior methodologist reviewing a difference-in-differences design memo. Section: ${section}. Analyst wrote: ${JSON.stringify(content)}. Return structured critique: assumption_gaps (array of gaps in the identifying assumption), threats (array of threats to identification), suggestions (array of concrete improvements). Be specific to staggered Medicaid expansion at the county level.`,
        { schema: { properties: { assumption_gaps: { type: "array", items: { type: "string" } }, threats: { type: "array", items: { type: "string" } }, suggestions: { type: "array", items: { type: "string" } } } } }
      )
      const parsed = JSON.parse(res)
      await database.put({ section, content, critique: parsed, createdAt: Date.now(), author: viewer?.userSlug })
    } finally {
      setLoading((l) => ({ ...l, [section]: false }))
    }
  }

  const Spinner = () => (
    <svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
  )

  function Robustness() {
    const { doc, merge, save } = useDocument({ _id: "robustness", section: "robustness", synthetic: "", psm: "", iv: "" })
    if (!can("write")) {
      return (
        <section id="robustness" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>05 · Robustness Plan</h2>
          <div className="text-xs space-y-2"><div><span className="text-gray-400">Synthetic control:</span> {doc.synthetic || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">PSM:</span> {doc.psm || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">IV:</span> {doc.iv || <span className={c.readonly}>(empty)</span>}</div></div>
          <Critique section="robustness" />
        </section>
      )
    }
    return (
      <section id="robustness" className={c.section}>
        <h2 className={c.h2} style={c.h2Font}>05 · Robustness Plan</h2>
        <p className="text-xs text-gray-400 mb-2">Triangulate the DiD finding with alternative designs.</p>
        <label className={c.label}>Synthetic control (donor pool, predictors, fit window)</label>
        <textarea className={c.textarea} value={doc.synthetic} onChange={(e) => merge({ synthetic: e.target.value })} placeholder="Donor pool: never-expanded counties. Match on 2014-2017 ED trajectories + covariates..." />
        <label className={c.label}>Propensity score on county-year observations</label>
        <textarea className={c.textarea} value={doc.psm} onChange={(e) => merge({ psm: e.target.value })} placeholder="Estimate propensity for expansion timing on poverty, uninsured rate, RUCC; assess overlap..." />
        <label className={c.label}>Instrumental variables (if a plausible instrument exists)</label>
        <textarea className={c.textarea} value={doc.iv} onChange={(e) => merge({ iv: e.target.value })} placeholder="Candidate: state legislative composition at expansion window. Discuss relevance + exclusion..." />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn} disabled={loading.robustness} onClick={() => critique("robustness", doc)}>{loading.robustness ? <Spinner /> : "Request review"}</button>
        </div>
        <Critique section="robustness" />
      </section>
    )
  }

  function Heterogeneity() {
    const { doc, merge, save } = useDocument({ _id: "heterogeneity", section: "heterogeneity", estimand: "", subgroups: "" })
    const estimands = ["Overall ATT", "Event-study ATT(g,t)", "CATE by covariate"]
    if (!can("write")) {
      return (
        <section id="heterogeneity" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>04 · Heterogeneity & Estimand</h2>
          <div className="text-xs space-y-2"><div><span className="text-gray-400">Estimand:</span> {doc.estimand || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Subgroups:</span> {doc.subgroups || <span className={c.readonly}>(empty)</span>}</div></div>
          <Critique section="heterogeneity" />
        </section>
      )
    }
    async function suggest() {
      setLoading((l) => ({ ...l, "het-sug": true }))
      try {
        const res = await callAI(
          `Pre-specify subgroups for heterogeneity analysis in a county-level Medicaid expansion DiD on ED visits. Covariates available: poverty, baseline uninsured rate, rural-urban classification, hospital beds. Return as semicolon-separated string.`,
          { schema: { properties: { subgroups: { type: "string" } } } }
        )
        merge({ subgroups: JSON.parse(res).subgroups })
      } finally { setLoading((l) => ({ ...l, "het-sug": false })) }
    }
    return (
      <section id="heterogeneity" className={c.section}>
        <h2 className={c.h2} style={c.h2Font}>04 · Heterogeneity & Estimand</h2>
        <p className="text-xs text-gray-400 mb-2">Choose an estimand; pre-register subgroups before touching data.</p>
        <label className={c.label}>Target estimand</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {estimands.map((e) => (
            <button key={e} className={doc.estimand === e ? c.btn : c.btnGhost} onClick={() => merge({ estimand: e })}>{e}</button>
          ))}
        </div>
        <label className={c.label}>Pre-specified subgroups</label>
        <textarea className={c.textarea} value={doc.subgroups} onChange={(e) => merge({ subgroups: e.target.value })} placeholder="baseline uninsured rate (Q1 vs Q4); rural vs urban (RUCC 1-3 vs 4-9)..." />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn} disabled={loading.heterogeneity} onClick={() => critique("heterogeneity", doc)}>{loading.heterogeneity ? <Spinner /> : "Request review"}</button>
          <button className={c.suggest} disabled={loading["het-sug"]} onClick={suggest}>{loading["het-sug"] ? <Spinner /> : "Suggest subgroups"}</button>
        </div>
        <Critique section="heterogeneity" />
      </section>
    )
  }

  function Estimator() {
    const { doc, merge, save } = useDocument({ _id: "estimator", section: "estimator", choice: "", justification: "" })
    const options = ["Callaway-Sant'Anna", "Sun-Abraham", "de Chaisemartin-D'Haultfœuille", "Borusyak-Jaravel-Spiess", "TWFE"]
    if (!can("write")) {
      return (
        <section id="estimator" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>03 · Estimator Family</h2>
          <div className="text-xs space-y-2"><div><span className="text-gray-400">Choice:</span> {doc.choice || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Justification:</span> {doc.justification || <span className={c.readonly}>(empty)</span>}</div></div>
          <Critique section="estimator" />
        </section>
      )
    }
    return (
      <section id="estimator" className={c.section}>
        <h2 className={c.h2} style={c.h2Font}>03 · Estimator Family</h2>
        <p className="text-xs text-gray-400 mb-2">Staggered adoption ⇒ avoid TWFE (Goodman-Bacon 2021). Group-time ATT estimators are preferred.</p>
        <div className="flex flex-wrap gap-1 my-2">
          {options.map((o) => (
            <button key={o} className={doc.choice === o ? c.btn : c.btnGhost} onClick={() => merge({ choice: o })}>{o}</button>
          ))}
        </div>
        <label className={c.label}>Justification</label>
        <textarea className={c.textarea} value={doc.justification} onChange={(e) => merge({ justification: e.target.value })} placeholder="CS handles staggered adoption, reports group-time ATTs, aggregates to event-study or overall ATT..." />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn} disabled={loading.estimator} onClick={() => critique("estimator", doc)}>{loading.estimator ? <Spinner /> : "Request review"}</button>
        </div>
        <Critique section="estimator" />
      </section>
    )
  }

  function ParallelTrends() {
    const { doc, merge, save } = useDocument({ _id: "parallel-trends", section: "parallel-trends", narrative: "", staggered: "", threats: "" })
    if (!can("write")) {
      return (
        <section id="parallel-trends" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>02 · Identifying Assumption</h2>
          <div className="text-xs space-y-2"><div><span className="text-gray-400">Narrative:</span> {doc.narrative || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Staggered:</span> {doc.staggered || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Threats:</span> {doc.threats || <span className={c.readonly}>(empty)</span>}</div></div>
          <Critique section="parallel-trends" />
        </section>
      )
    }
    async function suggest() {
      setLoading((l) => ({ ...l, "pt-sug": true }))
      try {
        const res = await callAI(
          `Draft a parallel-trends narrative for a county-level Medicaid expansion DiD study (2018-2024, staggered adoption, outcome = ED visits per 1000). Also list 4 threats to identification specific to this setting.`,
          { schema: { properties: { narrative: { type: "string" }, threats: { type: "array", items: { type: "string" } } } } }
        )
        const p = JSON.parse(res)
        merge({ narrative: p.narrative, threats: p.threats.join("; "), staggered: "Yes — waves" })
      } finally { setLoading((l) => ({ ...l, "pt-sug": false })) }
    }
    return (
      <section id="parallel-trends" className={c.section}>
        <h2 className={c.h2} style={c.h2Font}>02 · Identifying Assumption</h2>
        <p className="text-xs text-gray-400 mb-2">Articulate parallel trends in the language of your case. Flag staggered adoption.</p>
        <label className={c.label}>Parallel trends narrative</label>
        <textarea className={c.textarea} value={doc.narrative} onChange={(e) => merge({ narrative: e.target.value })} placeholder="Absent expansion, ED utilization would have evolved..." />
        <label className={c.label}>Staggered adoption?</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {["Yes — waves", "No — single date"].map((opt) => (
            <button key={opt} className={doc.staggered === opt ? c.btn : c.btnGhost} onClick={() => merge({ staggered: opt })}>{opt}</button>
          ))}
        </div>
        <label className={c.label}>Threats to identification</label>
        <textarea className={c.textarea} value={doc.threats} onChange={(e) => merge({ threats: e.target.value })} placeholder="ACA navigators, hospital closures, opioid policy..." />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn} disabled={loading["parallel-trends"]} onClick={() => critique("parallel-trends", doc)}>{loading["parallel-trends"] ? <Spinner /> : "Request review"}</button>
          <button className={c.suggest} disabled={loading["pt-sug"]} onClick={suggest}>{loading["pt-sug"] ? <Spinner /> : "Suggest draft"}</button>
        </div>
        <Critique section="parallel-trends" />
      </section>
    )
  }

  function PanelSetup() {
    const { doc, merge, save } = useDocument({ _id: "panel-setup", section: "panel-setup", unit: "", time: "", treatment: "", outcome: "", covariates: "" })
    if (!can("write")) {
      return (
        <section id="panel-setup" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>01 · Panel Setup</h2>
          <div className="text-xs space-y-1"><div><span className="text-gray-400">Unit:</span> {doc.unit || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Time:</span> {doc.time || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Treatment:</span> {doc.treatment || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Outcome:</span> {doc.outcome || <span className={c.readonly}>(empty)</span>}</div><div><span className="text-gray-400">Covariates:</span> {doc.covariates || <span className={c.readonly}>(empty)</span>}</div></div>
          <Critique section="panel-setup" />
        </section>
      )
    }
    async function fillExample() {
      merge({ unit: "county (FIPS)", time: "2018–2024 annual", treatment: "Medicaid expansion (staggered adoption)", outcome: "ED visits per 1000 residents", covariates: "poverty rate, baseline uninsured rate, rural-urban classification, hospital beds per capita" })
    }
    return (
      <section id="panel-setup" className={c.section}>
        <h2 className={c.h2} style={c.h2Font}>01 · Panel Setup</h2>
        <p className="text-xs text-gray-400 mb-2">Specify the unit, time, treatment, and outcome under the potential outcomes framework.</p>
        <label className={c.label}>Unit of analysis</label>
        <input className={c.input} value={doc.unit} onChange={(e) => merge({ unit: e.target.value })} placeholder="e.g. county" />
        <label className={c.label}>Time periods</label>
        <input className={c.input} value={doc.time} onChange={(e) => merge({ time: e.target.value })} placeholder="e.g. 2018–2024 annual" />
        <label className={c.label}>Treatment</label>
        <input className={c.input} value={doc.treatment} onChange={(e) => merge({ treatment: e.target.value })} placeholder="e.g. Medicaid expansion" />
        <label className={c.label}>Outcome Y</label>
        <input className={c.input} value={doc.outcome} onChange={(e) => merge({ outcome: e.target.value })} placeholder="e.g. ED visits per 1000" />
        <label className={c.label}>Covariates X</label>
        <textarea className={c.textarea} value={doc.covariates} onChange={(e) => merge({ covariates: e.target.value })} placeholder="poverty rate, baseline insurance rate, rural-urban, bed supply" />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn} disabled={loading["panel-setup"]} onClick={() => critique("panel-setup", doc)}>{loading["panel-setup"] ? <Spinner /> : "Request review"}</button>
          <button className={c.suggest} onClick={fillExample}>Suggest example</button>
        </div>
        <Critique section="panel-setup" />
      </section>
    )
  }

  const Critique = ({ section }) => {
    const d = critiqueFor(section)
    if (!d?.critique) return null
    return (
      <div className={c.crit}>
        <div className="font-bold uppercase tracking-wider text-[10px] mb-2">Methodologist review</div>
        {d.critique.assumption_gaps?.length > 0 && <div className="mb-2"><div className="text-gray-400 text-[10px] uppercase">Assumption gaps</div><ul className="list-disc pl-4">{d.critique.assumption_gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        {d.critique.threats?.length > 0 && <div className="mb-2"><div className="text-gray-400 text-[10px] uppercase">Threats</div><ul className="list-disc pl-4">{d.critique.threats.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        {d.critique.suggestions?.length > 0 && <div><div className="text-gray-400 text-[10px] uppercase">Suggestions</div><ul className="list-disc pl-4">{d.critique.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      </div>
    )
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#2d3748] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-2xl font-black tracking-tight",
    titleFont: { fontFamily: "'Archivo Black', sans-serif" },
    tagline: "text-xs text-gray-400 mt-1 uppercase tracking-widest",
    badge: "inline-block text-[10px] px-2 py-1 border border-[#2d3748] rounded ml-2 uppercase tracking-wider",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-5 pb-24",
    section: "bg-black border border-[#2d3748] rounded-lg p-5",
    h2: "text-lg font-bold uppercase tracking-wider mb-3 flex items-center gap-2",
    h2Font: { fontFamily: "'Archivo Black', sans-serif" },
    label: "block text-xs uppercase tracking-wider text-gray-400 mb-1 mt-3",
    input: "w-full bg-[#0a0a0a] border border-[#2d3748] rounded px-3 py-3 text-sm text-white focus:outline-none focus:border-white min-h-[44px]",
    textarea: "w-full bg-[#0a0a0a] border border-[#2d3748] rounded px-3 py-3 text-sm text-white focus:outline-none focus:border-white min-h-[100px]",
    btn: "px-4 py-3 bg-white text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-gray-200 disabled:opacity-50 min-h-[44px]",
    btnGhost: "px-3 py-2 border border-[#2d3748] text-white text-xs uppercase tracking-wider rounded hover:border-white min-h-[36px]",
    suggest: "text-[10px] px-2 py-1 border border-[#2d3748] rounded text-gray-400 hover:text-white hover:border-white uppercase tracking-wider",
    chip: "inline-block text-xs px-2 py-1 border border-[#2d3748] rounded mr-2 mb-2",
    crit: "mt-3 p-3 bg-[#0a0a0a] border-l-2 border-white text-xs leading-relaxed",
    readonly: "text-xs text-gray-500 italic",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={c.titleFont}>DiD Design Studio</h1>
        <p className={c.tagline}>
          Methods memo · pre-analysis
          {viewer && <span className={c.badge}>{can("write") ? "Editor" : "Reader"}</span>}
        </p>
      </header>
      <main id="app" className={c.main}>
        <PanelSetup />
        <ParallelTrends />
        <Estimator />
        <Heterogeneity />
        <Robustness />
      </main>
    </div>
  )
}