import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("case-dossier")

  const { doc: intake, merge: mergeIntake, submit: submitIntake } = useDocument({
    type: "case",
    caseType: "Rezoning",
    parcelId: "",
    applicant: "",
    action: "",
    zoning: "",
    step: 0,
    createdAt: Date.now(),
  })

  const { docs: cases } = useLiveQuery("type", { key: "case", descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selectedCase = cases.find((x) => x._id === selectedId)
  const { docs: caseComments } = useLiveQuery("commentCaseId", { key: selectedId || "__none__" })

  const [suggestingIntake, setSuggestingIntake] = React.useState(false)
  const [commentBody, setCommentBody] = React.useState("")
  const [draftingReport, setDraftingReport] = React.useState(false)
  const [findingPrecedents, setFindingPrecedents] = React.useState(false)
  const [reportDraft, setReportDraft] = React.useState(null)
  const [precedents, setPrecedents] = React.useState(null)

  const WORKFLOWS = {
    "Rezoning": ["Completeness Check", "Department Distribution", "Neighborhood Notification", "Comment Period", "Staff Report", "Planning Commission", "Council Action"],
    "Conditional Use Permit": ["Completeness Check", "Department Distribution", "Neighborhood Notification", "Comment Period", "Staff Report", "Planning Commission Decision"],
    "Subdivision Plat": ["Completeness Check", "Department Distribution", "Engineering Review", "Staff Report", "Planning Commission Decision"],
    "Variance": ["Completeness Check", "Neighborhood Notification", "Comment Period", "Staff Report", "Board of Adjustment"],
    "Environmental Impact Assessment": ["Completeness Check", "SEPA Threshold Determination", "EIS Scoping", "Draft EIS", "Public Comment on DEIS", "Final EIS", "Agency Decision"],
    "Comprehensive Plan Amendment": ["Completeness Check", "Consistency Analysis", "Department Distribution", "Neighborhood Notification", "Comment Period", "Staff Report", "Planning Commission", "Council Hearing", "Council Action"],
  }

  async function handleIntakeSuggest() {
    setSuggestingIntake(true)
    try {
      const r = await callAI("Generate an example development application intake for a municipal planning department.", {
        schema: { properties: { parcelId: { type: "string" }, applicant: { type: "string" }, action: { type: "string" }, zoning: { type: "string" } } },
      })
      const s = JSON.parse(r)
      mergeIntake(s)
    } finally { setSuggestingIntake(false) }
  }

  async function handleAdvance(cs) {
    const steps = WORKFLOWS[cs.caseType] || []
    if (cs.step >= steps.length) return
    await database.put({ ...cs, step: cs.step + 1 })
  }

  async function handleLogComment() {
    if (!selectedId || !commentBody.trim()) return
    await database.put({
      type: "comment",
      commentCaseId: selectedId,
      body: commentBody.trim(),
      authorSlug: viewer?.userSlug || "anonymous",
      authorName: viewer?.displayName ?? viewer?.userSlug ?? "anonymous",
      authorAvatar: viewer?.avatarUrl ?? "",
      createdAt: Date.now(),
    })
    setCommentBody("")
  }

  async function handleDraftReport() {
    if (!selectedCase) return
    setDraftingReport(true); setReportDraft(null)
    try {
      const r = await callAI(`Draft a planning staff report for a ${selectedCase.caseType} application. Parcel: ${selectedCase.parcelId}. Applicant: ${selectedCase.applicant}. Action: ${selectedCase.action}. Existing zoning/comp plan: ${selectedCase.zoning}. Return structured sections.`, {
        schema: { properties: { findings: { type: "string" }, consistencyAnalysis: { type: "string" }, conditions: { type: "array", items: { type: "string" } }, suggestedMotion: { type: "string" } } },
      })
      setReportDraft(JSON.parse(r))
    } finally { setDraftingReport(false) }
  }

  async function handleFindPrecedents() {
    if (!selectedCase) return
    setFindingPrecedents(true); setPrecedents(null)
    const priorSummaries = cases.filter((x) => x._id !== selectedCase._id && x.caseType === selectedCase.caseType).slice(0, 10).map((x) => `${x.caseType} at ${x.parcelId}: ${x.action}`).join("; ")
    try {
      const r = await callAI(`Summarize how similar past ${selectedCase.caseType} cases have been decided and what discussion themes arose. Prior cases on file: ${priorSummaries || "none"}. Current case: ${selectedCase.action} at ${selectedCase.parcelId}.`, {
        schema: { properties: { comparable: { type: "array", items: { type: "object", properties: { summary: { type: "string" }, outcome: { type: "string" } } } }, discussionThemes: { type: "array", items: { type: "string" } } } },
      })
      setPrecedents(JSON.parse(r))
    } finally { setFindingPrecedents(false) }
  }

  const Spinner = () => (
    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  )

  const c = {
    page: "min-h-screen bg-[#28282b] text-[#f5f5f0] font-mono",
    header: "sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#3d4a5c] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-black tracking-widest uppercase",
    tagline: "text-[10px] tracking-[0.2em] uppercase text-[#8b95a7]",
    main: "max-w-3xl mx-auto px-4 py-5 space-y-5 pb-24",
    section: "bg-[#0a0a0a] border border-[#3d4a5c] rounded-sm",
    sectionHead: "px-4 py-3 border-b border-[#3d4a5c] flex items-center justify-between",
    sectionTitle: "text-xs font-black tracking-[0.2em] uppercase",
    sectionBody: "p-4 space-y-3",
    btn: "min-h-[44px] px-4 py-2 bg-[#f5f5f0] text-[#0a0a0a] text-xs font-black tracking-widest uppercase rounded-sm hover:bg-white disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3d4a5c] text-[#f5f5f0] text-xs font-black tracking-widest uppercase rounded-sm hover:bg-[#1a1a1d] disabled:opacity-50",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#1a1a1d] border border-[#3d4a5c] text-[#f5f5f0] text-sm rounded-sm focus:outline-none focus:border-[#f5f5f0]",
    label: "block text-[10px] tracking-[0.2em] uppercase text-[#8b95a7] mb-1",
    row: "p-3 border border-[#3d4a5c] rounded-sm bg-[#1a1a1d] hover:border-[#f5f5f0] cursor-pointer",
    pill: "inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase border border-[#3d4a5c] rounded-sm",
    avatar: "w-7 h-7 rounded-full border border-[#3d4a5c]",
    muted: "text-xs text-[#8b95a7]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Case Dossier</h1>
          <div className={c.tagline}>Planning Dept. Workflow</div>
        </div>
        <div className="flex items-center gap-2">
          {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
          {viewer && <span className={c.muted}>{viewer.displayName ?? viewer.userSlug}</span>}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="intake" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>New Case Intake</h2>
            {can("write") && (
              <button type="button" onClick={handleIntakeSuggest} disabled={suggestingIntake} className={c.btnGhost}>
                {suggestingIntake ? <Spinner /> : "Suggest Example"}
              </button>
            )}
          </div>
          {can("write") ? (
            <form onSubmit={submitIntake} className={c.sectionBody}>
              <div>
                <label className={c.label}>Case Type</label>
                <select className={c.input} value={intake.caseType} onChange={(e) => mergeIntake({ caseType: e.target.value })}>
                  {Object.keys(WORKFLOWS).map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={c.label}>Parcel ID</label>
                <input className={c.input} value={intake.parcelId} onChange={(e) => mergeIntake({ parcelId: e.target.value })} placeholder="e.g. 04-2310-001" />
              </div>
              <div>
                <label className={c.label}>Applicant</label>
                <input className={c.input} value={intake.applicant} onChange={(e) => mergeIntake({ applicant: e.target.value })} placeholder="Name or entity" />
              </div>
              <div>
                <label className={c.label}>Requested Action</label>
                <input className={c.input} value={intake.action} onChange={(e) => mergeIntake({ action: e.target.value })} placeholder="e.g. Rezone R-1 to MU-3" />
              </div>
              <div>
                <label className={c.label}>Existing Zoning / Comp Plan</label>
                <input className={c.input} value={intake.zoning} onChange={(e) => mergeIntake({ zoning: e.target.value })} placeholder="e.g. R-1, Low Density Residential" />
              </div>
              <button type="submit" className={c.btn}>File Case</button>
            </form>
          ) : (
            <div className={c.sectionBody}><p className={c.muted}>Read-only view — contact the planning department for write access.</p></div>
          )}
        </section>

        <section id="caseload" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Active Caseload</h2>
            <span className={c.muted}>{cases.length} case{cases.length === 1 ? "" : "s"}</span>
          </div>
          <div className={c.sectionBody}>
            {cases.length === 0 && <p className={c.muted}>No cases filed yet.</p>}
            {cases.map((cs) => {
              const steps = WORKFLOWS[cs.caseType] || []
              const currentStep = steps[cs.step] || "Closed"
              return (
                <div key={cs._id} onClick={() => setSelectedId(cs._id === selectedId ? null : cs._id)} className={`${c.row} ${selectedId === cs._id ? "border-[#f5f5f0]" : ""}`}>
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-sm font-bold">{cs.caseType} · {cs.parcelId || "—"}</span>
                    <span className={c.pill}>{currentStep}</span>
                  </div>
                  <div className={c.muted}>{cs.applicant || "—"} · {cs.action || "—"}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section id="case-detail" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Case Detail</h2>
            {selectedCase && <span className={c.muted}>{selectedCase.parcelId}</span>}
          </div>
          <div className={c.sectionBody}>
            {!selectedCase && <p className={c.muted}>Select a case from the caseload to view workflow and comments.</p>}
            {selectedCase && (
              <>
                <div className="space-y-1 text-sm">
                  <div><span className={c.label}>Type</span>{selectedCase.caseType}</div>
                  <div><span className={c.label}>Applicant</span>{selectedCase.applicant}</div>
                  <div><span className={c.label}>Action</span>{selectedCase.action}</div>
                  <div><span className={c.label}>Existing</span>{selectedCase.zoning}</div>
                </div>
                <div>
                  <h3 className={c.label}>Workflow Steps</h3>
                  <ol className="space-y-1 text-sm">
                    {(WORKFLOWS[selectedCase.caseType] || []).map((step, i) => (
                      <li key={i} className={i < selectedCase.step ? "text-[#8b95a7] line-through" : i === selectedCase.step ? "font-bold" : ""}>
                        {i + 1}. {step} {i === selectedCase.step && <span className={c.pill}>Current</span>}
                      </li>
                    ))}
                  </ol>
                  {can("write") && selectedCase.step < (WORKFLOWS[selectedCase.caseType] || []).length && (
                    <button type="button" onClick={() => handleAdvance(selectedCase)} className={`${c.btn} mt-3`}>Advance Step</button>
                  )}
                </div>
                <div>
                  <h3 className={c.label}>Comment Log</h3>
                  {caseComments.length === 0 && <p className={c.muted}>No comments logged.</p>}
                  <ul className="space-y-2">
                    {caseComments.map((cm) => (
                      <li key={cm._id} className="flex gap-2 p-2 border border-[#3d4a5c] rounded-sm bg-[#1a1a1d]">
                        {cm.authorAvatar && <img src={cm.authorAvatar} alt={cm.authorSlug} className={c.avatar} />}
                        <div className="flex-1">
                          <div className="text-xs font-bold">{cm.authorName}</div>
                          <div className="text-sm">{cm.body}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {can("write") && (
                    <div className="mt-3 space-y-2">
                      <textarea className={c.input} rows="2" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Log a written comment received during the comment period" />
                      <button type="button" onClick={handleLogComment} className={c.btn}>Log Comment</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section id="ai-tools" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Drafting & Memory</h2>
          </div>
          <div className={c.sectionBody}>
            {!selectedCase && <p className={c.muted}>Select a case above to draft a staff report or pull comparable past decisions.</p>}
            {selectedCase && can("write") && (
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={handleDraftReport} disabled={draftingReport} className={c.btn}>
                  {draftingReport ? <><Spinner /> Drafting…</> : "Draft Staff Report"}
                </button>
                <button type="button" onClick={handleFindPrecedents} disabled={findingPrecedents} className={c.btnGhost}>
                  {findingPrecedents ? <><Spinner /> Searching…</> : "Find Precedents"}
                </button>
              </div>
            )}
            {selectedCase && !can("write") && <p className={c.muted}>Read-only — staff report drafting requires write access.</p>}

            {reportDraft && (
              <div className="mt-2 space-y-3 p-3 border border-[#3d4a5c] rounded-sm bg-[#1a1a1d]">
                <div>
                  <h4 className={c.label}>Findings of Fact</h4>
                  <p className="text-sm whitespace-pre-wrap">{reportDraft.findings}</p>
                </div>
                <div>
                  <h4 className={c.label}>Consistency Analysis</h4>
                  <p className="text-sm whitespace-pre-wrap">{reportDraft.consistencyAnalysis}</p>
                </div>
                <div>
                  <h4 className={c.label}>Recommended Conditions</h4>
                  <ul className="text-sm list-disc pl-5">
                    {(reportDraft.conditions || []).map((cd, i) => <li key={i}>{cd}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className={c.label}>Suggested Motion</h4>
                  <p className="text-sm whitespace-pre-wrap">{reportDraft.suggestedMotion}</p>
                </div>
              </div>
            )}

            {precedents && (
              <div className="mt-2 space-y-3 p-3 border border-[#3d4a5c] rounded-sm bg-[#1a1a1d]">
                <div>
                  <h4 className={c.label}>Comparable Past Cases</h4>
                  <ul className="text-sm space-y-2">
                    {(precedents.comparable || []).map((p, i) => (
                      <li key={i}>
                        <div>{p.summary}</div>
                        <div className={c.muted}>Outcome: {p.outcome}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className={c.label}>Discussion Themes</h4>
                  <ul className="text-sm list-disc pl-5">
                    {(precedents.discussionThemes || []).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}