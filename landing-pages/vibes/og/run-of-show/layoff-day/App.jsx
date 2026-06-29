import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("layoff-day-choreography")
  const [expandedId, setExpandedId] = React.useState(null)

  const cohort = [
    { id: "E001", time: "09:00", manager: "Park", badge: "09:30", pkg: "v3.1" },
    { id: "E002", time: "09:15", manager: "Okafor", badge: "09:45", pkg: "v3.1" },
    { id: "E003", time: "09:30", manager: "Reyes", badge: "10:00", pkg: "v3.0" },
    { id: "E004", time: "09:45", manager: "Park", badge: "10:15", pkg: "v3.1" },
    { id: "E005", time: "10:00", manager: "Tan", badge: "10:30", pkg: "v3.2" },
    { id: "E006", time: "10:15", manager: "Okafor", badge: "10:45", pkg: "v3.1" },
  ]

  const { docs: statusDocs } = useLiveQuery("type", { key: "status", descending: true })
  const { docs: escDocs } = useLiveQuery("type", { key: "escalation", descending: true })

  const latestByEmployee = {}
  for (const d of [...statusDocs].reverse()) latestByEmployee[d.employeeId] = d
  const counts = { SCHEDULED: 0, NOTIFIED: 0, "IT DONE": 0 }
  for (const e of cohort) {
    const s = latestByEmployee[e.id]?.status || "SCHEDULED"
    if (s === "SCHEDULED" || s === "IN MEETING") counts.SCHEDULED++
    if (s === "NOTIFIED" || s === "FAREWELL SENT") counts.NOTIFIED++
    if (s === "IT DONE" || s === "FAREWELL SENT") counts["IT DONE"]++
  }

  const { doc: statusDoc, merge: mergeStatus, submit: submitStatus } =
    useDocument({ type: "status", employeeId: "", status: "SCHEDULED", note: "", createdAt: Date.now() })
  const { doc: escDoc, merge: mergeEsc, submit: submitEsc } =
    useDocument({ type: "escalation", employeeId: "", flag: "Manager Unavailable", detail: "", resolved: false, createdAt: Date.now() })

  function handleStatusSubmit(e) { e.preventDefault(); mergeStatus({ createdAt: Date.now() }); submitStatus() }
  function handleEscalationSubmit(e) { e.preventDefault(); mergeEsc({ createdAt: Date.now() }); submitEsc() }
  function handleResolve(esc) { database.put({ ...esc, resolved: true, resolvedAt: Date.now() }) }
  function handleRowClick(id) { setExpandedId(expandedId === id ? null : id) }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black font-sans",
    header: "px-6 pt-10 pb-6",
    eyebrow: "text-[0.6rem] font-bold uppercase tracking-[0.12em] mb-4 text-black",
    heroBand: "grid grid-cols-[200px_1fr_200px] border-t border-b border-black min-h-[180px]",
    heroSide: "p-4 text-[0.6rem] font-bold uppercase tracking-[0.1em] flex flex-col justify-between",
    heroCenter: "p-6 border-l border-r border-black flex items-center justify-center",
    heroTitle: "text-center font-black uppercase leading-[0.9] tracking-[-0.04em]",
    counters: "grid grid-cols-3 border-b border-black",
    counter: "p-5 border-r border-black last:border-r-0",
    counterLabel: "text-[0.6rem] font-bold uppercase tracking-[0.12em] mb-2",
    counterValue: "text-4xl font-black tabular-nums",
    section: "border-b border-black",
    sectionHead: "flex items-baseline justify-between px-6 py-4 border-b border-black",
    sectionTitle: "text-[0.7rem] font-bold uppercase tracking-[0.12em]",
    sectionMeta: "text-[0.6rem] uppercase tracking-[0.1em] text-[#666]",
    gridHead: "grid grid-cols-[60px_90px_1fr_1fr_100px_140px] text-[0.55rem] font-bold uppercase tracking-[0.1em]",
    gridHeadCell: "px-3 py-2 border-r border-black last:border-r-0",
    gridRow: "grid grid-cols-[60px_90px_1fr_1fr_100px_140px] text-[0.78rem] border-t border-black cursor-pointer hover:bg-black hover:text-white",
    gridCell: "px-3 py-3 border-r border-black last:border-r-0 truncate",
    expandRow: "border-t border-black px-6 py-5 grid grid-cols-2 gap-6 text-[0.78rem] bg-white",
    expandLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mb-1",
    form: "px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4",
    formField: "flex flex-col",
    formLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mb-1",
    input: "bg-transparent border-b border-black py-1 text-[0.85rem] outline-none",
    select: "bg-transparent border-b border-black py-1 text-[0.85rem] outline-none appearance-none",
    formActions: "col-span-2 flex gap-3 pt-2",
    btn: "px-6 py-3 border border-black bg-white text-black text-[0.65rem] font-bold uppercase tracking-[0.08em] hover:bg-black hover:text-white",
    btnFilled: "px-6 py-3 border border-black bg-black text-white text-[0.65rem] font-bold uppercase tracking-[0.08em] hover:bg-white hover:text-black",
    escList: "divide-y divide-black",
    escRow: "px-6 py-4 grid grid-cols-[1fr_120px_120px] gap-4 items-start text-[0.78rem]",
    escMeta: "text-[0.55rem] uppercase tracking-[0.1em] mb-1 text-[#666]",
    footer: "px-6 py-8 text-[0.55rem] uppercase tracking-[0.12em] text-[#666] border-t border-black",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.eyebrow}>Confidential — Operations Coordination</div>
        <div className={c.heroBand}>
          <div className={c.heroSide}>
            <div>Issue No. 01</div>
            <div>Restricted Distribution</div>
          </div>
          <div className={c.heroCenter}>
            <h1 className={c.heroTitle} style={{ fontSize: "clamp(3rem,10vw,8rem)", WebkitTextStroke: "2px #000", color: "transparent" }}>
              Choreography
            </h1>
          </div>
          <div className={c.heroSide}>
            <div>Coordination</div>
            <div>Page 1 / 1</div>
          </div>
        </div>
      </header>

      <main id="app">
        <section id="counters" className={c.counters}>
          <div className={c.counter}>
            <div className={c.counterLabel}>Scheduled</div>
            <div className={c.counterValue}>{String(counts.SCHEDULED).padStart(2, "0")}</div>
          </div>
          <div className={c.counter}>
            <div className={c.counterLabel}>Notified</div>
            <div className={c.counterValue}>{String(counts.NOTIFIED).padStart(2, "0")}</div>
          </div>
          <div className={c.counter}>
            <div className={c.counterLabel}>IT Done</div>
            <div className={c.counterValue}>{String(counts["IT DONE"]).padStart(2, "0")}</div>
          </div>
        </section>

        <section id="cohort" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Cohort Schedule</h2>
            <div className={c.sectionMeta}>Sorted by meeting time</div>
          </div>
          <div className={c.gridHead}>
            <div className={c.gridHeadCell}>Time</div>
            <div className={c.gridHeadCell}>ID</div>
            <div className={c.gridHeadCell}>Manager</div>
            <div className={c.gridHeadCell}>Package</div>
            <div className={c.gridHeadCell}>Badge</div>
            <div className={c.gridHeadCell}>Status</div>
          </div>
          {cohort.map(emp => {
            const latest = latestByEmployee[emp.id]
            const status = latest?.status || "SCHEDULED"
            return (
              <React.Fragment key={emp.id}>
                <div className={c.gridRow} onClick={() => handleRowClick(emp.id)}>
                  <div className={c.gridCell}>{emp.time}</div>
                  <div className={c.gridCell}>{emp.id}</div>
                  <div className={c.gridCell}>{emp.manager}</div>
                  <div className={c.gridCell}>{emp.pkg}</div>
                  <div className={c.gridCell}>{emp.badge}</div>
                  <div className={c.gridCell}>{status}</div>
                </div>
                {expandedId === emp.id && (
                  <div className={c.expandRow}>
                    <div>
                      <div className={c.expandLabel}>Manager Note</div>
                      <div>{latest?.note || "No note recorded."}</div>
                    </div>
                    <div>
                      <div className={c.expandLabel}>Last Update</div>
                      <div>{latest ? new Date(latest.createdAt).toLocaleTimeString() : "—"}</div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </section>

        <section id="status-update" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Record Status Change</h2>
            <div className={c.sectionMeta}>Appends to audit log</div>
          </div>
          <form onSubmit={handleStatusSubmit} className={c.form}>
            <div className={c.formField}>
              <label className={c.formLabel}>Employee ID</label>
              <input className={c.input} placeholder="E001" value={statusDoc.employeeId} onChange={e => mergeStatus({ employeeId: e.target.value.toUpperCase() })} />
            </div>
            <div className={c.formField}>
              <label className={c.formLabel}>New Status</label>
              <select className={c.select} value={statusDoc.status} onChange={e => mergeStatus({ status: e.target.value })}>
                <option>SCHEDULED</option>
                <option>IN MEETING</option>
                <option>NOTIFIED</option>
                <option>IT DONE</option>
                <option>FAREWELL SENT</option>
              </select>
            </div>
            <div className={c.formField} style={{ gridColumn: "span 2" }}>
              <label className={c.formLabel}>Note</label>
              <input className={c.input} placeholder="Optional context for the log" value={statusDoc.note} onChange={e => mergeStatus({ note: e.target.value })} />
            </div>
            <div className={c.formActions}>
              <button type="submit" className={c.btnFilled}>Record</button>
              <button type="button" className={c.btn}>Clear</button>
            </div>
          </form>
        </section>

        <section id="escalations" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Escalations</h2>
            <div className={c.sectionMeta}>{escDocs.filter(d => !d.resolved).length} open</div>
          </div>
          <form onSubmit={handleEscalationSubmit} className={c.form}>
            <div className={c.formField}>
              <label className={c.formLabel}>Employee ID</label>
              <input className={c.input} placeholder="E001" value={escDoc.employeeId} onChange={e => mergeEsc({ employeeId: e.target.value.toUpperCase() })} />
            </div>
            <div className={c.formField}>
              <label className={c.formLabel}>Flag Type</label>
              <select className={c.select} value={escDoc.flag} onChange={e => mergeEsc({ flag: e.target.value })}>
                <option>Manager Unavailable</option>
                <option>Equipment Request</option>
                <option>Package Question</option>
                <option>Other</option>
              </select>
            </div>
            <div className={c.formField} style={{ gridColumn: "span 2" }}>
              <label className={c.formLabel}>Detail</label>
              <input className={c.input} placeholder="What happened" value={escDoc.detail} onChange={e => mergeEsc({ detail: e.target.value })} />
            </div>
            <div className={c.formActions}>
              <button type="submit" className={c.btnFilled}>File Escalation</button>
            </div>
          </form>
          <div className={c.escList}>
            {escDocs.length === 0 && (
              <div className={c.escRow}>
                <div>
                  <div className={c.escMeta}>—</div>
                  <div>No escalations filed.</div>
                </div>
                <div className={c.escMeta}>—</div>
                <div className={c.escMeta}>—</div>
              </div>
            )}
            {escDocs.map(esc => (
              <div className={c.escRow} key={esc._id}>
                <div>
                  <div className={c.escMeta}>{esc.employeeId} — {esc.flag}</div>
                  <div>{esc.detail || "No detail provided."}</div>
                </div>
                <div className={c.escMeta}>{esc.resolved ? "RESOLVED" : "OPEN"}</div>
                {!esc.resolved && (
                  <button type="button" className={c.btn} onClick={() => handleResolve(esc)}>Resolve</button>
                )}
                {esc.resolved && <div className={c.escMeta}>{new Date(esc.resolvedAt).toLocaleTimeString()}</div>}
              </div>
            ))}
          </div>
        </section>

        <section id="log" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Audit Log</h2>
            <div className={c.sectionMeta}>Most recent first</div>
          </div>
          <div className={c.gridHead} style={{ gridTemplateColumns: "120px 90px 140px 1fr" }}>
            <div className={c.gridHeadCell}>Timestamp</div>
            <div className={c.gridHeadCell}>ID</div>
            <div className={c.gridHeadCell}>Status</div>
            <div className={c.gridHeadCell}>Note</div>
          </div>
          {statusDocs.length === 0 && (
            <div className={c.gridRow} style={{ gridTemplateColumns: "120px 90px 140px 1fr" }}>
              <div className={c.gridCell}>—</div>
              <div className={c.gridCell}>—</div>
              <div className={c.gridCell}>—</div>
              <div className={c.gridCell}>No entries yet.</div>
            </div>
          )}
          {statusDocs.map(d => (
            <div className={c.gridRow} key={d._id} style={{ gridTemplateColumns: "120px 90px 140px 1fr" }}>
              <div className={c.gridCell}>{new Date(d.createdAt).toLocaleTimeString()}</div>
              <div className={c.gridCell}>{d.employeeId}</div>
              <div className={c.gridCell}>{d.status}</div>
              <div className={c.gridCell}>{d.note || "—"}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className={c.footer}>End of document</footer>
    </div>
  )
}