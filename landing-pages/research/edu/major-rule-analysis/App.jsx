import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("ria-workbench")

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4a6a] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-xl md:text-2xl font-black tracking-tight uppercase",
    subtitle: "text-xs text-[#8a9ab5] mt-1 tracking-wider uppercase",
    main: "max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a6a] bg-black p-4 md:p-5",
    h2: "text-sm font-black uppercase tracking-widest text-white border-b border-[#3a4a6a] pb-2 mb-4",
    label: "block text-[10px] uppercase tracking-widest text-[#8a9ab5] mb-1",
    input: "w-full bg-[#1a1a1a] border border-[#3a4a6a] text-white px-3 py-3 min-h-[44px] focus:outline-none focus:border-white text-sm",
    textarea: "w-full bg-[#1a1a1a] border border-[#3a4a6a] text-white px-3 py-3 focus:outline-none focus:border-white text-sm min-h-[88px]",
    btn: "w-full md:w-auto bg-white text-black px-5 py-3 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#cccccc] disabled:opacity-50 inline-flex items-center justify-center gap-2",
    btnGhost: "bg-transparent border border-[#3a4a6a] text-white px-3 py-2 text-[10px] uppercase tracking-widest hover:border-white",
    row: "border border-[#3a4a6a] bg-[#1a1a1a] p-3 mb-2",
    rowTitle: "text-sm font-bold text-white",
    rowMeta: "text-[10px] uppercase tracking-widest text-[#8a9ab5] mt-1",
    pill: "inline-block border border-[#3a4a6a] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#8a9ab5] mr-1",
    empty: "text-xs text-[#8a9ab5] italic",
    grid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    viewer: "flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#8a9ab5]",
    avatar: "w-6 h-6 border border-[#3a4a6a]",
  }

  function handleNoop(e) { if (e?.preventDefault) e.preventDefault() }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');
        body { font-family: 'Roboto Mono', monospace; }
        .font-black { font-family: 'Archivo Black', sans-serif; font-weight: 900; }`}</style>

      <header id="app-header" className={c.header}>
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-3">
          <div>
            <h1 className={c.title}>RIA Workbench</h1>
            <p className={c.subtitle}>Regulatory Impact Analysis · Version-Controlled</p>
          </div>
          {viewer && (
            <div className={c.viewer}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden md:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <AlternativesSection c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <ImpactsSection c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <StakeholdersSection c={c} can={can} viewer={viewer} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <SensitivitySection c={c} can={can} viewer={viewer} useDocument={useDocument} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  )
}

function SensitivitySection({ c, can, viewer, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({
    type: "sensitivity",
    scenario: "",
    discountRate: 3,
    welfareStandard: "Kaldor-Hicks",
    uncertaintyMethod: "Monte Carlo (Framing Only)",
    notes: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })
  const { docs: scenarios } = useLiveQuery("type", { key: "sensitivity", descending: true })

  return (
    <section id="sensitivity" className={c.section}>
      <h2 className={c.h2}>04 · Sensitivity & Discount Rate</h2>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 mb-4">
          <div>
            <label className={c.label}>Scenario Name</label>
            <input className={c.input} value={doc.scenario} onChange={(e) => merge({ scenario: e.target.value })} placeholder="e.g., Low-rate sensitivity with fat-tail compliance costs" required />
          </div>
          <div className={c.grid}>
            <div>
              <label className={c.label}>Discount Rate (%)</label>
              <input className={c.input} type="number" step="0.5" value={doc.discountRate} onChange={(e) => merge({ discountRate: Number(e.target.value) })} />
            </div>
            <div>
              <label className={c.label}>Welfare Standard</label>
              <select className={c.input} value={doc.welfareStandard} onChange={(e) => merge({ welfareStandard: e.target.value })}>
                <option>Kaldor-Hicks</option>
                <option>Pareto</option>
                <option>Weighted Social Welfare</option>
              </select>
            </div>
          </div>
          <div>
            <label className={c.label}>Uncertainty Method</label>
            <select className={c.input} value={doc.uncertaintyMethod} onChange={(e) => merge({ uncertaintyMethod: e.target.value })}>
              <option>Monte Carlo (Framing Only)</option>
              <option>Fat-Tailed Distribution</option>
              <option>Low-Probability High-Consequence</option>
              <option>Deterministic Bounds</option>
            </select>
          </div>
          <div>
            <label className={c.label}>Assumptions & Notes</label>
            <textarea className={c.textarea} value={doc.notes} onChange={(e) => merge({ notes: e.target.value })} placeholder="Document key assumptions, parameter ranges, and reasoning..." />
          </div>
          <button type="submit" className={c.btn}>Record Scenario</button>
        </form>
      ) : (
        <p className={c.empty}>Read-only view — contact the owner for write access.</p>
      )}
      <div>
        {scenarios.length === 0 && <p className={c.empty}>No sensitivity scenarios recorded yet.</p>}
        {scenarios.map((s) => (
          <div key={s._id} className={c.row}>
            <div className={c.rowTitle}>{s.scenario}</div>
            <div className={c.rowMeta}>
              <span className={c.pill}>{s.discountRate}% rate</span>
              <span className={c.pill}>{s.welfareStandard}</span>
              <span className={c.pill}>{s.uncertaintyMethod}</span>
            </div>
            {s.notes && <p className="text-xs text-[#cccccc] mt-2">{s.notes}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function StakeholdersSection({ c, can, viewer, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({
    type: "stakeholder",
    group: "",
    position: "Net Winner",
    magnitude: 0,
    dimension: "Income",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })
  const { docs: stakeholders } = useLiveQuery("type", { key: "stakeholder", descending: true })

  async function suggestGroups() {
    const r = await callAI("Suggest one stakeholder group affected by a major federal regulation. Return group name, position (Net Winner/Net Loser/Ambiguous), magnitude in millions of dollars annual, and dimension (Income/Race/Geography/Industry Sector).", {
      schema: { properties: { group: { type: "string" }, position: { type: "string" }, magnitude: { type: "number" }, dimension: { type: "string" } } }
    })
    const s = JSON.parse(r)
    merge({ group: s.group, position: s.position, magnitude: s.magnitude, dimension: s.dimension })
  }

  return (
    <section id="stakeholders" className={c.section}>
      <h2 className={c.h2}>03 · Stakeholder Winners & Losers</h2>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 mb-4">
          <div>
            <label className={c.label}>Stakeholder Group</label>
            <input className={c.input} value={doc.group} onChange={(e) => merge({ group: e.target.value })} placeholder="e.g., Low-income households, Rural manufacturers" required />
          </div>
          <div className={c.grid}>
            <div>
              <label className={c.label}>Net Position</label>
              <select className={c.input} value={doc.position} onChange={(e) => merge({ position: e.target.value })}>
                <option>Net Winner</option><option>Net Loser</option><option>Ambiguous</option>
              </select>
            </div>
            <div>
              <label className={c.label}>Magnitude ($M annual)</label>
              <input className={c.input} type="number" value={doc.magnitude} onChange={(e) => merge({ magnitude: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={c.label}>Distributional Dimension</label>
            <select className={c.input} value={doc.dimension} onChange={(e) => merge({ dimension: e.target.value })}>
              <option>Income</option><option>Race</option><option>Geography</option><option>Industry Sector</option>
            </select>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <button type="submit" className={c.btn}>Record Stakeholder</button>
            <button type="button" onClick={suggestGroups} className={c.btnGhost}>AI Suggest Group</button>
          </div>
        </form>
      ) : (
        <p className={c.empty}>Read-only view — contact the owner for write access.</p>
      )}
      <div>
        {stakeholders.length === 0 && <p className={c.empty}>No stakeholder groups recorded yet.</p>}
        {stakeholders.map((s) => (
          <div key={s._id} className={c.row}>
            <div className={c.rowTitle}>{s.group}</div>
            <div className={c.rowMeta}>
              <span className={c.pill}>{s.position}</span>
              <span className={c.pill}>{s.dimension}</span>
              <span className={c.pill}>${s.magnitude}M/yr</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImpactsSection({ c, can, viewer, database, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({
    type: "impact",
    category: "",
    sign: "Cost",
    method: "Market Price",
    logic: "",
    critique: null,
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })
  const { docs: impacts } = useLiveQuery("type", { key: "impact", descending: true })
  const [isLoading, setIsLoading] = React.useState(false)

  async function runCritique() {
    if (!doc.logic.trim()) return
    setIsLoading(true)
    try {
      const r = await callAI(`Review this regulatory impact causal logic for economic rigor. Category: ${doc.category}. Method: ${doc.method}. Logic: ${doc.logic}. Score 1-10 and flag missing welfare-economics considerations.`, {
        schema: { properties: { rigorScore: { type: "number" }, strengths: { type: "string" }, missingConsiderations: { type: "string" }, recommendations: { type: "string" } } }
      })
      merge({ critique: JSON.parse(r) })
    } finally { setIsLoading(false) }
  }

  async function suggestImpact() {
    const r = await callAI("Suggest one realistic impact category for a major federal rule. Return category name, sign (Cost/Benefit), method (Market Price/Shadow Price/Willingness to Pay/Qualitative Only), and a 3-sentence causal logic chain.", {
      schema: { properties: { category: { type: "string" }, sign: { type: "string" }, method: { type: "string" }, logic: { type: "string" } } }
    })
    const s = JSON.parse(r)
    merge({ category: s.category, sign: s.sign, method: s.method, logic: s.logic })
  }

  return (
    <section id="impacts" className={c.section}>
      <h2 className={c.h2}>02 · Impact Categories & Causal Logic</h2>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 mb-4">
          <div>
            <label className={c.label}>Impact Category</label>
            <input className={c.input} value={doc.category} onChange={(e) => merge({ category: e.target.value })} placeholder="e.g., Compliance Costs — Industry Capital" required />
          </div>
          <div className={c.grid}>
            <div>
              <label className={c.label}>Cost / Benefit</label>
              <select className={c.input} value={doc.sign} onChange={(e) => merge({ sign: e.target.value })}>
                <option>Cost</option><option>Benefit</option>
              </select>
            </div>
            <div>
              <label className={c.label}>Monetization Method</label>
              <select className={c.input} value={doc.method} onChange={(e) => merge({ method: e.target.value })}>
                <option>Market Price</option>
                <option>Shadow Price</option>
                <option>Willingness to Pay</option>
                <option>Qualitative Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className={c.label}>Causal Logic (Provision → Effect)</label>
            <textarea className={c.textarea} value={doc.logic} onChange={(e) => merge({ logic: e.target.value })} placeholder="Trace the causal chain from regulatory provision to measurable economic effect..." />
          </div>
          {doc.critique && (
            <div className="border border-[#3a4a6a] bg-[#1a1a1a] p-3 text-xs">
              <div className="text-[10px] uppercase tracking-widest text-[#8a9ab5] mb-1">AI Critique · Rigor Score {doc.critique.rigorScore}/10</div>
              <p className="text-[#cccccc] mb-1"><strong>Strengths:</strong> {doc.critique.strengths}</p>
              <p className="text-[#cccccc] mb-1"><strong>Missing:</strong> {doc.critique.missingConsiderations}</p>
              <p className="text-[#cccccc]"><strong>Recommendations:</strong> {doc.critique.recommendations}</p>
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-2">
            <button type="submit" className={c.btn} disabled={isLoading}>Record Impact</button>
            <button type="button" onClick={runCritique} disabled={isLoading} className={c.btn}>
              {isLoading ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>Critiquing...</> : "AI Critique Logic"}
            </button>
            <button type="button" onClick={suggestImpact} className={c.btnGhost}>Suggest Example</button>
          </div>
        </form>
      ) : (
        <p className={c.empty}>Read-only view — contact the owner for write access.</p>
      )}
      <div>
        {impacts.length === 0 && <p className={c.empty}>No impact categories recorded yet.</p>}
        {impacts.map((i) => (
          <div key={i._id} className={c.row}>
            <div className={c.rowTitle}>{i.category}</div>
            <div className={c.rowMeta}>
              <span className={c.pill}>{i.sign}</span>
              <span className={c.pill}>{i.method}</span>
              {i.critique && <span className={c.pill}>Rigor {i.critique.rigorScore}/10</span>}
            </div>
            {i.logic && <p className="text-xs text-[#cccccc] mt-2">{i.logic}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function AlternativesSection({ c, can, viewer, database, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({
    type: "alternative",
    name: "",
    altType: "Proposed Rule",
    stringency: 50,
    provision: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })
  const { docs: alts } = useLiveQuery("type", { key: "alternative", descending: true })

  async function suggestAlternative() {
    const r = await callAI("Suggest one realistic regulatory alternative for a major rule with billions in annual impact. Return name, type, stringency 0-100, and a 2-sentence provision summary.", {
      schema: { properties: { name: { type: "string" }, altType: { type: "string" }, stringency: { type: "number" }, provision: { type: "string" } } }
    })
    const s = JSON.parse(r)
    merge({ name: s.name, altType: s.altType, stringency: s.stringency, provision: s.provision })
  }

  return (
    <section id="alternatives" className={c.section}>
      <h2 className={c.h2}>01 · Regulatory Alternatives</h2>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3 mb-4">
          <div>
            <label className={c.label}>Alternative Name</label>
            <input className={c.input} value={doc.name} onChange={(e) => merge({ name: e.target.value })} placeholder="e.g., Proposed Rule — Tier 3 Stringency" required />
          </div>
          <div className={c.grid}>
            <div>
              <label className={c.label}>Type</label>
              <select className={c.input} value={doc.altType} onChange={(e) => merge({ altType: e.target.value })}>
                <option>Baseline (No Action)</option>
                <option>Proposed Rule</option>
                <option>More Stringent Variant</option>
                <option>Less Stringent Variant</option>
              </select>
            </div>
            <div>
              <label className={c.label}>Stringency Index (0–100)</label>
              <input className={c.input} type="number" value={doc.stringency} onChange={(e) => merge({ stringency: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={c.label}>Provision Summary</label>
            <textarea className={c.textarea} value={doc.provision} onChange={(e) => merge({ provision: e.target.value })} placeholder="Describe the regulatory provision and scope of coverage..." />
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <button type="submit" className={c.btn}>Record Alternative</button>
            <button type="button" onClick={suggestAlternative} className={c.btnGhost}>AI Suggest Example</button>
          </div>
        </form>
      ) : (
        <p className={c.empty}>Read-only view — contact the owner for write access.</p>
      )}
      <div>
        {alts.length === 0 && <p className={c.empty}>No alternatives recorded yet.</p>}
        {alts.map((a) => (
          <div key={a._id} className={c.row}>
            <div className={c.rowTitle}>{a.name}</div>
            <div className={c.rowMeta}>
              <span className={c.pill}>{a.altType}</span>
              <span className={c.pill}>Stringency {a.stringency}</span>
            </div>
            {a.provision && <p className="text-xs text-[#cccccc] mt-2">{a.provision}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}