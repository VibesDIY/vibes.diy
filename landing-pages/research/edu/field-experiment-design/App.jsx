import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const SECTIONS = [
  { id: "population", label: "Population & Eligibility" },
  { id: "treatment", label: "Treatment Arms" },
  { id: "outcomes", label: "Primary & Secondary Outcomes" },
  { id: "hypotheses", label: "Directional Hypotheses" },
  { id: "randomization", label: "Randomization Design" },
  { id: "power", label: "Sample Size & Power" },
  { id: "heterogeneity", label: "Heterogeneity Analyses" },
  { id: "irb", label: "IRB & Subject Welfare" },
  { id: "deviations", label: "Post-Experiment Deviations" },
]

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("pap-designer")
  const { doc: meta, merge: mergeMeta, save: saveMeta } = useDocument({ _id: "plan-meta", title: "", pi: "", registry: "", updatedAt: 0 })

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "sticky top-0 z-10 bg-black border-b border-[#2a3a52] px-4 py-4 flex items-center justify-between",
    title: "text-lg md:text-xl font-bold tracking-tight",
    tagline: "text-xs text-[#9ca3af] hidden md:block",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-5 pb-24",
    section: "bg-black border border-[#2a3a52] rounded-lg p-5",
    h2: "text-base font-bold uppercase tracking-wider mb-3 text-white",
    label: "block text-xs uppercase tracking-wider text-[#9ca3af] mb-1",
    input: "w-full bg-[#0a0a0a] border border-[#2a3a52] rounded px-3 py-3 text-sm text-white focus:outline-none focus:border-white min-h-[44px]",
    textarea: "w-full bg-[#0a0a0a] border border-[#2a3a52] rounded px-3 py-3 text-sm text-white focus:outline-none focus:border-white min-h-[120px] font-mono",
    btn: "min-h-[44px] px-4 py-3 bg-white text-black font-bold text-sm uppercase tracking-wider rounded hover:bg-[#e5e5e5] disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-4 py-3 bg-transparent border border-[#2a3a52] text-white text-sm uppercase tracking-wider rounded hover:border-white",
    avatar: "w-8 h-8 rounded-full border border-[#2a3a52]",
    pill: "inline-block px-2 py-1 text-[10px] uppercase tracking-wider border border-[#2a3a52] rounded text-[#9ca3af]",
    critique: "mt-3 p-3 bg-[#0a0a0a] border border-[#2a3a52] rounded text-xs",
    deviationRow: "p-3 bg-[#0a0a0a] border border-[#2a3a52] rounded mb-2",
    readonly: "text-sm text-[#9ca3af] whitespace-pre-wrap",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>PRE-ANALYSIS PLAN DESIGNER</div>
          <div className={c.tagline}>Reference-Dependent Labor Supply // Field Experiment Protocol</div>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            <span className="text-xs hidden md:inline">{viewer.displayName ?? viewer.userSlug}</span>
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="plan-meta" className={c.section}>
          <h2 className={c.h2}>Plan Identification</h2>
          {!can("write") ? (
            <div className={c.readonly}>
              <div><span className={c.pill}>TITLE</span> {meta.title || "(untitled)"}</div>
              <div className="mt-2"><span className={c.pill}>PI</span> {meta.pi || "—"}</div>
              <div className="mt-2"><span className={c.pill}>REGISTRY</span> {meta.registry || "—"}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={c.label}>Plan Title</label>
                <input className={c.input} value={meta.title} onChange={(e) => mergeMeta({ title: e.target.value })} onBlur={() => { mergeMeta({ updatedAt: Date.now() }); saveMeta() }} placeholder="Reference points and labor supply among rideshare drivers" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Principal Investigator</label>
                  <input className={c.input} value={meta.pi} onChange={(e) => mergeMeta({ pi: e.target.value })} onBlur={() => saveMeta()} placeholder="Name, affiliation" />
                </div>
                <div>
                  <label className={c.label}>Registry</label>
                  <input className={c.input} value={meta.registry} onChange={(e) => mergeMeta({ registry: e.target.value })} onBlur={() => saveMeta()} placeholder="AEA RCT Registry" />
                </div>
              </div>
              <div className="text-xs text-[#9ca3af]">Last updated: {meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : "—"}</div>
            </div>
          )}
        </section>

        {SECTIONS.filter(s => s.id !== "deviations").map((s) => (
          <SectionEditor key={s.id} section={s} c={c} can={can} database={database} useDocument={useDocument} />
        ))}
        <section id="section-deviations" className={c.section}>
          <h2 className={c.h2}>Post-Experiment Deviations</h2>
          <DeviationLog c={c} can={can} />
        </section>
      </main>
    </div>
  )
}

const PROMPTS = {
  population: "Suggest concise text defining the rideshare-driver target population, eligibility criteria, recruitment channel, and exclusion rules.",
  treatment: "Suggest two treatment arms manipulating salience of a daily earnings reference point via a randomized message; specify control.",
  outcomes: "Suggest the primary outcome (hours worked that day after message) and 2-3 secondary outcomes with measurement detail.",
  hypotheses: "Suggest directional hypotheses contrasting reference-dependent preferences with loss aversion against a standard intertemporal income-smoothing model.",
  randomization: "Suggest a randomization design: unit of randomization, stratification, blocking, and assignment mechanism.",
  power: "Suggest a sample size justification: MDE, alpha, power, assumed variance, citations from prior rideshare studies.",
  heterogeneity: "Suggest pre-specified heterogeneity analyses across driver tenure, baseline earnings, and prior-day shortfall vs. reference.",
  irb: "Suggest IRB protocol language on subject welfare, no-deception, bounded rationality respect, and debriefing plan.",
}

function SectionEditor({ section, c, can, database, useDocument }) {
  const docId = `section-${section.id}`
  const { doc, merge, save } = useDocument({ _id: docId, sectionId: section.id, body: "", critique: null, updatedAt: 0 })
  const [loading, setLoading] = React.useState(false)
  const [suggesting, setSuggesting] = React.useState(false)

  async function evaluate() {
    if (!doc.body.trim()) return
    setLoading(true)
    try {
      const raw = await callAI(`You are reviewing a pre-analysis plan section titled "${section.label}" for a field experiment on rideshare driver labor supply. Critique for internal consistency and common pre-registration pitfalls (underspecified exclusion, ambiguous hypothesis direction, p-hacking risks). Score clarity 1-10. Section text:\n\n${doc.body}`, {
        schema: { properties: { clarityScore: { type: "number" }, issues: { type: "array", items: { type: "string" } }, revision: { type: "string" } } }
      })
      const parsed = JSON.parse(raw)
      merge({ critique: parsed, updatedAt: Date.now() })
      await save()
    } finally { setLoading(false) }
  }

  async function suggestDraft() {
    setSuggesting(true)
    try {
      const raw = await callAI(PROMPTS[section.id] || "Draft this section concisely.", {
        schema: { properties: { draft: { type: "string" } } }
      })
      const parsed = JSON.parse(raw)
      merge({ body: parsed.draft, updatedAt: Date.now() })
      await save()
    } finally { setSuggesting(false) }
  }

  const Spinner = () => <svg className="animate-spin inline w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>

  return (
    <section id={`section-${section.id}`} className={c.section}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={c.h2} style={{ marginBottom: 0 }}>{section.label}</h2>
        {doc.critique && <span className={c.pill}>CLARITY {doc.critique.clarityScore}/10</span>}
      </div>
      {!can("write") ? (
        <div className={c.readonly}>{doc.body || "(empty)"}</div>
      ) : (
        <>
          <textarea className={c.textarea} value={doc.body} onChange={(e) => merge({ body: e.target.value })} onBlur={() => { merge({ updatedAt: Date.now() }); save() }} placeholder={`Draft your ${section.label.toLowerCase()} here...`} />
          <div className="flex flex-wrap gap-2 mt-3">
            <button className={c.btn} onClick={evaluate} disabled={loading || !doc.body.trim()}>
              {loading ? <>Evaluating<Spinner /></> : "Evaluate"}
            </button>
            <button className={c.btnGhost} onClick={suggestDraft} disabled={suggesting}>
              {suggesting ? <>Suggesting<Spinner /></> : "AI Suggest"}
            </button>
          </div>
        </>
      )}
      {doc.critique && (
        <div className={c.critique}>
          <div className="font-bold uppercase tracking-wider mb-2">Critique</div>
          {doc.critique.issues?.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 mb-2">
              {doc.critique.issues.map((iss, i) => <li key={i}>{iss}</li>)}
            </ul>
          )}
          {doc.critique.revision && <div className="text-[#9ca3af] mt-2"><span className="text-white font-bold">Proposed revision: </span>{doc.critique.revision}</div>}
        </div>
      )}
    </section>
  )
}

function DeviationLog({ c, can }) {
  const { useLiveQuery, useDocument, database } = useFireproof("pap-designer")
  const { doc, merge, submit } = useDocument({ type: "deviation", summary: "", reason: "", impact: "", createdAt: Date.now() })
  const { docs } = useLiveQuery("type", { key: "deviation", descending: true })

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.summary.trim()) return
    merge({ createdAt: Date.now() })
    submit()
  }

  return (
    <>
      <p className="text-xs text-[#9ca3af] mb-3">Append-only log. Record each deviation with reason and inference impact.</p>
      {can("write") && (
        <form onSubmit={handleSubmit} className="space-y-2 mb-4">
          <input className={c.input} placeholder="Deviation summary" value={doc.summary} onChange={(e) => merge({ summary: e.target.value })} />
          <input className={c.input} placeholder="Reason" value={doc.reason} onChange={(e) => merge({ reason: e.target.value })} />
          <input className={c.input} placeholder="Effect on inference strength" value={doc.impact} onChange={(e) => merge({ impact: e.target.value })} />
          <button type="submit" className={c.btn}>Log Deviation</button>
        </form>
      )}
      {docs.length === 0 && <div className="text-xs text-[#9ca3af]">No deviations logged yet.</div>}
      {docs.map((d) => (
        <div key={d._id} className={c.deviationRow}>
          <div className="text-xs text-[#9ca3af]">{new Date(d.createdAt).toLocaleString()}</div>
          <div className="text-sm font-bold mt-1">{d.summary}</div>
          <div className="text-xs mt-1"><span className={c.pill}>REASON</span> <span className="text-[#9ca3af]">{d.reason}</span></div>
          <div className="text-xs mt-1"><span className={c.pill}>IMPACT</span> <span className="text-[#9ca3af]">{d.impact}</span></div>
        </div>
      ))}
    </>
  )
}