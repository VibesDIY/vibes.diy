import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("evidence-dossier")
  const { doc: newCase, merge: mergeCase, submit: submitCase } = useDocument({
    type: "dossier",
    title: "",
    submissionId: "",
    status: "intake",
    createdAt: Date.now(),
  })
  const { docs: dossiers } = useLiveQuery("type", { key: "dossier", descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = dossiers.find((d) => d._id === selectedId) || null
  const [checkLoading, setCheckLoading] = React.useState(false)
  const { doc: newReview, merge: mergeReview, submit: submitReview } = useDocument({
    type: "review",
    dossierId: "",
    rating: "",
    notes: "",
    reviewerSlug: "",
    reviewerName: "",
    createdAt: Date.now(),
  })
  const { docs: allReviews } = useLiveQuery("type", { key: "review" })
  const dossierReviews = selectedId ? allReviews.filter((r) => r.dossierId === selectedId) : []
  const uniqueRatings = new Set(dossierReviews.map((r) => r.rating))
  const disagreement = dossierReviews.length >= 2 && uniqueRatings.size > 1

  const c = {
    page: "min-h-screen bg-[#292929] text-white font-mono",
    header: "border-b border-[#3a4a6b] bg-black px-4 py-5 sticky top-0 z-10",
    brand: "text-xl font-black tracking-wider uppercase",
    tagline: "text-xs text-[#8a9bc1] mt-1 tracking-wide",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a6b] bg-black p-5 rounded-sm",
    h2: "text-sm font-black uppercase tracking-widest mb-4 border-b border-[#3a4a6b] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-white text-black font-bold uppercase text-xs tracking-wider rounded-sm hover:bg-[#e5e5e5] disabled:opacity-50",
    input: "w-full bg-[#1a1a1a] border border-[#3a4a6b] text-white px-3 py-3 rounded-sm text-sm focus:outline-none focus:border-white",
    label: "block text-[10px] uppercase tracking-widest text-[#8a9bc1] mb-1",
    row: "border border-[#3a4a6b] bg-[#1a1a1a] p-3 rounded-sm mb-2",
    pill: "inline-block text-[10px] uppercase tracking-wider px-2 py-1 border border-[#3a4a6b] rounded-sm",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>Evidence Dossier</div>
        <div className={c.tagline}>Clearinghouse Methodological Review System</div>
      </header>
      <main id="app" className={c.main}>
        <section id="case-files" className={c.section}>
          <h2 className={c.h2}>Case Files</h2>
          {can("write") ? (
            <form onSubmit={submitCase} className="space-y-3 mb-4">
              <div>
                <label className={c.label}>Study Title</label>
                <input
                  className={c.input}
                  value={newCase.title}
                  onChange={(e) => mergeCase({ title: e.target.value })}
                  placeholder="Effects of Tier 2 Reading Intervention..."
                  required
                />
              </div>
              <div>
                <label className={c.label}>Submission ID</label>
                <input
                  className={c.input}
                  value={newCase.submissionId}
                  onChange={(e) => mergeCase({ submissionId: e.target.value })}
                  placeholder="CLR-2024-XXXX"
                  required
                />
              </div>
              <button type="submit" className={c.btn}>Open Dossier</button>
            </form>
          ) : (
            <div className="text-xs text-[#8a9bc1] mb-4">Read-only view — contact clearinghouse staff for review access.</div>
          )}
          <div>
            <div className={c.label}>Open Dossiers ({dossiers.length})</div>
            {dossiers.length === 0 ? (
              <div className={c.row}>
                <div className="text-xs text-[#8a9bc1]">No dossiers yet.</div>
              </div>
            ) : (
              dossiers.map((d) => (
                <div
                  key={d._id}
                  className={`${c.row} cursor-pointer ${selectedId === d._id ? "border-white" : ""}`}
                  onClick={() => setSelectedId(d._id === selectedId ? null : d._id)}
                >
                  <div className="font-bold text-sm">{d.title || "Untitled"}</div>
                  <div className="flex gap-2 mt-2 items-center">
                    <span className={c.pill}>{d.submissionId}</span>
                    <span className={c.pill}>{d.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section id="methodology" className={c.section}>
          <h2 className={c.h2}>Methodology Log</h2>
          {!selected ? (
            <div className="text-xs text-[#8a9bc1]">Select a dossier above to log methodology.</div>
          ) : !can("write") ? (
            <div className="text-xs text-[#8a9bc1]">Read-only view — sign in as a reviewer to edit.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-[#8a9bc1] mb-2">Editing: <strong className="text-white">{selected.title}</strong></div>
              <div>
                <label className={c.label}>Research Question</label>
                <textarea
                  className={c.input}
                  rows={2}
                  value={selected.researchQuestion || ""}
                  onChange={(e) => database.put({ ...selected, researchQuestion: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Target Population</label>
                <input
                  className={c.input}
                  value={selected.population || ""}
                  onChange={(e) => database.put({ ...selected, population: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Intervention</label>
                <input
                  className={c.input}
                  value={selected.intervention || ""}
                  onChange={(e) => database.put({ ...selected, intervention: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Comparison Condition</label>
                <input
                  className={c.input}
                  value={selected.comparison || ""}
                  onChange={(e) => database.put({ ...selected, comparison: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Outcome Measures</label>
                <input
                  className={c.input}
                  value={selected.outcomes || ""}
                  onChange={(e) => database.put({ ...selected, outcomes: e.target.value })}
                />
              </div>
              <div>
                <label className={c.label}>Design</label>
                <select
                  className={c.input}
                  value={selected.design || ""}
                  onChange={(e) => database.put({ ...selected, design: e.target.value })}
                >
                  <option value="">Select design...</option>
                  <option>Randomized trial</option>
                  <option>Quasi-experimental (matching)</option>
                  <option>Regression discontinuity</option>
                  <option>Interrupted time series</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className={c.label}>Analytic Approach</label>
                <select
                  className={c.input}
                  value={selected.analytic || ""}
                  onChange={(e) => database.put({ ...selected, analytic: e.target.value })}
                >
                  <option value="">Select approach...</option>
                  <option>Multiple regression</option>
                  <option>Multilevel / HLM</option>
                  <option>Panel data — fixed effects</option>
                  <option>Panel data — random effects</option>
                  <option>Mixed methods</option>
                </select>
              </div>
            </div>
          )}
        </section>
        <section id="rubric" className={c.section}>
          <h2 className={c.h2}>Rubric & Consistency Check</h2>
          {!selected ? (
            <div className="text-xs text-[#8a9bc1]">Select a dossier to run the rubric.</div>
          ) : (
            <>
              <div className="text-xs text-[#8a9bc1] mb-3">AI cross-examines design ↔ analytic approach for internal consistency.</div>
              {can("write") && (
                <button
                  className={c.btn}
                  disabled={checkLoading || !selected.design || !selected.analytic}
                  onClick={async () => {
                    setCheckLoading(true)
                    try {
                      const prompt = `You are a senior methodologist for an education research clearinghouse. Critique the internal consistency of this study's methodology. Design: ${selected.design}. Analytic approach: ${selected.analytic}. Research question: ${selected.researchQuestion || "n/a"}. Population: ${selected.population || "n/a"}. Flag mismatches (e.g., quasi-experimental design without selection-bias adjustment, multilevel data analyzed without respecting nesting, fixed effects estimators not capturing the unobserved confounders the design relies on, interaction terms not theoretically grounded). Return alignmentScore 0-100, flags as array of {concern, severity, rubricPrompt}.`
                      const res = await callAI(prompt, {
                        schema: {
                          properties: {
                            alignmentScore: { type: "number" },
                            summary: { type: "string" },
                            flags: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  concern: { type: "string" },
                                  severity: { type: "string" },
                                  rubricPrompt: { type: "string" },
                                },
                              },
                            },
                          },
                        },
                      })
                      const parsed = JSON.parse(res)
                      await database.put({ ...selected, consistencyCheck: parsed, checkedAt: Date.now() })
                    } finally {
                      setCheckLoading(false)
                    }
                  }}
                >
                  {checkLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" strokeDasharray="50 20" />
                      </svg>
                      Analyzing...
                    </span>
                  ) : "Run Consistency Check"}
                </button>
              )}
              <div className="mt-4 space-y-3">
                <div className={c.row}>
                  <div className={c.label}>Alignment Score</div>
                  <div className="text-sm font-bold">
                    {selected.consistencyCheck ? `${selected.consistencyCheck.alignmentScore} / 100` : "—"}
                  </div>
                  {selected.consistencyCheck?.summary && (
                    <div className="text-xs text-[#8a9bc1] mt-2">{selected.consistencyCheck.summary}</div>
                  )}
                </div>
                <div className={c.row}>
                  <div className={c.label}>Flagged Concerns</div>
                  {selected.consistencyCheck?.flags?.length ? (
                    <ul className="space-y-2 mt-2">
                      {selected.consistencyCheck.flags.map((f, i) => (
                        <li key={i} className="text-xs border-l-2 border-white pl-2">
                          <div className="flex gap-2 items-center mb-1">
                            <span className={c.pill}>{f.severity}</span>
                          </div>
                          <div className="font-bold">{f.concern}</div>
                          <div className="text-[#8a9bc1] mt-1">→ {f.rubricPrompt}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-[#8a9bc1]">Run a check to see flags.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
        <section id="reconciliation" className={c.section}>
          <h2 className={c.h2}>Independent Reviews & Reconciliation</h2>
          {!selected ? (
            <div className="text-xs text-[#8a9bc1]">Select a dossier to view or submit reviews.</div>
          ) : (
            <>
              <div className="text-xs text-[#8a9bc1] mb-3">Two independent reviews per dossier. Disagreements adjudicated by senior methodologist.</div>
              {can("write") && viewer ? (
                <form
                  className="space-y-3 mb-4"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    submitReview()
                  }}
                >
                  <div>
                    <label className={c.label}>Strength of Evidence</label>
                    <select
                      className={c.input}
                      value={newReview.rating}
                      onChange={(e) => mergeReview({ rating: e.target.value })}
                      required
                    >
                      <option value="">Select rating...</option>
                      <option>Meets standards without reservations</option>
                      <option>Meets standards with reservations</option>
                      <option>Does not meet standards</option>
                    </select>
                  </div>
                  <div>
                    <label className={c.label}>Generalizability Notes</label>
                    <textarea
                      className={c.input}
                      rows={2}
                      value={newReview.notes}
                      onChange={(e) => mergeReview({ notes: e.target.value })}
                      placeholder="Sample restrictions, populations..."
                    />
                  </div>
                  <button
                    type="submit"
                    className={c.btn}
                    onClick={() => mergeReview({ dossierId: selected._id, reviewerSlug: viewer.userSlug, reviewerName: viewer.displayName ?? viewer.userSlug, createdAt: Date.now() })}
                  >
                    Submit Review
                  </button>
                </form>
              ) : (
                <div className="text-xs text-[#8a9bc1] mb-4">Sign in as a reviewer to submit a review.</div>
              )}
              <div className={c.label}>Reviews on File ({dossierReviews.length})</div>
              {dossierReviews.length === 0 ? (
                <div className={c.row}>
                  <div className="text-xs text-[#8a9bc1]">No reviews submitted yet.</div>
                </div>
              ) : (
                <>
                  {dossierReviews.map((r) => (
                    <div key={r._id} className={c.row}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="text-xs font-bold">{r.reviewerName}</div>
                          <div className="text-sm mt-1">{r.rating}</div>
                          {r.notes && <div className="text-xs text-[#8a9bc1] mt-2">{r.notes}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {disagreement && (
                    <div className="border border-yellow-500 bg-[#2a2410] p-3 rounded-sm mt-2">
                      <div className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold">⚑ Disagreement Detected</div>
                      <div className="text-xs text-[#d4c896] mt-1">Reviews disagree. Senior methodologist adjudication required.</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}