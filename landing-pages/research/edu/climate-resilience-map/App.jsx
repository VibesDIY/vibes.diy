import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("tidewatch")
  const { doc: obsDoc, merge: mergeObs, submit: submitObs } = useDocument({
    type: "observation", block: "", category: "Flooding intersection", notes: "",
    severity: "", equityFlag: "", createdAt: Date.now(),
    authorUserSlug: viewer?.userSlug, authorName: viewer?.displayName ?? viewer?.userSlug, authorAvatar: viewer?.avatarUrl,
  })
  const { docs: observations } = useLiveQuery("type", { key: "observation", descending: true })
  const [obsLoading, setObsLoading] = React.useState(false)

  async function tagAndSubmitObs(e) {
    e.preventDefault()
    if (!obsDoc.block.trim() || !obsDoc.notes.trim()) return
    setObsLoading(true)
    try {
      const res = await callAI(`Analyze this neighborhood climate vulnerability observation. Block: ${obsDoc.block}. Category: ${obsDoc.category}. Notes: ${obsDoc.notes}. Return severity (low/medium/high) and equityFlag (none/elevated/critical).`, {
        schema: { properties: { severity: { type: "string" }, equityFlag: { type: "string" } } }
      })
      const tags = JSON.parse(res)
      await database.put({ ...obsDoc, severity: tags.severity, equityFlag: tags.equityFlag, _id: undefined })
      mergeObs({ block: "", notes: "", severity: "", equityFlag: "" })
    } finally { setObsLoading(false) }
  }

  async function suggestObsExample() {
    setObsLoading(true)
    try {
      const res = await callAI(`Suggest a realistic example of a neighborhood climate vulnerability observation for category "${obsDoc.category}". Include a plausible block name and 1-2 sentence notes.`, {
        schema: { properties: { block: { type: "string" }, notes: { type: "string" } } }
      })
      const ex = JSON.parse(res)
      mergeObs(ex)
    } finally { setObsLoading(false) }
  }

  const { doc: evtDoc, merge: mergeEvt, submit: submitEvt } = useDocument({ type: "event", date: "", title: "" })
  const { docs: events } = useLiveQuery((d) => d.type === "event" ? d.date : undefined)

  const { doc: msgDoc, merge: mergeMsg, submit: submitMsg } = useDocument({
    type: "message", text: "", createdAt: Date.now(),
    authorUserSlug: viewer?.userSlug, authorName: viewer?.displayName ?? viewer?.userSlug, authorAvatar: viewer?.avatarUrl,
  })
  const { docs: messages } = useLiveQuery("type", { key: "message", descending: true, limit: 30 })

  const { doc: draftDoc, merge: mergeDraft, save: saveDraftDoc } = useDocument({ _id: "shared-comment-draft", text: "", suggestion: "", lastEditor: "" })
  const [draftLoading, setDraftLoading] = React.useState(false)
  async function saveDraft() {
    await database.put({ ...draftDoc, lastEditor: viewer?.displayName ?? viewer?.userSlug ?? "anon" })
  }
  async function strengthenDraft() {
    if (!draftDoc.text?.trim()) return
    setDraftLoading(true)
    try {
      const res = await callAI(`This is a community public comment draft on a city climate resilience plan. Strengthen the language, add policy-specific framing where appropriate, and keep the community voice. Original:\n\n${draftDoc.text}`, {
        schema: { properties: { suggestion: { type: "string" } } }
      })
      const out = JSON.parse(res)
      mergeDraft({ suggestion: out.suggestion })
    } finally { setDraftLoading(false) }
  }

  const mapRef = React.useRef(null)
  React.useEffect(() => {
    if (!mapRef.current) return
    const svg = d3.select(mapRef.current)
    svg.selectAll("*").remove()
    const blocks = Array.from(d3.group(observations, o => o.block), ([block, obs]) => {
      const sev = obs.map(o => o.severity === "high" ? 3 : o.severity === "medium" ? 2 : 1)
      return { block, max: d3.max(sev) || 1, count: obs.length }
    })
    const cols = 5
    const cellW = 70, cellH = 50, gap = 8
    const color = d3.scaleOrdinal().domain([1, 2, 3]).range(["#333", "#999", "#ffffff"])
    svg.selectAll("g").data(blocks).enter().append("g")
      .attr("transform", (d, i) => `translate(${(i % cols) * (cellW + gap) + 10},${Math.floor(i / cols) * (cellH + gap) + 10})`)
      .each(function(d) {
        const g = d3.select(this)
        g.append("rect").attr("width", cellW).attr("height", cellH).attr("fill", color(d.max)).attr("stroke", "#1a1a1a").attr("rx", 4)
        g.append("text").attr("x", 6).attr("y", 18).attr("fill", d.max === 3 ? "#030303" : "#eaeaea").attr("font-size", 9).attr("font-family", "monospace").text(d.block.slice(0, 12))
        g.append("text").attr("x", 6).attr("y", cellH - 8).attr("fill", d.max === 3 ? "#030303" : "#666").attr("font-size", 9).attr("font-family", "monospace").text(`${d.count} obs`)
      })
    if (blocks.length === 0) {
      svg.append("text").attr("x", 200).attr("y", 120).attr("text-anchor", "middle").attr("fill", "#666").attr("font-family", "monospace").attr("font-size", 11).text("no observations yet")
    }
  }, [observations])

  const c = {
    page: "min-h-screen bg-[#030303] text-[#eaeaea] font-sans",
    header: "sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between",
    brand: "font-mono text-lg tracking-wider text-[#ffffff]",
    tagline: "text-xs text-[#666] font-mono",
    main: "max-w-4xl mx-auto px-4 py-5 space-y-5 pb-24",
    section: "bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4",
    h2: "font-mono text-sm tracking-widest text-[#eaeaea] uppercase mb-3",
    btn: "min-h-[44px] px-4 py-3 bg-[#ffffff] text-[#030303] font-mono text-sm rounded hover:opacity-80 disabled:opacity-40",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#1a1a1a] text-[#eaeaea] font-mono text-xs rounded hover:bg-[#1a1a1a]",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#030303] border border-[#1a1a1a] rounded text-[#eaeaea] font-mono text-sm focus:outline-none focus:border-[#666]",
    textarea: "w-full px-3 py-2 bg-[#030303] border border-[#1a1a1a] rounded text-[#eaeaea] font-mono text-sm focus:outline-none focus:border-[#666] min-h-[100px]",
    muted: "text-[#666] text-xs font-mono",
    row: "flex items-start gap-3 py-2 border-b border-[#1a1a1a] last:border-b-0",
    avatar: "w-7 h-7 rounded-full border border-[#1a1a1a]",
    tag: "inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-[#1a1a1a] text-[#eaeaea] mr-1",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.brand}>TIDEWATCH</div>
          <div className={c.tagline}>coastal resilience · collective memory</div>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            <span className="font-mono text-xs text-[#eaeaea] hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="block-map" className={c.section}>
          <h2 className={c.h2}>Vulnerability Map</h2>
          <div className="overflow-x-auto">
            <svg ref={mapRef} width="100%" height="240" viewBox="0 0 400 240"></svg>
          </div>
          <div className="flex gap-3 mt-2 flex-wrap text-xs font-mono">
            <span className="text-[#666]">▪ low</span>
            <span className="text-[#999]">▪ medium</span>
            <span className="text-[#ffffff]">▪ high</span>
            <span className={c.muted}>· {observations.length} observations across {new Set(observations.map(o => o.block)).size} blocks</span>
          </div>
        </section>

        <section id="observations" className={c.section}>
          <h2 className={c.h2}>Log Block Observation</h2>
          {can("write") ? (
            <form className="space-y-3" onSubmit={tagAndSubmitObs}>
              <input className={c.input} placeholder="Block (e.g. Maple & 4th)" value={obsDoc.block} onChange={(e) => mergeObs({ block: e.target.value })} />
              <select className={c.input} value={obsDoc.category} onChange={(e) => mergeObs({ category: e.target.value })}>
                <option>Flooding intersection</option>
                <option>No AC household</option>
                <option>Mobility concern</option>
                <option>No tree canopy / heat island</option>
              </select>
              <textarea className={c.textarea} placeholder="Describe what you observed..." value={obsDoc.notes} onChange={(e) => mergeObs({ notes: e.target.value })} />
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={c.btnGhost} onClick={suggestObsExample} disabled={obsLoading}>✦ Suggest example</button>
                <button type="submit" className={c.btn} disabled={obsLoading}>
                  {obsLoading ? (
                    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                  ) : "Submit observation"}
                </button>
              </div>
            </form>
          ) : (
            <p className={c.muted}>Read-only view — contact the group to request write access.</p>
          )}
          <div className="mt-4">
            {observations.length === 0 ? (
              <div className={c.muted}>No observations yet.</div>
            ) : observations.slice(0, 8).map((o) => (
              <div key={o._id} className={c.row}>
                {o.authorAvatar && <img src={o.authorAvatar} alt="" className={c.avatar} />}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-[#eaeaea]">{o.block}</div>
                  <div className={c.muted}>{o.category} · by {o.authorName ?? "anon"}</div>
                  <div className="text-xs text-[#eaeaea] mt-1">{o.notes}</div>
                  <div className="mt-1">
                    {o.severity && <span className={c.tag}>severity: {o.severity}</span>}
                    {o.equityFlag && o.equityFlag !== "none" && <span className={c.tag}>equity: {o.equityFlag}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="comment-draft" className={c.section}>
          <h2 className={c.h2}>Public Comment Draft</h2>
          <div className={c.muted + " mb-2"}>Collective working draft — visible to all members. Last edited by {draftDoc.lastEditor ?? "—"}.</div>
          {can("write") ? (
            <>
              <textarea className={c.textarea} placeholder="Begin the group's public comment on the city resilience plan..." value={draftDoc.text ?? ""} onChange={(e) => mergeDraft({ text: e.target.value })} />
              <div className="flex gap-2 mt-2 flex-wrap">
                <button type="button" className={c.btnGhost} onClick={strengthenDraft} disabled={draftLoading}>
                  {draftLoading ? "..." : "✦ Strengthen language"}
                </button>
                <button type="button" className={c.btn} onClick={saveDraft} disabled={draftLoading}>Save draft</button>
              </div>
              {draftDoc.suggestion && (
                <div className="mt-3 p-3 border border-[#1a1a1a] rounded bg-[#030303]">
                  <div className={c.muted + " mb-1"}>Suggested revision:</div>
                  <div className="text-sm text-[#eaeaea] whitespace-pre-wrap">{draftDoc.suggestion}</div>
                  <button type="button" className={c.btnGhost + " mt-2"} onClick={() => mergeDraft({ text: draftDoc.suggestion, suggestion: "" })}>Accept</button>
                </div>
              )}
            </>
          ) : (
            <div className="whitespace-pre-wrap text-sm text-[#eaeaea] p-3 border border-[#1a1a1a] rounded bg-[#030303]">{draftDoc.text || "No draft yet."}</div>
          )}
        </section>

        <section id="calendar" className={c.section}>
          <h2 className={c.h2}>Meetings & Workshops</h2>
          {can("write") && (
            <form className="flex flex-col sm:flex-row gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); if (evtDoc.date && evtDoc.title) submitEvt() }}>
              <input type="date" className={c.input + " sm:flex-1"} value={evtDoc.date} onChange={(e) => mergeEvt({ date: e.target.value })} />
              <input className={c.input + " sm:flex-1"} placeholder="Event title" value={evtDoc.title} onChange={(e) => mergeEvt({ title: e.target.value })} />
              <button type="submit" className={c.btn}>Add</button>
            </form>
          )}
          {events.length === 0 ? <div className={c.muted}>No events yet.</div> : events.map(ev => (
            <div key={ev._id} className={c.row}>
              <div className="font-mono text-xs text-[#666] w-24 shrink-0">{ev.date}</div>
              <div className="flex-1 font-mono text-sm text-[#eaeaea]">{ev.title}</div>
            </div>
          ))}
        </section>

        <section id="discussions" className={c.section}>
          <h2 className={c.h2}>Climate Justice Discussion</h2>
          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
            {messages.length === 0 ? <div className={c.muted}>Start the conversation.</div> : messages.map(m => (
              <div key={m._id} className={c.row}>
                {m.authorAvatar && <img src={m.authorAvatar} alt="" className={c.avatar} />}
                <div className="flex-1">
                  <div className="font-mono text-xs text-[#666]">{m.authorName ?? "anon"}</div>
                  <div className="text-sm text-[#eaeaea] whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
          </div>
          {can("write") && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msgDoc.text.trim()) submitMsg() }}>
              <input className={c.input + " flex-1"} placeholder="Share a thought, ask a question..." value={msgDoc.text} onChange={(e) => mergeMsg({ text: e.target.value })} />
              <button type="submit" className={c.btn}>Post</button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}