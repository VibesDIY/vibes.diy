import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const STATUSES = ["UPCOMING", "IN PROGRESS", "DONE", "MISSED"]

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("roadshow-floor")
  const [view, setView] = useState("today")
  const [expandedId, setExpandedId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const { doc: rsDoc, merge: rsMerge, submit: rsSubmit } = useDocument({
    type: "roadshow",
    name: "",
    cities: "",
    leadBanker: "",
    firstCity: "",
    startDate: "",
    notes: "",
    createdAt: Date.now(),
  })

  const { doc: mDoc, merge: mMerge, submit: mSubmit } = useDocument({
    type: "meeting",
    time: "",
    investor: "",
    room: "",
    attendees: "",
    city: "New York",
    status: "UPCOMING",
    notes: "",
    createdAt: Date.now(),
  })

  const { docs: meetings } = useLiveQuery("type", { key: "meeting", descending: false })
  const { docs: roadshows } = useLiveQuery("type", { key: "roadshow", descending: true })
  const { docs: statusLog } = useLiveQuery("type", { key: "status-change", descending: true, limit: 20 })

  const todays = meetings.filter(m => m.city === "New York")
  const done = todays.filter(m => m.status === "DONE").length
  const investors = new Set(todays.map(m => m.investor)).size
  const onTime = todays.length ? Math.round((done / Math.max(todays.length,1)) * 100) : 0

  function handleSubmit(e) { e.preventDefault(); rsSubmit() }
  function handleAdd(e) { e.preventDefault(); mSubmit() }
  function handleToggleView() { setView(v => v === "today" ? "cities" : "today") }
  function handleRowClick(id) { setExpandedId(prev => prev === id ? null : id) }

  async function handleCycle(meeting) {
    const i = STATUSES.indexOf(meeting.status || "UPCOMING")
    const next = STATUSES[(i + 1) % STATUSES.length]
    await database.put({ ...meeting, status: next })
    await database.put({ type: "status-change", meetingId: meeting._id, investor: meeting.investor, status: next, ts: Date.now(), by: "J.P." })
  }

  async function handleNotes(meeting, notes) {
    await database.put({ ...meeting, notes })
  }

  async function handleSuggest() {
    setIsLoading(true)
    try {
      const res = await callAI("Suggest 3 realistic institutional investor meetings for an IPO roadshow in New York. Include time (HH:MM), investor name, room, attendees.", {
        schema: { properties: { meetings: { type: "array", items: { type: "object", properties: {
          time: { type: "string" }, investor: { type: "string" }, room: { type: "string" }, attendees: { type: "string" }
        } } } } }
      })
      const data = JSON.parse(res)
      for (const m of (data.meetings || [])) {
        await database.put({ type: "meeting", ...m, city: "New York", status: "UPCOMING", notes: "", createdAt: Date.now() })
      }
    } finally { setIsLoading(false) }
  }

  const Spinner = () => (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
    </svg>
  )

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-x border-black bg-white text-black",
    header: "px-5 py-4 border-b border-black flex items-center justify-between bg-white",
    brand: "text-[0.7rem] font-bold uppercase tracking-[0.12em]",
    nav: "flex gap-2 text-[0.6rem] font-bold uppercase tracking-[0.1em]",
    main: "flex flex-col",
    hero: "grid grid-cols-[120px_1fr_120px] md:grid-cols-[200px_1fr_200px] border-b border-black",
    heroSide: "p-3 flex flex-col justify-between border-r border-black last:border-r-0 last:border-l last:border-black text-[0.55rem] font-bold uppercase tracking-[0.12em]",
    heroCenter: "p-4 md:p-8 flex flex-col items-center justify-center text-center",
    heroTitle: "uppercase font-black leading-[0.85] tracking-[-0.04em] text-transparent",
    heroSub: "mt-3 text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    cityBanner: "px-5 py-6 border-b border-black flex items-end justify-between gap-4",
    cityName: "text-3xl md:text-5xl font-black uppercase tracking-[-0.03em] leading-none",
    cityMeta: "text-[0.6rem] font-bold uppercase tracking-[0.1em] text-right text-[#666]",
    statsRow: "grid grid-cols-3 border-b border-black",
    stat: "p-4 border-r border-black last:border-r-0 flex flex-col gap-2",
    statLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em]",
    statValue: "text-2xl md:text-4xl font-black leading-none",
    sectionHead: "px-5 py-3 border-b border-black flex items-center justify-between",
    sectionLabel: "text-[0.6rem] font-bold uppercase tracking-[0.12em] px-2 py-1 bg-black text-white",
    tableHead: "grid grid-cols-[60px_1fr_70px_90px] md:grid-cols-[80px_1fr_120px_120px_60px] border-b border-black text-[0.55rem] font-bold uppercase tracking-[0.12em] bg-white",
    th: "px-3 py-2 border-r border-black last:border-r-0",
    tableRow: "grid grid-cols-[60px_1fr_70px_90px] md:grid-cols-[80px_1fr_120px_120px_60px] border-b border-black text-[0.75rem] min-h-[44px] cursor-pointer hover:bg-black hover:text-white",
    td: "px-3 py-3 border-r border-black last:border-r-0 flex items-center",
    expandRow: "border-b border-black p-4 flex flex-col gap-3 bg-white",
    notesLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em]",
    textarea: "w-full p-2 bg-transparent border border-black min-h-[80px] text-[0.8rem] font-sans resize-y focus:outline-none",
    cyclePill: "inline-flex items-center gap-2 px-3 py-2 border border-black text-[0.6rem] font-bold uppercase tracking-[0.1em] min-h-[44px] bg-white text-black hover:bg-black hover:text-white",
    citiesGrid: "border-b",
    cityRow: "grid grid-cols-[1fr_auto] md:grid-cols-[200px_1fr_120px] border-b border-black min-h-[64px] hover:bg-black hover:text-white cursor-pointer",
    cityCell: "px-4 py-4 border-r border-black last:border-r-0 flex items-center",
    progressDots: "flex gap-1 flex-wrap",
    dot: "w-3 h-3 border border-black bg-black",
    formGrid: "grid grid-cols-1 md:grid-cols-2 border-b border-black",
    formCol: "p-5 border-r border-black last:border-r-0 flex flex-col gap-4",
    field: "flex flex-col gap-1",
    fieldLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em]",
    input: "bg-transparent border-b border-black py-2 text-[0.85rem] font-sans focus:outline-none placeholder:text-[#666]",
    btnRow: "flex flex-wrap gap-2 px-5 py-4 border-b border-black",
    btn: "px-6 py-3 border border-black text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px] bg-white text-black hover:bg-black hover:text-white disabled:opacity-50",
    btnGhost: "px-4 py-2 border border-black text-[0.6rem] font-bold uppercase tracking-[0.08em] min-h-[44px] bg-white text-black hover:bg-black hover:text-white disabled:opacity-50",
    footer: "px-5 py-6 text-[0.55rem] font-bold uppercase tracking-[0.12em] flex items-center justify-between border-t border-black",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>The Roadshow Ledger</div>
        <nav className={c.nav}>
          <button onClick={() => setView("today")} className={c.btnGhost} style={view==="today"?{background:"#000",color:"#fff"}:{}}>Today</button>
          <button onClick={() => setView("cities")} className={c.btnGhost} style={view==="cities"?{background:"#000",color:"#fff"}:{}}>All Cities</button>
        </nav>
      </header>

      <main id="app">
        <section id="hero" className={c.hero}>
          <div className={c.heroSide}>
            <span>Vol. 01</span>
            <span>Day 03 of 07</span>
          </div>
          <div className={c.heroCenter}>
            <h1 className={c.heroTitle} style={{ fontSize: "clamp(2.5rem, 10vw, 7rem)", WebkitTextStroke: "2px #000" }}>
              The<br/>Roadshow
            </h1>
            <div className={c.heroSub}>Choreography &nbsp;›&nbsp; Live Floor</div>
          </div>
          <div className={c.heroSide} style={{ textAlign: "right" }}>
            <span>09:42 ET</span>
            <span>Next in 00:18:00</span>
          </div>
        </section>

        <section id="city-banner" className={c.cityBanner}>
          <div>
            <div className={c.heroSub}>Today’s City</div>
            <div className={c.cityName}>New York</div>
          </div>
          <div className={c.cityMeta}>
            {todays.length} Meetings<br/>{investors} Investors<br/>Wall St / Midtown
          </div>
        </section>

        <section id="stats" className={c.statsRow}>
          <div className={c.stat}>
            <div className={c.statLabel}>Meetings Done</div>
            <div className={c.statValue}>{done} / {todays.length}</div>
          </div>
          <div className={c.stat}>
            <div className={c.statLabel}>Investors Covered</div>
            <div className={c.statValue}>{investors}</div>
          </div>
          <div className={c.stat}>
            <div className={c.statLabel}>Road Score</div>
            <div className={c.statValue}>{onTime}%</div>
          </div>
        </section>

        <section id="meetings">
          <div className={c.sectionHead}>
            <span className={c.sectionLabel}>Today / Meetings</span>
            <span className={c.sectionLabel}>Tap row to expand</span>
          </div>
          <div className={c.tableHead}>
            <div className={c.th}>Time</div>
            <div className={c.th}>Investor</div>
            <div className={c.th + " hidden md:flex"}>Attendees</div>
            <div className={c.th}>Room</div>
            <div className={c.th}>Status</div>
          </div>

          {todays.length === 0 && (
            <div className={c.expandRow}><div className="text-[#666] text-[0.75rem]">No meetings yet — seed below or tap Suggest.</div></div>
          )}
          {todays.map(m => (
            <React.Fragment key={m._id}>
              <div className={c.tableRow} onClick={() => handleRowClick(m._id)}>
                <div className={c.td}>{m.time}</div>
                <div className={c.td}>{m.investor}</div>
                <div className={c.td + " hidden md:flex"}>{m.attendees}</div>
                <div className={c.td}>{m.room}</div>
                <div className={c.td}>{m.status}</div>
              </div>
              {expandedId === m._id && (
                <div className={c.expandRow}>
                  <div className={c.notesLabel}>Notes</div>
                  <textarea className={c.textarea} value={m.notes || ""} onChange={(e) => handleNotes(m, e.target.value)} placeholder="Investor pushback, follow-ups, sentiment..." />
                  <div className="flex gap-2">
                    <button onClick={() => handleCycle(m)} className={c.cyclePill}>› Cycle Status</button>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </section>

        {view === "cities" && <section id="all-cities" className={c.citiesGrid}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabel}>All Cities / Progress</span>
            <span className={c.sectionLabel}>4 of 6</span>
          </div>
          <div className={c.cityRow}>
            <div className={c.cityCell}>New York</div>
            <div className={c.cityCell + " hidden md:flex"}>
              <div className={c.progressDots}>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
                <span className={c.dot}></span><span className={c.dot}></span>
              </div>
            </div>
            <div className={c.cityCell}>3 / 8</div>
          </div>
          <div className={c.cityRow}>
            <div className={c.cityCell}>Boston</div>
            <div className={c.cityCell + " hidden md:flex"}>
              <div className={c.progressDots}>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
                <span className={c.dot}></span><span className={c.dot}></span>
              </div>
            </div>
            <div className={c.cityCell}>0 / 5</div>
          </div>
          <div className={c.cityRow}>
            <div className={c.cityCell}>San Francisco</div>
            <div className={c.cityCell + " hidden md:flex"}>
              <div className={c.progressDots}>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
              </div>
            </div>
            <div className={c.cityCell}>0 / 6</div>
          </div>
          <div className={c.cityRow}>
            <div className={c.cityCell}>Chicago</div>
            <div className={c.cityCell + " hidden md:flex"}>
              <div className={c.progressDots}>
                <span className={c.dot}></span><span className={c.dot}></span><span className={c.dot}></span>
                <span className={c.dot}></span>
              </div>
            </div>
            <div className={c.cityCell}>0 / 4</div>
          </div>
        </section>}

        <section id="seed-roadshow">
          <div className={c.sectionHead}>
            <span className={c.sectionLabel}>Seed / New Roadshow</span>
            <button onClick={handleSuggest} className={c.btnGhost}>Suggest</button>
          </div>
          <form onSubmit={handleSubmit} className={c.formGrid}>
            <div className={c.formCol}>
              <div className={c.field}>
                <label className={c.fieldLabel}>Roadshow Name</label>
                <input className={c.input} value={rsDoc.name} onChange={(e) => rsMerge({ name: e.target.value })} placeholder="Q4 IPO Tour" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Cities (comma)</label>
                <input className={c.input} value={rsDoc.cities} onChange={(e) => rsMerge({ cities: e.target.value })} placeholder="NYC, Boston, SF, Chicago" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Lead Banker</label>
                <input className={c.input} value={rsDoc.leadBanker} onChange={(e) => rsMerge({ leadBanker: e.target.value })} placeholder="J. Park" />
              </div>
            </div>
            <div className={c.formCol}>
              <div className={c.field}>
                <label className={c.fieldLabel}>First City</label>
                <input className={c.input} placeholder="New York" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Start Date</label>
                <input className={c.input} placeholder="2025-01-15" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Notes</label>
                <input className={c.input} placeholder="Pre-deal, no Q&A" />
              </div>
            </div>
          </form>

          <form onSubmit={handleAdd} className={c.formGrid}>
            <div className={c.formCol}>
              <div className={c.field}>
                <label className={c.fieldLabel}>Add Meeting / Time</label>
                <input className={c.input} value={mDoc.time} onChange={(e) => mMerge({ time: e.target.value })} placeholder="09:00" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Investor</label>
                <input className={c.input} value={mDoc.investor} onChange={(e) => mMerge({ investor: e.target.value })} placeholder="Fidelity Mgmt" />
              </div>
            </div>
            <div className={c.formCol}>
              <div className={c.field}>
                <label className={c.fieldLabel}>Room / Location</label>
                <input className={c.input} value={mDoc.room} onChange={(e) => mMerge({ room: e.target.value })} placeholder="1407" />
              </div>
              <div className={c.field}>
                <label className={c.fieldLabel}>Attendees</label>
                <input className={c.input} value={mDoc.attendees} onChange={(e) => mMerge({ attendees: e.target.value })} placeholder="J. Park, A. Liu" />
              </div>
            </div>
          </form>

          <div className={c.btnRow}>
            <button onClick={handleSubmit} className={c.btn}>Save Roadshow</button>
            <button onClick={handleAdd} className={c.btn}>Add Meeting</button>
            <button onClick={handleSuggest} className={c.btn} disabled={isLoading}>
              {isLoading ? <span className="inline-flex items-center gap-2"><Spinner/> Loading…</span> : "Suggest Investors"}
            </button>
          </div>
        </section>

        <section id="log">
          <div className={c.sectionHead}>
            <span className={c.sectionLabel}>Status Log</span>
            <span className={c.sectionLabel}>Live</span>
          </div>
          <div className={c.tableHead}>
            <div className={c.th}>Time</div>
            <div className={c.th}>Meeting</div>
            <div className={c.th + " hidden md:flex"}>Status</div>
            <div className={c.th}>By</div>
            <div className={c.th}>›</div>
          </div>
          {statusLog.length === 0 && (
            <div className={c.expandRow}><div className="text-[#666] text-[0.75rem]">No status changes yet — tap a meeting row to cycle it.</div></div>
          )}
          {statusLog.map(s => (
            <div key={s._id} className={c.tableRow}>
              <div className={c.td}>{new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className={c.td}>{s.investor}</div>
              <div className={c.td + " hidden md:flex"}>{s.status}</div>
              <div className={c.td}>{s.by}</div>
              <div className={c.td}>›</div>
            </div>
          ))}
        </section>

        <footer className={c.footer}>
          <span>End of Sheet</span>
          <span>Floor Edition</span>
        </footer>
      </main>
    </div>
  )
}