import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CHECKLIST_ITEMS = [
  ["sites","Site Inventory Adequacy","Gov. Code § 65583.2"],
  ["density","Density / Affordability","§ 65583.2(c)"],
  ["constraints","Constraints & CEQA","§ 65583(a)(5)"],
  ["engagement","Community Engagement","§ 65583(c)(8)"],
  ["land-use","Land Use Alignment","§ 65583(c)(1)"],
  ["transport","Transportation Consistency","§ 65302(b)"],
]

function Spinner() {
  return <svg className="animate-spin inline-block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
}

function CertificationSection({ c, activeCase, can, database, useLiveQuery }) {
  const { docs: findings } = useLiveQuery("caseId", { key: activeCase?._id || "__none__" })
  const [drafting, setDrafting] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)

  async function aiDraft() {
    if (!activeCase) return
    setDrafting(true)
    try {
      const summary = findings.map(f => `- ${f.itemName} (${f.cite}): ${f.reviewed ? "REVIEWED" : "pending"} — ${f.evidence?.slice(0,200) || "no evidence"}`).join("\n")
      const prompt = `Draft a formal housing element certification findings narrative for ${activeCase.jurisdiction} (pop. ${activeCase.population}, ${activeCase.cycle} cycle).
RHNA totals: VL=${activeCase.rhna?.veryLow||0}, L=${activeCase.rhna?.low||0}, M=${activeCase.rhna?.moderate||0}, AM=${activeCase.rhna?.aboveMod||0}.
Findings:
${summary}
Output a professional narrative suitable for the public certification record and recommend certify / non-certify.`
      const resp = await callAI(prompt, {
        schema: { properties: {
          narrative: { type: "string" },
          recommendation: { type: "string" }
        }}
      })
      const parsed = JSON.parse(resp)
      await database.put({ ...activeCase, draftFindings: parsed.narrative, recommendation: parsed.recommendation })
    } finally { setDrafting(false) }
  }

  async function publish(decision) {
    if (!activeCase) return
    setPublishing(true)
    try {
      await database.put({ ...activeCase, status: decision, publishedAt: Date.now() })
    } finally { setPublishing(false) }
  }

  if (!activeCase) {
    return (
      <section id="certification" className={c.section}>
        <div className={c.sectionHead}><h2 className={c.h2}>§ 05 — Certification Decision</h2></div>
        <div className={c.sectionBody}><p className={c.muted}>Select a case to publish certification.</p></div>
      </section>
    )
  }

  return (
    <section id="certification" className={c.section}>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>§ 05 — Certification Decision</h2>
        <span className={c.chip}>{activeCase.status}</span>
      </div>
      <div className={c.sectionBody}>
        <label className={c.label}>Draft Findings Document</label>
        {can("write") ? (
          <textarea className={c.textarea + " min-h-[140px]"}
            value={activeCase.draftFindings || ""}
            onChange={e => database.put({ ...activeCase, draftFindings: e.target.value })}
            placeholder="Draft findings narrative for the certification record…" />
        ) : (
          <div className={c.muted + " whitespace-pre-wrap p-2 border border-[#3a3f52] rounded-sm"}>{activeCase.draftFindings || "(no findings drafted)"}</div>
        )}
        {activeCase.recommendation && (
          <div className="mt-2 p-2 border border-[#3a3f52] rounded-sm bg-[#0e1018]">
            <div className={c.label}>AI Recommendation</div>
            <div className="text-xs text-[#cbd5e1]">{activeCase.recommendation}</div>
          </div>
        )}
        {can("write") && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <button disabled={drafting} onClick={aiDraft} className={c.btnGhost}>
              {drafting ? <><Spinner /> Drafting…</> : "AI Draft Findings"}
            </button>
            <button disabled={publishing} onClick={() => publish("certified")} className={c.btn}>
              {publishing ? <><Spinner /> Publishing…</> : "Publish · Certify"}
            </button>
            <button disabled={publishing} onClick={() => publish("non-certified")} className={c.btnGhost}>Non-Certify</button>
          </div>
        )}
        {activeCase.publishedAt && (
          <div className={c.muted + " mt-2"}>Published {new Date(activeCase.publishedAt).toLocaleString()}</div>
        )}
      </div>
    </section>
  )
}

function CorrespondenceSection({ c, activeCase, can, database, useLiveQuery, viewer }) {
  const { docs: entries } = useLiveQuery("corrCaseId", { key: activeCase?._id || "__none__", descending: true })
  const [kind, setKind] = React.useState("rfi")
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")

  async function logEntry(e) {
    e.preventDefault()
    if (!activeCase || !subject.trim()) return
    await database.put({
      type: "correspondence", corrCaseId: activeCase._id, kind, subject: subject.trim(), body: body.trim(),
      authorSlug: viewer?.userSlug || "anonymous", authorName: viewer?.displayName || viewer?.userSlug || "Anonymous",
      authorAvatar: viewer?.avatarUrl || null, loggedAt: Date.now()
    })
    setSubject(""); setBody("")
  }

  if (!activeCase) {
    return (
      <section id="correspondence" className={c.section}>
        <div className={c.sectionHead}><h2 className={c.h2}>§ 04 — Correspondence Log</h2></div>
        <div className={c.sectionBody}><p className={c.muted}>Select a case to view correspondence.</p></div>
      </section>
    )
  }

  return (
    <section id="correspondence" className={c.section}>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>§ 04 — Correspondence Log</h2>
        <span className={c.muted}>{entries.length} entries</span>
      </div>
      <div className={c.sectionBody}>
        {can("write") ? (
          <form onSubmit={logEntry} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className={c.input} value={kind} onChange={e => setKind(e.target.value)}>
                <option value="rfi">Request for Information</option>
                <option value="response">Jurisdiction Response</option>
                <option value="note">Internal Note</option>
              </select>
              <input className={c.input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <textarea className={c.textarea} value={body} onChange={e => setBody(e.target.value)} placeholder="Detail of communication…" />
            <button type="submit" className={c.btn}>Log Entry</button>
          </form>
        ) : <p className={c.muted}>Read-only.</p>}
        <div className="space-y-2 pt-2">
          {entries.length === 0 && <div className={c.row}><div className={c.muted}>No correspondence yet.</div></div>}
          {entries.map(en => (
            <div key={en._id} className={c.row}>
              <div className="flex justify-between items-start mb-1">
                <span className={c.chip}>{en.kind}</span>
                <span className={c.muted}>{new Date(en.loggedAt).toLocaleDateString()}</span>
              </div>
              <strong className="font-['Archivo_Black',sans-serif] tracking-tight text-sm">{en.subject}</strong>
              <div className="text-xs text-[#cbd5e1] whitespace-pre-wrap mt-1">{en.body}</div>
              <div className="flex items-center gap-2 mt-2">
                {en.authorAvatar && <img src={en.authorAvatar} alt="" className="w-5 h-5 rounded-full" />}
                <span className={c.muted}>{en.authorName}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ChecklistSection({ c, activeCase, can, database, useLiveQuery }) {
  const { docs: findings } = useLiveQuery("caseId", { key: activeCase?._id || "__none__" })
  const [loadingKey, setLoadingKey] = React.useState(null)
  const completeCount = findings.filter(f => f.reviewed).length

  async function critique(item, finding) {
    if (!activeCase) return
    setLoadingKey(item[0])
    try {
      const prompt = `Critique this housing element review finding for jurisdiction ${activeCase.jurisdiction}.
Category: ${item[1]}
Statute: ${item[2]}
Reviewer's evidence: ${finding?.evidence || "(none yet)"}
RHNA total: ${["veryLow","low","moderate","aboveMod"].reduce((s,k)=>s+(activeCase.rhna?.[k]||0),0)}
Flag gaps, suggest stronger citation language, score completeness 0-100.`
      const resp = await callAI(prompt, {
        schema: { properties: {
          gaps: { type: "array", items: { type: "string" } },
          suggestedLanguage: { type: "string" },
          completenessScore: { type: "number" }
        }}
      })
      const parsed = JSON.parse(resp)
      const base = finding || { type: "finding", caseId: activeCase._id, itemKey: item[0], itemName: item[1], cite: item[2], evidence: "", reviewed: false }
      await database.put({ ...base, critique: parsed })
    } finally { setLoadingKey(null) }
  }

  async function updateFinding(item, patch, existing) {
    const base = existing || { type: "finding", caseId: activeCase._id, itemKey: item[0], itemName: item[1], cite: item[2], evidence: "", reviewed: false }
    await database.put({ ...base, ...patch })
  }

  if (!activeCase) {
    return (
      <section id="checklist" className={c.section}>
        <div className={c.sectionHead}><h2 className={c.h2}>§ 03 — Statutory Checklist</h2></div>
        <div className={c.sectionBody}><p className={c.muted}>Select a case file to begin checklist review.</p></div>
      </section>
    )
  }

  return (
    <section id="checklist" className={c.section}>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>§ 03 — Statutory Checklist</h2>
        <span className={c.muted}>{completeCount} / 6 complete</span>
      </div>
      <div className={c.sectionBody}>
        {CHECKLIST_ITEMS.map(item => {
          const [k, name, cite] = item
          const finding = findings.find(f => f.itemKey === k)
          const isLoading = loadingKey === k
          return (
            <div key={k} className={c.row}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <strong className="font-['Archivo_Black',sans-serif] tracking-tight">{name}</strong>
                  <div className={c.muted}>{cite}</div>
                </div>
                <span className={c.chip}>{finding?.reviewed ? "reviewed" : "pending"}</span>
              </div>
              <label className={c.label}>Evidence in submission</label>
              {can("write") ? (
                <textarea className={c.textarea}
                  value={finding?.evidence || ""}
                  onChange={e => updateFinding(item, { evidence: e.target.value }, finding)}
                  placeholder="Cite page numbers, exhibits, data sources…" />
              ) : (
                <div className={c.muted + " whitespace-pre-wrap p-2 border border-[#3a3f52] rounded-sm"}>{finding?.evidence || "(no evidence recorded)"}</div>
              )}
              {finding?.critique && (
                <div className="mt-2 p-2 border border-[#3a3f52] rounded-sm bg-[#0e1018]">
                  <div className={c.label}>AI Critique · Score {finding.critique.completenessScore}/100</div>
                  {finding.critique.gaps?.length > 0 && (
                    <ul className="text-xs list-disc pl-5 mb-2">
                      {finding.critique.gaps.map((g,i) => <li key={i}>{g}</li>)}
                    </ul>
                  )}
                  <div className="text-xs text-[#cbd5e1] whitespace-pre-wrap">{finding.critique.suggestedLanguage}</div>
                </div>
              )}
              {can("write") && (
                <div className="flex gap-2 mt-2">
                  <button disabled={isLoading} onClick={() => critique(item, finding)} className={c.btnGhost}>
                    {isLoading ? <><Spinner /> Analyzing…</> : "AI Critique"}
                  </button>
                  <button onClick={() => updateFinding(item, { reviewed: !finding?.reviewed }, finding)} className={c.btn}>
                    {finding?.reviewed ? "Unmark" : "Mark Reviewed"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("hcd-dossier")
  const [activeCaseId, setActiveCaseId] = React.useState(null)
  const { doc: caseDraft, merge: mergeCase, submit: submitCase } = useDocument({
    type: "case", jurisdiction: "", population: "", cycle: "6th", status: "draft", createdAt: Date.now()
  })
  const { docs: cases } = useLiveQuery("type", { key: "case", descending: true })
  const activeCase = cases.find(x => x._id === activeCaseId) || null

  const c = {
    page: "min-h-screen bg-[#28282e] text-white font-mono",
    header: "border-b border-[#3a3f52] bg-black px-4 py-4 sticky top-0 z-10",
    brand: "text-xs tracking-[0.3em] text-[#9aa3b8] uppercase",
    title: "font-['Archivo_Black',sans-serif] text-2xl md:text-3xl tracking-tight mt-1",
    sub: "text-xs text-[#9aa3b8] mt-1",
    viewer: "flex items-center gap-2 text-xs text-[#9aa3b8]",
    avatar: "w-7 h-7 rounded-full border border-[#3a3f52]",
    main: "max-w-3xl mx-auto px-4 py-5 space-y-5 pb-24",
    section: "border border-[#3a3f52] bg-black/60 rounded-sm",
    sectionHead: "border-b border-[#3a3f52] px-4 py-3 flex items-center justify-between",
    h2: "font-['Archivo_Black',sans-serif] text-sm tracking-[0.2em] uppercase",
    sectionBody: "p-4 space-y-3",
    label: "block text-[0.65rem] tracking-[0.2em] uppercase text-[#9aa3b8] mb-1",
    input: "w-full bg-[#1a1d28] border border-[#3a3f52] rounded-sm px-3 py-3 text-sm focus:outline-none focus:border-white min-h-[44px]",
    textarea: "w-full bg-[#1a1d28] border border-[#3a3f52] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-white min-h-[80px]",
    btn: "min-h-[44px] px-4 py-2 bg-white text-black text-xs tracking-[0.2em] uppercase font-bold rounded-sm hover:bg-[#e0e0e0] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a3f52] text-xs tracking-[0.2em] uppercase rounded-sm hover:border-white",
    chip: "inline-block px-2 py-1 text-[0.6rem] tracking-[0.2em] uppercase border border-[#3a3f52] rounded-sm mr-1 mb-1",
    row: "border border-[#3a3f52] rounded-sm p-3 bg-[#1a1d28]",
    muted: "text-xs text-[#9aa3b8]",
    statusBar: "fixed bottom-0 left-0 right-0 bg-black border-t border-[#3a3f52] px-4 py-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#9aa3b8] flex justify-between",
  }

  function noop(e) { if (e?.preventDefault) e.preventDefault() }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>

      <header id="app-header" className={c.header}>
        <div className="flex justify-between items-start gap-3">
          <div>
            <div className={c.brand}>Dossier // HCD Review</div>
            <h1 className={c.title}>Housing Element Compliance</h1>
            <div className={c.sub}>Statutory certification review system</div>
          </div>
          {viewer && (
            <div className={c.viewer}>
              <img src={viewer.avatarUrl} alt="" className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="case-files" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.h2}>§ 01 — Case Files</h2>
            <span className={c.muted}>{cases.length} open</span>
          </div>
          <div className={c.sectionBody}>
            {can("write") ? (
              <form onSubmit={(e) => { e.preventDefault(); if (caseDraft.jurisdiction.trim()) submitCase() }} className="space-y-3">
                <div>
                  <label className={c.label}>Jurisdiction</label>
                  <input className={c.input} value={caseDraft.jurisdiction} onChange={e => mergeCase({ jurisdiction: e.target.value })} placeholder="e.g. City of Mountain View" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={c.label}>Population</label>
                    <input className={c.input} type="number" value={caseDraft.population} onChange={e => mergeCase({ population: e.target.value })} placeholder="82000" />
                  </div>
                  <div>
                    <label className={c.label}>Cycle</label>
                    <input className={c.input} value={caseDraft.cycle} onChange={e => mergeCase({ cycle: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className={c.btn}>Open Case File</button>
              </form>
            ) : (
              <p className={c.muted}>Read-only view — contact the program owner for write access.</p>
            )}
            <div className="space-y-2 pt-2">
              {cases.length === 0 && <div className={c.row}><div className={c.muted}>No cases opened yet.</div></div>}
              {cases.map(cs => {
                const dual = Number(cs.population) >= 50000
                const isActive = cs._id === activeCaseId
                return (
                  <button key={cs._id} onClick={() => setActiveCaseId(cs._id)} className={`${c.row} w-full text-left ${isActive ? 'border-white' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="font-['Archivo_Black',sans-serif] tracking-tight">{cs.jurisdiction}</strong>
                        <div className={c.muted}>Pop. {Number(cs.population).toLocaleString()} · {cs.cycle} Cycle</div>
                      </div>
                      <div>
                        <span className={c.chip}>{cs.status}</span>
                        {dual && <span className={c.chip}>DUAL</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section id="rhna" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.h2}>§ 02 — RHNA Allocation</h2>
            <span className={c.muted}>{activeCase ? activeCase.jurisdiction : "No case selected"}</span>
          </div>
          <div className={c.sectionBody}>
            {!activeCase ? (
              <p className={c.muted}>Select or open a case file above to record RHNA.</p>
            ) : !can("write") ? (
              <div className="space-y-2">
                <p className={c.muted}>Allocation totals (read-only):</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Very Low: <strong>{activeCase.rhna?.veryLow ?? 0}</strong></div>
                  <div>Low: <strong>{activeCase.rhna?.low ?? 0}</strong></div>
                  <div>Moderate: <strong>{activeCase.rhna?.moderate ?? 0}</strong></div>
                  <div>Above Mod: <strong>{activeCase.rhna?.aboveMod ?? 0}</strong></div>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault() }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[["veryLow","Very Low (<50% AMI)"],["low","Low (50–80%)"],["moderate","Moderate (80–120%)"],["aboveMod","Above Moderate"]].map(([k,lbl]) => (
                    <div key={k}>
                      <label className={c.label}>{lbl}</label>
                      <input type="number" className={c.input}
                        value={activeCase.rhna?.[k] ?? ""}
                        onChange={e => database.put({ ...activeCase, rhna: { ...(activeCase.rhna||{}), [k]: Number(e.target.value)||0 } })}
                      />
                    </div>
                  ))}
                </div>
                <div className={c.muted}>
                  Total assigned: <strong className="text-white">
                    {(["veryLow","low","moderate","aboveMod"].reduce((s,k) => s + (activeCase.rhna?.[k]||0), 0)).toLocaleString()}
                  </strong> units
                </div>
              </form>
            )}
          </div>
        </section>

        <ChecklistSection {...{ c, activeCase, can, database, useLiveQuery }} />

        <CorrespondenceSection {...{ c, activeCase, can, database, useLiveQuery, viewer }} />

        <CertificationSection {...{ c, activeCase, can, database, useLiveQuery }} />
      </main>

      <div className={c.statusBar}>
        <span>CASE: {activeCase ? activeCase.jurisdiction.toUpperCase() : "—"}</span>
        <span>STATUS: {activeCase ? (activeCase.status || "draft").toUpperCase() : "—"}</span>
      </div>
    </div>
  )
}