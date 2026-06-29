import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("ma-signing-day")
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { doc: newTask, merge: mergeTask, submit: submitTask } = useDocument({
    type: "task",
    num: 0,
    description: "",
    owner: "",
    deps: "",
    durationMin: 15,
    createdAt: Date.now(),
  })

  const { docs: tasks } = useLiveQuery("type", { key: "task" })
  const { docs: events } = useLiveQuery("type", { key: "event", descending: true, limit: 50 })

  const sortedTasks = [...tasks].sort((a, b) => (a.num || 0) - (b.num || 0))
  const eventsByTask = {}
  for (const ev of events) {
    if (!eventsByTask[ev.taskId]) eventsByTask[ev.taskId] = []
    eventsByTask[ev.taskId].push(ev)
  }
  function statusFor(taskId) {
    const evs = eventsByTask[taskId] || []
    if (evs.find(e => e.kind === "done")) return "done"
    if (evs.find(e => e.kind === "start")) return "in-progress"
    return "pending"
  }
  function elapsedFor(taskId) {
    const evs = (eventsByTask[taskId] || []).slice().sort((a, b) => a.ts - b.ts)
    const start = evs.find(e => e.kind === "start")
    const done = evs.find(e => e.kind === "done")
    if (!start) return "—"
    const end = done ? done.ts : now
    const sec = Math.floor((end - start.ts) / 1000)
    const m = String(Math.floor(sec / 60)).padStart(2, "0")
    const s = String(sec % 60).padStart(2, "0")
    return `${m}:${s}`
  }
  function depsList(deps) {
    return String(deps || "").split(",").map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n))
  }
  function depsSatisfied(task) {
    const list = depsList(task.deps)
    if (list.length === 0) return true
    return list.every(n => {
      const dep = sortedTasks.find(t => t.num === n)
      return dep && statusFor(dep._id) === "done"
    })
  }
  const remaining = sortedTasks.filter(t => statusFor(t._id) !== "done").length
  const nextBlocked = sortedTasks.find(t => statusFor(t._id) !== "done" && !depsSatisfied(t))
  const firstStart = events.length ? Math.min(...events.filter(e => e.kind === "start").map(e => e.ts).concat([Infinity])) : Infinity
  const totalElapsedMs = firstStart === Infinity ? 0 : now - firstStart
  const overBudget = totalElapsedMs > 4 * 60 * 60 * 1000
  function fmtClock(ms) {
    if (ms <= 0) return "00:00:00"
    const s = Math.floor(ms / 1000)
    const h = String(Math.floor(s / 3600)).padStart(2, "0")
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
    const sec = String(s % 60).padStart(2, "0")
    return `${h}:${m}:${sec}`
  }
  function fmtTime(ts) {
    const d = new Date(ts)
    return d.toTimeString().slice(0, 8)
  }

  function handleTaskSubmit(e) {
    e.preventDefault()
    const num = newTask.num || (sortedTasks.length + 1)
    submitTask({ ...newTask, num })
  }
  async function handleStart(task) {
    await database.put({ type: "event", taskId: task._id, taskNum: task.num, kind: "start", actor: task.owner, ts: Date.now() })
  }
  async function handleDone(task) {
    await database.put({ type: "event", taskId: task._id, taskNum: task.num, kind: "done", actor: task.owner, ts: Date.now() })
  }
  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI(
        "Suggest one realistic M&A signing-day task for a 4-hour closing window. Provide a short description, the owner role (Lead Counsel, Lead Banker, PR Lead, or EA), and an expected duration in minutes between 5 and 30.",
        { schema: { properties: { description: { type: "string" }, owner: { type: "string" }, durationMin: { type: "number" } } } }
      )
      const parsed = JSON.parse(res)
      mergeTask({ description: parsed.description || "", owner: parsed.owner || "", durationMin: parsed.durationMin || 15 })
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black",
    header: "px-6 pt-10 pb-6 border-b border-black",
    eyebrow: "text-[0.6rem] font-bold uppercase tracking-[0.12em] mb-3",
    heroBand: "grid grid-cols-[200px_1fr_200px] border-t border-b border-black min-h-[180px]",
    heroSide: "p-4 text-[0.55rem] font-bold uppercase tracking-[0.1em] flex flex-col justify-between",
    heroCenter: "p-4 flex items-center justify-center text-center border-l border-r border-black",
    heroTitle: "font-black uppercase leading-none tracking-[-0.04em]",
    banner: "grid grid-cols-3 border-b border-black",
    bannerCell: "p-4 border-r border-black last:border-r-0",
    bannerLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mb-2 text-[#666]",
    bannerValue: "text-2xl font-black",
    section: "border-b border-black",
    sectionHead: "px-6 py-3 border-b border-black bg-black text-white text-[0.6rem] font-bold uppercase tracking-[0.12em] flex items-center justify-between",
    sectionBody: "p-6",
    formRow: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6",
    field: "flex flex-col",
    label: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mb-2",
    input: "bg-transparent border-0 border-b border-black py-2 text-sm focus:outline-none",
    fieldFull: "flex flex-col md:col-span-2",
    submitRow: "flex flex-wrap gap-3 pt-4 border-t border-black",
    btn: "px-6 py-3 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px]",
    btnGhost: "px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.6rem] font-bold uppercase tracking-[0.08em]",
    gridHead: "grid grid-cols-[40px_1fr_120px_60px_110px_80px_140px] border-b border-black text-[0.55rem] font-bold uppercase tracking-[0.1em] bg-black text-white",
    gridHeadCell: "p-3 border-r border-white/30 last:border-r-0",
    gridRow: "grid grid-cols-[40px_1fr_120px_60px_110px_80px_140px] border-b border-black last:border-b-0 hover:bg-black hover:text-white",
    gridCell: "p-3 border-r border-black last:border-r-0 text-sm flex items-center",
    gridNum: "p-3 border-r border-black text-sm font-bold flex items-center justify-center",
    statusPill: "text-[0.55rem] font-bold uppercase tracking-[0.08em] px-2 py-1 border border-black",
    rowActions: "p-2 border-r border-black last:border-r-0 flex gap-2 items-center",
    rowBtn: "px-3 py-2 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.55rem] font-bold uppercase tracking-[0.08em] flex-1",
    auditRow: "grid grid-cols-[140px_80px_120px_1fr] border-b border-black last:border-b-0",
    auditCell: "p-3 border-r border-black last:border-r-0 text-xs font-mono",
    footer: "px-6 py-8 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[#666] text-center",
    suggestBtn: "text-[0.55rem] font-bold uppercase tracking-[0.08em] underline hover:bg-white hover:text-black px-2 py-1",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.eyebrow}>Vol. I — Closing Day Edition</div>
        <div className={c.heroBand}>
          <aside className={c.heroSide}>
            <div>Window<br/>04:00:00</div>
            <div>Owners<br/>Multi-party</div>
          </aside>
          <div className={c.heroCenter}>
            <h1 className={c.heroTitle} style={{ fontSize: "clamp(3rem,10vw,8rem)", WebkitTextStroke: "2px #000", color: "transparent" }}>
              Signing Day
            </h1>
          </div>
          <aside className={c.heroSide}>
            <div>Edition<br/>Live</div>
            <div>Status<br/>In Session</div>
          </aside>
        </div>
        <div className={c.banner}>
          <div className={c.bannerCell}>
            <div className={c.bannerLabel}>Next Blocked</div>
            <div className={c.bannerValue}>{nextBlocked ? `№${String(nextBlocked.num).padStart(2, "0")}` : "—"}</div>
          </div>
          <div className={c.bannerCell}>
            <div className={c.bannerLabel}>Tasks Remaining</div>
            <div className={c.bannerValue}>{remaining} / {sortedTasks.length}</div>
          </div>
          <div className={c.bannerCell} style={overBudget ? { background: "#000", color: "#fff" } : {}}>
            <div className={c.bannerLabel} style={overBudget ? { color: "#fff" } : {}}>{overBudget ? "Drift Alarm" : "Elapsed of 4:00"}</div>
            <div className={c.bannerValue}>{fmtClock(totalElapsedMs)}</div>
          </div>
        </div>
      </header>

      <main id="app">
        <section id="add-task" className={c.section}>
          <div className={c.sectionHead}>
            <span>§ I — Add Task to Script</span>
            <button className={c.suggestBtn}>› Suggest</button>
          </div>
          <div className={c.sectionBody}>
            <form onSubmit={handleTaskSubmit}>
              <div className={c.formRow}>
                <div className={c.fieldFull}>
                  <label className={c.label}>Description</label>
                  <input className={c.input} value={newTask.description} onChange={e => mergeTask({ description: e.target.value })} placeholder="e.g. Counter-signature on master agreement" />
                </div>
                <div className={c.field}>
                  <label className={c.label}>Owner</label>
                  <input className={c.input} value={newTask.owner} onChange={e => mergeTask({ owner: e.target.value })} placeholder="Lead Counsel / Banker / PR / EA" />
                </div>
                <div className={c.field}>
                  <label className={c.label}>Dependencies (Task №s)</label>
                  <input className={c.input} value={newTask.deps} onChange={e => mergeTask({ deps: e.target.value })} placeholder="1, 3, 5" />
                </div>
                <div className={c.field}>
                  <label className={c.label}>Duration (minutes)</label>
                  <input className={c.input} type="number" value={newTask.durationMin} onChange={e => mergeTask({ durationMin: Number(e.target.value) })} />
                </div>
                <div className={c.field}>
                  <label className={c.label}>Task № (blank = auto)</label>
                  <input className={c.input} type="number" value={newTask.num || ""} onChange={e => mergeTask({ num: Number(e.target.value) })} />
                </div>
              </div>
              <div className={c.submitRow}>
                <button type="submit" className={c.btn}>› File Task</button>
                <button type="button" className={c.btnGhost} disabled={isSuggesting} onClick={handleSuggest}>
                  {isSuggesting ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                    </svg>
                  ) : "Suggest Example"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section id="task-grid" className={c.section}>
          <div className={c.sectionHead}>
            <span>§ II — The Script</span>
            <span>{String(sortedTasks.length).padStart(2, "0")} entries</span>
          </div>
          <div className={c.gridHead}>
            <div className={c.gridHeadCell}>№</div>
            <div className={c.gridHeadCell}>Description</div>
            <div className={c.gridHeadCell}>Owner</div>
            <div className={c.gridHeadCell}>Deps</div>
            <div className={c.gridHeadCell}>Status</div>
            <div className={c.gridHeadCell}>Elapsed</div>
            <div className={c.gridHeadCell}>Action</div>
          </div>

          {sortedTasks.length === 0 && (
            <div className="p-6 text-sm text-[#666] text-center">No tasks filed. Add the first entry above.</div>
          )}
          {sortedTasks.map(task => {
            const status = statusFor(task._id)
            const ok = depsSatisfied(task)
            const label = status === "done" ? "Done" : status === "in-progress" ? "In Progress" : (ok ? "Pending" : "Blocked")
            return (
              <div className={c.gridRow} key={task._id}>
                <div className={c.gridNum}>{String(task.num).padStart(2, "0")}</div>
                <div className={c.gridCell}>{task.description}</div>
                <div className={c.gridCell}>{task.owner}</div>
                <div className={c.gridCell}>{ok ? "✓" : "✗"}</div>
                <div className={c.gridCell}><span className={c.statusPill}>{label}</span></div>
                <div className={c.gridCell + " font-mono"}>{elapsedFor(task._id)}</div>
                <div className={c.rowActions}>
                  <button disabled={!ok || status !== "pending"} onClick={() => handleStart(task)} className={c.rowBtn}>Start</button>
                  <button disabled={status !== "in-progress"} onClick={() => handleDone(task)} className={c.rowBtn}>Done</button>
                </div>
              </div>
            )
          })}
        </section>

        <section id="audit" className={c.section}>
          <div className={c.sectionHead}>
            <span>§ III — Audit Log</span>
            <span>Chronological</span>
          </div>
          <div className={c.auditRow} style={{ fontWeight: 700 }}>
            <div className={c.auditCell}>Timestamp</div>
            <div className={c.auditCell}>Task №</div>
            <div className={c.auditCell}>Actor</div>
            <div className={c.auditCell}>Event</div>
          </div>
          {events.length === 0 && (
            <div className="p-6 text-sm text-[#666] text-center">No events recorded. The log writes itself as owners hit Start and Done.</div>
          )}
          {events.map(ev => (
            <div className={c.auditRow} key={ev._id}>
              <div className={c.auditCell}>{fmtTime(ev.ts)}</div>
              <div className={c.auditCell}>№{String(ev.taskNum).padStart(2, "0")}</div>
              <div className={c.auditCell}>{ev.actor || "—"}</div>
              <div className={c.auditCell}>{ev.kind === "start" ? "Started" : "Completed"}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className={c.footer}>— End of Script · Filed under Closing Day —</footer>
    </div>
  )
}