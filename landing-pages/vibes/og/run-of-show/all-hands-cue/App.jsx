import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("all-hands-cue-sheet")
  const [now, setNow] = React.useState(Date.now())
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const { doc: slotDoc, merge: mergeSlot, submit: submitSlot } = useDocument({
    type: "slot", speaker: "", deck: "", demo: "", minutes: 5, order: Date.now(), createdAt: Date.now()
  })
  const { doc: qDoc, merge: mergeQ, submit: submitQ } = useDocument({
    type: "question", question: "", from: "", status: "open", order: Date.now(), createdAt: Date.now()
  })

  const { docs: slots } = useLiveQuery((d) => d.type === "slot" ? d.order : undefined)
  const { docs: questions } = useLiveQuery((d) => d.type === "question" ? d.order : undefined)
  const { docs: logs } = useLiveQuery((d) => d.type === "log" ? d.createdAt : undefined, { descending: true, limit: 50 })
  const { docs: runtimeDocs } = useLiveQuery("type", { key: "runtime" })
  const runtime = runtimeDocs[0] || { _id: "runtime-singleton", type: "runtime", currentIndex: -1, slotStartedAt: 0, totalElapsedMs: 0 }

  const currentSlot = runtime.currentIndex >= 0 ? slots[runtime.currentIndex] : null
  const elapsedMs = currentSlot && runtime.slotStartedAt ? now - runtime.slotStartedAt : 0
  const budgetMs = currentSlot ? (currentSlot.minutes || 0) * 60000 : 0
  const warning = currentSlot && budgetMs > 0 && elapsedMs >= budgetMs * 0.8
  const flashing = warning && Math.floor(now / 500) % 2 === 0

  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000))
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  }

  async function logAction(action) {
    await database.put({ type: "log", action, at: now, createdAt: Date.now() })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!slotDoc.speaker) return
    submitSlot()
  }

  async function handleAdvance() {
    const next = runtime.currentIndex + 1
    const totalElapsedMs = (runtime.totalElapsedMs || 0) + (runtime.slotStartedAt ? now - runtime.slotStartedAt : 0)
    await database.put({ ...runtime, currentIndex: next, slotStartedAt: Date.now(), totalElapsedMs })
    const target = slots[next]
    await logAction(target ? `Advanced › ${target.speaker}` : "Meeting ended")
  }

  async function handleStart() {
    if (!slots.length) return
    await database.put({ ...runtime, currentIndex: 0, slotStartedAt: Date.now(), totalElapsedMs: 0 })
    await logAction(`Started › ${slots[0].speaker}`)
  }

  function handleAddQuestion(e) {
    e.preventDefault()
    if (!qDoc.question) return
    submitQ()
  }

  async function setQStatus(q, status) {
    await database.put({ ...q, status })
    await logAction(`Q ${status} › ${q.question.slice(0, 40)}`)
  }

  async function moveQ(q, dir) {
    const idx = questions.findIndex((x) => x._id === q._id)
    const swap = questions[idx + dir]
    if (!swap) return
    await database.put({ ...q, order: swap.order })
    await database.put({ ...swap, order: q.order })
  }

  async function suggestSlot() {
    setIsLoading(true)
    try {
      const r = await callAI("Suggest one realistic all-hands agenda slot.", {
        schema: { properties: { speaker: { type: "string" }, deck: { type: "string" }, demo: { type: "string" }, minutes: { type: "number" } } }
      })
      const p = JSON.parse(r)
      mergeSlot({ speaker: p.speaker || "", deck: p.deck || "", demo: p.demo || "", minutes: p.minutes || 5 })
    } finally { setIsLoading(false) }
  }

  const totalScheduledMs = slots.reduce((a, s) => a + (s.minutes || 0) * 60000, 0)
  const totalElapsedNow = (runtime.totalElapsedMs || 0) + (runtime.slotStartedAt && currentSlot ? now - runtime.slotStartedAt : 0)
  const remainingMs = Math.max(0, totalScheduledMs - totalElapsedNow)
  const expectedSoFar = slots.slice(0, Math.max(0, runtime.currentIndex)).reduce((a, s) => a + (s.minutes || 0) * 60000, 0)
  const driftMin = ((totalElapsedNow - expectedSoFar) / 60000)

  const Spinner = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline-block">
      <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-x border-black bg-white text-black [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif]",
    header: "px-6 pt-10 pb-6 grid grid-cols-[200px_1fr_200px] border-b border-black",
    headerSide: "p-3 text-[0.6rem] uppercase tracking-widest border-black border-r last:border-r-0 last:border-l",
    headerCenter: "p-3 flex flex-col items-center justify-center text-center",
    title: "font-black uppercase leading-[0.85]",
    titleSize: "text-[clamp(3rem,10vw,8rem)] tracking-[-0.04em] text-transparent [-webkit-text-stroke:2px_#000]",
    kicker: "text-[0.65rem] uppercase tracking-[0.12em] mb-2",
    main: "px-6 py-8 space-y-10",
    section: "border border-black",
    sectionHead: "px-4 py-2 border-b border-black bg-black text-white text-[0.65rem] uppercase tracking-[0.12em] font-bold flex items-center justify-between",
    sectionBody: "p-4 space-y-4",
    label: "block text-[0.55rem] uppercase tracking-[0.12em] font-bold mb-1 text-[#666]",
    input: "w-full bg-transparent border-0 border-b border-black py-2 text-[0.95rem] focus:outline-none",
    formGrid: "grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_80px] gap-4",
    button: "px-6 py-3 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.65rem] uppercase tracking-[0.08em] font-bold min-h-[44px]",
    buttonBig: "w-full px-6 py-6 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.85rem] uppercase tracking-[0.1em] font-bold min-h-[64px]",
    table: "border border-black",
    row: "grid grid-cols-[40px_2fr_1fr_1fr_80px_100px] border-b border-black last:border-b-0 hover:bg-black hover:text-white",
    cell: "p-3 text-[0.85rem] border-r border-black last:border-r-0 flex items-center",
    qRow: "grid grid-cols-[40px_1fr_120px_140px] border-b border-black last:border-b-0 hover:bg-black hover:text-white",
    qCell: "p-3 text-[0.85rem] border-r border-black last:border-r-0 flex items-center",
    logRow: "grid grid-cols-[120px_1fr] border-b border-black last:border-b-0 hover:bg-black hover:text-white",
    timerWrap: "p-8 border border-black text-center",
    timerNumber: "font-black tabular-nums text-[clamp(4rem,15vw,10rem)] leading-none tracking-[-0.04em]",
    timerLabel: "text-[0.65rem] uppercase tracking-[0.12em] mt-2",
    statsGrid: "grid grid-cols-3 border border-black",
    statCell: "p-4 border-r border-black last:border-r-0 text-center",
    statNum: "font-black text-3xl tabular-nums",
    statLabel: "text-[0.55rem] uppercase tracking-[0.12em] mt-1",
    iconBtn: "w-7 h-7 border border-black bg-white hover:bg-black hover:text-white text-[0.7rem] flex items-center justify-center",
    footer: "px-6 py-6 border-t border-black text-[0.6rem] uppercase tracking-[0.12em] flex items-center justify-between",
  }

  return (
    <div className={c.page} id="app">
      <header id="app-header" className={c.header}>
        <div className={c.headerSide}>
          <div>Vol. I</div>
          <div className="mt-1">No. 001</div>
        </div>
        <div className={c.headerCenter}>
          <div className={c.kicker}>The Chief of Staff Cue Sheet</div>
          <h1 className={`${c.title} ${c.titleSize}`}>All-Hands</h1>
          <div className={c.kicker + " mt-2"}>Run of Show › Live Mode › Q&amp;A</div>
        </div>
        <div className={c.headerSide + " text-right"}>
          <div>Today</div>
          <div className="mt-1">Edition</div>
        </div>
      </header>

      <main id="app" className={c.main}>

        <section id="live-timer" className={c.section}>
          <div className={c.sectionHead}>
            <span>Now Speaking</span>
            <span className="tabular-nums">{String(Math.max(0, runtime.currentIndex + 1)).padStart(2, "0")} / {String(slots.length).padStart(2, "0")}</span>
          </div>
          <div className={c.sectionBody}>
            <div className={c.timerWrap}>
              <div className={c.kicker}>Speaker — Deck Cue — Demo Cue</div>
              <div className="text-[1.1rem] uppercase tracking-[0.08em] font-bold mb-4">
                {currentSlot ? `${currentSlot.speaker} — ${currentSlot.deck || "—"} — ${currentSlot.demo || "—"}` : "— No slot active —"}
              </div>
              <div className={c.timerNumber}>{fmt(elapsedMs)}</div>
              <div className={c.timerLabel}>Of {fmt(budgetMs)} Budget</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button className={c.buttonBig} onClick={handleStart} disabled={!slots.length}>Start →</button>
              <button className={c.buttonBig} onClick={handleAdvance} disabled={runtime.currentIndex < 0}>Next ›</button>
            </div>
            <div className={`border border-black p-3 text-[0.65rem] uppercase tracking-[0.12em] text-center font-bold ${flashing ? "bg-black text-white" : "bg-white text-black"}`}>
              {warning ? "› Time Warning ‹ Wrap It Up" : "Time Warning — Inactive"}
            </div>
          </div>
        </section>

        <section id="agenda-builder" className={c.section}>
          <div className={c.sectionHead}>
            <span>Run of Show — Pre-Load</span>
            <span>Add Slot</span>
          </div>
          <div className={c.sectionBody}>
            <form onSubmit={handleSubmit} className={c.formGrid}>
              <div>
                <label className={c.label}>Speaker</label>
                <input className={c.input} placeholder="Name" value={slotDoc.speaker} onChange={(e) => mergeSlot({ speaker: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Deck Cue</label>
                <input className={c.input} placeholder="Section" value={slotDoc.deck} onChange={(e) => mergeSlot({ deck: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Demo Cue</label>
                <input className={c.input} placeholder="Feature" value={slotDoc.demo} onChange={(e) => mergeSlot({ demo: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Min</label>
                <input className={c.input} placeholder="5" type="number" value={slotDoc.minutes} onChange={(e) => mergeSlot({ minutes: Number(e.target.value) || 0 })} />
              </div>
              <div className="md:col-span-4 flex gap-3">
                <button type="submit" className={c.button}>Add to Agenda</button>
                <button type="button" className={c.button} onClick={suggestSlot} disabled={isLoading}>
                  {isLoading ? <Spinner /> : "Suggest ★"}
                </button>
              </div>
            </form>

            <div className={c.table}>
              <div className={c.row + " font-bold uppercase text-[0.55rem] tracking-[0.12em]"}>
                <div className={c.cell}>#</div>
                <div className={c.cell}>Speaker</div>
                <div className={c.cell}>Deck</div>
                <div className={c.cell}>Demo</div>
                <div className={c.cell}>Min</div>
                <div className={c.cell}>Actions</div>
              </div>
              {slots.length === 0 && (
                <div className={c.row}>
                  <div className={c.cell}>—</div>
                  <div className={c.cell}>— No slots yet —</div>
                  <div className={c.cell}>—</div>
                  <div className={c.cell}>—</div>
                  <div className={c.cell}>—</div>
                  <div className={c.cell}>—</div>
                </div>
              )}
              {slots.map((s, i) => (
                <div key={s._id} className={c.row + (i === runtime.currentIndex ? " bg-black text-white" : "")}>
                  <div className={c.cell + " tabular-nums"}>{String(i + 1).padStart(2, "0")}</div>
                  <div className={c.cell + " font-bold"}>{s.speaker}</div>
                  <div className={c.cell}>{s.deck || "—"}</div>
                  <div className={c.cell}>{s.demo || "—"}</div>
                  <div className={c.cell + " tabular-nums"}>{s.minutes}</div>
                  <div className={c.cell}>
                    <button className={c.iconBtn} onClick={() => database.del(s._id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="qa-queue" className={c.section}>
          <div className={c.sectionHead}>
            <span>Q&amp;A Queue</span>
            <span>Open</span>
          </div>
          <div className={c.sectionBody}>
            <form onSubmit={handleAddQuestion} className="grid grid-cols-1 md:grid-cols-[1fr_200px_120px] gap-4">
              <div>
                <label className={c.label}>Question</label>
                <input className={c.input} placeholder="Type or paste from chat" value={qDoc.question} onChange={(e) => mergeQ({ question: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>From</label>
                <input className={c.input} placeholder="Attribution" value={qDoc.from} onChange={(e) => mergeQ({ from: e.target.value })} />
              </div>
              <div className="flex items-end">
                <button type="submit" className={c.button + " w-full"}>Add From Chat</button>
              </div>
            </form>

            <div className={c.table}>
              <div className={c.qRow + " font-bold uppercase text-[0.55rem] tracking-[0.12em]"}>
                <div className={c.qCell}>#</div>
                <div className={c.qCell}>Question / From</div>
                <div className={c.qCell}>Order</div>
                <div className={c.qCell}>Status</div>
              </div>
              {questions.length === 0 && (
                <div className={c.qRow}>
                  <div className={c.qCell}>—</div>
                  <div className={c.qCell}>— No questions yet —</div>
                  <div className={c.qCell}>—</div>
                  <div className={c.qCell}>—</div>
                </div>
              )}
              {questions.map((q, i) => (
                <div key={q._id} className={c.qRow + (q.status !== "open" ? " opacity-50 line-through" : "")}>
                  <div className={c.qCell + " tabular-nums"}>{String(i + 1).padStart(2, "0")}</div>
                  <div className={c.qCell + " flex-col items-start"}>
                    <div className="font-bold">{q.question}</div>
                    <div className="text-[0.65rem] uppercase tracking-[0.12em] mt-1">— {q.from || "Anon"}</div>
                  </div>
                  <div className={c.qCell + " gap-2"}>
                    <button className={c.iconBtn} onClick={() => moveQ(q, -1)}>▲</button>
                    <button className={c.iconBtn} onClick={() => moveQ(q, 1)}>▼</button>
                  </div>
                  <div className={c.qCell + " gap-1"}>
                    <button className={c.iconBtn + " w-auto px-2"} onClick={() => setQStatus(q, "answered")}>Ans</button>
                    <button className={c.iconBtn + " w-auto px-2"} onClick={() => setQStatus(q, "skipped")}>Skip</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cue-log" className={c.section}>
          <div className={c.sectionHead}>
            <span>Cue Log — Running Record</span>
            <span>Live</span>
          </div>
          <div className={c.sectionBody}>
            <div className={c.table}>
              <div className={c.logRow + " font-bold uppercase text-[0.55rem] tracking-[0.12em]"}>
                <div className={c.cell}>Time</div>
                <div className={c.cell}>Action</div>
              </div>
              {logs.length === 0 && (
                <div className={c.logRow}>
                  <div className={c.cell}>—:—:—</div>
                  <div className={c.cell}>— Awaiting first cue —</div>
                </div>
              )}
              {logs.map((l) => (
                <div key={l._id} className={c.logRow}>
                  <div className={c.cell + " tabular-nums"}>{new Date(l.createdAt).toLocaleTimeString()}</div>
                  <div className={c.cell}>{l.action}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="stats" className={c.section}>
          <div className={c.sectionHead}>
            <span>Footer Stats</span>
            <span>Drift Tracker</span>
          </div>
          <div className={c.statsGrid}>
            <div className={c.statCell}>
              <div className={c.statNum}>{fmt(totalElapsedNow)}</div>
              <div className={c.statLabel}>Total Elapsed</div>
            </div>
            <div className={c.statCell}>
              <div className={c.statNum}>{fmt(remainingMs)}</div>
              <div className={c.statLabel}>Scheduled Remaining</div>
            </div>
            <div className={c.statCell}>
              <div className={c.statNum}>{driftMin >= 0 ? "+" : ""}{driftMin.toFixed(1)}</div>
              <div className={c.statLabel}>Drift (Min)</div>
            </div>
          </div>
        </section>

      </main>

      <footer className={c.footer}>
        <span>— End of Sheet —</span>
        <span>Printed Live</span>
      </footer>
    </div>
  )
}