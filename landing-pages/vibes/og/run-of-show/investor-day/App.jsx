import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("investor-day-rundown")
  const [now, setNow] = React.useState(new Date())
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { docs: segments } = useLiveQuery("startMinutes", { type: "segment" })
  const segmentDocs = segments.filter(d => d.type === "segment").sort((a, b) => a.startMinutes - b.startMinutes)
  const { docs: logs } = useLiveQuery("_id", { descending: true, limit: 50 })
  const logDocs = logs.filter(d => d.type === "log")

  const seg = useDocument({ type: "segment", name: "", primary: "", backup: "", stage: "", start: "", duration: "", startMinutes: 0 })
  const logDoc = useDocument({ type: "log", text: "", at: "" })

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const liveSegment = segmentDocs.find(s => nowMinutes >= s.startMinutes && nowMinutes < s.startMinutes + Number(s.duration || 0))
  const upcoming = segmentDocs.filter(s => s.startMinutes > nowMinutes).slice(0, 2)

  const plannedStart = segmentDocs[0]?.startMinutes ?? nowMinutes
  const driftMin = liveSegment ? nowMinutes - liveSegment.startMinutes : 0
  const driftSign = driftMin >= 0 ? "+" : "-"
  const driftAbs = Math.abs(driftMin)
  const driftStr = `${driftSign}${String(Math.floor(driftAbs / 60)).padStart(2, "0")}:${String(driftAbs % 60).padStart(2, "0")}`

  const fmtTime = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  const fmtHM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`

  const execs = Array.from(new Set(segmentDocs.flatMap(s => [s.primary, s.backup]).filter(Boolean)))
  const stages = Array.from(new Set(segmentDocs.map(s => s.stage).filter(Boolean)))

  function handleLogSubmit(e) {
    e.preventDefault()
    if (!logDoc.doc.text.trim()) return
    logDoc.merge({ at: fmtTime(now).slice(0, 5) })
    logDoc.submit()
  }

  function handleSegmentSubmit(e) {
    e.preventDefault()
    const [h, m] = (seg.doc.start || "00:00").split(":").map(Number)
    seg.merge({ startMinutes: (h || 0) * 60 + (m || 0) })
    seg.submit()
  }

  async function suggestSegment() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Suggest one investor day segment with name, primary speaker, backup speaker, stage, start time HH:MM, and duration in minutes.", {
        schema: { properties: { name: { type: "string" }, primary: { type: "string" }, backup: { type: "string" }, stage: { type: "string" }, start: { type: "string" }, duration: { type: "string" } } }
      })
      const data = JSON.parse(res)
      seg.merge(data)
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen w-full bg-[#f5f1e8] text-[#1a1625]",
    header: "sticky top-0 z-20 px-4 py-3 border-b-[3px] border-[#1a1625] bg-white flex items-center justify-between gap-3",
    brandRow: "flex items-center gap-2",
    brandSquares: "flex gap-1",
    brandSquare: "w-3 h-3 border-[2px] border-[#1a1625]",
    brandText: "text-sm font-bold uppercase tracking-tight",
    driftWrap: "flex items-center gap-2 px-3 py-2 border-[3px] border-[#1a1625] rounded bg-[#d63a2a] text-white shadow-[3px_3px_0px_#1a1625]",
    driftLabel: "text-[0.6rem] uppercase tracking-widest",
    driftValue: "text-lg font-bold font-mono tabular-nums",
    nowBar: "px-4 py-2 border-b-[3px] border-[#1a1625] bg-[#2a55c4] text-white flex items-center justify-between",
    nowLabel: "text-[0.65rem] uppercase tracking-widest font-bold",
    nowTime: "text-base font-mono font-bold",
    main: "px-4 py-4 pb-32 max-w-[1100px] mx-auto",
    handoffSection: "mb-6",
    sectionLabel: "text-[0.65rem] uppercase tracking-widest font-bold mb-2 text-[#6b6478]",
    handoffGrid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    handoffCard: "p-4 border-[3px] border-[#1a1625] rounded bg-white shadow-[4px_4px_0px_#1a1625]",
    handoffWhen: "text-xs font-mono uppercase tracking-wider mb-2",
    handoffNames: "text-base font-bold uppercase mb-1",
    handoffArrow: "text-2xl font-bold my-1",
    handoffRoom: "text-xs uppercase tracking-wider mt-2",
    handoffConfirm: "mt-3 w-full py-2 border-[3px] border-[#1a1625] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-[#3aa84a] text-white shadow-[3px_3px_0px_#1a1625] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
    boardSection: "mb-6",
    boardGrid: "grid grid-cols-3 gap-2",
    columnHead: "text-[0.6rem] uppercase tracking-widest font-bold py-2 px-2 border-[3px] border-[#1a1625] rounded text-center bg-[#1a1625] text-white shadow-[3px_3px_0px_#1a1625]",
    column: "flex flex-col gap-2 mt-2",
    execRow: "p-2 border-[3px] border-[#1a1625] rounded text-xs bg-white shadow-[3px_3px_0px_#1a1625]",
    execName: "font-bold uppercase",
    execRole: "text-[0.6rem] uppercase tracking-wider",
    onStageBadge: "inline-block px-2 py-0.5 mt-1 text-[0.55rem] uppercase tracking-widest font-bold border-[2px] border-[#1a1625] bg-[#3aa84a] text-white",
    segmentBlock: "p-2 border-[3px] border-[#1a1625] rounded text-xs bg-[#e6c547] text-[#1a1625] shadow-[3px_3px_0px_#1a1625]",
    segmentTime: "font-mono text-[0.65rem]",
    segmentName: "font-bold uppercase",
    segmentSpeaker: "text-[0.65rem] uppercase tracking-wider",
    stageRow: "p-2 border-[3px] border-[#1a1625] rounded text-xs text-center bg-white shadow-[3px_3px_0px_#1a1625]",
    stageName: "font-bold uppercase",
    stageStatus: "text-[0.6rem] uppercase tracking-wider mt-1",
    formSection: "mb-6 p-4 border-[3px] border-[#1a1625] rounded bg-white shadow-[4px_4px_0px_#1a1625]",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    label: "text-[0.6rem] uppercase tracking-widest font-bold block mb-1",
    input: "w-full px-3 py-2 border-[3px] border-[#1a1625] rounded text-sm min-h-[44px] bg-white focus:outline-none focus:shadow-[3px_3px_0px_#1a1625] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all duration-150",
    submitBtn: "mt-4 px-4 py-3 border-[3px] border-[#1a1625] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-[#d63a2a] text-white shadow-[4px_4px_0px_#1a1625] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
    logSection: "mb-6",
    logForm: "flex gap-2 mb-3",
    logInput: "flex-1 px-3 py-2 border-[3px] border-[#1a1625] rounded text-sm min-h-[44px] bg-white",
    logBtn: "px-4 py-2 border-[3px] border-[#1a1625] rounded text-xs uppercase tracking-widest font-bold min-h-[44px] bg-[#e6c547] text-[#1a1625] shadow-[3px_3px_0px_#1a1625] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
    logList: "flex flex-col gap-2",
    logItem: "p-3 border-[3px] border-[#1a1625] rounded text-sm flex items-start gap-3 bg-white shadow-[3px_3px_0px_#1a1625]",
    logTime: "text-[0.65rem] font-mono uppercase shrink-0",
    logText: "flex-1",
    actionBar: "fixed bottom-0 left-0 right-0 px-4 py-3 border-t-[3px] border-[#1a1625] bg-white flex gap-2 z-30 shadow-[0_-4px_0px_#1a1625]",
    actionBtn: "flex-1 py-3 border-[3px] rounded text-xs uppercase tracking-widest font-bold min-h-[44px]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brandRow}>
          <div className={c.brandSquares}>
            <span className={`${c.brandSquare} bg-[#d63a2a]`} />
            <span className={`${c.brandSquare} bg-[#e6c547]`} />
            <span className={`${c.brandSquare} bg-[#3aa84a]`} />
          </div>
          <span className={c.brandText}>Rundown / Investor Day</span>
        </div>
        <div className={c.driftWrap}>
          <span className={c.driftLabel}>Drift</span>
          <span className={c.driftValue}>{driftStr}</span>
        </div>
      </header>

      <div className={c.nowBar}>
        <span className={c.nowLabel}>Now</span>
        <span className={c.nowTime}>{fmtTime(now)}</span>
        <span className={c.nowLabel}>On Stage: {liveSegment?.primary || "—"}</span>
      </div>

      <main id="app" className={c.main}>
        <section id="handoffs" className={c.handoffSection}>
          <h2 className={c.sectionLabel}>Next Two Handoffs</h2>
          <div className={c.handoffGrid}>
            {upcoming.length === 0 && <div className={c.handoffCard}><div className={c.handoffWhen}>No upcoming handoffs</div></div>}
            {upcoming.map((s, i) => {
              const prev = segmentDocs[segmentDocs.indexOf(s) - 1]
              const mins = s.startMinutes - nowMinutes
              return (
                <div key={s._id} className={c.handoffCard}>
                  <div className={c.handoffWhen}>In {mins} min · {fmtHM(s.startMinutes)}</div>
                  <div className={c.handoffNames}>{prev?.primary || "—"}</div>
                  <div className={c.handoffArrow}>↓</div>
                  <div className={c.handoffNames}>{s.primary}</div>
                  <div className={c.handoffRoom}>Room: {s.stage}</div>
                  <button className={c.handoffConfirm} onClick={() => database.put({ type: "log", text: `Handoff confirmed: ${prev?.primary || "—"} → ${s.primary} @ ${s.stage}`, at: fmtTime(now).slice(0, 5) })}>Confirm Handoff</button>
                </div>
              )
            })}
          </div>
        </section>

        <section id="board" className={c.boardSection}>
          <h2 className={c.sectionLabel}>Live Board</h2>
          <div className={c.boardGrid}>
            <div>
              <div className={c.columnHead}>Execs</div>
              <div className={c.column}>
                {execs.length === 0 && <div className={c.execRow}>No execs yet</div>}
                {execs.map(name => (
                  <div key={name} className={c.execRow}>
                    <div className={c.execName}>{name}</div>
                    <div className={c.execRole}>Speaker</div>
                    {liveSegment?.primary === name && <span className={c.onStageBadge}>On Stage</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className={c.columnHead}>Segments</div>
              <div className={c.column}>
                {segmentDocs.length === 0 && <div className={c.segmentBlock}>No segments yet</div>}
                {segmentDocs.map(s => (
                  <div key={s._id} className={`${c.segmentBlock} ${liveSegment?._id === s._id ? "ring-[3px] ring-[#d63a2a]" : ""}`}>
                    <div className={c.segmentTime}>{fmtHM(s.startMinutes)} · {s.duration}m</div>
                    <div className={c.segmentName}>{s.name}</div>
                    <div className={c.segmentSpeaker}>{s.primary}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className={c.columnHead}>Stages</div>
              <div className={c.column}>
                {stages.length === 0 && <div className={c.stageRow}>No stages yet</div>}
                {stages.map(name => (
                  <div key={name} className={c.stageRow}>
                    <div className={c.stageName}>{name}</div>
                    <div className={c.stageStatus}>{liveSegment?.stage === name ? "Live" : "Standby"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="add-segment" className={c.formSection}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={c.sectionLabel}>Add Segment</h2>
            <button type="button" onClick={suggestSegment} disabled={isSuggesting} className="px-2 py-1 border-[2px] border-[#1a1625] rounded text-[0.6rem] uppercase tracking-widest font-bold bg-[#2a55c4] text-white">
              {isSuggesting ? (
                <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="white" strokeWidth="3" strokeDasharray="40 60" /></svg>
              ) : "Suggest"}
            </button>
          </div>
          <form onSubmit={handleSegmentSubmit}>
            <div className={c.formGrid}>
              <div>
                <label className={c.label}>Segment Name</label>
                <input className={c.input} placeholder="e.g. Fireside" value={seg.doc.name} onChange={e => seg.merge({ name: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Primary Speaker</label>
                <input className={c.input} placeholder="e.g. A. Chen" value={seg.doc.primary} onChange={e => seg.merge({ primary: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Backup Speaker</label>
                <input className={c.input} placeholder="e.g. R. Patel" value={seg.doc.backup} onChange={e => seg.merge({ backup: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Stage</label>
                <input className={c.input} placeholder="e.g. Main Hall" value={seg.doc.stage} onChange={e => seg.merge({ stage: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Start Time</label>
                <input className={c.input} placeholder="HH:MM" value={seg.doc.start} onChange={e => seg.merge({ start: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Duration (min)</label>
                <input className={c.input} placeholder="45" value={seg.doc.duration} onChange={e => seg.merge({ duration: e.target.value })} />
              </div>
            </div>
            <button type="submit" className={c.submitBtn}>Add to Rundown</button>
          </form>
        </section>

        <section id="log" className={c.logSection}>
          <h2 className={c.sectionLabel}>Intervention Log</h2>
          <form onSubmit={handleLogSubmit} className={c.logForm}>
            <input className={c.logInput} placeholder="Logged a decision…" value={logDoc.doc.text} onChange={e => logDoc.merge({ text: e.target.value })} />
            <button type="submit" className={c.logBtn}>Log</button>
          </form>
          <ul className={c.logList}>
            {logDocs.length === 0 && <li className={c.logItem}><span className={c.logText}>No interventions yet</span></li>}
            {logDocs.map(l => (
              <li key={l._id} className={c.logItem}>
                <span className={c.logTime}>{l.at}</span>
                <span className={c.logText}>{l.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div className={c.actionBar}>
        <button onClick={() => liveSegment && database.put({ type: "log", text: `Advanced past ${liveSegment.name}`, at: fmtTime(now).slice(0, 5) })} className={`${c.actionBtn} border-[#1a1625] bg-[#d63a2a] text-white shadow-[3px_3px_0px_#1a1625] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]`}>Advance Now</button>
        <button onClick={() => database.put({ type: "log", text: `Drift marked at ${driftStr}`, at: fmtTime(now).slice(0, 5) })} className={`${c.actionBtn} border-[#1a1625] bg-[#e6c547] text-[#1a1625] shadow-[3px_3px_0px_#1a1625] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]`}>Mark Drift</button>
      </div>
    </div>
  )
}