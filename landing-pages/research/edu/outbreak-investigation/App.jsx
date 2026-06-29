import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function StatusNotes({ c, can, viewer, database, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({ text: "", type: "note", createdAt: Date.now() })
  const { docs: notes } = useLiveQuery("type", { key: "note", descending: true })
  const { docs: comments } = useLiveQuery("type", { key: "comment" })
  const [reply, setReply] = React.useState({})

  function postNote(e) {
    e.preventDefault()
    if (!doc.text.trim()) return
    submit({ authorUserSlug: viewer?.userSlug, authorDisplayName: viewer?.displayName ?? viewer?.userSlug, authorAvatarUrl: viewer?.avatarUrl })
  }

  async function postComment(noteId) {
    const body = (reply[noteId] || "").trim()
    if (!body || !viewer) return
    await database.put({
      type: "comment", noteId, body, createdAt: Date.now(),
      authorUserSlug: viewer.userSlug, authorDisplayName: viewer.displayName ?? viewer.userSlug, authorAvatarUrl: viewer.avatarUrl
    })
    setReply({ ...reply, [noteId]: "" })
  }

  return (
    <>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>✎ Daily Status Notes</h2>
        <span className={c.badge}>{notes.length} notes</span>
      </div>
      <div className="space-y-3">
        {can("write") && (
          <form onSubmit={postNote}>
            <label className={c.label}>Tonight's Update</label>
            <textarea className={c.input} rows={2} value={doc.text} onChange={(e) => merge({ text: e.target.value })} placeholder="14 interviews logged today, leading hypothesis: potato salad…" />
            <button type="submit" className={c.btn + " mt-2"}>Post Note</button>
          </form>
        )}
        {notes.length === 0 && <p className={c.rowMuted}>No status notes posted yet.</p>}
        {notes.map(n => {
          const noteComments = comments.filter(cm => cm.noteId === n._id).sort((a,b) => a.createdAt - b.createdAt)
          return (
            <div key={n._id} className="border border-[#3a3f4c] rounded p-3 bg-[#000] space-y-2">
              <div className="flex items-center gap-2">
                {n.authorAvatarUrl && <img src={n.authorAvatarUrl} alt={n.authorUserSlug} className="w-5 h-5 rounded-full" />}
                <span className="text-[10px] uppercase tracking-wider text-[#7a8294]">{n.authorDisplayName || "anon"} · {new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-[#f5f6f8]">{n.text}</p>
              <div className="pl-3 border-l border-[#3a3f4c] space-y-1.5">
                {noteComments.map(cm => (
                  <div key={cm._id} className="flex gap-2 text-xs">
                    {cm.authorAvatarUrl && <img src={cm.authorAvatarUrl} alt="" className="w-4 h-4 rounded-full mt-0.5" />}
                    <div><span className="text-[#7a8294]">{cm.authorDisplayName}:</span> <span className="text-[#f5f6f8]">{cm.body}</span></div>
                  </div>
                ))}
                {can("write") && viewer && (
                  <div className="flex gap-1 mt-1">
                    <input className={c.input + " text-xs"} placeholder="Reply…" value={reply[n._id] || ""} onChange={(e) => setReply({ ...reply, [n._id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), postComment(n._id))} />
                    <button onClick={() => postComment(n._id)} className={c.btnGhost + " text-[10px]"}>↵</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function AnalyticPanel({ c, can, viewer, database, useDocument, useLiveQuery }) {
  const { docs: interviews } = useLiveQuery("type", { key: "interview" })
  const { doc: notes, merge: mergeNotes, save: saveNotes } = useDocument({ _id: "bias-notes", text: "", type: "notes" })
  const { docs: analyses } = useLiveQuery("type", { key: "analysis", descending: true, limit: 1 })
  const latest = analyses[0]
  const [running, setRunning] = React.useState(false)

  async function runAnalysis() {
    if (interviews.length < 2) return
    setRunning(true)
    try {
      const payload = interviews.map(i => ({ subjectId: i.subjectId, role: i.role, exposures: i.exposures }))
      const r = await callAI(`As an epidemiologist, compute odds ratios for each exposure in this case-control data. Rank by strength of association. Flag potential confounders. Data: ${JSON.stringify(payload)}`, {
        schema: { properties: {
          exposures: { type: "array", items: { type: "object", properties: { name: { type: "string" }, oddsRatio: { type: "number" }, caseCount: { type: "number" }, controlCount: { type: "number" }, interpretation: { type: "string" } } } },
          confounders: { type: "array", items: { type: "string" } },
          narrative: { type: "string" }
        } }
      })
      const parsed = JSON.parse(r)
      await database.put({ type: "analysis", ...parsed, runBy: viewer?.userSlug || "anonymous", runAt: Date.now() })
    } finally { setRunning(false) }
  }

  return (
    <>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>⊕ Analytic Phase</h2>
        <span className={c.badge}>{interviews.length} subjects</span>
      </div>
      <div className="space-y-3">
        {can("write") ? (
          <button onClick={runAnalysis} disabled={running || interviews.length < 2} className={c.btn}>
            {running ? (
              <span className="flex items-center gap-2 justify-center"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg> Computing…</span>
            ) : "⚡ Run Odds-Ratio Analysis"}
          </button>
        ) : (
          <p className="text-[10px] text-[#7a8294] italic">Read-only view of analytic results.</p>
        )}

        {latest && (
          <div className="space-y-2 bg-[#000] border border-[#3a3f4c] rounded p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#7a8294]">Ranked Associations</p>
            {latest.exposures?.sort((a,b) => (b.oddsRatio||0) - (a.oddsRatio||0)).map((e, i) => (
              <div key={i} className="flex items-center gap-3 text-xs border-b border-[#1a1f2e] pb-1.5">
                <span className="font-bold text-[#e74c3c] w-12">OR {e.oddsRatio?.toFixed(2)}</span>
                <span className="flex-1 text-[#f5f6f8]">{e.name}</span>
                <span className="text-[#7a8294] text-[10px]">{e.caseCount}c / {e.controlCount}ct</span>
              </div>
            ))}
            {latest.narrative && <p className="text-xs text-[#7a8294] italic mt-2">{latest.narrative}</p>}
            {latest.confounders?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#3a3f4c]">
                <p className="text-[10px] uppercase tracking-wider text-[#7a8294] mb-1">⚠ Flagged Confounders</p>
                <ul className="text-xs text-[#f5f6f8] space-y-0.5">{latest.confounders.map((f, i) => <li key={i}>· {f}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {can("write") && (
          <div>
            <label className={c.label}>Confounding / Selection Bias Notes</label>
            <textarea className={c.input} rows={3} value={notes.text} onChange={(e) => mergeNotes({ text: e.target.value })} onBlur={saveNotes} placeholder="Multiple foods served together; controls recruited late…" />
          </div>
        )}
      </div>
    </>
  )
}

function LineList({ c, useLiveQuery, can, database }) {
  const { docs } = useLiveQuery("type", { key: "interview", descending: true })
  const cases = docs.filter(d => d.role === "case").length
  const controls = docs.filter(d => d.role === "control").length

  return (
    <>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>⊟ Line List</h2>
        <span className={c.badge}>{cases} cases · {controls} controls</span>
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-[60px_70px_1fr_auto] gap-2 text-[10px] uppercase tracking-wider text-[#7a8294] px-2 pb-1 border-b border-[#3a3f4c]">
          <span>ID</span><span>Role</span><span>Exposures</span><span></span>
        </div>
        {docs.length === 0 && <p className={c.rowMuted}>No interviews logged yet.</p>}
        {docs.map(d => (
          <div key={d._id} className="grid grid-cols-[60px_70px_1fr_auto] gap-2 items-center px-2 py-1.5 border-b border-[#1a1f2e] text-xs">
            <span className="font-bold text-[#f5f6f8]">{d.subjectId}</span>
            <span className={d.role === "case" ? "text-[#e74c3c]" : "text-[#7a8294]"}>{d.role}</span>
            <span className="text-[#7a8294] truncate" title={d.exposures}>{d.exposures}</span>
            {can("write") && <button onClick={() => database.del(d._id)} className="text-[10px] text-[#7a8294] hover:text-[#e74c3c]">✕</button>}
          </div>
        ))}
      </div>
    </>
  )
}

function InterviewPanel({ c, can, viewer, database, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({ subjectId: "", role: "case", exposures: "", notes: "", type: "interview", createdAt: Date.now(), createdBy: "" })
  const { docs } = useLiveQuery("type", { key: "interview", descending: true })
  const [suggesting, setSuggesting] = React.useState(false)

  async function suggestExample() {
    setSuggesting(true)
    try {
      const r = await callAI("Generate a realistic foodborne outbreak interview entry from a community picnic. Provide subjectId (S-###), role (case or control), exposures (comma-separated foods), and notes (onset + symptoms).", {
        schema: { properties: { subjectId: { type: "string" }, role: { type: "string" }, exposures: { type: "string" }, notes: { type: "string" } } }
      })
      const parsed = JSON.parse(r)
      merge(parsed)
    } finally { setSuggesting(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.subjectId.trim()) return
    submit({ createdBy: viewer?.userSlug || "anonymous" })
  }

  return (
    <>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>▤ Interview Capture</h2>
        <span className={c.badge}>{docs.length} logged</span>
      </div>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={c.label}>Subject ID</label>
              <input className={c.input} value={doc.subjectId} onChange={(e) => merge({ subjectId: e.target.value })} placeholder="S-001" />
            </div>
            <div>
              <label className={c.label}>Role</label>
              <select className={c.input} value={doc.role} onChange={(e) => merge({ role: e.target.value })}>
                <option value="case">Case (ill)</option>
                <option value="control">Control (not ill)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={c.label}>Exposures (comma-separated)</label>
            <input className={c.input} value={doc.exposures} onChange={(e) => merge({ exposures: e.target.value })} placeholder="potato salad, iced tea, fruit cup" />
          </div>
          <div>
            <label className={c.label}>Onset / Notes</label>
            <input className={c.input} value={doc.notes} onChange={(e) => merge({ notes: e.target.value })} placeholder="Onset 6h post-event, vomiting + diarrhea" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={c.btn}>+ Log Interview</button>
            <button type="button" onClick={suggestExample} disabled={suggesting} className={c.btnGhost}>
              {suggesting ? (
                <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
              ) : "✦ Suggest"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[10px] text-[#7a8294] italic">Read-only — sign in with write access to log interviews.</p>
      )}
    </>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("recon-grid")

  const { doc: caseDef, merge: mergeCaseDef, save: saveCaseDef } = useDocument({ _id: "case-definition", title: "", definition: "", status: "draft" })

  async function requestApproval() {
    await database.put({ ...caseDef, status: "pending-approval" })
  }
  async function approveDefinition() {
    await database.put({ ...caseDef, status: "approved", approvedBy: viewer?.userSlug, approvedAt: Date.now() })
  }

  const c = {
    page: "min-h-screen bg-[#000000] text-[#f5f6f8] font-mono",
    header: "sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#3a3f4c] px-4 py-3",
    title: "text-lg font-bold tracking-wider text-[#f5f6f8] uppercase",
    subtitle: "text-[10px] tracking-[0.2em] text-[#7a8294] uppercase mt-0.5",
    viewerChip: "flex items-center gap-2 text-xs text-[#7a8294]",
    avatar: "w-7 h-7 rounded-full border border-[#3a3f4c]",
    main: "max-w-3xl mx-auto px-3 py-4 space-y-4 pb-24",
    section: "bg-[#0a0a0f]/80 border border-[#3a3f4c] rounded-md p-4",
    sectionHead: "flex items-center justify-between mb-3 border-b border-[#3a3f4c] pb-2",
    h2: "text-xs font-bold tracking-[0.2em] text-[#e74c3c] uppercase",
    badge: "text-[10px] px-2 py-0.5 bg-[#1a1f2e] border border-[#3a3f4c] rounded text-[#7a8294] uppercase tracking-wider",
    btn: "min-h-[44px] px-4 py-2 bg-[#e74c3c] text-[#f5f6f8] text-sm font-bold uppercase tracking-wider rounded hover:bg-[#c0392b] disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a3f4c] text-[#f5f6f8] text-xs uppercase tracking-wider rounded hover:bg-[#1a1f2e]",
    input: "w-full bg-[#000] border border-[#3a3f4c] rounded px-3 py-2 text-sm text-[#f5f6f8] placeholder-[#555c6b] focus:outline-none focus:border-[#e74c3c]",
    label: "block text-[10px] uppercase tracking-[0.2em] text-[#7a8294] mb-1",
    row: "border border-[#3a3f4c] rounded p-2 bg-[#0a0a0f]",
    rowMuted: "text-xs text-[#7a8294]",
    bottomBar: "fixed bottom-0 left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur border-t border-[#3a3f4c] p-3 flex gap-2 justify-center"
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={c.title}>▣ Recon Grid</h1>
            <p className={c.subtitle}>Outbreak Investigation Workspace</p>
          </div>
          {viewer && (
            <div className={c.viewerChip}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="case-definition" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.h2}>◉ Case Definition</h2>
            <span className={c.badge}>{caseDef.status === "approved" ? "✓ Approved" : caseDef.status === "pending-approval" ? "⧗ Pending" : "Draft"}</span>
          </div>
          {can("write") ? (
            <div className="space-y-3">
              <div>
                <label className={c.label}>Outbreak Title</label>
                <input className={c.input} value={caseDef.title} onChange={(e) => mergeCaseDef({ title: e.target.value })} placeholder="e.g. Foodborne illness — Riverside picnic" />
              </div>
              <div>
                <label className={c.label}>Working Case Definition</label>
                <textarea className={c.input} rows={4} value={caseDef.definition} onChange={(e) => mergeCaseDef({ definition: e.target.value })} placeholder="Person, place, time, clinical criteria…" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className={c.btn} onClick={saveCaseDef}>Save Definition</button>
                <button className={c.btnGhost} onClick={requestApproval}>Request Approval</button>
                <button className={c.btnGhost} onClick={approveDefinition}>Approve (Supervisor)</button>
              </div>
              {caseDef.approvedBy && <p className={c.rowMuted}>Approved by {caseDef.approvedBy}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[#f5f6f8]">{caseDef.title || "Untitled outbreak"}</p>
              <p className={c.rowMuted}>{caseDef.definition || "No definition recorded yet."}</p>
              <p className="text-[10px] text-[#7a8294] italic">Read-only view — contact the lead for write access.</p>
            </div>
          )}
        </section>

        <section id="interviews" className={c.section}>
          <InterviewPanel c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />
        </section>

        <section id="line-list" className={c.section}>
          <LineList c={c} useLiveQuery={useLiveQuery} can={can} database={database} />
        </section>

        <section id="analytic" className={c.section}>
          <AnalyticPanel c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />
        </section>

        <section id="status-notes" className={c.section}>
          <StatusNotes c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}