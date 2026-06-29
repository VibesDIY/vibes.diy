import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("clean-deputy")

  const { doc: form, merge: mergeForm, submit: submitForm, reset: resetForm } = useDocument({
    type: "incident",
    location: "Kitchen",
    zone: "",
    complaint: "",
    roast: "",
    _files: {},
    createdAt: Date.now(),
  })

  const { docs: incidents } = useLiveQuery("type", { key: "incident", descending: true, limit: 20 })
  const { docs: reactions } = useLiveQuery("type", { key: "reaction" })

  const [isFiling, setIsFiling] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  const zoneCounts = incidents.reduce((acc, d) => {
    const k = `${d.zone || "Unspecified"} · ${d.location}`
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const leaders = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.incidentId] = acc[r.incidentId] || {}
    acc[r.incidentId][r.kind] = (acc[r.incidentId][r.kind] || 0) + 1
    return acc
  }, {})

  const escalated = incidents.filter(i => i.escalated).length

  async function handleFileReport(e) {
    e.preventDefault()
    if (!form.complaint.trim()) return
    setIsFiling(true)
    try {
      const prompt = `You are a deadpan municipal "Clean Deputy" filing an official roast report on a shared-living mess. Location: ${form.location}. Zone: ${form.zone || "unspecified"}. Complaint: ${form.complaint}. Write a SHORT (2-3 sentence) playful roast in the voice of a hall-monitor bureaucrat. Keep it funny, not mean.`
      const resp = await callAI(prompt, { schema: { properties: { roast: { type: "string" } } } })
      const { roast } = JSON.parse(resp)
      mergeForm({ roast })
      await submitForm()
      resetForm()
    } finally {
      setIsFiling(false)
    }
  }

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const resp = await callAI("Generate one funny shared-living mess complaint a roommate might file anonymously. Return short text under 100 chars.", { schema: { properties: { complaint: { type: "string" }, location: { type: "string" }, zone: { type: "string" } } } })
      const ex = JSON.parse(resp)
      mergeForm({ complaint: ex.complaint, location: ex.location || form.location, zone: ex.zone || form.zone })
    } finally {
      setIsSuggesting(false)
    }
  }

  function handleReact(incidentId, kind) {
    database.put({ type: "reaction", incidentId, kind, createdAt: Date.now() })
  }

  function handleEscalate(incident) {
    database.put({ ...incident, escalated: !incident.escalated })
  }

  const Spinner = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin inline">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="40 60" strokeLinecap="round" />
    </svg>
  )

  const c = {
    page: "min-h-screen pb-24 bg-[#f5f1e8] text-[#1a1625]",
    header: "sticky top-0 z-20 border-b-[3px] border-[#1a1625] bg-[#1a1625] px-4 py-3 flex items-center justify-between shadow-[0_3px_0_0_#d6371c]",
    badge: "w-10 h-10 border-[3px] border-[#d6371c] bg-[#d6371c] text-white flex items-center justify-center font-bold shadow-[3px_3px_0_0_#d6371c]",
    brand: "flex items-center gap-3",
    brandText: "uppercase tracking-tight font-bold text-lg leading-none text-white",
    brandSub: "uppercase tracking-widest text-[0.6rem] mt-1 text-[#cccdc8]",
    navTabs: "flex gap-2",
    tab: "px-3 py-2 border-[3px] border-[#cccdc8] bg-transparent text-white uppercase text-[0.7rem] font-bold tracking-wider shadow-[3px_3px_0_0_#d6371c] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all hover:border-white",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-8",
    section: "border-[3px] border-[#1a1625] bg-white p-5 space-y-4 shadow-[4px_4px_0_0_#1a1625]",
    sectionLabel: "uppercase tracking-widest text-[0.65rem] font-bold text-[#6b6478]",
    sectionTitle: "uppercase tracking-tight font-bold text-2xl leading-none",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3",
    statCard: "border-[3px] border-[#1a1625] overflow-hidden shadow-[3px_3px_0_0_#1a1625]",
    statHead: "px-3 py-2 border-b-[3px] border-[#1a1625] uppercase text-[0.65rem] font-bold tracking-widest",
    statBody: "px-3 py-4",
    statNum: "font-mono text-2xl font-bold leading-none",
    statUnit: "uppercase text-[0.6rem] tracking-widest mt-1 text-[#6b6478]",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-4",
    field: "space-y-2",
    label: "uppercase tracking-widest text-[0.65rem] font-bold block",
    input: "w-full border-[3px] border-[#1a1625] bg-white px-3 py-3 text-sm min-h-[44px] focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0_0_#1a1625] transition-all",
    textarea: "w-full border-[3px] border-[#1a1625] bg-white px-3 py-3 text-sm min-h-[88px] focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0_0_#1a1625] transition-all",
    select: "w-full border-[3px] border-[#1a1625] bg-white px-3 py-3 text-sm min-h-[44px]",
    dropzone: "border-[3px] border-dashed border-[#1a1625] bg-[#faf6ec] p-6 text-center min-h-[120px] flex items-center justify-center",
    btnPrimary: "px-5 py-3 border-[3px] border-[#1a1625] bg-[#d6371c] text-white uppercase font-bold text-sm tracking-wider min-h-[44px] shadow-[4px_4px_0_0_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60",
    btnSecondary: "px-4 py-3 border-[3px] border-[#1a1625] bg-[#f0c419] uppercase font-bold text-xs tracking-wider min-h-[44px] shadow-[3px_3px_0_0_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnGhost: "px-3 py-2 border-[3px] border-[#1a1625] bg-white uppercase font-bold text-xs tracking-wider hover:shadow-[3px_3px_0_0_#1a1625] transition-all",
    feed: "space-y-4",
    incident: "border-[3px] border-[#1a1625] bg-white overflow-hidden shadow-[4px_4px_0_0_#1a1625]",
    incidentHead: "px-4 py-2 border-b-[3px] border-[#1a1625] bg-[#2952cc] text-white flex items-center justify-between",
    incidentCase: "font-mono text-[0.7rem] uppercase tracking-widest font-bold",
    incidentBody: "p-4 space-y-3",
    incidentImg: "w-full aspect-video border-[3px] object-cover",
    roastBox: "border-[3px] border-[#1a1625] bg-[#faf6ec] p-3",
    roastLabel: "uppercase text-[0.6rem] font-bold tracking-widest mb-1 text-[#d6371c]",
    roastText: "text-sm italic leading-relaxed",
    reactRow: "flex flex-wrap gap-2 pt-2",
    reactBtn: "px-3 py-2 border-[3px] border-[#1a1625] bg-white text-xs font-bold uppercase tracking-wider min-h-[40px] flex items-center gap-2 hover:bg-[#f0c419] transition-colors",
    leaderRow: "flex items-center justify-between border-b-2 border-[#1a1625] py-3 hover:bg-[#f0c419] transition-colors px-2",
    leaderRank: "font-mono font-bold text-lg w-8",
    leaderName: "flex-1 font-bold uppercase text-sm tracking-wide",
    leaderCount: "font-mono font-bold text-sm",
    badgeActive: "px-2 py-1 border-[2px] border-[#1a1625] bg-[#3a9b3a] uppercase text-[0.6rem] font-bold tracking-widest",
    actionBar: "fixed bottom-0 inset-x-0 border-t-[3px] border-[#1a1625] bg-white px-4 py-3 z-20 shadow-[0_-3px_0_0_#1a1625]",
    actionInner: "max-w-[920px] mx-auto flex items-center justify-between gap-3",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.badge}>CD</div>
          <div>
            <div className={c.brandText}>Clean Deputy</div>
            <div className={c.brandSub}>Dept. Of Communal Order</div>
          </div>
        </div>
        <nav className={c.navTabs}>
          <button className={c.tab}>Feed</button>
          <button className={c.tab}>Board</button>
        </nav>
      </header>

      <main id="app">
        <div className={c.main}>

          <section id="stats" className={c.section}>
            <div className={c.sectionLabel}>Bureau Statistics</div>
            <div className={c.statRow}>
              <div className={c.statCard}>
                <div className={`${c.statHead} bg-[#d6371c] text-white`}>Open Cases</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{incidents.filter(i => !i.escalated).length}</div>
                  <div className={c.statUnit}>Active</div>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHead} bg-[#f0c419]`}>Citations</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{incidents.length}</div>
                  <div className={c.statUnit}>Filed</div>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHead} bg-[#2952cc] text-white`}>Reactions</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{reactions.length}</div>
                  <div className={c.statUnit}>Logged</div>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHead} bg-[#3a9b3a]`}>Legends</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{escalated}</div>
                  <div className={c.statUnit}>Escalated</div>
                </div>
              </div>
            </div>
          </section>

          <section id="file-report" className={c.section}>
            <div>
              <div className={c.sectionLabel}>Form 7B</div>
              <div className={c.sectionTitle}>File An Incident</div>
            </div>
            <form onSubmit={handleFileReport} className="space-y-4">
              <div className={c.formGrid}>
                <div className={c.field}>
                  <label className={c.label}>Location</label>
                  <select className={c.select} value={form.location} onChange={(e) => mergeForm({ location: e.target.value })}>
                    <option>Kitchen</option>
                    <option>Bathroom</option>
                    <option>Hallway</option>
                    <option>Laundry Room</option>
                    <option>Common Lounge</option>
                  </select>
                </div>
                <div className={c.field}>
                  <label className={c.label}>Zone Code</label>
                  <input className={c.input} placeholder="Floor 3, Apt 4B, etc." value={form.zone} onChange={(e) => mergeForm({ zone: e.target.value })} />
                </div>
              </div>
              <div className={c.field}>
                <label className={c.label}>Complaint</label>
                <textarea className={c.textarea} placeholder="Describe the scene of the crime..." value={form.complaint} onChange={(e) => mergeForm({ complaint: e.target.value })} />
              </div>
              <div className={c.field}>
                <label className={c.label}>Evidence Photo</label>
                <label className={c.dropzone}>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) mergeForm({ _files: { evidence: f } }) }} />
                  <span className="uppercase text-xs tracking-widest font-bold">{form._files?.evidence ? "Evidence Attached ✓" : "Tap to upload evidence"}</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isFiling} className={c.btnPrimary}>
                  {isFiling ? <><Spinner /> Filing...</> : "Submit Citation"}
                </button>
                <button type="button" disabled={isSuggesting} onClick={handleSuggest} className={c.btnSecondary}>
                  {isSuggesting ? <><Spinner /> Thinking...</> : "Suggest Example"}
                </button>
              </div>
            </form>
          </section>

          <section id="feed" className={c.section}>
            <div className="flex items-baseline justify-between">
              <div>
                <div className={c.sectionLabel}>Public Record</div>
                <div className={c.sectionTitle}>Recent Citations</div>
              </div>
              <span className={c.badgeActive}>Live</span>
            </div>
            <div className={c.feed}>
              {incidents.length === 0 && (
                <p className="text-sm text-[#6b6478] italic">No citations on the books. Be the first deputy to file one.</p>
              )}
              {incidents.map((d) => {
                const counts = reactionCounts[d._id] || {}
                const caseNum = String(d._id).slice(-5).toUpperCase()
                return (
                  <article key={d._id} className={c.incident}>
                    <div className={c.incidentHead}>
                      <span className={c.incidentCase}>Case #{caseNum} · {d.location}{d.zone ? ` · ${d.zone}` : ""}</span>
                      <span className={`${c.badgeActive} ${d.escalated ? "bg-[#d6371c] text-white" : ""}`}>{d.escalated ? "Legend" : "Active"}</span>
                    </div>
                    <div className={c.incidentBody}>
                      {d._files?.evidence?.url && <img src={d._files.evidence.url} alt="evidence" className={c.incidentImg} />}
                      <p className="text-sm font-bold">{d.complaint}</p>
                      {d.roast && (
                        <div className={c.roastBox}>
                          <div className={c.roastLabel}>Deputy's Report</div>
                          <p className={c.roastText}>{d.roast}</p>
                        </div>
                      )}
                      <div className={c.reactRow}>
                        <button onClick={() => handleReact(d._id, "skull")} className={c.reactBtn}>Skull · {counts.skull || 0}</button>
                        <button onClick={() => handleReact(d._id, "alarm")} className={c.reactBtn}>Alarm · {counts.alarm || 0}</button>
                        <button onClick={() => handleReact(d._id, "soap")} className={c.reactBtn}>Soap · {counts.soap || 0}</button>
                        <button onClick={() => handleReact(d._id, "trophy")} className={c.reactBtn}>Trophy · {counts.trophy || 0}</button>
                        <button onClick={() => handleEscalate(d)} className={c.btnGhost}>{d.escalated ? "Demote" : "Escalate"}</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section id="leaderboard" className={c.section}>
            <div>
              <div className={c.sectionLabel}>Hall Of Dishonor</div>
              <div className={c.sectionTitle}>Most Cited Zones</div>
            </div>
            <ul>
              {leaders.length === 0 && <li className="text-sm text-[#6b6478] italic py-2">Leaderboard empty. File a citation to seed dishonor.</li>}
              {leaders.map(([name, count], i) => (
                <li key={name} className={c.leaderRow}>
                  <span className={c.leaderRank}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={c.leaderName}>{name}</span>
                  <span className={c.leaderCount}>{count} {count === 1 ? "cite" : "cites"}</span>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </main>

      <div className={c.actionBar}>
        <div className={c.actionInner}>
          <span className="uppercase text-[0.65rem] font-bold tracking-widest">Anonymous Mode</span>
          <button className={c.btnPrimary} onClick={() => document.getElementById("file-report")?.scrollIntoView({ behavior: "smooth" })}>+ File Report</button>
        </div>
      </div>
    </div>
  )
}