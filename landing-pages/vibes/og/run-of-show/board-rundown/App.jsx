import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("board-rundown")

  const { doc: newItem, merge: mergeNew, submit: submitNew } = useDocument({
    type: "agenda",
    title: "",
    presenter: "",
    duration: "",
    materials: "",
    requiresVote: false,
    status: "pending",
    order: Date.now(),
  })

  const { docs: agenda } = useLiveQuery("type", { key: "agenda" })
  const { docs: motions } = useLiveQuery("type", { key: "motion", descending: true })

  const sortedAgenda = [...agenda].sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentItem = sortedAgenda.find(i => i.status === "active") || sortedAgenda.find(i => i.status === "pending")

  const [tally, setTally] = React.useState({ yea: 0, nay: 0, abstain: 0 })
  const [elapsed, setElapsed] = React.useState(0)
  const [startedAt, setStartedAt] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [suggesting, setSuggesting] = React.useState(false)

  React.useEffect(() => {
    if (!currentItem) { setStartedAt(null); return }
    if (!startedAt) setStartedAt(Date.now())
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedAt || Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [currentItem?._id, startedAt])

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0")
    const ss = (s % 60).toString().padStart(2, "0")
    return `${m}:${ss}`
  }

  function handleAddItem(e) {
    e.preventDefault()
    if (!newItem.title.trim()) return
    submitNew()
  }

  async function handleNext() {
    if (!currentItem) return
    await database.put({ ...currentItem, status: "done" })
    setStartedAt(Date.now())
    setElapsed(0)
    setTally({ yea: 0, nay: 0, abstain: 0 })
  }

  function handleVote(kind) {
    setTally(t => ({ ...t, [kind]: t[kind] + 1 }))
  }

  async function handleRecord() {
    if (!currentItem) return
    setIsLoading(true)
    try {
      await database.put({
        type: "motion",
        title: currentItem.title,
        presenter: currentItem.presenter,
        tally,
        timestamp: Date.now(),
      })
      await database.put({ ...currentItem, status: "done", recordedTally: tally })
      setTally({ yea: 0, nay: 0, abstain: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  function handleExport() {
    const lines = ["BOARD MEETING MINUTES", "=".repeat(40), ""]
    sortedAgenda.forEach((it, i) => {
      lines.push(`${(i + 1).toString().padStart(2, "0")}. ${it.title} — ${it.presenter || "—"}`)
      if (it.recordedTally) {
        lines.push(`    Vote: Yea ${it.recordedTally.yea} · Nay ${it.recordedTally.nay} · Abstain ${it.recordedTally.abstain}`)
      }
    })
    lines.push("", "MOTION LOG", "-".repeat(40))
    motions.forEach(m => {
      lines.push(`${new Date(m.timestamp).toLocaleTimeString()} · ${m.title}`)
      lines.push(`  Yea ${m.tally.yea} · Nay ${m.tally.nay} · Abstain ${m.tally.abstain}`)
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "minutes.txt"; a.click()
    URL.revokeObjectURL(url)
  }

  async function suggestAgenda() {
    setSuggesting(true)
    try {
      const res = await callAI("Suggest one realistic board meeting agenda item with title, presenter name, and duration in minutes.", {
        schema: { properties: { title: { type: "string" }, presenter: { type: "string" }, duration: { type: "string" }, requiresVote: { type: "boolean" } } }
      })
      const data = JSON.parse(res)
      mergeNew({ title: data.title, presenter: data.presenter, duration: data.duration, requiresVote: !!data.requiresVote })
    } finally {
      setSuggesting(false)
    }
  }

  const statusGlyph = (s) => s === "done" ? "✓" : s === "active" ? "–" : "☐"

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-x border-black bg-white text-black font-['Helvetica_Neue',Helvetica,Arial,sans-serif]",
    header: "px-6 py-8 border-b border-black",
    heroBand: "grid grid-cols-[120px_1fr_120px] md:grid-cols-[200px_1fr_200px] border-y border-black",
    heroSide: "px-3 py-4 text-[0.55rem] uppercase tracking-[0.12em] font-bold",
    heroCenter: "px-4 py-6 border-x border-black text-center",
    heroTitle: "font-black uppercase leading-[0.85] tracking-[-0.04em] text-transparent [-webkit-text-stroke:2px_#000]",
    heroTitleSize: "text-[clamp(2.5rem,10vw,6rem)]",
    sectionLabel: "text-[0.6rem] uppercase tracking-[0.12em] font-bold px-3 py-2 border-b border-black bg-white text-black",
    sectionLabelFilled: "text-[0.6rem] uppercase tracking-[0.12em] font-bold px-3 py-2 bg-black text-white",
    section: "border-b border-black",
    main: "",
    formRow: "px-4 py-3 border-b border-black",
    formLabel: "block text-[0.55rem] uppercase tracking-[0.12em] font-bold mb-1",
    input: "w-full bg-transparent border-0 border-b border-black py-2 text-base focus:outline-none",
    formGrid: "grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-black",
    checkRow: "flex items-center gap-3 px-4 py-3 border-b border-black",
    checkbox: "w-4 h-4 border border-black appearance-none cursor-pointer checked:bg-black",
    btn: "block w-full md:w-auto px-6 py-3 border border-black bg-white text-black hover:bg-black hover:text-white text-[0.65rem] uppercase tracking-[0.08em] font-bold min-h-[44px]",
    btnRow: "flex flex-col md:flex-row gap-0 border-b",
    agendaTable: "",
    agendaRow: "grid grid-cols-[28px_24px_1fr_60px] border-b border-black hover:bg-black hover:text-white",
    agendaCell: "px-2 py-3 border-r border-black text-sm",
    agendaCellLast: "px-2 py-3 text-sm",
    voteBay: "grid grid-cols-3 border-b border-black",
    voteCol: "px-3 py-6 text-center border-r border-black last:border-r-0 hover:bg-black hover:text-white",
    voteCount: "text-4xl font-black tabular-nums",
    voteLabel: "text-[0.6rem] uppercase tracking-[0.12em] font-bold mt-1",
    voteBtn: "w-full py-3 border-t text-[0.65rem] uppercase tracking-[0.08em] font-bold min-h-[44px]",
    logTable: "",
    logHead: "grid grid-cols-[80px_1fr_80px] border-b border-black bg-black text-white",
    logCell: "px-2 py-2 border-r border-black last:border-r-0 text-[0.55rem] uppercase tracking-[0.12em] font-bold",
    logRow: "grid grid-cols-[80px_1fr_80px] border-b border-black",
    logRowCell: "px-2 py-3 border-r border-black last:border-r-0 text-sm",
    stopwatch: "px-4 py-6 text-center border-b border-black",
    stopwatchTime: "text-5xl font-black tabular-nums tracking-tight",
    stopwatchLabel: "text-[0.55rem] uppercase tracking-[0.12em] font-bold mt-2",
    currentBar: "px-4 py-4 border-b border-black",
    currentLabel: "text-[0.55rem] uppercase tracking-[0.12em] font-bold mb-1",
    currentTitle: "text-xl font-bold",
    footer: "px-4 py-6 border-t border-black text-center text-[0.55rem] uppercase tracking-[0.12em] font-bold text-[#666]",
    empty: "px-4 py-6 text-center text-sm text-[#666]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.heroBand}>
          <div className={c.heroSide}>Vol. I</div>
          <div className={c.heroCenter}>
            <div className={`${c.heroTitle} ${c.heroTitleSize}`}>Board Rundown</div>
          </div>
          <div className={c.heroSide}>Est. Today</div>
        </div>
      </header>

      <main id="app">
        <section id="current" className={c.section}>
          <div className={c.sectionLabel}>Now Presenting</div>
          <div className={c.currentBar}>
            <div className={c.currentLabel}>
              {currentItem ? `Item ${(sortedAgenda.indexOf(currentItem) + 1).toString().padStart(2, "0")} · ${currentItem.presenter || "—"}` : "No Item Active"}
            </div>
            <div className={c.currentTitle}>{currentItem ? currentItem.title : "Add an item below to begin."}</div>
          </div>
          <div className={c.stopwatch}>
            <div className={c.stopwatchTime}>{fmt(elapsed)}</div>
            <div className={c.stopwatchLabel}>Elapsed</div>
          </div>
          <button onClick={handleNext} className={c.btn}>Next Item ›</button>
        </section>

        <section id="vote" className={c.section}>
          <div className={c.sectionLabel}>Vote Tally</div>
          <div className={c.voteBay}>
            <button onClick={() => handleVote("yea")} className={c.voteCol}>
              <div className={c.voteCount}>{tally.yea}</div>
              <div className={c.voteLabel}>Yea</div>
            </button>
            <button onClick={() => handleVote("nay")} className={c.voteCol}>
              <div className={c.voteCount}>{tally.nay}</div>
              <div className={c.voteLabel}>Nay</div>
            </button>
            <button onClick={() => handleVote("abstain")} className={c.voteCol}>
              <div className={c.voteCount}>{tally.abstain}</div>
              <div className={c.voteLabel}>Abstain</div>
            </button>
          </div>
          <button onClick={handleRecord} disabled={isLoading} className={c.btn}>
            {isLoading ? (
              <svg className="inline w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 60" /></svg>
            ) : "Record Vote ›"}
          </button>
        </section>

        <section id="add-item" className={c.section}>
          <div className={c.sectionLabel}>Add Agenda Item</div>
          <form onSubmit={handleAddItem}>
            <div className={c.formRow}>
              <label className={c.formLabel}>Title</label>
              <input className={c.input} placeholder="Approval of Q3 Budget" value={newItem.title} onChange={e => mergeNew({ title: e.target.value })} />
            </div>
            <div className={c.formGrid}>
              <div className={c.formRow}>
                <label className={c.formLabel}>Presenter</label>
                <input className={c.input} placeholder="J. Doe" value={newItem.presenter} onChange={e => mergeNew({ presenter: e.target.value })} />
              </div>
              <div className={c.formRow}>
                <label className={c.formLabel}>Duration (min)</label>
                <input className={c.input} placeholder="15" value={newItem.duration} onChange={e => mergeNew({ duration: e.target.value })} />
              </div>
            </div>
            <div className={c.formRow}>
              <label className={c.formLabel}>Materials URL</label>
              <input className={c.input} placeholder="https://" value={newItem.materials} onChange={e => mergeNew({ materials: e.target.value })} />
            </div>
            <div className={c.checkRow}>
              <input type="checkbox" className={c.checkbox} checked={newItem.requiresVote} onChange={e => mergeNew({ requiresVote: e.target.checked })} />
              <label className={c.formLabel}>Requires Board Vote</label>
            </div>
            <div className={c.btnRow}>
              <button type="submit" className={c.btn}>Add To Agenda ›</button>
              <button type="button" onClick={suggestAgenda} disabled={suggesting} className={c.btn}>
                {suggesting ? (
                  <svg className="inline w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 60" /></svg>
                ) : "Suggest ▲"}
              </button>
            </div>
          </form>
        </section>

        <section id="agenda" className={c.section}>
          <div className={c.sectionLabel}>The Agenda</div>
          <div className={c.agendaTable}>
            {sortedAgenda.length === 0 ? (
              <div className={c.empty}>No agenda items yet.</div>
            ) : sortedAgenda.map((it, i) => (
              <div key={it._id} className={c.agendaRow}>
                <div className={c.agendaCell}>{(i + 1).toString().padStart(2, "0")}</div>
                <div className={c.agendaCell}>{statusGlyph(it.status)}</div>
                <div className={c.agendaCell}>
                  {it.title}
                  {it.requiresVote && <span className="ml-2 text-[0.55rem] uppercase tracking-[0.12em]">· Vote</span>}
                  {it.presenter && <span className="ml-2 text-[#666]">— {it.presenter}</span>}
                </div>
                <div className={c.agendaCellLast}>{it.duration ? `${it.duration}m` : "—"}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="log" className={c.section}>
          <div className={c.sectionLabel}>Motion Log</div>
          <div className={c.logHead}>
            <div className={c.logCell}>Time</div>
            <div className={c.logCell}>Motion</div>
            <div className={c.logCell}>Tally</div>
          </div>
          {motions.length === 0 ? (
            <div className={c.empty}>No motions recorded.</div>
          ) : motions.map(m => (
            <div key={m._id} className={c.logRow}>
              <div className={c.logRowCell}>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className={c.logRowCell}>
                <div className="font-bold">{m.title}</div>
                <div className="text-[#666] text-xs">{m.presenter || "—"}</div>
              </div>
              <div className={c.logRowCell + " tabular-nums"}>
                {m.tally.yea}/{m.tally.nay}/{m.tally.abstain}
              </div>
            </div>
          ))}
        </section>

        <section id="export" className={c.section}>
          <div className={c.sectionLabelFilled}>Minutes</div>
          <button onClick={handleExport} className={c.btn}>Export Minutes</button>
        </section>
      </main>

      <footer className={c.footer}>End of Record</footer>
    </div>
  )
}