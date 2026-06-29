import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const TIMELINE = [
  { offset: 0, label: "T+0 ASSESS" },
  { offset: 15, label: "T+15 LEGAL HOLD" },
  { offset: 30, label: "T+30 EXEC ALIGN" },
  { offset: 45, label: "T+45 EMPLOYEE NOTICE DRAFT" },
  { offset: 60, label: "T+1H FIRST EXTERNAL STATEMENT" },
  { offset: 120, label: "T+2H CUSTOMER NOTICE" },
  { offset: 240, label: "T+4H PRESS BRIEFING" },
  { offset: 360, label: "T+6H POST-MORTEM" },
]

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("crisis-comms-playbook")
  const [now, setNow] = React.useState(Date.now())
  const [activeTab, setActiveTab] = React.useState("timeline")
  const [suggesting, setSuggesting] = React.useState(false)

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { docs: incidents } = useLiveQuery("type", { key: "incident", descending: true, limit: 1 })
  const incident = incidents[0]
  const incidentId = incident?._id

  const { docs: tasks } = useLiveQuery("incidentId", { key: incidentId || "__none__" })
  const { docs: decisions } = useLiveQuery("type", { key: "decision", descending: true })
  const { docs: statements } = useLiveQuery("type", { key: "statement", descending: true })

  const filteredDecisions = decisions.filter(d => d.incidentId === incidentId)
  const filteredStatements = statements.filter(s => s.incidentId === incidentId)
  const openDecisions = filteredDecisions.length

  const elapsed = incident ? Math.max(0, now - incident.startedAt) : 0
  const hh = String(Math.floor(elapsed / 3600000)).padStart(2, "0")
  const mm = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, "0")
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")

  const { doc: incidentDoc, merge: mergeIncident, reset: resetIncident } = useDocument({ name: "", lead: "" })
  const { doc: decisionDoc, merge: mergeDecision, reset: resetDecision } = useDocument({ category: "", text: "" })
  const { doc: stmtDoc, merge: mergeStmt, reset: resetStmt } = useDocument({ title: "", body: "", approver: "" })

  async function handleOpenIncident(e) {
    e.preventDefault()
    if (!incidentDoc.name.trim()) return
    await database.put({
      type: "incident",
      name: incidentDoc.name,
      lead: incidentDoc.lead,
      startedAt: Date.now(),
    })
    resetIncident()
  }

  async function handleAddDecision(e) {
    e.preventDefault()
    if (!incidentId || !decisionDoc.text.trim()) return
    await database.put({
      type: "decision",
      incidentId,
      category: decisionDoc.category.toUpperCase() || "COMMS",
      text: decisionDoc.text,
      at: Date.now(),
    })
    resetDecision()
  }

  async function handleApproveStatement(e) {
    e.preventDefault()
    if (!incidentId || !stmtDoc.title.trim()) return
    const versions = filteredStatements.filter(s => s.title === stmtDoc.title).length
    await database.put({
      type: "statement",
      incidentId,
      title: stmtDoc.title,
      body: stmtDoc.body,
      approver: stmtDoc.approver,
      version: versions + 1,
      at: Date.now(),
    })
    resetStmt()
  }

  async function setOwner(stepOffset, owner) {
    const existing = tasks.find(t => t.offset === stepOffset)
    if (existing) {
      await database.put({ ...existing, owner, updatedAt: Date.now() })
    } else {
      await database.put({ type: "task", incidentId, offset: stepOffset, owner, status: "Pending", updatedAt: Date.now() })
    }
  }

  async function cycleStatus(stepOffset) {
    const order = ["Pending", "In Progress", "Done"]
    const existing = tasks.find(t => t.offset === stepOffset)
    const current = existing?.status || "Pending"
    const next = order[(order.indexOf(current) + 1) % order.length]
    if (existing) {
      await database.put({ ...existing, status: next, updatedAt: Date.now() })
    } else {
      await database.put({ type: "task", incidentId, offset: stepOffset, owner: "", status: next, updatedAt: Date.now() })
    }
  }

  async function suggestIncident() {
    setSuggesting(true)
    try {
      const res = await callAI("Generate a realistic but fictional corporate crisis incident name (one short line) and a plausible Comms Lead full name.", {
        schema: { properties: { name: { type: "string" }, lead: { type: "string" } } }
      })
      const data = JSON.parse(res)
      mergeIncident({ name: data.name, lead: data.lead })
    } finally {
      setSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black",
    inner: "px-4 md:px-6",
    headerBand: "grid grid-cols-[80px_1fr_80px] md:grid-cols-[200px_1fr_200px] border-b border-black",
    headerSide: "p-3 border-r border-black last:border-r-0 last:border-l last:border-black flex items-center",
    headerCenter: "p-4 md:p-6 flex items-center justify-center",
    hero: "uppercase font-black leading-none tracking-tighter",
    label: "text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    labelFilled: "text-[0.6rem] font-bold uppercase tracking-[0.12em] px-2 py-1 inline-block bg-black text-white",
    bannerRow: "grid grid-cols-2 border-b border-black",
    bannerCell: "p-3 border-r border-black last:border-r-0",
    bannerNum: "font-black text-2xl md:text-4xl tabular-nums",
    openForm: "p-4 border-b border-black grid gap-3",
    field: "flex flex-col gap-1",
    input: "w-full border-0 border-b border-black bg-transparent py-2 text-sm focus:outline-none",
    btn: "px-6 py-3 border border-black bg-white text-black text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px] hover:bg-black hover:text-white",
    grid: "grid grid-cols-1 md:grid-cols-2 border-b border-black",
    col: "border-r border-black last:border-r-0",
    sectionHead: "p-3 border-b border-black flex items-center justify-between",
    timelineHeadRow: "grid grid-cols-[1fr_90px_70px] text-[0.55rem] font-bold uppercase tracking-[0.1em] border-b border-black bg-black text-white",
    timelineHead: "p-2 border-r border-white last:border-r-0",
    timelineRow: "grid grid-cols-[1fr_90px_70px] border-b border-black text-xs hover:bg-black hover:text-white",
    timelineCell: "p-2 border-r border-black last:border-r-0 min-h-[44px] flex items-center",
    decisionList: "divide-y divide-black",
    decisionRow: "p-3 text-xs grid grid-cols-[60px_1fr] gap-2",
    decisionTag: "text-[0.55rem] font-bold uppercase tracking-[0.1em]",
    tabs: "grid grid-cols-2 border-b border-black border-t",
    tab: "p-3 text-[0.65rem] font-bold uppercase tracking-[0.08em] border-r border-black last:border-r-0 min-h-[44px] bg-white text-black",
    tabActive: "p-3 text-[0.65rem] font-bold uppercase tracking-[0.08em] border-r border-black last:border-r-0 min-h-[44px] bg-black text-white",
    statementRow: "p-3 border-b border-black text-xs",
    foot: "p-4 text-[0.55rem] uppercase tracking-[0.12em] text-center border-t border-black text-[#666]",
    muted: "text-xs text-[#666]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.inner}>
        <div className={c.headerBand}>
          <div className={c.headerSide}><span className={c.label}>VOL I</span></div>
          <div className={c.headerCenter}>
            <h1 className={c.hero} style={{fontSize:"clamp(2rem,10vw,8rem)",WebkitTextStroke:"2px #000",color:"transparent",letterSpacing:"-0.04em"}}>Crisis Comms</h1>
          </div>
          <div className={c.headerSide}><span className={c.label}>{incident ? "LIVE" : "STANDBY"}</span></div>
        </div>
        <div className={c.bannerRow}>
          <div className={c.bannerCell}>
            <div className={c.label}>Time Elapsed</div>
            <div className={c.bannerNum}>{incident ? `${hh}:${mm}:${ss}` : "—:—:—"}</div>
          </div>
          <div className={c.bannerCell}>
            <div className={c.label}>Open Decisions</div>
            <div className={c.bannerNum}>{openDecisions}</div>
          </div>
        </div>
      </header>

      <main id="app" className={c.inner}>
        <section id="open-incident">
          <div className={c.sectionHead}><span className={c.labelFilled}>Open Incident</span></div>
          {incident ? (
            <div className="p-4 border-b border-black text-xs">
              <div className={c.label}>Active Incident</div>
              <div className="font-bold text-base mt-1">{incident.name}</div>
              <div className={c.muted}>Lead: {incident.lead || "—"}</div>
            </div>
          ) : (
            <form onSubmit={handleOpenIncident} className={c.openForm}>
              <div className={c.field}>
                <label className={c.label}>Incident Name</label>
                <input className={c.input} value={incidentDoc.name} onChange={(e) => mergeIncident({ name: e.target.value })} placeholder="e.g. Data exposure — customer records" />
              </div>
              <div className={c.field}>
                <label className={c.label}>Comms Lead</label>
                <input className={c.input} value={incidentDoc.lead} onChange={(e) => mergeIncident({ lead: e.target.value })} placeholder="Full name" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className={c.btn}>Start Clock ›</button>
                <button type="button" onClick={suggestIncident} disabled={suggesting} className={c.btn}>
                  {suggesting ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline">
                      <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  ) : "Suggest ▲"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section id="grid" className={c.grid}>
          <div id="timeline" className={c.col}>
            <div className={c.sectionHead}><span className={c.labelFilled}>Incident Timeline</span><span className={c.label}>8 Steps</span></div>
            <div className={c.timelineHeadRow}>
              <div className={c.timelineHead}>Step / Owner</div>
              <div className={c.timelineHead}>Status</div>
              <div className={c.timelineHead}>Time</div>
            </div>
            {TIMELINE.map((row) => {
              const t = tasks.find(x => x.offset === row.offset)
              const reached = incident && elapsed >= row.offset * 60000
              return (
                <div key={row.offset} className={c.timelineRow}>
                  <div className={c.timelineCell}>
                    <div className="w-full">
                      <div className="font-bold">{row.label}</div>
                      <input
                        className="w-full border-0 border-b border-current bg-transparent py-1 text-[0.7rem] focus:outline-none"
                        placeholder="Assign owner"
                        defaultValue={t?.owner || ""}
                        disabled={!incident}
                        onBlur={(e) => e.target.value !== (t?.owner || "") && setOwner(row.offset, e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={c.timelineCell}>
                    <button
                      type="button"
                      disabled={!incident}
                      onClick={() => cycleStatus(row.offset)}
                      className="text-[0.55rem] font-bold uppercase tracking-[0.1em] underline-offset-2 hover:underline"
                    >
                      {t?.status || (reached ? "Pending ›" : "—")}
                    </button>
                  </div>
                  <div className={c.timelineCell}>
                    <span className={c.muted}>T+{row.offset}m</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div id="decisions" className={c.col}>
            <div className={c.sectionHead}><span className={c.labelFilled}>Decision Log</span><span className={c.label}>Append Only</span></div>
            <form onSubmit={handleAddDecision} className={c.openForm}>
              <div className={c.field}>
                <label className={c.label}>Category</label>
                <input
                  className={c.input}
                  value={decisionDoc.category}
                  onChange={(e) => mergeDecision({ category: e.target.value })}
                  placeholder="LEGAL / EXEC / COMMS / HR"
                  disabled={!incident}
                />
              </div>
              <div className={c.field}>
                <label className={c.label}>Decision</label>
                <input
                  className={c.input}
                  value={decisionDoc.text}
                  onChange={(e) => mergeDecision({ text: e.target.value })}
                  placeholder="One line."
                  disabled={!incident}
                />
              </div>
              <button type="submit" className={c.btn} disabled={!incident}>Log Decision →</button>
            </form>
            <ul className={c.decisionList}>
              {filteredDecisions.length === 0 && (
                <li className={c.decisionRow}>
                  <span className={c.decisionTag}>—</span>
                  <span className={c.muted}>No decisions logged yet.</span>
                </li>
              )}
              {filteredDecisions.map((d) => (
                <li key={d._id} className={c.decisionRow}>
                  <span className={c.decisionTag}>{d.category}</span>
                  <span>
                    <div>{d.text}</div>
                    <div className={c.muted}>{new Date(d.at).toLocaleTimeString()}</div>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="approved-language">
          <div className={c.tabs}>
            <button onClick={() => setActiveTab("timeline")} className={activeTab === "timeline" ? c.tabActive : c.tab}>Timeline</button>
            <button onClick={() => setActiveTab("language")} className={activeTab === "language" ? c.tabActive : c.tab}>Approved Language</button>
          </div>
          <div className={c.sectionHead}><span className={c.labelFilled}>Approved Language</span><span className={c.label}>Versioned</span></div>
          <form onSubmit={handleApproveStatement} className={c.openForm}>
            <div className={c.field}>
              <label className={c.label}>Statement Title</label>
              <input className={c.input} value={stmtDoc.title} onChange={(e) => mergeStmt({ title: e.target.value })} placeholder="e.g. First External Statement" disabled={!incident} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Body</label>
              <textarea className={c.input} rows={4} value={stmtDoc.body} onChange={(e) => mergeStmt({ body: e.target.value })} placeholder="Canonical drafted language…" disabled={!incident} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Approver</label>
              <input className={c.input} value={stmtDoc.approver} onChange={(e) => mergeStmt({ approver: e.target.value })} placeholder="Approver name" disabled={!incident} />
            </div>
            <button type="submit" className={c.btn} disabled={!incident}>Approve & Save ›</button>
          </form>
          <div>
            {filteredStatements.length === 0 && (
              <div className={c.statementRow}>
                <div className={c.label}>No statements approved yet.</div>
              </div>
            )}
            {filteredStatements.map((s) => (
              <div key={s._id} className={c.statementRow}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-bold uppercase tracking-tight">{s.title}</div>
                  <div className={c.label}>v{s.version}</div>
                </div>
                <div className="my-2 whitespace-pre-wrap">{s.body}</div>
                <div className={c.muted}>Approved by {s.approver || "—"} · {new Date(s.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={c.foot}>End of Playbook · Crisis Comms Live</footer>
    </div>
  )
}