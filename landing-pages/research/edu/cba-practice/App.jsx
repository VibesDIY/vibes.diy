import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("policy-lab")
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario", descending: true, limit: 20 })
  const { docs: masteryDocs } = useLiveQuery("type", { key: "mastery" })
  const { docs: evaluations } = useLiveQuery("type", { key: "evaluation", descending: true, limit: 10 })
  const [currentScenarioId, setCurrentScenarioId] = React.useState(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isEvaluating, setIsEvaluating] = React.useState(false)
  const [analysis, setAnalysis] = React.useState({ monetizedCosts: "", monetizedBenefits: "", unmonetized: "", stakeholders: "", discountRate: "3", discountRationale: "", wtp: "" })
  const [openConcept, setOpenConcept] = React.useState(null)

  const currentScenario = scenarios.find(s => s._id === currentScenarioId) || scenarios[0]
  const currentEval = evaluations.find(e => e.scenarioId === currentScenario?._id)

  function weakestConcept() {
    if (!masteryDocs.length) return null
    const sorted = [...masteryDocs].sort((a, b) => (a.score || 0) - (b.score || 0))
    return sorted[0]?.concept
  }

  async function generateScenario() {
    if (!can("write")) return
    setIsGenerating(true)
    const weak = weakestConcept()
    const prompt = `Generate a beginner-friendly cost-benefit analysis practice scenario for an intro public policy student. ${weak ? `Emphasize the concept: ${weak}.` : ""} Pick from: pedestrian bridge, rural bus extension, road safety intervention, park renovation, flood mitigation. Include a sample analyst's reference answer with realistic numbers.`
    try {
      const res = await callAI(prompt, { schema: { properties: {
        title: { type: "string" },
        jurisdiction: { type: "string" },
        horizon: { type: "string" },
        vignette: { type: "string", description: "2-3 sentence policy decision" },
        tags: { type: "array", items: { type: "string" } },
        referenceCosts: { type: "string" },
        referenceBenefits: { type: "string" },
        referenceStakeholders: { type: "string" },
        referenceDiscountRate: { type: "string" },
        referenceWTP: { type: "string" },
      } } })
      const parsed = JSON.parse(res)
      const ok = await database.put({ type: "scenario", createdAt: Date.now(), ...parsed })
      setCurrentScenarioId(ok.id)
      setAnalysis({ monetizedCosts: "", monetizedBenefits: "", unmonetized: "", stakeholders: "", discountRate: "3", discountRationale: "", wtp: "" })
    } finally { setIsGenerating(false) }
  }

  const c = {
    page: "min-h-screen bg-[#f4ead5] text-[#2a1e10] font-serif pb-24",
    header: "sticky top-0 z-10 bg-[#2a1e10] text-[#f4ead5] px-5 py-4 border-b-2 border-[#c97b3f] shadow-sm",
    title: "text-2xl tracking-wide",
    tagline: "text-xs italic text-[#e6d3a3] mt-0.5",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-5",
    section: "bg-[#fbf5e3] border border-[#2a1e10]/15 rounded-lg p-5 shadow-sm",
    sectionTitle: "text-xl font-semibold mb-3 text-[#2a1e10] border-b border-[#c97b3f]/40 pb-2",
    label: "block text-sm font-medium text-[#2a1e10] mb-1",
    input: "w-full min-h-[44px] px-3 py-2 bg-white border border-[#2a1e10]/20 rounded text-[#2a1e10] focus:outline-none focus:border-[#c97b3f]",
    textarea: "w-full min-h-[88px] px-3 py-2 bg-white border border-[#2a1e10]/20 rounded text-[#2a1e10] focus:outline-none focus:border-[#c97b3f]",
    btn: "min-h-[44px] px-4 py-2 bg-[#c97b3f] text-white rounded font-medium hover:bg-[#a8632f] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 bg-transparent text-[#2a1e10] border border-[#2a1e10]/30 rounded text-sm hover:bg-[#2a1e10]/5",
    chip: "inline-block px-2 py-1 bg-[#e6d3a3] text-[#2a1e10] rounded text-xs mr-1 mb-1",
    muted: "text-sm text-[#6b5a44]",
    scoreBar: "h-2 bg-[#e6d3a3] rounded overflow-hidden",
    scoreFill: "h-full bg-[#c97b3f]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Policy Lab</h1>
        <p className={c.tagline}>cost-benefit analysis, one decision at a time</p>
      </header>

      <main id="app" className={c.main}>
        <section id="scenario" className={c.section}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className={c.sectionTitle + " mb-0 border-0 pb-0"}>Today's Scenario</h2>
            {can("write") && (
              <button className={c.btn} onClick={generateScenario} disabled={isGenerating}>
                {isGenerating ? (
                  <svg className="animate-spin inline" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
                ) : "New"}
              </button>
            )}
          </div>
          {!currentScenario ? (
            <p className={c.muted + " mt-2"}>Tap <em>New</em> to generate your first scenario.</p>
          ) : (
            <>
              <h3 className="text-lg font-semibold mt-2">{currentScenario.title}</h3>
              <p className={c.muted + " mt-1 italic"}>{currentScenario.jurisdiction} · {currentScenario.horizon}</p>
              <p className="mt-3 leading-relaxed">{currentScenario.vignette}</p>
              <div className="mt-3 flex flex-wrap">
                {(currentScenario.tags || []).map(t => <span key={t} className={c.chip}>{t}</span>)}
              </div>
              {scenarios.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={c.muted + " self-center text-xs"}>Past:</span>
                  {scenarios.slice(0, 5).map(s => (
                    <button key={s._id} className={c.btnGhost + " text-xs min-h-0 py-1"} onClick={() => setCurrentScenarioId(s._id)}>{s.title?.slice(0, 28)}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section id="workbench" className={c.section}>
          <h2 className={c.sectionTitle}>Your Analysis</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only view — contact the owner to practice scenarios yourself.</p>
          ) : !currentScenario ? (
            <p className={c.muted}>Generate a scenario above to begin.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={c.label}>Monetized costs</label>
                <textarea className={c.textarea} value={analysis.monetizedCosts} onChange={e => setAnalysis({...analysis, monetizedCosts: e.target.value})} placeholder="Construction, maintenance, opportunity costs..." />
              </div>
              <div className="flex items-center justify-between">
                <label className={c.label + " mb-0"}>Monetized benefits</label>
                <button className={c.btnGhost + " text-xs min-h-0 py-1"} disabled={isGenerating} onClick={async () => {
                  setIsGenerating(true)
                  try {
                    const res = await callAI(`For this scenario: ${currentScenario.vignette}. Suggest 3 brief example monetized benefits a student could brainstorm.`, { schema: { properties: { suggestion: { type: "string" } } } })
                    setAnalysis(a => ({ ...a, monetizedBenefits: JSON.parse(res).suggestion }))
                  } finally { setIsGenerating(false) }
                }}>Suggest</button>
              </div>
              <textarea className={c.textarea} value={analysis.monetizedBenefits} onChange={e => setAnalysis({...analysis, monetizedBenefits: e.target.value})} placeholder="Toll revenue, increased property values..." />
              <div>
                <label className={c.label}>Unmonetized costs & benefits</label>
                <textarea className={c.textarea} value={analysis.unmonetized} onChange={e => setAnalysis({...analysis, unmonetized: e.target.value})} placeholder="Quality of life, ecological impact..." />
              </div>
              <div>
                <label className={c.label}>Stakeholders affected</label>
                <textarea className={c.textarea} value={analysis.stakeholders} onChange={e => setAnalysis({...analysis, stakeholders: e.target.value})} placeholder="Whose welfare changes? Residents, commuters, businesses..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Discount rate (%)</label>
                  <input className={c.input} type="number" step="0.5" value={analysis.discountRate} onChange={e => setAnalysis({...analysis, discountRate: e.target.value})} />
                </div>
                <div>
                  <label className={c.label}>Rationale</label>
                  <input className={c.input} value={analysis.discountRationale} onChange={e => setAnalysis({...analysis, discountRationale: e.target.value})} placeholder="Why this rate?" />
                </div>
              </div>
              <div>
                <label className={c.label}>Willingness-to-pay for non-market outcomes</label>
                <textarea className={c.textarea} value={analysis.wtp} onChange={e => setAnalysis({...analysis, wtp: e.target.value})} placeholder="How would you value a life saved, an hour of travel time, an avoided injury?" />
              </div>
              <button className={c.btn + " w-full"} disabled={isEvaluating} onClick={async () => {
                setIsEvaluating(true)
                try {
                  const prompt = `Evaluate this student's beginner cost-benefit analysis. Be encouraging, emphasize where reasonable analysts differ rather than declaring one right answer.

Scenario: ${currentScenario.vignette}
Reference costs: ${currentScenario.referenceCosts}
Reference benefits: ${currentScenario.referenceBenefits}
Reference stakeholders: ${currentScenario.referenceStakeholders}
Reference discount rate: ${currentScenario.referenceDiscountRate}
Reference WTP: ${currentScenario.referenceWTP}

Student's answers:
- Monetized costs: ${analysis.monetizedCosts}
- Monetized benefits: ${analysis.monetizedBenefits}
- Unmonetized: ${analysis.unmonetized}
- Stakeholders: ${analysis.stakeholders}
- Discount rate: ${analysis.discountRate}% (${analysis.discountRationale})
- WTP: ${analysis.wtp}

Score each dimension 0-100 and write a worked comparison narrative.`
                  const res = await callAI(prompt, { schema: { properties: {
                    narrative: { type: "string", description: "2-3 paragraph worked comparison" },
                    scoreCosts: { type: "number" },
                    scoreBenefits: { type: "number" },
                    scoreStakeholders: { type: "number" },
                    scoreDiscount: { type: "number" },
                    scoreWTP: { type: "number" },
                    weakAreas: { type: "array", items: { type: "string" }, description: "concept names student should review" },
                  } } })
                  const parsed = JSON.parse(res)
                  await database.put({ type: "evaluation", scenarioId: currentScenario._id, createdAt: Date.now(), analysis, ...parsed })
                  for (const concept of (parsed.weakAreas || [])) {
                    const existing = masteryDocs.find(m => m.concept === concept)
                    const prevScore = existing?.score || 50
                    await database.put({ ...(existing || {}), type: "mastery", concept, score: Math.max(0, prevScore - 8), updatedAt: Date.now() })
                  }
                  const avgScore = (parsed.scoreCosts + parsed.scoreBenefits + parsed.scoreStakeholders + parsed.scoreDiscount + parsed.scoreWTP) / 5
                  const dims = [["costs", parsed.scoreCosts], ["benefits", parsed.scoreBenefits], ["stakeholders", parsed.scoreStakeholders], ["discount rate", parsed.scoreDiscount], ["willingness to pay", parsed.scoreWTP]]
                  for (const [concept, score] of dims) {
                    const existing = masteryDocs.find(m => m.concept === concept)
                    const blended = existing ? Math.round((existing.score * 0.6) + (score * 0.4)) : score
                    await database.put({ ...(existing || {}), type: "mastery", concept, score: blended, updatedAt: Date.now() })
                  }
                } finally { setIsEvaluating(false) }
              }}>
                {isEvaluating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
                    Evaluating...
                  </span>
                ) : "Submit for evaluation"}
              </button>
            </div>
          )}
        </section>

        <section id="concepts" className={c.section}>
          <h2 className={c.sectionTitle}>Concept Explainers</h2>
          <p className={c.muted + " mb-3"}>Tap a concept to expand a quick lesson.</p>
          <div className="space-y-2">
            {[
              { key: "shadow", label: "Shadow pricing", body: "When something has no market price (clean air, a saved life), economists estimate what its price would be by looking at related markets — wage premiums for risky jobs, travel-time savings, hedonic property values. The estimate is always contestable." },
              { key: "sensitivity", label: "Sensitivity analysis", body: "Your numbers are guesses. Sensitivity analysis rewinds the calculation with different assumptions (high/low discount rate, optimistic/pessimistic WTP) to see whether the conclusion flips. If it does, you've found uncertainty worth flagging." },
              { key: "welfare", label: "Welfare economics assumptions", body: "Cost-benefit analysis implicitly adds up dollars across people — a $1 gain for a billionaire counts the same as a $1 gain for someone in poverty. The Kaldor-Hicks criterion says a project is worthwhile if winners could in principle compensate losers, even if they don't." },
              { key: "discount", label: "Social discount rate", body: "Future costs and benefits are worth less than present ones. A 3% rate is typical for long-horizon public projects; 7% reflects opportunity cost of capital. Choice of rate massively affects projects with distant benefits (climate, infrastructure)." },
              { key: "wtp", label: "Willingness to pay", body: "WTP measures how much someone would voluntarily pay for a benefit. It's the workhorse for valuing non-market goods, but it's bounded by ability to pay — which means the poor's preferences register as smaller in raw dollars." },
            ].map(concept => (
              <div key={concept.key} className="border border-[#2a1e10]/15 rounded">
                <button className="w-full text-left px-3 py-2 min-h-[44px] hover:bg-[#e6d3a3]/30 flex items-center justify-between" onClick={async () => {
                  const next = openConcept === concept.key ? null : concept.key
                  setOpenConcept(next)
                  if (next && can("write")) {
                    const existing = masteryDocs.find(m => m.concept === concept.label.toLowerCase())
                    const prev = existing?.score || 40
                    await database.put({ ...(existing || {}), type: "mastery", concept: concept.label.toLowerCase(), score: Math.min(100, prev + 3), updatedAt: Date.now() })
                  }
                }}>
                  <span className="font-medium">{concept.label}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={openConcept === concept.key ? "rotate-180 transition" : "transition"}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {openConcept === concept.key && (
                  <div className="px-3 pb-3 text-sm leading-relaxed">{concept.body}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="comparison" className={c.section}>
          <h2 className={c.sectionTitle}>Worked Comparison</h2>
          {!currentEval ? (
            <p className={c.muted}>Submit your analysis above to see how it compares against a sample analyst.</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#f4ead5] border border-[#c97b3f]/30 rounded p-3">
                <p className="leading-relaxed text-sm whitespace-pre-wrap">{currentEval.narrative}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-sm">Sample analyst's reference</h4>
                <div className="text-sm space-y-2">
                  <div><strong>Costs:</strong> {currentScenario?.referenceCosts}</div>
                  <div><strong>Benefits:</strong> {currentScenario?.referenceBenefits}</div>
                  <div><strong>Stakeholders:</strong> {currentScenario?.referenceStakeholders}</div>
                  <div><strong>Discount rate:</strong> {currentScenario?.referenceDiscountRate}</div>
                  <div><strong>WTP approach:</strong> {currentScenario?.referenceWTP}</div>
                </div>
              </div>
              {currentEval.weakAreas?.length > 0 && (
                <div className="bg-[#e6d3a3]/40 rounded p-3">
                  <p className="text-sm"><strong>Worth revisiting:</strong> {currentEval.weakAreas.join(", ")}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section id="mastery" className={c.section}>
          <h2 className={c.sectionTitle}>Mastery Tracker</h2>
          {!masteryDocs.length ? (
            <p className={c.muted}>Your concept mastery will appear here once you submit a scenario or open explainers.</p>
          ) : (
            <div className="space-y-3">
              {[...masteryDocs].sort((a, b) => (b.score || 0) - (a.score || 0)).map(m => (
                <div key={m._id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium">{m.concept}</span>
                    <span className={c.muted}>{Math.round(m.score || 0)}</span>
                  </div>
                  <div className={c.scoreBar}>
                    <div className={c.scoreFill} style={{ width: `${Math.min(100, m.score || 0)}%` }} />
                  </div>
                </div>
              ))}
              {weakestConcept() && (
                <p className={c.muted + " italic mt-3"}>Next scenario will lean into: <strong>{weakestConcept()}</strong></p>
              )}
            </div>
          )}
          {viewer && (
            <div className="mt-4 pt-3 border-t border-[#2a1e10]/15 flex items-center gap-2">
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-8 h-8 rounded-full" />
              <span className="text-sm">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}