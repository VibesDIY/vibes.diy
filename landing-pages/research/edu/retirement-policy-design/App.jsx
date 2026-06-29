import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("default-architect")
  const decisionTypes = ["Default contribution rate","Default investment allocation","Auto-escalation schedule","Opt-out mechanics","Employer match structure"]
  const { doc: dDoc, merge: dMerge, submit: dSubmit } = useDocument({ type:"decision", decision: decisionTypes[0], value:"", rationale:"", createdAt: Date.now() })
  const { docs: decisions } = useLiveQuery("type", { key:"decision", descending:true })
  const [aiLoading, setAiLoading] = React.useState(false)
  const mechanisms = ["Present bias","Status quo bias","Loss aversion","Framing","Social preferences","Hyperbolic discounting"]
  const { doc: eDoc, merge: eMerge, submit: eSubmit } = useDocument({ type:"evidence", citation:"", effect:"", year:"", population:"", transport:"", mechanism: mechanisms[0], createdAt: Date.now() })
  const { docs: evidence } = useLiveQuery("type", { key:"evidence", descending:true })
  const [evLoading, setEvLoading] = React.useState(false)
  const { doc: rDoc, merge: rMerge, submit: rSubmit } = useDocument({ type:"redteam", assumption:"", subgroup:"", severity:"Moderate", createdAt: Date.now() })
  const { docs: findings } = useLiveQuery("type", { key:"redteam", descending:true })
  const { doc: sDoc, merge: sMerge, submit: sSubmit } = useDocument({ type:"surveil", subgroup:"", optoutRate:"", unintended:"", createdAt: Date.now() })
  const { docs: surveil } = useLiveQuery("type", { key:"surveil", descending:true })
  async function synthesize() {
    if (!can("write")) return
    setEvLoading(true)
    try {
      const r = await callAI(`Summarize the behavioral economics literature on ${eDoc.mechanism} as applied to retirement savings defaults. Suggest a representative study with citation, effect size, population, year, and transportability caveats to the U.S. workforce.`, { schema:{ properties:{ citation:{type:"string"}, effect:{type:"string"}, population:{type:"string"}, year:{type:"string"}, transport:{type:"string"} } } })
      const p = JSON.parse(r); eMerge(p)
    } finally { setEvLoading(false) }
  }
  async function draftRationale() {
    if (!can("write")) return
    setAiLoading(true)
    try {
      const r = await callAI(`Draft a behavioral economics rationale (3-4 sentences) for setting ${dDoc.decision} to "${dDoc.value||"a sensible default"}" in a U.S. retirement savings program. Cite mechanisms like present bias, status quo bias, loss aversion.`, { schema: { properties: { rationale: { type:"string" } } } })
      dMerge({ rationale: JSON.parse(r).rationale })
    } finally { setAiLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.16_0_0)] text-[oklch(1_0_0)] font-mono",
    header: "border-b border-[oklch(0.28_0.03_257)] bg-[oklch(0_0_0)] px-4 py-5 sticky top-0 z-10",
    brand: "text-xl tracking-wider uppercase",
    brandAccent: "font-black",
    tagline: "text-xs opacity-60 mt-1 tracking-wide",
    main: "px-4 py-5 space-y-5 max-w-3xl mx-auto pb-24",
    section: "border border-[oklch(0.28_0.03_257)] bg-[oklch(0_0_0)] p-4 rounded",
    sectionHeading: "text-sm uppercase tracking-widest border-b border-[oklch(0.28_0.03_257)] pb-2 mb-3 font-black",
    label: "block text-xs uppercase tracking-wider opacity-70 mb-1",
    input: "w-full bg-[oklch(0.16_0_0)] border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] px-3 py-3 rounded text-sm min-h-[44px] font-mono",
    textarea: "w-full bg-[oklch(0.16_0_0)] border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] px-3 py-3 rounded text-sm font-mono",
    btn: "min-h-[44px] px-4 py-3 bg-[oklch(1_0_0)] text-[oklch(0_0_0)] uppercase tracking-wider text-xs font-black rounded disabled:opacity-40",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] uppercase tracking-wider text-xs rounded",
    row: "border border-[oklch(0.28_0.03_257)] bg-[oklch(0.16_0_0)] p-3 rounded mb-2",
    pill: "inline-block text-[10px] uppercase tracking-wider border border-[oklch(0.28_0.03_257)] px-2 py-0.5 rounded mr-1",
    muted: "text-xs opacity-60",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>DEFAULT <span className={c.brandAccent}>ARCHITECT</span></div>
        <div className={c.tagline}>Choice architecture dossier — retirement savings rulemaking</div>
      </header>
      <main id="app" className={c.main}>
        <section id="decisions" className={c.section}>
          <h2 className={c.sectionHeading}>01 · Decision Records</h2>
          {can("write") ? (
            <form onSubmit={dSubmit} className="space-y-3 mb-4">
              <div>
                <label className={c.label}>Decision</label>
                <select className={c.input} value={dDoc.decision} onChange={e=>dMerge({decision:e.target.value})}>
                  {decisionTypes.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={c.label}>Proposed value</label>
                <input className={c.input} value={dDoc.value} onChange={e=>dMerge({value:e.target.value})} placeholder="e.g. 6% of gross wages" />
              </div>
              <div>
                <label className={c.label}>Behavioral rationale</label>
                <textarea className={c.textarea} rows={3} value={dDoc.rationale} onChange={e=>dMerge({rationale:e.target.value})} placeholder="Why this default — link to behavioral mechanism" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={c.btn}>Record Decision</button>
                <button type="button" onClick={draftRationale} disabled={aiLoading} className={c.btnGhost}>
                  {aiLoading ? <svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg> : "AI Draft Rationale"}
                </button>
              </div>
            </form>
          ) : <div className={c.muted}>Read-only view — contact the owner for write access.</div>}
          <div className="space-y-2">
            {decisions.length===0 && <div className={c.muted}>No decisions recorded yet.</div>}
            {decisions.map(d=>(
              <div key={d._id} className={c.row}>
                <div className={c.pill}>{d.decision}</div>
                <div className="text-sm font-black mt-1">{d.value}</div>
                <div className={c.muted+" mt-1"}>{d.rationale}</div>
              </div>
            ))}
          </div>
        </section>
        <section id="evidence" className={c.section}>
          <h2 className={c.sectionHeading}>02 · Evidence Cards</h2>
          {can("write") ? (
            <form onSubmit={eSubmit} className="space-y-3 mb-4">
              <div><label className={c.label}>Study citation</label><input className={c.input} value={eDoc.citation} onChange={e=>eMerge({citation:e.target.value})} placeholder="Madrian & Shea 2001" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={c.label}>Effect size</label><input className={c.input} value={eDoc.effect} onChange={e=>eMerge({effect:e.target.value})} placeholder="+50pp" /></div>
                <div><label className={c.label}>Year</label><input className={c.input} value={eDoc.year} onChange={e=>eMerge({year:e.target.value})} placeholder="2001" /></div>
              </div>
              <div><label className={c.label}>Population</label><input className={c.input} value={eDoc.population} onChange={e=>eMerge({population:e.target.value})} /></div>
              <div><label className={c.label}>Transportability</label><textarea className={c.textarea} rows={2} value={eDoc.transport} onChange={e=>eMerge({transport:e.target.value})} /></div>
              <div><label className={c.label}>Mechanism</label>
                <select className={c.input} value={eDoc.mechanism} onChange={e=>eMerge({mechanism:e.target.value})}>{mechanisms.map(m=><option key={m}>{m}</option>)}</select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={c.btn}>Attach</button>
                <button type="button" onClick={synthesize} disabled={evLoading} className={c.btnGhost}>
                  {evLoading ? <svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg> : "AI Synthesis"}
                </button>
              </div>
            </form>
          ) : <div className={c.muted}>Read-only view.</div>}
          <div className="space-y-2">
            {evidence.length===0 && <div className={c.muted}>No evidence cards yet.</div>}
            {evidence.map(ev=>(
              <div key={ev._id} className={c.row}>
                <span className={c.pill}>{ev.mechanism}</span><span className={c.pill}>{ev.year}</span>
                <div className="text-sm font-black mt-1">{ev.citation}</div>
                <div className="text-xs mt-1">Effect: {ev.effect}</div>
                <div className={c.muted+" mt-1"}>Pop: {ev.population}</div>
                <div className={c.muted+" mt-1"}>Transport: {ev.transport}</div>
              </div>
            ))}
          </div>
        </section>
        <section id="redteam" className={c.section}>
          <h2 className={c.sectionHeading}>03 · Red-Team Findings</h2>
          {can("write") ? (
            <form onSubmit={rSubmit} className="space-y-3 mb-4">
              <div><label className={c.label}>Load-bearing assumption</label><textarea className={c.textarea} rows={2} value={rDoc.assumption} onChange={e=>rMerge({assumption:e.target.value})} /></div>
              <div><label className={c.label}>Subgroup at risk</label><input className={c.input} value={rDoc.subgroup} onChange={e=>rMerge({subgroup:e.target.value})} /></div>
              <div><label className={c.label}>Severity</label>
                <select className={c.input} value={rDoc.severity} onChange={e=>rMerge({severity:e.target.value})}>
                  <option>Low</option><option>Moderate</option><option>High</option><option>Critical</option>
                </select>
              </div>
              <button type="submit" className={c.btn}>File Finding</button>
            </form>
          ) : <div className={c.muted}>Read-only view.</div>}
          <div className="space-y-2">
            {findings.length===0 && <div className={c.muted}>No red-team findings yet.</div>}
            {findings.map(f=>(
              <div key={f._id} className={c.row}>
                <span className={c.pill}>{f.severity}</span>
                <div className="text-sm font-black mt-1">{f.assumption}</div>
                <div className={c.muted+" mt-1"}>Subgroup: {f.subgroup}</div>
              </div>
            ))}
          </div>
        </section>
        <section id="surveillance" className={c.section}>
          <h2 className={c.sectionHeading}>04 · Post-Implementation Registry</h2>
          {can("write") ? (
            <form onSubmit={sSubmit} className="space-y-3 mb-4">
              <div><label className={c.label}>Subgroup observed</label><input className={c.input} value={sDoc.subgroup} onChange={e=>sMerge({subgroup:e.target.value})} placeholder="e.g. workers earning <$25k" /></div>
              <div><label className={c.label}>Opt-out rate</label><input className={c.input} value={sDoc.optoutRate} onChange={e=>sMerge({optoutRate:e.target.value})} placeholder="e.g. 34% vs projected 12%" /></div>
              <div><label className={c.label}>Unintended outcome</label><textarea className={c.textarea} rows={2} value={sDoc.unintended} onChange={e=>sMerge({unintended:e.target.value})} placeholder="What did the default nudge people into?" /></div>
              <button type="submit" className={c.btn}>Log Observation</button>
            </form>
          ) : <div className={c.muted}>Read-only view.</div>}
          <div className="space-y-2">
            {surveil.length===0 && <div className={c.muted}>No surveillance entries yet.</div>}
            {surveil.map(s=>(
              <div key={s._id} className={c.row}>
                <div className="text-sm font-black">{s.subgroup}</div>
                <div className="text-xs mt-1">Opt-out: {s.optoutRate}</div>
                <div className={c.muted+" mt-1"}>{s.unintended}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}