import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("minute-board")

  const { doc: slotDraft, merge: mergeSlot, submit: submitSlot } = useDocument({
    type: "slot",
    time: "09:00",
    title: "",
    owner: "",
    location: "",
    brief: "",
    status: "upcoming",
    handoffAt: null,
    createdAt: Date.now(),
  })

  const { doc: noteDraft, merge: mergeNote, submit: submitNote } = useDocument({
    type: "note",
    slotId: "",
    text: "",
    createdAt: Date.now(),
  })

  const { docs: slots } = useLiveQuery("type", { key: "slot" })
  const sortedSlots = [...slots].sort((a,b) => (a.time||"").localeCompare(b.time||""))

  const [selectedSlotId, setSelectedSlotId] = React.useState(null)
  const selectedSlot = sortedSlots.find(s => s._id === selectedSlotId) || sortedSlots.find(s => s.status === "live") || sortedSlots[0]

  const { docs: allNotes } = useLiveQuery("type", { key: "note" })
  const slotNotes = allNotes.filter(n => n.slotId === selectedSlot?._id).sort((a,b) => b.createdAt - a.createdAt)

  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const liveSlot = sortedSlots.find(s => s.status === "live")
  const lastHandoff = sortedSlots.filter(s => s.handoffAt).sort((a,b) => b.handoffAt - a.handoffAt)[0]
  const sinceHandoffMs = lastHandoff ? now - lastHandoff.handoffAt : 0
  function fmtClock(ms) {
    if (!ms || ms < 0) return "00:00:00"
    const s = Math.floor(ms/1000)
    const h = String(Math.floor(s/3600)).padStart(2,"0")
    const m = String(Math.floor((s%3600)/60)).padStart(2,"0")
    const ss = String(s%60).padStart(2,"0")
    return `${h}:${m}:${ss}`
  }

  const [isSuggesting, setIsSuggesting] = React.useState(false)

  function handleSlotSubmit(e) { e.preventDefault(); submitSlot() }
  function handleNoteSubmit(e) {
    e.preventDefault()
    if (!selectedSlot || !noteDraft.text.trim()) return
    database.put({ ...noteDraft, slotId: selectedSlot._id, createdAt: Date.now() })
    mergeNote({ text: "", createdAt: Date.now() })
  }
  function handleHandoff(slot) {
    if (!slot) return
    const ts = Date.now()
    database.put({ ...slot, status: "done", handoffAt: ts })
    const idx = sortedSlots.findIndex(s => s._id === slot._id)
    const next = sortedSlots[idx+1]
    if (next) database.put({ ...next, status: "live" })
  }
  function handleSelectSlot(slot) { setSelectedSlotId(slot._id) }

  async function suggestSlot() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Suggest one realistic agenda slot for an executive customer site visit. Return time HH:MM, short title, owner role, room.", {
        schema: { properties: { time:{type:"string"}, title:{type:"string"}, owner:{type:"string"}, location:{type:"string"}, brief:{type:"string"} } }
      })
      const s = JSON.parse(r)
      mergeSlot(s)
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black",
    header: "px-6 py-8 border-b border-black",
    heroBand: "grid grid-cols-[200px_1fr_200px] border-b border-black",
    heroSide: "p-4 border-r border-black flex flex-col justify-between",
    heroSideRight: "p-4 border-l border-black flex flex-col justify-between",
    heroCenter: "p-6 flex items-center justify-center text-center",
    heroTitle: "uppercase font-black tracking-tighter leading-[0.85]",
    eyebrow: "uppercase font-bold tracking-[0.12em]",
    sectionLabel: "uppercase font-bold tracking-[0.10em] inline-block px-2 py-1 border border-black",
    sectionLabelFilled: "uppercase font-bold tracking-[0.10em] inline-block px-2 py-1 bg-black text-white",
    section: "border-b border-black",
    sectionInner: "p-6",
    sectionHead: "flex items-center justify-between mb-4",
    formRow: "grid grid-cols-2 gap-4 mb-4",
    formCell: "flex flex-col",
    label: "uppercase font-bold tracking-[0.10em] mb-2",
    input: "bg-transparent border-b border-black py-2 outline-none",
    textarea: "bg-transparent border border-black w-full p-3 min-h-[100px] outline-none",
    btnRow: "flex gap-2 flex-wrap",
    btn: "uppercase font-bold tracking-[0.08em] px-6 py-3 border border-black bg-white text-black hover:bg-black hover:text-white min-h-[44px]",
    btnPrimary: "uppercase font-bold tracking-[0.08em] px-6 py-3 border border-black bg-white text-black hover:bg-black hover:text-white min-h-[44px]",
    table: "w-full border-t",
    tableHead: "grid grid-cols-[80px_1fr_120px_100px_120px] border-b border-black",
    tableHeadCell: "p-3 border-r border-black last:border-r-0 uppercase font-bold tracking-[0.10em]",
    tableRow: "grid grid-cols-[80px_1fr_120px_100px_120px] border-b border-black hover:bg-black hover:text-white",
    tableCell: "p-3 border-r border-black last:border-r-0",
    timeline: "border-t border-black",
    timelineRow: "grid grid-cols-[90px_1fr_140px_100px_140px] border-b border-black items-center hover:bg-black hover:text-white cursor-pointer",
    timelineCell: "p-4 border-r border-black last:border-r-0",
    nowLine: "border-t-2 border-b-2 border-black py-2 px-4 uppercase font-bold tracking-[0.12em] bg-black text-white",
    statusBadge: "uppercase font-bold tracking-[0.10em] px-2 py-1 inline-block border border-black text-[0.6rem]",
    participantGrid: "grid grid-cols-2 md:grid-cols-3 border-t border-l border-black",
    participantCell: "p-4 border-b border-r border-black",
    participantName: "uppercase font-bold tracking-[0.08em] mb-1",
    clock: "tabular-nums",
    notesList: "border-t border-black",
    noteRow: "grid grid-cols-[140px_1fr] border-b border-black",
    noteCell: "p-3 border-r border-black last:border-r-0",
    muted: "text-[#666666]",
    footer: "p-6 border-t border-black uppercase font-bold tracking-[0.10em] text-center",
    suggestBtn: "uppercase font-bold tracking-[0.08em] px-3 py-2 border border-black bg-white text-black hover:bg-black hover:text-white text-[10px]",
    checkbox: "w-4 h-4 border appearance-none",
    fieldGroup: "flex items-center gap-2",
    printHide: "print:hidden",
  }

  return (
    <div className={c.page} style={{fontFamily:'"Helvetica Neue", Helvetica, Arial, sans-serif'}}>
      <header id="app-header" className={c.header}>
        <div className="flex justify-between">
          <div className={c.eyebrow} style={{fontSize:"0.65rem"}}>Vol. 01 — Customer Visit Edition</div>
          <div className={c.eyebrow} style={{fontSize:"0.65rem"}}>The Minute Board</div>
        </div>
      </header>

      <div className={c.heroBand}>
        <div className={c.heroSide}>
          <div className={c.eyebrow} style={{fontSize:"0.55rem"}}>Established Today</div>
          <div className={c.eyebrow} style={{fontSize:"0.55rem"}}>Edition 01</div>
        </div>
        <div className={c.heroCenter}>
          <h1 className={c.heroTitle} style={{fontSize:"clamp(3rem,10vw,8rem)", WebkitTextStroke:"2px #000", color:"transparent", letterSpacing:"-0.04em"}}>
            The Minute<br/>Board
          </h1>
        </div>
        <div className={c.heroSideRight}>
          <div className={c.eyebrow} style={{fontSize:"0.55rem"}}>Run Of Show</div>
          <div className={c.eyebrow} style={{fontSize:"0.55rem"}}>Eight Hour Edition</div>
        </div>
      </div>

      <main id="app">

        <section id="now" className={c.section}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabelFilled}>The Hour</span>
              <span className={c.eyebrow} style={{fontSize:"0.65rem"}}>Live Status</span>
            </div>
            <div className={c.nowLine}>
              Now {new Date(now).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})} — {liveSlot ? `Live · ${liveSlot.title}` : "Awaiting First Handoff"} — Since Handoff <span className={c.clock}>{fmtClock(sinceHandoffMs)}</span>
            </div>
          </div>
        </section>

        <section id="agenda-form" className={`${c.section} ${c.printHide}`}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabel}>Compose The Day</span>
              <button type="button" className={c.suggestBtn} onClick={suggestSlot} disabled={isSuggesting}>
                {isSuggesting ? (<svg className="animate-spin inline" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42 18"/></svg>) : "› Suggest Slot"}
              </button>
            </div>
            <form onSubmit={handleSlotSubmit}>
              <div className={c.formRow}>
                <div className={c.formCell}>
                  <label className={c.label} style={{fontSize:"0.6rem"}}>Time</label>
                  <input className={c.input} type="time" value={slotDraft.time} onChange={e => mergeSlot({time:e.target.value})} />
                </div>
                <div className={c.formCell}>
                  <label className={c.label} style={{fontSize:"0.6rem"}}>Title</label>
                  <input className={c.input} type="text" placeholder="Demo Block A" value={slotDraft.title} onChange={e => mergeSlot({title:e.target.value})} />
                </div>
                <div className={c.formCell}>
                  <label className={c.label} style={{fontSize:"0.6rem"}}>Owner</label>
                  <input className={c.input} type="text" placeholder="Account team lead" value={slotDraft.owner} onChange={e => mergeSlot({owner:e.target.value})} />
                </div>
                <div className={c.formCell}>
                  <label className={c.label} style={{fontSize:"0.6rem"}}>Location</label>
                  <input className={c.input} type="text" placeholder="Boardroom 3" value={slotDraft.location} onChange={e => mergeSlot({location:e.target.value})} />
                </div>
              </div>
              <div className={c.formCell} style={{marginBottom:"1rem"}}>
                <label className={c.label} style={{fontSize:"0.6rem"}}>Brief</label>
                <textarea className={c.textarea} placeholder="Pre-call notes, talking points, exec context..." value={slotDraft.brief} onChange={e => mergeSlot({brief:e.target.value})}></textarea>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Add Slot →</button>
                <button type="button" className={c.btn}>Clear</button>
              </div>
            </form>
          </div>
        </section>

        <section id="timeline" className={c.section}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabelFilled}>The Timeline</span>
              <span className={c.eyebrow} style={{fontSize:"0.65rem"}}>Run Of Show</span>
            </div>
          </div>
          <div className={c.timeline}>
            <div className={c.timelineRow} style={{fontSize:"0.6rem"}}>
              <div className={`${c.timelineCell} ${c.eyebrow}`}>Time</div>
              <div className={`${c.timelineCell} ${c.eyebrow}`}>Slot · Owner · Room</div>
              <div className={`${c.timelineCell} ${c.eyebrow}`}>Status</div>
              <div className={`${c.timelineCell} ${c.eyebrow}`}>Handoff</div>
              <div className={`${c.timelineCell} ${c.eyebrow}`}>Action</div>
            </div>
            {sortedSlots.length === 0 && (
              <div className={c.timelineRow}>
                <div className={c.timelineCell}>—</div>
                <div className={c.timelineCell}><span className={c.muted}>No slots yet — compose the day above.</span></div>
                <div className={c.timelineCell}>—</div>
                <div className={c.timelineCell}>—</div>
                <div className={c.timelineCell}>—</div>
              </div>
            )}
            {sortedSlots.map(slot => (
              <div key={slot._id} className={c.timelineRow} onClick={() => handleSelectSlot(slot)}>
                <div className={c.timelineCell}>{slot.time}</div>
                <div className={c.timelineCell}>
                  <div style={{fontWeight:700}}>{slot.title || "Untitled"}</div>
                  <div className={c.muted} style={{fontSize:"0.75rem"}}>{slot.owner || "—"} · {slot.location || "—"}</div>
                </div>
                <div className={c.timelineCell}><span className={c.statusBadge}>{slot.status}</span></div>
                <div className={c.timelineCell}>{slot.handoffAt ? new Date(slot.handoffAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
                <div className={c.timelineCell}>
                  {slot.status !== "done" && (
                    <button className={c.btn} onClick={(e) => { e.stopPropagation(); handleHandoff(slot) }}>Handoff →</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="notes" className={c.section}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabel}>In Room Notes</span>
              <span className={c.eyebrow} style={{fontSize:"0.65rem"}}>Selected Slot · {selectedSlot?.title || "None"}</span>
            </div>
            <form onSubmit={handleNoteSubmit}>
              <div className={c.formCell} style={{marginBottom:"1rem"}}>
                <label className={c.label} style={{fontSize:"0.6rem"}}>Drop An Observation</label>
                <textarea className={c.textarea} placeholder="Exec reaction, competitive mention, follow-up ask..." value={noteDraft.text} onChange={e => mergeNote({text:e.target.value})}></textarea>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Post Note →</button>
                <button type="button" className={c.suggestBtn}>› Suggest Note</button>
              </div>
            </form>
          </div>
          <div className={c.notesList}>
            <div className={c.noteRow} style={{fontSize:"0.6rem"}}>
              <div className={`${c.noteCell} ${c.eyebrow}`}>Stamp</div>
              <div className={`${c.noteCell} ${c.eyebrow}`}>Observation</div>
            </div>
            {slotNotes.length === 0 && (
              <div className={c.noteRow}>
                <div className={c.noteCell}>—</div>
                <div className={c.noteCell}><span className={c.muted}>No notes captured yet — be the first to drop one above.</span></div>
              </div>
            )}
            {slotNotes.map(n => (
              <div key={n._id} className={c.noteRow}>
                <div className={c.noteCell}>{new Date(n.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                <div className={c.noteCell}>{n.text}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="participants" className={c.section}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabelFilled}>The Floor</span>
              <span className={c.eyebrow} style={{fontSize:"0.65rem"}}>Live Participant Board</span>
            </div>
          </div>
          <div className={c.participantGrid}>
            {sortedSlots.length === 0 && (
              <div className={c.participantCell}>
                <div className={c.participantName}>The Floor</div>
                <div className={c.muted} style={{fontSize:"0.75rem"}}>No participants yet</div>
                <div className={c.clock}>—</div>
              </div>
            )}
            {sortedSlots.map(slot => (
              <div key={slot._id} className={c.participantCell}>
                <div className={c.participantName}>{slot.owner || "Unassigned"}</div>
                <div className={c.muted} style={{fontSize:"0.75rem"}}>
                  {slot.status === "live" ? `In: ${slot.title}` : slot.status === "done" ? `Done · ${slot.title}` : `Standing By · ${slot.time}`}
                </div>
                <div className={c.clock}>{slot.status === "live" ? fmtClock(sinceHandoffMs) : slot.handoffAt ? new Date(slot.handoffAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="archive" className={c.section}>
          <div className={c.sectionInner}>
            <div className={c.sectionHead}>
              <span className={c.sectionLabel}>The Archive</span>
              <span className={c.eyebrow} style={{fontSize:"0.65rem"}}>Saved Days</span>
            </div>
          </div>
          <div className={c.table}>
            <div className={c.tableHead} style={{fontSize:"0.6rem"}}>
              <div className={c.tableHeadCell}>Date</div>
              <div className={c.tableHeadCell}>Customer</div>
              <div className={c.tableHeadCell}>Slots</div>
              <div className={c.tableHeadCell}>Notes</div>
              <div className={c.tableHeadCell}>Action</div>
            </div>
            <div className={c.tableRow}>
              <div className={c.tableCell}>{new Date().toLocaleDateString()}</div>
              <div className={c.tableCell}>Today's Visit</div>
              <div className={c.tableCell}>{sortedSlots.length}</div>
              <div className={c.tableCell}>{allNotes.length}</div>
              <div className={c.tableCell}><button className={c.btn} onClick={() => window.print()}>Print →</button></div>
            </div>
          </div>
        </section>

      </main>

      <footer className={c.footer}>
        End Of Edition — Printed For The Debrief
      </footer>
    </div>
  )
}