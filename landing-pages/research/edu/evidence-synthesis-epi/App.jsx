import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("evidence-workbench")

  const { doc: study, merge: mergeStudy, submit: submitStudy } = useDocument({
    type: "study",
    citation: "",
    design: "Cohort",
    population: "",
    exposure: "",
    outcome: "",
    measure: "",
    bias: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })

  const { docs: studies } = useLiveQuery("type", { key: "study", descending: true })

  const { doc: dag, merge: mergeDag, save: saveDag } = useDocument({ _id: "body-of-evidence-dag", type: "dag", text: "" })

  const { doc: het, merge: mergeHet, submit: submitHet } = useDocument({
    type: "heterogeneity",
    modifier: "Age",
    pattern: "",
    explanation: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })

  const { docs: hetNotes } = useLiveQuery("type", { key: "heterogeneity", descending: true })

  const { doc: rec, merge: mergeRec, submit: submitRec } = useDocument({
    type: "recommendation",
    grade: "B — Moderate",
    draft: "",
    trigger: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })

  const { doc: dissent, merge: mergeDissent, submit: submitDissent } = useDocument({
    type: "dissent",
    text: "",
    createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })

  const { docs: revisions } = useLiveQuery("type", { key: "recommendation", descending: true })
  const { docs: dissents } = useLiveQuery("type", { key: "dissent", descending: true })

  const [isLoading, setIsLoading] = React.useState(false)

  async function synthesize() {
    setIsLoading(true)
    try {
      const prompt = `You are an evidence synthesis assistant for a public health review committee. Given the studies, DAG, and heterogeneity notes below, draft a recommendation paragraph, propose a strength-of-evidence grade (A/B/C/I) with rationale, identify gaps, and suggest a reassessment trigger.

STUDIES (${studies.length}):
${studies.map(s => `- [${s.design}] ${s.citation}: ${s.exposure} → ${s.outcome}; MoA: ${s.measure}; Bias: ${s.bias}`).join("\n")}

DAG: ${dag.text || "(none)"}

HETEROGENEITY:
${hetNotes.map(n => `- ${n.modifier}: ${n.pattern} — ${n.explanation}`).join("\n")}`

      const response = await callAI(prompt, {
        schema: {
          properties: {
            draft: { type: "string", description: "Recommendation paragraph" },
            grade: { type: "string", description: "One of: A — Strong, B — Moderate, C — Weak, I — Insufficient" },
            rationale: { type: "string", description: "Rationale for grade" },
            gaps: { type: "string", description: "Identified evidence gaps" },
            trigger: { type: "string", description: "Reassessment trigger" },
          }
        }
      })
      const result = JSON.parse(response)
      mergeRec({ draft: result.draft, grade: result.grade, trigger: result.trigger, rationale: result.rationale, gaps: result.gaps })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const c = {
    page: "min-h-screen bg-[#282828] text-[#ffffff] font-mono",
    header: "sticky top-0 z-10 bg-[#000000] border-b border-[#3a4a6b] px-4 py-4",
    title: "text-xl font-black tracking-wider uppercase",
    titleFont: { fontFamily: "'Archivo Black', sans-serif" },
    bodyFont: { fontFamily: "'Roboto Mono', monospace" },
    tagline: "text-xs text-[#9ca3af] mt-1 uppercase tracking-widest",
    main: "px-4 py-4 pb-24 max-w-3xl mx-auto space-y-4",
    section: "bg-[#000000] border border-[#3a4a6b] rounded-sm p-4",
    sectionTitle: "text-sm font-black tracking-wider uppercase mb-3 text-[#ffffff] border-b border-[#3a4a6b] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-[#ffffff] text-[#000000] font-bold uppercase tracking-wider text-xs rounded-sm hover:bg-[#cccccc] disabled:opacity-50",
    btnAlt: "min-h-[44px] px-4 py-3 bg-transparent border border-[#ffffff] text-[#ffffff] font-bold uppercase tracking-wider text-xs rounded-sm hover:bg-[#1a1a1a]",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#3a4a6b] text-[#ffffff] rounded-sm focus:outline-none focus:border-[#ffffff] text-sm",
    label: "block text-xs uppercase tracking-wider text-[#9ca3af] mb-1",
    row: "border border-[#3a4a6b] rounded-sm p-3 mb-2 bg-[#0a0a0a]",
    badge: "inline-block px-2 py-1 text-[10px] uppercase tracking-wider bg-[#3a4a6b] text-[#ffffff] rounded-sm",
    empty: "text-xs text-[#6b7280] italic py-6 text-center",
    avatarBar: "flex items-center gap-2 text-xs text-[#9ca3af]",
    avatar: "w-6 h-6 rounded-full border border-[#3a4a6b]",
  }

  return (
    <div className={c.page} style={c.bodyFont}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={c.title} style={c.titleFont}>Evidence Synthesis Workbench</h1>
            <p className={c.tagline}>Dossier · Guideline Review · Audit Trail</p>
          </div>
          {viewer && (
            <div className={c.avatarBar}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="study-inventory" className={c.section}>
          <h2 className={c.sectionTitle} style={c.titleFont}>01 · Study Inventory ({studies.length})</h2>
          {can("write") ? (
            <form onSubmit={submitStudy} className="space-y-3 mb-4">
              <div>
                <label className={c.label}>Citation</label>
                <input className={c.input} placeholder="Author, Year, Journal" value={study.citation} onChange={(e) => mergeStudy({ citation: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={c.label}>Design</label>
                  <select className={c.input} value={study.design} onChange={(e) => mergeStudy({ design: e.target.value })}>
                    <option>Cohort</option>
                    <option>Case-Control</option>
                    <option>Cross-Sectional</option>
                    <option>RCT</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Population</label>
                  <input className={c.input} placeholder="e.g. adults 50+" value={study.population} onChange={(e) => mergeStudy({ population: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={c.label}>Exposure / Intervention</label>
                <input className={c.input} placeholder="What was studied" value={study.exposure} onChange={(e) => mergeStudy({ exposure: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Outcome</label>
                <input className={c.input} placeholder="What was measured" value={study.outcome} onChange={(e) => mergeStudy({ outcome: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Measure of Association</label>
                <input className={c.input} placeholder="e.g. RR 1.42 (95% CI 1.10–1.83)" value={study.measure} onChange={(e) => mergeStudy({ measure: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Bias / Confounding Handling</label>
                <textarea className={c.input} rows="2" placeholder="How authors addressed bias" value={study.bias} onChange={(e) => mergeStudy({ bias: e.target.value })} />
              </div>
              <button type="submit" className={c.btn}>Add Study</button>
            </form>
          ) : (
            <p className={c.empty}>Read-only view — contact the owner for write access.</p>
          )}
          {studies.length === 0 ? (
            <div className={c.empty}>No studies extracted yet.</div>
          ) : (
            <ul>
              {studies.map((s) => (
                <li key={s._id} className={c.row}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <strong className="text-sm">{s.citation || "Untitled"}</strong>
                    <span className={c.badge}>{s.design}</span>
                  </div>
                  <div className="text-xs text-[#9ca3af] space-y-1">
                    {s.population && <div><span className="text-[#6b7280]">Pop:</span> {s.population}</div>}
                    {s.exposure && <div><span className="text-[#6b7280]">Exp:</span> {s.exposure}</div>}
                    {s.outcome && <div><span className="text-[#6b7280]">Out:</span> {s.outcome}</div>}
                    {s.measure && <div><span className="text-[#6b7280]">MoA:</span> {s.measure}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="causal-heterogeneity" className={c.section}>
          <h2 className={c.sectionTitle} style={c.titleFont}>02 · Causal Graph & Heterogeneity ({hetNotes.length})</h2>
          {can("write") ? (
            <>
              <div className="mb-4">
                <label className={c.label}>Body-of-Evidence DAG (committee's framing)</label>
                <textarea
                  className={c.input}
                  rows="4"
                  placeholder="Describe nodes and edges: Exposure → Mediator → Outcome; note confounders, colliders…"
                  value={dag.text}
                  onChange={(e) => mergeDag({ text: e.target.value })}
                  onBlur={saveDag}
                />
              </div>
              <form onSubmit={submitHet} className="mb-4">
                <label className={c.label}>Add Heterogeneity Note</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select className={c.input} value={het.modifier} onChange={(e) => mergeHet({ modifier: e.target.value })}>
                    <option>Age</option>
                    <option>Sex</option>
                    <option>Comorbidity</option>
                    <option>Dose</option>
                    <option>Other</option>
                  </select>
                  <input className={c.input} placeholder="Pattern observed" value={het.pattern} onChange={(e) => mergeHet({ pattern: e.target.value })} required />
                </div>
                <textarea className={c.input} rows="2" placeholder="Committee's explanation / unresolved heterogeneity" value={het.explanation} onChange={(e) => mergeHet({ explanation: e.target.value })} />
                <button type="submit" className={`${c.btn} mt-2`}>Add Note</button>
              </form>
            </>
          ) : (
            <div className="mb-4">
              <label className={c.label}>Body-of-Evidence DAG</label>
              <div className={c.row}>{dag.text || <em className="text-[#6b7280]">No DAG recorded.</em>}</div>
            </div>
          )}
          {hetNotes.length === 0 ? (
            <div className={c.empty}>No heterogeneity notes yet.</div>
          ) : (
            <ul>
              {hetNotes.map((n) => (
                <li key={n._id} className={c.row}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={c.badge}>{n.modifier}</span>
                    <strong className="text-sm">{n.pattern}</strong>
                  </div>
                  {n.explanation && <p className="text-xs text-[#9ca3af]">{n.explanation}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="draft-recommendation" className={c.section}>
          <h2 className={c.sectionTitle} style={c.titleFont}>03 · Draft Recommendation ({revisions.length} revisions)</h2>
          {can("write") ? (
            <>
              <button type="button" onClick={synthesize} disabled={isLoading || studies.length === 0} className={`${c.btn} w-full mb-4 flex items-center justify-center gap-2`}>
                {isLoading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Synthesizing…
                  </>
                ) : "Synthesize Evidence (AI)"}
              </button>
              <form onSubmit={submitRec} className="space-y-3">
                <div>
                  <label className={c.label}>Strength of Evidence Grade</label>
                  <select className={c.input} value={rec.grade} onChange={(e) => mergeRec({ grade: e.target.value })}>
                    <option>A — Strong</option>
                    <option>B — Moderate</option>
                    <option>C — Weak</option>
                    <option>I — Insufficient</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Draft Recommendation</label>
                  <textarea className={c.input} rows="5" placeholder="Recommendation paragraph…" value={rec.draft} onChange={(e) => mergeRec({ draft: e.target.value })} />
                </div>
                <div>
                  <label className={c.label}>Reassessment Trigger</label>
                  <input className={c.input} placeholder="e.g. Revisit when new RCT data appears" value={rec.trigger} onChange={(e) => mergeRec({ trigger: e.target.value })} />
                </div>
                <button type="submit" className={`${c.btn} w-full`}>Save Revision</button>
              </form>
              <form onSubmit={submitDissent} className="mt-4 pt-4 border-t border-[#3a4a6b]">
                <label className={c.label}>Dissenting Opinion</label>
                <textarea className={c.input} rows="2" placeholder="Record dissent for the deliberation log" value={dissent.text} onChange={(e) => mergeDissent({ text: e.target.value })} required />
                <button type="submit" className={`${c.btnAlt} mt-2`}>Log Dissent</button>
              </form>
            </>
          ) : (
            <p className={c.empty}>Read-only view — contact the owner for write access.</p>
          )}
          {revisions.length > 0 && (
            <div className="mt-4">
              <h3 className={c.label}>Revision Trail (immutable)</h3>
              <ul>
                {revisions.map((r) => (
                  <li key={r._id} className={c.row}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={c.badge}>{r.grade}</span>
                      <span className="text-[10px] text-[#6b7280]">{new Date(r.createdAt).toISOString().slice(0, 16)} · {r.createdBy}</span>
                    </div>
                    <p className="text-xs text-[#e5e7eb] whitespace-pre-wrap">{r.draft}</p>
                    {r.trigger && <p className="text-xs text-[#9ca3af] mt-2"><span className="text-[#6b7280]">Reassess:</span> {r.trigger}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dissents.length > 0 && (
            <div className="mt-4">
              <h3 className={c.label}>Dissent Log</h3>
              <ul>
                {dissents.map((d) => (
                  <li key={d._id} className={c.row}>
                    <div className="text-[10px] text-[#6b7280] mb-1">{d.createdBy} · {new Date(d.createdAt).toISOString().slice(0, 16)}</div>
                    <p className="text-xs text-[#e5e7eb]">{d.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}